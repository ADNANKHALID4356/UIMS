import React, { useState, useEffect, useCallback } from 'react';
import { useSelector } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import { useToast } from '../components/common/Toast';
import PermissionGate from '../components/PermissionGate';
import {
  ArrowLeftIcon,
  PlusIcon,
  CheckCircleIcon,
  XCircleIcon,
  ClockIcon,
  FunnelIcon,
  MagnifyingGlassIcon,
  DocumentTextIcon,
  BeakerIcon,
  TrashIcon,
  EyeIcon,
  ChartBarIcon,
} from '@heroicons/react/24/outline';

/**
 * PrescriptionsPage — Medical Industry Prescription Management
 * SRS v2.0: Prescription tracking, FEFO dispensing, partial dispensing,
 * controlled substance flags, and prescription statistics.
 */
const PrescriptionsPage = () => {
  const navigate = useNavigate();
  const toast = useToast();
  const { user: currentUser } = useSelector((state) => state.auth);
  const { industryConfig } = useSelector((state) => state.organization);

  // Data state
  const [prescriptions, setPrescriptions] = useState([]);
  const [statistics, setStatistics] = useState(null);
  const [patients, setPatients] = useState([]);
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);

  // View state
  const [activeTab, setActiveTab] = useState('list'); // 'list', 'stats'
  const [filterStatus, setFilterStatus] = useState('');
  const [searchTerm, setSearchTerm] = useState('');

  // Modal state
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showViewModal, setShowViewModal] = useState(false);
  const [showDispenseModal, setShowDispenseModal] = useState(false);
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [selectedPrescription, setSelectedPrescription] = useState(null);

  // Form state
  const [formData, setFormData] = useState({
    patient_id: '',
    patient_name: '',
    doctor_name: '',
    doctor_reg_number: '',
    prescription_date: new Date().toISOString().split('T')[0],
    diagnosis: '',
    notes: '',
    items: [],
  });

  const [cancelReason, setCancelReason] = useState('');
  const [dispenseItems, setDispenseItems] = useState([]); // [{ item_id, quantity_to_dispense }]

  // New item form
  const [newItem, setNewItem] = useState({
    product_id: '',
    product_name: '',
    dosage: '',
    frequency: '',
    duration: '',
    quantity_prescribed: '',
    notes: '',
  });

  // ─── Data Fetching ───────────────────────────────────────

  const fetchPrescriptions = useCallback(async () => {
    try {
      setLoading(true);
      const filters = {};
      if (filterStatus) filters.status = filterStatus;
      if (searchTerm) filters.search = searchTerm;

      const result = await window.electronAPI.prescription.getAll(filters);
      if (result.success) {
        setPrescriptions(result.data || []);
      }
    } catch (err) {
      console.error('Error fetching prescriptions:', err);
    } finally {
      setLoading(false);
    }
  }, [filterStatus, searchTerm]);

  const fetchStatistics = useCallback(async () => {
    try {
      const result = await window.electronAPI.prescription.getStatistics({});
      if (result.success) {
        setStatistics(result.data);
      }
    } catch (err) {
      console.error('Error fetching statistics:', err);
    }
  }, []);

  const fetchPatients = useCallback(async () => {
    try {
      const result = await window.electronAPI.farmer.getAll({});
      if (result?.success) {
        setPatients(result.data || []);
      }
    } catch (err) {
      console.error('Error fetching patients:', err);
    }
  }, []);

  const fetchProducts = useCallback(async () => {
    try {
      const result = await window.electronAPI.product.getAll({});
      if (result?.success) {
        setProducts(result.data || []);
      }
    } catch (err) {
      console.error('Error fetching products:', err);
    }
  }, []);

  useEffect(() => {
    fetchPrescriptions();
    fetchStatistics();
    fetchPatients();
    fetchProducts();
  }, [fetchPrescriptions, fetchStatistics, fetchPatients, fetchProducts]);

  // ─── Actions ─────────────────────────────────────────────

  const handleCreate = async () => {
    try {
      if (!formData.patient_name && !formData.patient_id) {
        toast.error('Patient name is required');
        return;
      }
      if (!formData.doctor_name) {
        toast.error('Doctor name is required');
        return;
      }
      if (formData.items.length === 0) {
        toast.error('At least one item is required');
        return;
      }

      const result = await window.electronAPI.prescription.create(formData, currentUser?.user_id);
      if (result.success) {
        toast.success(`Prescription ${result.data.prescription_number} created`);
        setShowCreateModal(false);
        resetForm();
        fetchPrescriptions();
        fetchStatistics();
      } else {
        toast.error(result.message || 'Failed to create prescription');
      }
    } catch (err) {
      toast.error('Error creating prescription');
    }
  };

  const handleViewDetails = async (prescriptionId) => {
    try {
      const result = await window.electronAPI.prescription.getById(prescriptionId);
      if (result.success) {
        setSelectedPrescription(result.data);
        setShowViewModal(true);
      } else {
        toast.error('Failed to load prescription');
      }
    } catch (err) {
      toast.error('Error loading prescription');
    }
  };

  const openDispenseModal = async (prescriptionId) => {
    try {
      const result = await window.electronAPI.prescription.getById(prescriptionId);
      if (result.success) {
        setSelectedPrescription(result.data);
        // Init dispense items from prescription items that are not fully dispensed
        const items = (result.data.items || [])
          .filter((i) => i.status !== 'DISPENSED' && i.status !== 'CANCELLED')
          .map((i) => ({
            item_id: i.item_id,
            product_name: i.product_name,
            quantity_prescribed: i.quantity_prescribed,
            quantity_dispensed: i.quantity_dispensed || 0,
            quantity_to_dispense: (i.quantity_prescribed || 0) - (i.quantity_dispensed || 0),
          }));
        setDispenseItems(items);
        setShowDispenseModal(true);
      }
    } catch (err) {
      toast.error('Error loading prescription');
    }
  };

  const handleDispense = async () => {
    try {
      if (!selectedPrescription) return;
      const itemsToDispense = dispenseItems.filter((i) => i.quantity_to_dispense > 0);
      if (itemsToDispense.length === 0) {
        toast.error('No items to dispense');
        return;
      }

      const result = await window.electronAPI.prescription.dispense(
        selectedPrescription.prescription_id,
        itemsToDispense,
        currentUser?.user_id
      );

      if (result.success) {
        toast.success(result.message || 'Items dispensed successfully');
        setShowDispenseModal(false);
        setSelectedPrescription(null);
        setDispenseItems([]);
        fetchPrescriptions();
        fetchStatistics();
      } else {
        toast.error(result.message || 'Dispensing failed');
      }
    } catch (err) {
      toast.error('Error dispensing items');
    }
  };

  const handleCancel = async () => {
    try {
      if (!selectedPrescription) return;
      const result = await window.electronAPI.prescription.cancel(
        selectedPrescription.prescription_id,
        cancelReason,
        currentUser?.user_id
      );
      if (result.success) {
        toast.success('Prescription cancelled');
        setShowCancelModal(false);
        setCancelReason('');
        setSelectedPrescription(null);
        fetchPrescriptions();
        fetchStatistics();
      } else {
        toast.error(result.message || 'Failed to cancel');
      }
    } catch (err) {
      toast.error('Error cancelling prescription');
    }
  };

  // ─── Item helpers ────────────────────────────────────────

  const addItemToForm = () => {
    if (!newItem.product_id && !newItem.product_name) {
      toast.error('Select a product');
      return;
    }
    if (!newItem.quantity_prescribed || parseInt(newItem.quantity_prescribed) <= 0) {
      toast.error('Quantity must be greater than 0');
      return;
    }
    setFormData((prev) => ({
      ...prev,
      items: [...prev.items, { ...newItem, quantity_prescribed: parseInt(newItem.quantity_prescribed) }],
    }));
    setNewItem({
      product_id: '',
      product_name: '',
      dosage: '',
      frequency: '',
      duration: '',
      quantity_prescribed: '',
      notes: '',
    });
  };

  const removeItemFromForm = (index) => {
    setFormData((prev) => ({
      ...prev,
      items: prev.items.filter((_, i) => i !== index),
    }));
  };

  const resetForm = () => {
    setFormData({
      patient_id: '',
      patient_name: '',
      doctor_name: '',
      doctor_reg_number: '',
      prescription_date: new Date().toISOString().split('T')[0],
      diagnosis: '',
      notes: '',
      items: [],
    });
    setNewItem({
      product_id: '',
      product_name: '',
      dosage: '',
      frequency: '',
      duration: '',
      quantity_prescribed: '',
      notes: '',
    });
  };

  // ─── Status helpers ──────────────────────────────────────

  const statusBadge = (status) => {
    const map = {
      PENDING: 'bg-yellow-100 text-yellow-800',
      PARTIALLY_DISPENSED: 'bg-blue-100 text-blue-800',
      DISPENSED: 'bg-green-100 text-green-800',
      CANCELLED: 'bg-red-100 text-red-800',
    };
    return (
      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${map[status] || 'bg-gray-100 text-gray-800'}`}>
        {(status || '').replace(/_/g, ' ')}
      </span>
    );
  };

  const currency = industryConfig?.currency || 'PKR';

  // ─── Render ──────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate('/dashboard')}
            className="p-2 hover:bg-gray-200 rounded-lg transition-colors"
          >
            <ArrowLeftIcon className="w-5 h-5 text-gray-600" />
          </button>
          <div>
            <h1 className="text-2xl font-bold text-gray-800">Prescriptions</h1>
            <p className="text-sm text-gray-500">Medical prescription management & dispensing</p>
          </div>
        </div>
        <PermissionGate permission="can_create_entities">
          <button
            onClick={() => {
              resetForm();
              setShowCreateModal(true);
            }}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            <PlusIcon className="w-5 h-5" />
            New Prescription
          </button>
        </PermissionGate>
      </div>

      {/* Statistics Cards */}
      {statistics?.summary && (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">
          <div className="bg-white p-4 rounded-lg shadow-sm border">
            <p className="text-xs text-gray-500 uppercase">Total</p>
            <p className="text-2xl font-bold text-gray-800">{statistics.summary.total_prescriptions || 0}</p>
          </div>
          <div className="bg-white p-4 rounded-lg shadow-sm border">
            <p className="text-xs text-gray-500 uppercase">Pending</p>
            <p className="text-2xl font-bold text-yellow-600">{statistics.summary.pending || 0}</p>
          </div>
          <div className="bg-white p-4 rounded-lg shadow-sm border">
            <p className="text-xs text-gray-500 uppercase">Partially Dispensed</p>
            <p className="text-2xl font-bold text-blue-600">{statistics.summary.partially_dispensed || 0}</p>
          </div>
          <div className="bg-white p-4 rounded-lg shadow-sm border">
            <p className="text-xs text-gray-500 uppercase">Dispensed</p>
            <p className="text-2xl font-bold text-green-600">{statistics.summary.dispensed || 0}</p>
          </div>
          <div className="bg-white p-4 rounded-lg shadow-sm border">
            <p className="text-xs text-gray-500 uppercase">Cancelled</p>
            <p className="text-2xl font-bold text-red-600">{statistics.summary.cancelled || 0}</p>
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-2 mb-4">
        <button
          onClick={() => setActiveTab('list')}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
            activeTab === 'list' ? 'bg-blue-600 text-white' : 'bg-white text-gray-700 hover:bg-gray-100'
          }`}
        >
          <DocumentTextIcon className="w-4 h-4 inline mr-1 -mt-0.5" />
          Prescriptions
        </button>
        <button
          onClick={() => setActiveTab('stats')}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
            activeTab === 'stats' ? 'bg-blue-600 text-white' : 'bg-white text-gray-700 hover:bg-gray-100'
          }`}
        >
          <ChartBarIcon className="w-4 h-4 inline mr-1 -mt-0.5" />
          Analytics
        </button>
      </div>

      {/* ─── List Tab ─────────────────────────────────── */}
      {activeTab === 'list' && (
        <div className="bg-white rounded-lg shadow-sm border">
          {/* Filters */}
          <div className="p-4 border-b flex flex-wrap gap-3 items-center">
            <div className="relative flex-1 min-w-[200px]">
              <MagnifyingGlassIcon className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                placeholder="Search prescriptions..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9 pr-3 py-2 border rounded-lg w-full text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div className="flex items-center gap-2">
              <FunnelIcon className="w-4 h-4 text-gray-400" />
              <select
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value)}
                className="border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">All Statuses</option>
                <option value="PENDING">Pending</option>
                <option value="PARTIALLY_DISPENSED">Partially Dispensed</option>
                <option value="DISPENSED">Dispensed</option>
                <option value="CANCELLED">Cancelled</option>
              </select>
            </div>
          </div>

          {/* Table */}
          {loading ? (
            <div className="p-8 text-center text-gray-500">Loading...</div>
          ) : prescriptions.length === 0 ? (
            <div className="p-8 text-center text-gray-500">No prescriptions found</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 text-gray-600 text-left">
                  <tr>
                    <th className="px-4 py-3 font-medium">Rx Number</th>
                    <th className="px-4 py-3 font-medium">Patient</th>
                    <th className="px-4 py-3 font-medium">Doctor</th>
                    <th className="px-4 py-3 font-medium">Date</th>
                    <th className="px-4 py-3 font-medium">Items</th>
                    <th className="px-4 py-3 font-medium">Status</th>
                    <th className="px-4 py-3 font-medium text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {prescriptions.map((rx) => (
                    <tr key={rx.prescription_id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-4 py-3 font-mono text-xs text-blue-600">
                        {rx.prescription_number}
                      </td>
                      <td className="px-4 py-3">{rx.patient_name || '—'}</td>
                      <td className="px-4 py-3">{rx.doctor_name || '—'}</td>
                      <td className="px-4 py-3 text-gray-500">
                        {rx.prescription_date
                          ? new Date(rx.prescription_date).toLocaleDateString()
                          : '—'}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span className="bg-gray-100 text-gray-700 px-2 py-0.5 rounded-full text-xs">
                          {rx.item_count || 0}
                        </span>
                      </td>
                      <td className="px-4 py-3">{statusBadge(rx.status)}</td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            onClick={() => handleViewDetails(rx.prescription_id)}
                            className="p-1.5 text-gray-500 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors"
                            title="View Details"
                          >
                            <EyeIcon className="w-4 h-4" />
                          </button>
                          {(rx.status === 'PENDING' || rx.status === 'PARTIALLY_DISPENSED') && (
                            <PermissionGate permission="can_edit_entities">
                              <button
                                onClick={() => openDispenseModal(rx.prescription_id)}
                                className="p-1.5 text-gray-500 hover:text-green-600 hover:bg-green-50 rounded transition-colors"
                                title="Dispense"
                              >
                                <BeakerIcon className="w-4 h-4" />
                              </button>
                            </PermissionGate>
                          )}
                          {rx.status !== 'DISPENSED' && rx.status !== 'CANCELLED' && (
                            <PermissionGate permission="can_delete_entities">
                              <button
                                onClick={() => {
                                  setSelectedPrescription(rx);
                                  setCancelReason('');
                                  setShowCancelModal(true);
                                }}
                                className="p-1.5 text-gray-500 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
                                title="Cancel"
                              >
                                <XCircleIcon className="w-4 h-4" />
                              </button>
                            </PermissionGate>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ─── Analytics Tab ────────────────────────────── */}
      {activeTab === 'stats' && statistics && (
        <div className="space-y-6">
          {/* Item Summary */}
          <div className="bg-white rounded-lg shadow-sm border p-6">
            <h3 className="text-lg font-semibold text-gray-800 mb-4">Dispensing Summary</h3>
            <div className="grid grid-cols-3 gap-4">
              <div>
                <p className="text-xs text-gray-500 uppercase">Total Items</p>
                <p className="text-2xl font-bold">{statistics.items?.total_items || 0}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500 uppercase">Qty Prescribed</p>
                <p className="text-2xl font-bold">{statistics.items?.total_prescribed || 0}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500 uppercase">Qty Dispensed</p>
                <p className="text-2xl font-bold text-green-600">{statistics.items?.total_dispensed || 0}</p>
              </div>
            </div>
          </div>

          {/* Top Products */}
          {statistics.top_products?.length > 0 && (
            <div className="bg-white rounded-lg shadow-sm border p-6">
              <h3 className="text-lg font-semibold text-gray-800 mb-4">Top Prescribed Products</h3>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 text-gray-600">
                    <tr>
                      <th className="px-4 py-2 text-left font-medium">Product</th>
                      <th className="px-4 py-2 text-right font-medium">Prescriptions</th>
                      <th className="px-4 py-2 text-right font-medium">Qty Prescribed</th>
                      <th className="px-4 py-2 text-right font-medium">Qty Dispensed</th>
                      <th className="px-4 py-2 text-right font-medium">Fill Rate</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {statistics.top_products.map((prod, idx) => {
                      const fillRate =
                        prod.total_prescribed > 0
                          ? ((prod.total_dispensed || 0) / prod.total_prescribed * 100).toFixed(1)
                          : '0.0';
                      return (
                        <tr key={idx} className="hover:bg-gray-50">
                          <td className="px-4 py-2">{prod.product_name}</td>
                          <td className="px-4 py-2 text-right">{prod.prescription_count}</td>
                          <td className="px-4 py-2 text-right">{prod.total_prescribed}</td>
                          <td className="px-4 py-2 text-right">{prod.total_dispensed || 0}</td>
                          <td className="px-4 py-2 text-right">
                            <span
                              className={`font-medium ${
                                parseFloat(fillRate) >= 80
                                  ? 'text-green-600'
                                  : parseFloat(fillRate) >= 50
                                  ? 'text-yellow-600'
                                  : 'text-red-600'
                              }`}
                            >
                              {fillRate}%
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ═══════════════════════════════════════════════ */}
      {/*  CREATE MODAL                                  */}
      {/* ═══════════════════════════════════════════════ */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b">
              <h2 className="text-xl font-bold text-gray-800">New Prescription</h2>
              <p className="text-sm text-gray-500 mt-1">Create a medical prescription with items</p>
            </div>
            <div className="p-6 space-y-4">
              {/* Patient */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Patient *</label>
                  <select
                    value={formData.patient_id}
                    onChange={(e) => {
                      const selected = patients.find(
                        (p) => String(p.farmer_id) === e.target.value
                      );
                      setFormData((prev) => ({
                        ...prev,
                        patient_id: e.target.value ? parseInt(e.target.value) : '',
                        patient_name: selected?.name || '',
                      }));
                    }}
                    className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">Select patient...</option>
                    {patients.map((p) => (
                      <option key={p.farmer_id} value={p.farmer_id}>
                        {p.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Patient Name (or type)
                  </label>
                  <input
                    type="text"
                    value={formData.patient_name}
                    onChange={(e) => setFormData((prev) => ({ ...prev, patient_name: e.target.value }))}
                    className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="Patient name"
                  />
                </div>
              </div>

              {/* Doctor */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Doctor Name *</label>
                  <input
                    type="text"
                    value={formData.doctor_name}
                    onChange={(e) => setFormData((prev) => ({ ...prev, doctor_name: e.target.value }))}
                    className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="Dr. ..."
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Doctor Reg. Number
                  </label>
                  <input
                    type="text"
                    value={formData.doctor_reg_number}
                    onChange={(e) =>
                      setFormData((prev) => ({ ...prev, doctor_reg_number: e.target.value }))
                    }
                    className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="Registration number"
                  />
                </div>
              </div>

              {/* Date & Diagnosis */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Date</label>
                  <input
                    type="date"
                    value={formData.prescription_date}
                    onChange={(e) =>
                      setFormData((prev) => ({ ...prev, prescription_date: e.target.value }))
                    }
                    className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Diagnosis</label>
                  <input
                    type="text"
                    value={formData.diagnosis}
                    onChange={(e) => setFormData((prev) => ({ ...prev, diagnosis: e.target.value }))}
                    className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="Diagnosis"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
                <textarea
                  value={formData.notes}
                  onChange={(e) => setFormData((prev) => ({ ...prev, notes: e.target.value }))}
                  rows={2}
                  className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Additional notes..."
                />
              </div>

              {/* ── Items Section ── */}
              <div className="border-t pt-4">
                <h3 className="text-sm font-semibold text-gray-800 mb-3">Prescription Items</h3>

                {/* Item list */}
                {formData.items.length > 0 && (
                  <div className="mb-4 space-y-2">
                    {formData.items.map((item, idx) => (
                      <div key={idx} className="flex items-center gap-2 p-2 bg-gray-50 rounded-lg text-sm">
                        <span className="flex-1 font-medium">{item.product_name}</span>
                        <span className="text-gray-500">
                          {item.dosage && `${item.dosage} · `}
                          {item.frequency && `${item.frequency} · `}
                          {item.duration && `${item.duration} · `}
                          Qty: {item.quantity_prescribed}
                        </span>
                        <button
                          onClick={() => removeItemFromForm(idx)}
                          className="p-1 hover:bg-red-100 rounded text-red-500"
                        >
                          <TrashIcon className="w-4 h-4" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}

                {/* Add item form */}
                <div className="p-3 bg-blue-50 rounded-lg space-y-2">
                  <div className="grid grid-cols-2 gap-2">
                    <select
                      value={newItem.product_id}
                      onChange={(e) => {
                        const selected = products.find(
                          (p) => String(p.product_id) === e.target.value
                        );
                        setNewItem((prev) => ({
                          ...prev,
                          product_id: e.target.value ? parseInt(e.target.value) : '',
                          product_name: selected?.name || '',
                        }));
                      }}
                      className="border rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="">Select medicine...</option>
                      {products.map((p) => (
                        <option key={p.product_id} value={p.product_id}>
                          {p.name}
                        </option>
                      ))}
                    </select>
                    <input
                      type="number"
                      value={newItem.quantity_prescribed}
                      onChange={(e) =>
                        setNewItem((prev) => ({ ...prev, quantity_prescribed: e.target.value }))
                      }
                      className="border rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="Qty"
                      min="1"
                    />
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    <input
                      type="text"
                      value={newItem.dosage}
                      onChange={(e) => setNewItem((prev) => ({ ...prev, dosage: e.target.value }))}
                      className="border rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="Dosage (e.g. 500mg)"
                    />
                    <input
                      type="text"
                      value={newItem.frequency}
                      onChange={(e) =>
                        setNewItem((prev) => ({ ...prev, frequency: e.target.value }))
                      }
                      className="border rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="Frequency (e.g. 3x/day)"
                    />
                    <input
                      type="text"
                      value={newItem.duration}
                      onChange={(e) => setNewItem((prev) => ({ ...prev, duration: e.target.value }))}
                      className="border rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="Duration (e.g. 7 days)"
                    />
                  </div>
                  <button
                    onClick={addItemToForm}
                    className="flex items-center gap-1 px-3 py-1.5 bg-blue-600 text-white text-sm rounded hover:bg-blue-700 transition-colors"
                  >
                    <PlusIcon className="w-4 h-4" /> Add Item
                  </button>
                </div>
              </div>
            </div>
            <div className="p-4 border-t flex justify-end gap-3">
              <button
                onClick={() => setShowCreateModal(false)}
                className="px-4 py-2 border rounded-lg text-sm hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleCreate}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700 transition-colors"
              >
                Create Prescription
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════════════ */}
      {/*  VIEW DETAILS MODAL                            */}
      {/* ═══════════════════════════════════════════════ */}
      {showViewModal && selectedPrescription && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b flex items-center justify-between">
              <div>
                <h2 className="text-xl font-bold text-gray-800">
                  {selectedPrescription.prescription_number}
                </h2>
                <p className="text-sm text-gray-500 mt-1">Prescription Details</p>
              </div>
              {statusBadge(selectedPrescription.status)}
            </div>
            <div className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="text-gray-500">Patient:</span>{' '}
                  <span className="font-medium">{selectedPrescription.patient_name || '—'}</span>
                </div>
                <div>
                  <span className="text-gray-500">Doctor:</span>{' '}
                  <span className="font-medium">{selectedPrescription.doctor_name || '—'}</span>
                </div>
                <div>
                  <span className="text-gray-500">Reg. No:</span>{' '}
                  <span className="font-medium">
                    {selectedPrescription.doctor_reg_number || '—'}
                  </span>
                </div>
                <div>
                  <span className="text-gray-500">Date:</span>{' '}
                  <span className="font-medium">
                    {selectedPrescription.prescription_date
                      ? new Date(selectedPrescription.prescription_date).toLocaleDateString()
                      : '—'}
                  </span>
                </div>
                <div className="col-span-2">
                  <span className="text-gray-500">Diagnosis:</span>{' '}
                  <span className="font-medium">{selectedPrescription.diagnosis || '—'}</span>
                </div>
                {selectedPrescription.notes && (
                  <div className="col-span-2">
                    <span className="text-gray-500">Notes:</span>{' '}
                    <span>{selectedPrescription.notes}</span>
                  </div>
                )}
              </div>

              {/* Items table */}
              <div className="border-t pt-4">
                <h3 className="text-sm font-semibold text-gray-800 mb-3">Items</h3>
                {selectedPrescription.items?.length > 0 ? (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead className="bg-gray-50 text-gray-600">
                        <tr>
                          <th className="px-3 py-2 text-left font-medium">Medicine</th>
                          <th className="px-3 py-2 text-left font-medium">Dosage</th>
                          <th className="px-3 py-2 text-left font-medium">Frequency</th>
                          <th className="px-3 py-2 text-right font-medium">Prescribed</th>
                          <th className="px-3 py-2 text-right font-medium">Dispensed</th>
                          <th className="px-3 py-2 font-medium">Status</th>
                          <th className="px-3 py-2 font-medium">Batch</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y">
                        {selectedPrescription.items.map((item) => (
                          <tr key={item.item_id} className="hover:bg-gray-50">
                            <td className="px-3 py-2 font-medium">{item.product_name}</td>
                            <td className="px-3 py-2 text-gray-500">{item.dosage || '—'}</td>
                            <td className="px-3 py-2 text-gray-500">{item.frequency || '—'}</td>
                            <td className="px-3 py-2 text-right">{item.quantity_prescribed}</td>
                            <td className="px-3 py-2 text-right">{item.quantity_dispensed || 0}</td>
                            <td className="px-3 py-2">{statusBadge(item.status)}</td>
                            <td className="px-3 py-2 text-xs text-gray-500">
                              {item.batch_number || '—'}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <p className="text-gray-500 text-sm">No items</p>
                )}
              </div>
            </div>
            <div className="p-4 border-t flex justify-end">
              <button
                onClick={() => {
                  setShowViewModal(false);
                  setSelectedPrescription(null);
                }}
                className="px-4 py-2 border rounded-lg text-sm hover:bg-gray-50 transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════════════ */}
      {/*  DISPENSE MODAL                                */}
      {/* ═══════════════════════════════════════════════ */}
      {showDispenseModal && selectedPrescription && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b">
              <h2 className="text-xl font-bold text-gray-800">Dispense Items</h2>
              <p className="text-sm text-gray-500 mt-1">
                {selectedPrescription.prescription_number} — {selectedPrescription.patient_name}
              </p>
            </div>
            <div className="p-6 space-y-3">
              {dispenseItems.length === 0 ? (
                <p className="text-gray-500 text-sm">All items are fully dispensed</p>
              ) : (
                dispenseItems.map((item, idx) => {
                  const remaining = item.quantity_prescribed - item.quantity_dispensed;
                  return (
                    <div
                      key={item.item_id}
                      className="p-3 bg-gray-50 rounded-lg flex items-center gap-3"
                    >
                      <div className="flex-1">
                        <p className="text-sm font-medium">{item.product_name}</p>
                        <p className="text-xs text-gray-500">
                          Prescribed: {item.quantity_prescribed} | Dispensed:{' '}
                          {item.quantity_dispensed} | Remaining: {remaining}
                        </p>
                      </div>
                      <div>
                        <input
                          type="number"
                          min={0}
                          max={remaining}
                          value={item.quantity_to_dispense}
                          onChange={(e) => {
                            const val = Math.min(
                              Math.max(0, parseInt(e.target.value) || 0),
                              remaining
                            );
                            setDispenseItems((prev) =>
                              prev.map((di, i) =>
                                i === idx ? { ...di, quantity_to_dispense: val } : di
                              )
                            );
                          }}
                          className="w-20 border rounded px-2 py-1 text-sm text-center focus:outline-none focus:ring-2 focus:ring-green-500"
                        />
                      </div>
                    </div>
                  );
                })
              )}
            </div>
            <div className="p-4 border-t flex justify-end gap-3">
              <button
                onClick={() => {
                  setShowDispenseModal(false);
                  setSelectedPrescription(null);
                  setDispenseItems([]);
                }}
                className="px-4 py-2 border rounded-lg text-sm hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleDispense}
                disabled={dispenseItems.length === 0}
                className="px-4 py-2 bg-green-600 text-white rounded-lg text-sm hover:bg-green-700 transition-colors disabled:opacity-50"
              >
                <BeakerIcon className="w-4 h-4 inline mr-1 -mt-0.5" />
                Dispense
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════════════ */}
      {/*  CANCEL MODAL                                  */}
      {/* ═══════════════════════════════════════════════ */}
      {showCancelModal && selectedPrescription && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md">
            <div className="p-6 border-b">
              <h2 className="text-xl font-bold text-red-600">Cancel Prescription</h2>
              <p className="text-sm text-gray-500 mt-1">
                {selectedPrescription.prescription_number} — {selectedPrescription.patient_name}
              </p>
            </div>
            <div className="p-6">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Reason for cancellation
              </label>
              <textarea
                value={cancelReason}
                onChange={(e) => setCancelReason(e.target.value)}
                rows={3}
                className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-500"
                placeholder="Enter reason..."
              />
            </div>
            <div className="p-4 border-t flex justify-end gap-3">
              <button
                onClick={() => {
                  setShowCancelModal(false);
                  setSelectedPrescription(null);
                  setCancelReason('');
                }}
                className="px-4 py-2 border rounded-lg text-sm hover:bg-gray-50 transition-colors"
              >
                Go Back
              </button>
              <button
                onClick={handleCancel}
                className="px-4 py-2 bg-red-600 text-white rounded-lg text-sm hover:bg-red-700 transition-colors"
              >
                Cancel Prescription
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default PrescriptionsPage;
