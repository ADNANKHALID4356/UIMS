import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSelector } from 'react-redux';
import { useToast } from '../components/common/Toast';

const MedicineBatchesPage = () => {
  const navigate = useNavigate();
  const toast = useToast();
  const { user } = useSelector((state) => state.auth);
  const { industryConfig } = useSelector((state) => state.organization);

  const [batches, setBatches] = useState([]);
  const [products, setProducts] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterProduct, setFilterProduct] = useState('');
  const [filterExpiry, setFilterExpiry] = useState(''); // all, expired, 30, 60, 90
  const [filterControlled, setFilterControlled] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [editingBatch, setEditingBatch] = useState(null);
  const [deletingBatch, setDeletingBatch] = useState(null);
  const [expiryAlerts, setExpiryAlerts] = useState(null);
  const [statistics, setStatistics] = useState(null);

  const [formData, setFormData] = useState({
    product_id: '',
    batch_number: '',
    manufacture_date: '',
    expiry_date: '',
    quantity: '0',
    unit_price: '0',
    supplier_id: '',
    notes: '',
  });

  const [formErrors, setFormErrors] = useState({});

  // Load data
  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const filters = {};
      if (filterProduct) filters.product_id = parseInt(filterProduct);
      if (filterExpiry === 'expired') filters.expired_only = true;
      if (filterExpiry && ['30', '60', '90'].includes(filterExpiry)) filters.expiring_within_days = parseInt(filterExpiry);
      if (filterControlled) filters.controlled_only = true;
      filters.is_active = 1;

      const [batchData, productData, supplierData, alertData, statsData] = await Promise.all([
        searchTerm
          ? window.electronAPI.medicineBatch.search(searchTerm)
          : window.electronAPI.medicineBatch.getAll(filters),
        window.electronAPI.product.getAll({ is_active: 1 }),
        window.electronAPI.company.getAll(true),
        window.electronAPI.medicineBatch.getExpiryAlerts(90),
        window.electronAPI.medicineBatch.getStatistics(),
      ]);

      setBatches(batchData || []);
      setProducts(productData || []);
      setSuppliers(supplierData || []);
      setExpiryAlerts(alertData);
      setStatistics(statsData);
    } catch (error) {
      console.error('Error loading batches:', error);
      toast.error('Failed to load medicine batches');
    } finally {
      setLoading(false);
    }
  }, [filterProduct, filterExpiry, filterControlled, searchTerm]);

  useEffect(() => { loadData(); }, [loadData]);

  const resetForm = () => {
    setFormData({
      product_id: '',
      batch_number: '',
      manufacture_date: '',
      expiry_date: '',
      quantity: '0',
      unit_price: '0',
      supplier_id: '',
      notes: '',
    });
    setFormErrors({});
  };

  const validateForm = () => {
    const errors = {};
    if (!formData.product_id) errors.product_id = 'Medicine is required';
    if (!formData.batch_number.trim()) errors.batch_number = 'Batch number is required';
    if (!formData.expiry_date) errors.expiry_date = 'Expiry date is required';
    if (parseFloat(formData.quantity) < 0) errors.quantity = 'Quantity must be >= 0';
    if (parseFloat(formData.unit_price) < 0) errors.unit_price = 'Price must be >= 0';
    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validateForm()) return;

    try {
      const data = {
        product_id: parseInt(formData.product_id),
        batch_number: formData.batch_number.trim(),
        manufacture_date: formData.manufacture_date || null,
        expiry_date: formData.expiry_date,
        quantity: parseFloat(formData.quantity),
        unit_price: parseFloat(formData.unit_price),
        supplier_id: formData.supplier_id ? parseInt(formData.supplier_id) : null,
        notes: formData.notes || null,
      };

      let result;
      if (editingBatch) {
        result = await window.electronAPI.medicineBatch.update(editingBatch.batch_id, data, user.user_id);
      } else {
        result = await window.electronAPI.medicineBatch.create(data, user.user_id);
      }

      if (result?.success) {
        toast.success(editingBatch ? 'Batch updated successfully' : 'Batch created successfully');
        setShowModal(false);
        setEditingBatch(null);
        resetForm();
        loadData();
      } else {
        toast.error(result?.message || 'Operation failed');
      }
    } catch (error) {
      console.error('Error saving batch:', error);
      toast.error('Error: ' + error.message);
    }
  };

  const handleEdit = (batch) => {
    setEditingBatch(batch);
    setFormData({
      product_id: batch.product_id.toString(),
      batch_number: batch.batch_number,
      manufacture_date: batch.manufacture_date || '',
      expiry_date: batch.expiry_date || '',
      quantity: batch.quantity.toString(),
      unit_price: batch.unit_price.toString(),
      supplier_id: batch.supplier_id?.toString() || '',
      notes: batch.notes || '',
    });
    setShowModal(true);
  };

  const handleDelete = async () => {
    if (!deletingBatch) return;
    try {
      const result = await window.electronAPI.medicineBatch.delete(deletingBatch.batch_id, user.user_id);
      if (result?.success) {
        toast.success('Batch deactivated');
        setShowDeleteModal(false);
        setDeletingBatch(null);
        loadData();
      } else {
        toast.error(result?.message || 'Failed to delete');
      }
    } catch (error) {
      toast.error('Error: ' + error.message);
    }
  };

  const getExpiryBadge = (batch) => {
    if (!batch.days_until_expiry && batch.days_until_expiry !== 0) return null;
    const d = batch.days_until_expiry;
    if (d < 0) return <span className="px-2 py-1 bg-red-100 text-red-800 text-xs font-bold rounded-full">Expired ({Math.abs(d)}d ago)</span>;
    if (d <= 30) return <span className="px-2 py-1 bg-red-100 text-red-700 text-xs font-bold rounded-full">Expires in {d}d</span>;
    if (d <= 60) return <span className="px-2 py-1 bg-orange-100 text-orange-700 text-xs font-bold rounded-full">{d}d left</span>;
    if (d <= 90) return <span className="px-2 py-1 bg-yellow-100 text-yellow-700 text-xs font-bold rounded-full">{d}d left</span>;
    return <span className="px-2 py-1 bg-green-100 text-green-700 text-xs font-medium rounded-full">{d}d</span>;
  };

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-4 mb-4">
            <button onClick={() => navigate('/dashboard')} className="flex items-center gap-2 px-4 py-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" /></svg>
              Back
            </button>
          </div>
          <h1 className="text-3xl font-bold text-gray-900">Medicine Batches</h1>
          <p className="text-gray-600 mt-2">Track batch numbers, expiry dates, and controlled substances (FEFO)</p>
        </div>

        {/* Expiry Alert Summary Cards */}
        {expiryAlerts && expiryAlerts.total_alert_count > 0 && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
            <div className="bg-red-50 border-2 border-red-300 rounded-xl p-4 text-center">
              <p className="text-3xl font-bold text-red-600">{expiryAlerts.expired?.length || 0}</p>
              <p className="text-sm text-red-700 font-medium">Expired</p>
            </div>
            <div className="bg-orange-50 border-2 border-orange-300 rounded-xl p-4 text-center">
              <p className="text-3xl font-bold text-orange-600">{expiryAlerts.critical?.length || 0}</p>
              <p className="text-sm text-orange-700 font-medium">Within 30 Days</p>
            </div>
            <div className="bg-yellow-50 border-2 border-yellow-300 rounded-xl p-4 text-center">
              <p className="text-3xl font-bold text-yellow-600">{expiryAlerts.warning?.length || 0}</p>
              <p className="text-sm text-yellow-700 font-medium">31-60 Days</p>
            </div>
            <div className="bg-blue-50 border-2 border-blue-300 rounded-xl p-4 text-center">
              <p className="text-3xl font-bold text-blue-600">{expiryAlerts.notice?.length || 0}</p>
              <p className="text-sm text-blue-700 font-medium">61-90 Days</p>
            </div>
          </div>
        )}

        {/* Stats Row */}
        {statistics && (
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-6">
            <div className="bg-white rounded-lg shadow-sm p-4 text-center">
              <p className="text-2xl font-bold text-gray-800">{statistics.total_batches || 0}</p>
              <p className="text-xs text-gray-500">Total Batches</p>
            </div>
            <div className="bg-white rounded-lg shadow-sm p-4 text-center">
              <p className="text-2xl font-bold text-green-600">{statistics.active_batches || 0}</p>
              <p className="text-xs text-gray-500">Active</p>
            </div>
            <div className="bg-white rounded-lg shadow-sm p-4 text-center">
              <p className="text-2xl font-bold text-red-600">{statistics.expired_batches || 0}</p>
              <p className="text-xs text-gray-500">Expired</p>
            </div>
            <div className="bg-white rounded-lg shadow-sm p-4 text-center">
              <p className="text-2xl font-bold text-orange-600">{statistics.expiring_soon || 0}</p>
              <p className="text-xs text-gray-500">Expiring Soon</p>
            </div>
            <div className="bg-white rounded-lg shadow-sm p-4 text-center">
              <p className="text-2xl font-bold text-purple-600">Rs. {parseFloat(statistics.total_batch_value || 0).toLocaleString()}</p>
              <p className="text-xs text-gray-500">Total Value</p>
            </div>
          </div>
        )}

        {/* Search & Filters */}
        <div className="bg-white rounded-lg shadow-sm p-4 mb-6">
          <div className="flex flex-col md:flex-row md:items-center gap-4">
            <div className="flex-1">
              <input
                type="text"
                placeholder="Search by batch number, medicine name, or generic name..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent"
              />
            </div>
            <select value={filterProduct} onChange={(e) => setFilterProduct(e.target.value)} className="px-3 py-2 border border-gray-300 rounded-lg">
              <option value="">All Medicines</option>
              {products.map(p => <option key={p.product_id} value={p.product_id}>{p.product_name}</option>)}
            </select>
            <select value={filterExpiry} onChange={(e) => setFilterExpiry(e.target.value)} className="px-3 py-2 border border-gray-300 rounded-lg">
              <option value="">All Expiry</option>
              <option value="expired">Expired</option>
              <option value="30">Within 30 Days</option>
              <option value="60">Within 60 Days</option>
              <option value="90">Within 90 Days</option>
            </select>
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={filterControlled} onChange={(e) => setFilterControlled(e.target.checked)} className="w-4 h-4 text-red-600" />
              <span className="text-sm font-medium text-red-700">Controlled Only</span>
            </label>
            <button
              onClick={() => { resetForm(); setEditingBatch(null); setShowModal(true); }}
              className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg font-medium transition-colors flex items-center gap-2"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" /></svg>
              Add Batch
            </button>
          </div>
        </div>

        {/* Batches Table */}
        <div className="bg-white rounded-lg shadow-sm overflow-hidden">
          {loading ? (
            <div className="p-12 text-center text-gray-500">Loading batches...</div>
          ) : batches.length === 0 ? (
            <div className="p-12 text-center text-gray-500">
              <p className="text-lg">No medicine batches found</p>
              <p className="text-sm mt-1">Add your first batch to start tracking</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Batch #</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Medicine</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Generic / Form</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Expiry Date</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Qty</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Price</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Supplier</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Flags</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Actions</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {batches.map((batch) => (
                    <tr key={batch.batch_id} className={`hover:bg-gray-50 ${batch.days_until_expiry < 0 ? 'bg-red-50' : batch.days_until_expiry <= 30 ? 'bg-orange-50' : ''}`}>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <span className="text-sm font-mono font-medium text-gray-900">{batch.batch_number}</span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="text-sm font-medium text-gray-900">{batch.product_name}</div>
                        <div className="text-xs text-gray-500">{batch.product_code}</div>
                      </td>
                      <td className="px-4 py-3">
                        {batch.generic_name && <div className="text-xs text-gray-700">{batch.generic_name}</div>}
                        {batch.drug_form && batch.strength && <div className="text-xs text-purple-600">{batch.drug_form} · {batch.strength}</div>}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <div className="text-sm text-gray-900">{batch.expiry_date ? new Date(batch.expiry_date).toLocaleDateString('en-GB') : '—'}</div>
                        {getExpiryBadge(batch)}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <span className="text-sm font-bold text-gray-900">{parseFloat(batch.quantity).toFixed(2)}</span>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <span className="text-sm text-gray-700">Rs. {parseFloat(batch.unit_price || 0).toFixed(2)}</span>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <span className="text-sm text-gray-600">{batch.supplier_name || '—'}</span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex gap-1">
                          {batch.controlled_substance === 1 && (
                            <span className="px-1.5 py-0.5 bg-red-100 text-red-700 text-[10px] font-bold rounded">Controlled</span>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-right">
                        <button onClick={() => handleEdit(batch)} className="text-blue-600 hover:text-blue-900 mr-3" title="Edit">
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
                        </button>
                        <button onClick={() => { setDeletingBatch(batch); setShowDeleteModal(true); }} className="text-red-600 hover:text-red-900" title="Delete">
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Create/Edit Modal */}
        {showModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
              <div className="bg-gradient-to-r from-red-600 to-pink-600 text-white px-6 py-4 rounded-t-lg flex items-center justify-between">
                <div>
                  <h2 className="text-xl font-bold">{editingBatch ? 'Edit Batch' : 'Add New Batch'}</h2>
                  <p className="text-red-100 text-sm">{editingBatch ? `Updating batch ${editingBatch.batch_number}` : 'Register a new medicine batch'}</p>
                </div>
                <button onClick={() => setShowModal(false)} className="text-white hover:bg-white hover:bg-opacity-20 rounded-full p-2">
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                </button>
              </div>

              <form onSubmit={handleSubmit} className="p-6 space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Medicine */}
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-1">Medicine *</label>
                    <select
                      value={formData.product_id}
                      onChange={(e) => setFormData({ ...formData, product_id: e.target.value })}
                      className={`w-full px-3 py-2 border-2 rounded-lg ${formErrors.product_id ? 'border-red-500' : 'border-gray-300'} focus:ring-2 focus:ring-red-500`}
                    >
                      <option value="">Select Medicine</option>
                      {products.map(p => (
                        <option key={p.product_id} value={p.product_id}>
                          {p.product_name} {p.generic_name ? `(${p.generic_name})` : ''} — {p.product_code}
                        </option>
                      ))}
                    </select>
                    {formErrors.product_id && <p className="text-red-500 text-xs mt-1">{formErrors.product_id}</p>}
                  </div>

                  {/* Batch Number */}
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-1">Batch Number *</label>
                    <input
                      type="text"
                      value={formData.batch_number}
                      onChange={(e) => setFormData({ ...formData, batch_number: e.target.value })}
                      className={`w-full px-3 py-2 border-2 rounded-lg ${formErrors.batch_number ? 'border-red-500' : 'border-gray-300'} focus:ring-2 focus:ring-red-500`}
                      placeholder="e.g., BN-2025-001"
                    />
                    {formErrors.batch_number && <p className="text-red-500 text-xs mt-1">{formErrors.batch_number}</p>}
                  </div>

                  {/* Manufacture Date */}
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-1">Manufacture Date</label>
                    <input
                      type="date"
                      value={formData.manufacture_date}
                      onChange={(e) => setFormData({ ...formData, manufacture_date: e.target.value })}
                      className="w-full px-3 py-2 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500"
                    />
                  </div>

                  {/* Expiry Date */}
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-1">Expiry Date *</label>
                    <input
                      type="date"
                      value={formData.expiry_date}
                      onChange={(e) => setFormData({ ...formData, expiry_date: e.target.value })}
                      className={`w-full px-3 py-2 border-2 rounded-lg ${formErrors.expiry_date ? 'border-red-500' : 'border-gray-300'} focus:ring-2 focus:ring-red-500`}
                    />
                    {formErrors.expiry_date && <p className="text-red-500 text-xs mt-1">{formErrors.expiry_date}</p>}
                  </div>

                  {/* Quantity */}
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-1">Quantity</label>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={formData.quantity}
                      onChange={(e) => setFormData({ ...formData, quantity: e.target.value })}
                      className="w-full px-3 py-2 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500"
                    />
                  </div>

                  {/* Unit Price */}
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-1">Unit Price (PKR)</label>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={formData.unit_price}
                      onChange={(e) => setFormData({ ...formData, unit_price: e.target.value })}
                      className="w-full px-3 py-2 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500"
                    />
                  </div>

                  {/* Supplier */}
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-1">Supplier</label>
                    <select
                      value={formData.supplier_id}
                      onChange={(e) => setFormData({ ...formData, supplier_id: e.target.value })}
                      className="w-full px-3 py-2 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500"
                    >
                      <option value="">Select Supplier</option>
                      {suppliers.map(s => <option key={s.company_id} value={s.company_id}>{s.company_name}</option>)}
                    </select>
                  </div>
                </div>

                {/* Notes */}
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1">Notes</label>
                  <textarea
                    value={formData.notes}
                    onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                    className="w-full px-3 py-2 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500"
                    rows="2"
                    placeholder="Additional notes..."
                  />
                </div>

                {/* Buttons */}
                <div className="flex gap-3 pt-2">
                  <button type="button" onClick={() => setShowModal(false)} className="flex-1 px-4 py-3 border-2 border-gray-300 rounded-lg text-gray-700 font-semibold hover:bg-gray-100">
                    Cancel
                  </button>
                  <button type="submit" className="flex-1 px-4 py-3 bg-red-600 text-white rounded-lg font-semibold hover:bg-red-700">
                    {editingBatch ? 'Update Batch' : 'Create Batch'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Delete Confirmation */}
        {showDeleteModal && deletingBatch && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-lg max-w-md w-full p-6">
              <h2 className="text-xl font-bold text-gray-900 mb-2">Deactivate Batch?</h2>
              <p className="text-gray-600 mb-4">
                Deactivate batch <strong>{deletingBatch.batch_number}</strong> for <strong>{deletingBatch.product_name}</strong>?
              </p>
              <div className="flex gap-3">
                <button onClick={() => setShowDeleteModal(false)} className="flex-1 px-4 py-2 border-2 border-gray-300 rounded-lg text-gray-700 font-semibold hover:bg-gray-100">
                  Cancel
                </button>
                <button onClick={handleDelete} className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg font-semibold hover:bg-red-700">
                  Deactivate
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default MedicineBatchesPage;
