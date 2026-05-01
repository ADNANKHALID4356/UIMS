import React, { useState, useEffect, useCallback } from 'react';
import { useSelector } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import { useToast } from '../components/common/Toast';
import PermissionGate from '../components/PermissionGate';
import {
  ArrowLeftIcon,
  CurrencyDollarIcon,
  PlusIcon,
  CheckCircleIcon,
  XCircleIcon,
  ClockIcon,
  FunnelIcon,
  ChartBarIcon,
  UserGroupIcon,
  BanknotesIcon,
  MagnifyingGlassIcon,
} from '@heroicons/react/24/outline';

/**
 * CommissionsPage — Real Estate Commission Management
 * SRS v2.0: Commission tracking, splits, payments, and reporting
 */
const CommissionsPage = () => {
  const navigate = useNavigate();
  const toast = useToast();
  const { user: currentUser } = useSelector((state) => state.auth);
  const { industryConfig } = useSelector((state) => state.organization);

  // Data state
  const [commissions, setCommissions] = useState([]);
  const [statistics, setStatistics] = useState(null);
  const [agents, setAgents] = useState([]);
  const [clients, setClients] = useState([]);
  const [loading, setLoading] = useState(true);

  // View state
  const [activeTab, setActiveTab] = useState('list'); // 'list', 'stats'
  const [filterStatus, setFilterStatus] = useState('');
  const [filterAgent, setFilterAgent] = useState('');
  const [searchTerm, setSearchTerm] = useState('');

  // Modal state
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [selectedCommission, setSelectedCommission] = useState(null);

  // Form state
  const [formData, setFormData] = useState({
    deal_description: '',
    agent_id: '',
    agent_name: '',
    client_id: '',
    client_name: '',
    deal_amount: '',
    commission_rate: '2',
    commission_amount: '',
    notes: '',
  });

  const [paymentForm, setPaymentForm] = useState({
    payment_method: 'CASH',
    payment_reference: '',
  });

  const [cancelReason, setCancelReason] = useState('');

  // Load data
  const fetchCommissions = useCallback(async () => {
    try {
      setLoading(true);
      const filters = {};
      if (filterStatus) filters.status = filterStatus;
      if (filterAgent) filters.agent_id = parseInt(filterAgent);

      const result = await window.electronAPI.commission.getAll(filters);
      if (result.success) {
        setCommissions(result.data || []);
      }
    } catch (error) {
      console.error('Error fetching commissions:', error);
    } finally {
      setLoading(false);
    }
  }, [filterStatus, filterAgent]);

  const fetchStatistics = useCallback(async () => {
    try {
      const result = await window.electronAPI.commission.getStatistics({});
      if (result.success) {
        setStatistics(result.data);
      }
    } catch (error) {
      console.error('Error fetching stats:', error);
    }
  }, []);

  const fetchAgents = useCallback(async () => {
    try {
      const result = await window.electronAPI.dealer.getAll(true);
      if (result.success) setAgents(result.data || []);
    } catch (error) {
      console.error('Error fetching agents:', error);
    }
  }, []);

  const fetchClients = useCallback(async () => {
    try {
      const result = await window.electronAPI.farmer.getAll(true);
      if (result.success) setClients(result.data || []);
    } catch (error) {
      console.error('Error fetching clients:', error);
    }
  }, []);

  useEffect(() => {
    fetchCommissions();
    fetchStatistics();
    fetchAgents();
    fetchClients();
  }, [fetchCommissions, fetchStatistics, fetchAgents, fetchClients]);

  // Auto-calculate commission amount
  useEffect(() => {
    const amount = parseFloat(formData.deal_amount) || 0;
    const rate = parseFloat(formData.commission_rate) || 0;
    if (amount > 0 && rate > 0) {
      setFormData(prev => ({ ...prev, commission_amount: (amount * rate / 100).toFixed(2) }));
    }
  }, [formData.deal_amount, formData.commission_rate]);

  // Auto-fill agent name when selecting
  useEffect(() => {
    if (formData.agent_id) {
      const agent = agents.find(a => a.dealer_id === parseInt(formData.agent_id));
      if (agent) {
        setFormData(prev => ({
          ...prev,
          agent_name: agent.name,
          commission_rate: agent.commission_rate ? String(agent.commission_rate) : prev.commission_rate
        }));
      }
    }
  }, [formData.agent_id, agents]);

  // Auto-fill client name when selecting
  useEffect(() => {
    if (formData.client_id) {
      const client = clients.find(c => c.farmer_id === parseInt(formData.client_id));
      if (client) {
        setFormData(prev => ({ ...prev, client_name: client.name }));
      }
    }
  }, [formData.client_id, clients]);

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-PK', {
      style: 'currency', currency: 'PKR', minimumFractionDigits: 0
    }).format(amount || 0);
  };

  // CRUD handlers
  const handleCreate = async () => {
    if (!formData.deal_description || !formData.deal_amount) {
      toast.warning('Please fill in deal description and amount');
      return;
    }

    const result = await window.electronAPI.commission.create(
      { ...formData, deal_amount: parseFloat(formData.deal_amount), commission_rate: parseFloat(formData.commission_rate) },
      currentUser?.user_id
    );

    if (result.success) {
      toast.success('Commission recorded successfully');
      setShowCreateModal(false);
      resetForm();
      fetchCommissions();
      fetchStatistics();
    } else {
      toast.error(result.message || 'Failed to create commission');
    }
  };

  const handlePayment = async () => {
    if (!selectedCommission) return;

    const result = await window.electronAPI.commission.recordPayment(
      selectedCommission.commission_id,
      paymentForm,
      currentUser?.user_id
    );

    if (result.success) {
      toast.success('Payment recorded successfully');
      setShowPaymentModal(false);
      setSelectedCommission(null);
      setPaymentForm({ payment_method: 'CASH', payment_reference: '' });
      fetchCommissions();
      fetchStatistics();
    } else {
      toast.error(result.message || 'Failed to record payment');
    }
  };

  const handleCancel = async () => {
    if (!selectedCommission) return;

    const result = await window.electronAPI.commission.cancel(
      selectedCommission.commission_id,
      cancelReason,
      currentUser?.user_id
    );

    if (result.success) {
      toast.success('Commission cancelled');
      setShowCancelModal(false);
      setSelectedCommission(null);
      setCancelReason('');
      fetchCommissions();
      fetchStatistics();
    } else {
      toast.error(result.message || 'Failed to cancel commission');
    }
  };

  const resetForm = () => {
    setFormData({
      deal_description: '', agent_id: '', agent_name: '', client_id: '', client_name: '',
      deal_amount: '', commission_rate: '2', commission_amount: '', notes: '',
    });
  };

  const openPaymentModal = (commission) => {
    setSelectedCommission(commission);
    setShowPaymentModal(true);
  };

  const openCancelModal = (commission) => {
    setSelectedCommission(commission);
    setShowCancelModal(true);
  };

  // Filter commissions by search term
  const filteredCommissions = commissions.filter(c => {
    if (!searchTerm) return true;
    const term = searchTerm.toLowerCase();
    return (
      (c.deal_description || '').toLowerCase().includes(term) ||
      (c.agent_name || '').toLowerCase().includes(term) ||
      (c.client_name || '').toLowerCase().includes(term)
    );
  });

  const statusBadge = (status) => {
    switch (status) {
      case 'PAID':
        return <span className="inline-flex items-center gap-1 px-2 py-1 bg-green-100 text-green-700 rounded-full text-xs font-medium"><CheckCircleIcon className="h-3 w-3" />Paid</span>;
      case 'CANCELLED':
        return <span className="inline-flex items-center gap-1 px-2 py-1 bg-red-100 text-red-700 rounded-full text-xs font-medium"><XCircleIcon className="h-3 w-3" />Cancelled</span>;
      default:
        return <span className="inline-flex items-center gap-1 px-2 py-1 bg-yellow-100 text-yellow-700 rounded-full text-xs font-medium"><ClockIcon className="h-3 w-3" />Pending</span>;
    }
  };

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate('/dashboard')} className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg">
            <ArrowLeftIcon className="h-5 w-5" />
          </button>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Commission Management</h1>
            <p className="text-sm text-gray-500">Track deals, commissions, and agent payments</p>
          </div>
        </div>
        <PermissionGate permission="can_create_entities">
          <button
            onClick={() => setShowCreateModal(true)}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center gap-2 font-medium"
          >
            <PlusIcon className="h-5 w-5" />
            New Commission
          </button>
        </PermissionGate>
      </div>

      {/* Statistics Cards */}
      {statistics?.summary && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <div className="bg-white rounded-lg border border-gray-200 p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-50 rounded-lg"><CurrencyDollarIcon className="h-6 w-6 text-blue-600" /></div>
              <div>
                <p className="text-xs text-gray-500 uppercase font-medium">Total Deals</p>
                <p className="text-xl font-bold text-gray-900">{formatCurrency(statistics.summary.total_deal_value)}</p>
              </div>
            </div>
          </div>
          <div className="bg-white rounded-lg border border-gray-200 p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-green-50 rounded-lg"><BanknotesIcon className="h-6 w-6 text-green-600" /></div>
              <div>
                <p className="text-xs text-gray-500 uppercase font-medium">Total Commission</p>
                <p className="text-xl font-bold text-green-700">{formatCurrency(statistics.summary.total_commission)}</p>
              </div>
            </div>
          </div>
          <div className="bg-white rounded-lg border border-gray-200 p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-yellow-50 rounded-lg"><ClockIcon className="h-6 w-6 text-yellow-600" /></div>
              <div>
                <p className="text-xs text-gray-500 uppercase font-medium">Pending</p>
                <p className="text-xl font-bold text-yellow-700">{formatCurrency(statistics.summary.pending_amount)}</p>
              </div>
            </div>
          </div>
          <div className="bg-white rounded-lg border border-gray-200 p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-emerald-50 rounded-lg"><CheckCircleIcon className="h-6 w-6 text-emerald-600" /></div>
              <div>
                <p className="text-xs text-gray-500 uppercase font-medium">Paid Out</p>
                <p className="text-xl font-bold text-emerald-700">{formatCurrency(statistics.summary.paid_amount)}</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-2 mb-4">
        <button
          onClick={() => setActiveTab('list')}
          className={`px-4 py-2 rounded-lg text-sm font-medium ${activeTab === 'list' ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}
        >
          All Commissions
        </button>
        <button
          onClick={() => setActiveTab('stats')}
          className={`px-4 py-2 rounded-lg text-sm font-medium ${activeTab === 'stats' ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}
        >
          <ChartBarIcon className="h-4 w-4 inline mr-1" />
          Agent Performance
        </button>
      </div>

      {activeTab === 'list' && (
        <>
          {/* Filters */}
          <div className="bg-white rounded-lg border border-gray-200 p-4 mb-4 flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2 flex-1 min-w-[200px]">
              <MagnifyingGlassIcon className="h-5 w-5 text-gray-400" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search deals, agents, clients..."
                className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            >
              <option value="">All Status</option>
              <option value="PENDING">Pending</option>
              <option value="PAID">Paid</option>
              <option value="CANCELLED">Cancelled</option>
            </select>
            <select
              value={filterAgent}
              onChange={(e) => setFilterAgent(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            >
              <option value="">All Agents</option>
              {agents.map(a => (
                <option key={a.dealer_id} value={a.dealer_id}>{a.specific_id} - {a.name}</option>
              ))}
            </select>
          </div>

          {/* Commissions Table */}
          <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Deal</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Agent</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Client</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Deal Amount</th>
                    <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Rate</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Commission</th>
                    <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Status</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Date</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Actions</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {loading ? (
                    <tr><td colSpan={9} className="text-center py-12 text-gray-500">Loading...</td></tr>
                  ) : filteredCommissions.length === 0 ? (
                    <tr><td colSpan={9} className="text-center py-12 text-gray-400">No commissions found</td></tr>
                  ) : filteredCommissions.map((c) => (
                    <tr key={c.commission_id} className="hover:bg-gray-50">
                      <td className="px-4 py-3 text-sm font-medium text-gray-900">{c.deal_description || '-'}</td>
                      <td className="px-4 py-3 text-sm text-gray-600">{c.agent_name || '-'}</td>
                      <td className="px-4 py-3 text-sm text-gray-600">{c.client_name || '-'}</td>
                      <td className="px-4 py-3 text-sm text-right font-medium">{formatCurrency(c.deal_amount)}</td>
                      <td className="px-4 py-3 text-sm text-center">{c.commission_rate}%</td>
                      <td className="px-4 py-3 text-sm text-right font-semibold text-green-700">{formatCurrency(c.commission_amount)}</td>
                      <td className="px-4 py-3 text-center">{statusBadge(c.status)}</td>
                      <td className="px-4 py-3 text-sm text-gray-500">{new Date(c.created_at).toLocaleDateString()}</td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-1">
                          {c.status === 'PENDING' && (
                            <>
                              <PermissionGate permission="can_edit_entities">
                                <button
                                  onClick={() => openPaymentModal(c)}
                                  className="px-2 py-1 text-xs bg-green-50 text-green-700 hover:bg-green-100 rounded font-medium"
                                >
                                  Pay
                                </button>
                              </PermissionGate>
                              <PermissionGate permission="can_delete_entities">
                                <button
                                  onClick={() => openCancelModal(c)}
                                  className="px-2 py-1 text-xs bg-red-50 text-red-700 hover:bg-red-100 rounded font-medium"
                                >
                                  Cancel
                                </button>
                              </PermissionGate>
                            </>
                          )}
                          {c.status === 'PAID' && c.payment_date && (
                            <span className="text-xs text-gray-400">
                              Paid {new Date(c.payment_date).toLocaleDateString()}
                            </span>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {activeTab === 'stats' && statistics?.top_agents && (
        <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
          <div className="px-4 py-3 bg-blue-50 border-b flex items-center gap-2">
            <UserGroupIcon className="h-5 w-5 text-blue-600" />
            <h3 className="font-semibold text-gray-800">Agent Performance</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Agent</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Deals</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Total Deal Value</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Earned</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Pending</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Paid</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {statistics.top_agents.map((agent, idx) => (
                  <tr key={idx} className="hover:bg-gray-50">
                    <td className="px-4 py-3 text-sm font-medium text-gray-900">{agent.agent_name}</td>
                    <td className="px-4 py-3 text-sm text-right">{agent.deal_count}</td>
                    <td className="px-4 py-3 text-sm text-right">{formatCurrency(agent.total_deals)}</td>
                    <td className="px-4 py-3 text-sm text-right font-semibold text-blue-700">{formatCurrency(agent.total_earned)}</td>
                    <td className="px-4 py-3 text-sm text-right text-yellow-700">{formatCurrency(agent.pending)}</td>
                    <td className="px-4 py-3 text-sm text-right text-green-700">{formatCurrency(agent.paid)}</td>
                  </tr>
                ))}
                {statistics.top_agents.length === 0 && (
                  <tr><td colSpan={6} className="text-center py-8 text-gray-400">No agent data available</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Create Commission Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <h2 className="text-lg font-bold text-gray-900 mb-4">Record New Commission</h2>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Deal Description *</label>
                  <input type="text" value={formData.deal_description}
                    onChange={(e) => setFormData(prev => ({ ...prev, deal_description: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    placeholder="e.g. 5 Marla House, DHA Phase 6"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Agent</label>
                    <select value={formData.agent_id}
                      onChange={(e) => setFormData(prev => ({ ...prev, agent_id: e.target.value }))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="">Select Agent</option>
                      {agents.map(a => (
                        <option key={a.dealer_id} value={a.dealer_id}>{a.specific_id} - {a.name}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Client</label>
                    <select value={formData.client_id}
                      onChange={(e) => setFormData(prev => ({ ...prev, client_id: e.target.value }))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="">Select Client</option>
                      {clients.map(c => (
                        <option key={c.farmer_id} value={c.farmer_id}>{c.specific_id} - {c.name}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Deal Amount (Rs) *</label>
                    <input type="number" value={formData.deal_amount}
                      onChange={(e) => setFormData(prev => ({ ...prev, deal_amount: e.target.value }))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                      placeholder="0"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Rate (%)</label>
                    <input type="number" step="0.5" value={formData.commission_rate}
                      onChange={(e) => setFormData(prev => ({ ...prev, commission_rate: e.target.value }))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Commission (Rs)</label>
                    <input type="number" value={formData.commission_amount} readOnly
                      className="w-full px-3 py-2 border border-gray-200 rounded-lg bg-gray-50 text-gray-700 font-semibold"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
                  <textarea value={formData.notes}
                    onChange={(e) => setFormData(prev => ({ ...prev, notes: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    rows={2} placeholder="Optional notes..."
                  />
                </div>
              </div>

              <div className="flex justify-end gap-3 mt-6">
                <button onClick={() => { setShowCreateModal(false); resetForm(); }}
                  className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300">Cancel</button>
                <button onClick={handleCreate}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium">Record Commission</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Payment Modal */}
      {showPaymentModal && selectedCommission && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-md">
            <div className="p-6">
              <h2 className="text-lg font-bold text-gray-900 mb-2">Record Commission Payment</h2>
              <p className="text-sm text-gray-500 mb-4">
                Paying <span className="font-semibold text-green-700">{formatCurrency(selectedCommission.commission_amount)}</span> to <span className="font-semibold">{selectedCommission.agent_name}</span>
              </p>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Payment Method</label>
                  <select value={paymentForm.payment_method}
                    onChange={(e) => setPaymentForm(prev => ({ ...prev, payment_method: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="CASH">Cash</option>
                    <option value="BANK_TRANSFER">Bank Transfer</option>
                    <option value="CHEQUE">Cheque</option>
                    <option value="DIGITAL_WALLET">Digital Wallet</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Reference Number</label>
                  <input type="text" value={paymentForm.payment_reference}
                    onChange={(e) => setPaymentForm(prev => ({ ...prev, payment_reference: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    placeholder="Transaction ID, cheque number, etc."
                  />
                </div>
              </div>

              <div className="flex justify-end gap-3 mt-6">
                <button onClick={() => { setShowPaymentModal(false); setSelectedCommission(null); }}
                  className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300">Cancel</button>
                <button onClick={handlePayment}
                  className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 font-medium">Confirm Payment</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Cancel Modal */}
      {showCancelModal && selectedCommission && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-md">
            <div className="p-6">
              <h2 className="text-lg font-bold text-red-700 mb-2">Cancel Commission</h2>
              <p className="text-sm text-gray-500 mb-4">
                Cancel {formatCurrency(selectedCommission.commission_amount)} commission for {selectedCommission.agent_name}?
              </p>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Reason</label>
                <textarea value={cancelReason}
                  onChange={(e) => setCancelReason(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500"
                  rows={3} placeholder="Reason for cancellation..."
                />
              </div>
              <div className="flex justify-end gap-3 mt-6">
                <button onClick={() => { setShowCancelModal(false); setSelectedCommission(null); setCancelReason(''); }}
                  className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300">Keep</button>
                <button onClick={handleCancel}
                  className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 font-medium">Cancel Commission</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default CommissionsPage;
