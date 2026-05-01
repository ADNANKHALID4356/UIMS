import React, { useState, useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import {
  fetchTransactions,
  fetchTransactionStatistics,
  clearError
} from '../store/slices/transactionSlice';
import PermissionGate from '../components/PermissionGate';
import { 
  PlusIcon, 
  MagnifyingGlassIcon,
  ArrowPathIcon,
  ChartBarIcon,
  BanknotesIcon,
  CreditCardIcon
} from '@heroicons/react/24/outline';

const TransactionsPage = () => {
  
  const dispatch = useDispatch();
  const navigate = useNavigate();
  
  const { transactions, statistics, loading, error } = useSelector(
    (state) => state.transactions
  );
  const { user } = useSelector((state) => state.auth);
  const { industryConfig } = useSelector((state) => state.organization);
  
  const terminology = industryConfig?.terminology || {};
  const industryType = industryConfig?.industry || industryConfig?.industryType || 'AGRICULTURAL';
  const isRetail = industryType === 'RETAIL';
  
  const [voidModal, setVoidModal] = useState({ show: false, transaction: null });
  const [deleteModal, setDeleteModal] = useState({ show: false, transaction: null });
  const [actionReason, setActionReason] = useState('');
  const [actionProcessing, setActionProcessing] = useState(false);

  const [filters, setFilters] = useState({
    transaction_type: '',
    entity_table: '',
    payment_type: '',
    start_date: '',
    end_date: '',
  });
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    loadTransactions();
    loadStatistics();
  }, []);

  const loadTransactions = () => {
    // Pass industry_type filter to only show transactions for current industry
    dispatch(fetchTransactions({ ...filters, industry_type: industryType }));
  };

  const loadStatistics = () => {
    dispatch(fetchTransactionStatistics({ ...filters, industry_type: industryType }));
  };

  const handleFilterChange = (field, value) => {
    setFilters(prev => ({ ...prev, [field]: value }));
  };

  const handleApplyFilters = () => {
    loadTransactions();
    loadStatistics();
  };

  const handleResetFilters = () => {
    setFilters({
      transaction_type: '',
      entity_table: '',
      payment_type: '',
      start_date: '',
      end_date: '',
    });
    setSearchTerm('');
    dispatch(fetchTransactions({ industry_type: industryType }));
    dispatch(fetchTransactionStatistics({ industry_type: industryType }));
  };

  const filteredTransactions = transactions.filter(transaction => {
    if (!searchTerm) return true;
    const search = searchTerm.toLowerCase();
    return (
      transaction.transaction_number?.toLowerCase().includes(search) ||
      transaction.entity_name?.toLowerCase().includes(search) ||
      transaction.item_name?.toLowerCase().includes(search) ||
      transaction.description?.toLowerCase().includes(search)
    );
  });

  // Group transactions by date
  const groupedTransactions = React.useMemo(() => {
    const groups = {};
    filteredTransactions.forEach(transaction => {
      const date = new Date(transaction.transaction_date).toDateString();
      if (!groups[date]) {
        groups[date] = [];
      }
      groups[date].push(transaction);
    });
    return Object.entries(groups).sort((a, b) => new Date(b[0]) - new Date(a[0]));
  }, [filteredTransactions]);

  const formatDateLabel = (dateString) => {
    const date = new Date(dateString);
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    if (date.toDateString() === today.toDateString()) {
      return 'Today';
    } else if (date.toDateString() === yesterday.toDateString()) {
      return 'Yesterday';
    } else {
      return date.toLocaleDateString('en-US', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
    }
  };

  const [expandedBatches, setExpandedBatches] = React.useState({});

  // Update expanded batches when grouped transactions change
  React.useEffect(() => {
    const newExpanded = {};
    groupedTransactions.forEach(([date]) => {
      newExpanded[date] = expandedBatches[date] !== undefined ? expandedBatches[date] : true;
    });
    setExpandedBatches(newExpanded);
  }, [groupedTransactions.length]);

  const toggleBatch = (date) => {
    setExpandedBatches(prev => ({ ...prev, [date]: !prev[date] }));
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-PK', {
      style: 'currency',
      currency: 'PKR',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleString('en-PK', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const getTransactionTypeLabel = (type) => {
    const labels = {
      // Agricultural
      'FARMER_PURCHASE': 'Farmer Purchase',
      'FARMER_SALE_GRAIN': 'Farmer Grain Sale',
      'DEALER_PURCHASE': 'Dealer Purchase',
      'DEALER_SALE': 'Dealer Sale',
      'COMPANY_PURCHASE': 'Company Purchase',
      'COMPANY_SALE': 'Company Sale',
      'COMPANY_DELIVERY': 'Company Delivery',
      // Retail
      'RETAIL_SALE': 'Sale to Customer',
      'RETAIL_PURCHASE': 'Purchase from Supplier',
      'RETAIL_DISTRIBUTOR_PURCHASE': 'Purchase from Distributor',
      'RETAIL_RETURN_IN': 'Customer Return',
      'RETAIL_RETURN_OUT': 'Return to Supplier',
      // Payments
      'PAYMENT_RECEIVED': 'Payment Received',
      'PAYMENT_MADE': 'Payment Made',
    };
    return labels[type] || type;
  };

  const getPaymentTypeBadge = (type) => {
    const colors = {
      'CASH': 'bg-green-100 text-green-800',
      'CREDIT': 'bg-yellow-100 text-yellow-800',
      'PARTIAL': 'bg-blue-100 text-blue-800',
    };
    return colors[type] || 'bg-gray-100 text-gray-800';
  };

  // Get comprehensive entity badge showing BOTH category and regularity
  /**
   * Get comprehensive entity badges for a transaction
   * 
   * ═══════════════════════════════════════════════════════════════
   *                 ENTITY CATEGORIZATION SYSTEM
   * ═══════════════════════════════════════════════════════════════
   * 
   * THREE CATEGORIES (from entity_table):
   * ────────────────────────────────────
   * 1. 👨‍🌾 Farmer   (Green)   - Agricultural producers
   * 2. 🏢 Company  (Purple)  - Corporate entities
   * 3. 🏪 Dealer   (Blue)    - Commercial dealers
   * 
   * TWO STATUS TYPES (from entity_type):
   * ────────────────────────────────────
   * 1. ⭐ Permanent (Emerald) - entity_type = 'regular'   - Registered in system
   * 2. 🚶 Walk-in   (Orange)  - entity_type = 'irregular' - One-time customer
   * 
   * ALL 6 VALID COMBINATIONS:
   * ────────────────────────────────────
   * [👨‍🌾 Farmer]  [⭐ Permanent]  ← Registered Farmer
   * [👨‍🌾 Farmer]  [🚶 Walk-in]    ← One-time Farmer
   * [🏢 Company] [⭐ Permanent]  ← Registered Company
   * [🏢 Company] [🚶 Walk-in]    ← One-time Company
   * [🏪 Dealer]  [⭐ Permanent]  ← Registered Dealer
   * [🏪 Dealer]  [🚶 Walk-in]    ← One-time Dealer
   * 
   * ═══════════════════════════════════════════════════════════════
   */
  const getEntityBadges = (transaction) => {
    // ===== STEP 1: Determine Category from entity_table =====
    // Default to 'Unknown' if data is invalid
    let categoryIcon = '❓';
    let categoryLabel = 'Unknown';
    let categoryColor = 'gray';
    
    if (transaction.entity_table) {
      const table = transaction.entity_table.toLowerCase();
      
      // ONLY THREE CATEGORIES exist in the system:
      // 1. Farmer (Green) - Agricultural producers
      // 2. Company (Purple) - Corporate entities  
      // 3. Dealer (Blue) - Commercial dealers
      // 
      // Walk-in is NOT a category - it's a STATUS (see Step 2 below)
      
      if (table === 'farmer' || table.includes('farmer')) {
        categoryIcon = '👨‍🌾';
        categoryLabel = terminology.customer || 'Farmer';
        categoryColor = 'green';
      } 
      else if (table === 'company' || table.includes('compan')) {
        categoryIcon = '🏢';
        categoryLabel = terminology.supplier || 'Company';
        categoryColor = 'purple';
      } 
      else if (table === 'dealer' || table.includes('dealer')) {
        categoryIcon = '🏪';
        categoryLabel = terminology.dealer || 'Dealer';
        categoryColor = 'blue';
      }
      // If none match, 'Unknown' will be displayed (error state)
    }
    
    // ===== STEP 2: Determine Status from entity_type =====
    const isPermanent = transaction.entity_type?.toLowerCase() === 'regular';
    const isWalkIn = transaction.entity_type?.toLowerCase() === 'irregular';
    
    let statusLabel = 'Unknown';
    let statusIcon = '❓';
    let statusColor = 'gray';
    
    if (isPermanent) {
      statusLabel = 'Permanent';
      statusIcon = '⭐';
      statusColor = 'emerald';
    } else if (isWalkIn) {
      statusLabel = 'Walk-In';
      statusIcon = '🚶';
      statusColor = 'orange';
    }
    
    // ===== STEP 3: Return Badge Configuration =====
    return {
      category: {
        icon: categoryIcon,
        label: categoryLabel,
        bgColor: `bg-${categoryColor}-100`,
        textColor: `text-${categoryColor}-800`,
        borderColor: `border-${categoryColor}-400`,
        ringColor: `ring-${categoryColor}-300`
      },
      status: {
        icon: statusIcon,
        label: statusLabel,
        bgColor: `bg-${statusColor}-100`,
        textColor: `text-${statusColor}-800`,
        borderColor: `border-${statusColor}-400`,
        ringColor: `ring-${statusColor}-300`
      }
    };
  };

  if (error) {
    return (
      <div className="p-6">
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <p className="text-red-800">{error}</p>
          <button
            onClick={() => dispatch(clearError())}
            className="mt-2 text-sm text-red-600 hover:text-red-800"
          >
            Dismiss
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* Navigation Header */}
      <header className="bg-white dark:bg-gray-800 shadow-sm border-b border-gray-200 dark:border-gray-700 mb-6">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex justify-between items-center">
          <div className="flex items-center">
            <button
              onClick={() => {
                navigate('/dashboard');
              }}
              className="mr-4 p-2 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <svg className="w-6 h-6 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
              </svg>
            </button>
            <div>
              <h1 className="text-2xl font-bold bg-gradient-to-r from-purple-600 to-blue-600 bg-clip-text text-transparent">
                📊 Transactions Management
              </h1>
              <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">View and manage all business transactions</p>
            </div>
          </div>
          <button
            onClick={() => {
              navigate('/transactions/new');
            }}
            className="px-6 py-2.5 bg-gradient-to-r from-purple-600 to-blue-600 text-white rounded-lg font-medium hover:shadow-lg transition-all hover:-translate-y-0.5 flex items-center gap-2"
          >
            <PlusIcon className="w-5 h-5" />
            New Transaction
          </button>
        </div>
      </header>

      <div className="p-6 max-w-7xl mx-auto">
      {/* Page Title - REMOVED as it's now in header */}

      {/* Entity Type Legend - Professional Guide */}
      <div className="bg-gradient-to-r from-indigo-50 via-purple-50 to-blue-50 border-2 border-indigo-200 rounded-xl p-5 mb-6 shadow-md">
        <div className="flex items-start gap-4">
          <div className="flex-shrink-0 p-2 bg-white rounded-lg shadow-sm">
            <svg className="w-7 h-7 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <div className="flex-1">
            <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-3">📋 Transaction Entity Types Guide</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-3">
              <div className="flex items-center gap-2 px-3 py-2 bg-white rounded-lg border-2 border-green-300 shadow-sm">
                <span className="text-xl">👨‍🌾</span>
                <div>
                  <p className="font-bold text-green-800 text-sm">{terminology.customer || 'Farmer'}</p>
                  <p className="text-xs text-gray-600">{isRetail ? 'Buyers' : 'Agricultural producers'}</p>
                </div>
              </div>
              <div className="flex items-center gap-2 px-3 py-2 bg-white rounded-lg border-2 border-blue-300 shadow-sm">
                <span className="text-xl">🏪</span>
                <div>
                  <p className="font-bold text-blue-800 text-sm">{terminology.dealer || 'Dealer'}</p>
                  <p className="text-xs text-gray-600">{isRetail ? 'Product distributors' : 'Grain buyers'}</p>
                </div>
              </div>
              <div className="flex items-center gap-2 px-3 py-2 bg-white rounded-lg border-2 border-purple-300 shadow-sm">
                <span className="text-xl">🏢</span>
                <div>
                  <p className="font-bold text-purple-800 text-sm">{terminology.supplier || 'Company'}</p>
                  <p className="text-xs text-gray-600">Product suppliers</p>
                </div>
              </div>
              <div className="flex items-center gap-2 px-3 py-2 bg-white rounded-lg border-2 border-gray-300 shadow-sm">
                <span className="text-xl">👤</span>
                <div>
                  <p className="font-bold text-gray-800 text-sm">Customer</p>
                  <p className="text-xs text-gray-600">Regular customers</p>
                </div>
              </div>
              <div className="flex items-center gap-2 px-3 py-2 bg-white rounded-lg border-2 border-orange-300 shadow-sm">
                <span className="text-xl">🚶</span>
                <div>
                  <p className="font-bold text-orange-800 text-sm">Walk-in</p>
                  <p className="text-xs text-gray-600">One-time customers</p>
                </div>
              </div>
            </div>
            <p className="text-sm text-indigo-700 mt-3 font-medium">
              💡 <strong>Tip:</strong> Each transaction is color-coded by entity type for easy identification.
            </p>
          </div>
        </div>
      </div>

      {/* Statistics Cards */}
      {statistics && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600 dark:text-gray-400">Total Transactions</p>
                <p className="text-2xl font-bold text-gray-900 dark:text-white">
                  {statistics.total_count || 0}
                </p>
              </div>
              <ChartBarIcon className="h-10 w-10 text-blue-500" />
            </div>
          </div>

          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600 dark:text-gray-400">Total Sales</p>
                <p className="text-xl font-bold text-green-600">
                  {formatCurrency(statistics.total_sales || 0)}
                </p>
              </div>
              <BanknotesIcon className="h-10 w-10 text-green-500" />
            </div>
          </div>

          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600 dark:text-gray-400">Total Purchases</p>
                <p className="text-xl font-bold text-orange-600">
                  {formatCurrency(statistics.total_purchases || 0)}
                </p>
              </div>
              <BanknotesIcon className="h-10 w-10 text-orange-500" />
            </div>
          </div>

          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600 dark:text-gray-400">Total Credit</p>
                <p className="text-xl font-bold text-yellow-600">
                  {formatCurrency(statistics.total_credit || 0)}
                </p>
              </div>
              <CreditCardIcon className="h-10 w-10 text-yellow-500" />
            </div>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-4 mb-6">
        <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-4 mb-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Transaction Type
            </label>
            <select
              value={filters.transaction_type}
              onChange={(e) => handleFilterChange('transaction_type', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">All Types</option>
              {isRetail ? (
                <>
                  <option value="RETAIL_SALE">Sale to Customer</option>
                  <option value="RETAIL_PURCHASE">Purchase from Supplier</option>
                  <option value="RETAIL_DISTRIBUTOR_PURCHASE">Purchase from Distributor</option>
                  <option value="RETAIL_RETURN_IN">Customer Return</option>
                  <option value="RETAIL_RETURN_OUT">Return to Supplier</option>
                </>
              ) : (
                <>
                  <option value="FARMER_PURCHASE">Farmer Purchase</option>
                  <option value="FARMER_SALE_GRAIN">Farmer Grain Sale</option>
                  <option value="DEALER_PURCHASE">Dealer Purchase</option>
                  <option value="COMPANY_DELIVERY">Company Delivery</option>
                </>
              )}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Entity Category
            </label>
            <select
              value={filters.entity_table}
              onChange={(e) => handleFilterChange('entity_table', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">All Categories</option>
              <option value="Farmers">{terminology.customer || 'Farmer'}</option>
              <option value="Dealers">{terminology.dealer || 'Dealer'}</option>
              <option value="Companies">{terminology.supplier || 'Company'}</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Payment Type
            </label>
            <select
              value={filters.payment_type}
              onChange={(e) => handleFilterChange('payment_type', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">All Payments</option>
              <option value="CASH">Cash</option>
              <option value="CREDIT">Credit</option>
              <option value="PARTIAL">Partial</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Date From
            </label>
            <input
              type="date"
              value={filters.start_date}
              onChange={(e) => handleFilterChange('start_date', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Date To
            </label>
            <input
              type="date"
              value={filters.end_date}
              onChange={(e) => handleFilterChange('end_date', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div className="flex items-end gap-2">
            <button
              onClick={handleApplyFilters}
              className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              Apply
            </button>
            <button
              onClick={handleResetFilters}
              className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors"
            >
              <ArrowPathIcon className="h-5 w-5" />
            </button>
          </div>
        </div>
      </div>

      {/* Action Bar */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-4 mb-6">
        <div className="flex flex-col sm:flex-row gap-4 justify-between items-center">
          <div className="relative flex-1 w-full">
            <MagnifyingGlassIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
            <input
              type="text"
              placeholder="Search transactions..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <button
            onClick={() => navigate('/transactions/new')}
            className="flex items-center gap-2 px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors whitespace-nowrap"
          >
            <PlusIcon className="h-5 w-5" />
            New Transaction
          </button>
        </div>
      </div>

      {/* Transactions Table */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md overflow-hidden">
        {loading ? (
          <div className="flex justify-center items-center p-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
          </div>
        ) : filteredTransactions.length === 0 ? (
          <div className="text-center py-16 px-6">
            <div className="inline-block p-6 bg-purple-100 rounded-full mb-4">
              <svg className="w-16 h-16 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
              </svg>
            </div>
            <h3 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">No Transactions Yet</h3>
            <p className="text-lg text-gray-600 mb-2">
              Ready to record your first transaction?
            </p>
            <p className="text-sm text-gray-500 mb-8 max-w-md mx-auto">
              Create transactions to track your business activities including sales, purchases, payments, and receipts.
            </p>
            <div className="flex gap-4 justify-center">
              <button
                onClick={() => {
                  navigate('/transactions/new');
                }}
                className="inline-flex items-center px-6 py-3 bg-gradient-to-r from-purple-600 to-blue-600 text-white rounded-lg hover:shadow-lg transition-all hover:-translate-y-0.5 text-lg font-medium"
              >
                <PlusIcon className="h-6 w-6 mr-2" />
                Create First Transaction
              </button>
              <button
                onClick={() => {
                  navigate('/dashboard');
                }}
                className="inline-flex items-center px-6 py-3 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors text-lg font-medium"
              >
                ← Back to Dashboard
              </button>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            {groupedTransactions.map(([date, dayTransactions]) => {
              const dayTotal = dayTransactions.reduce((sum, t) => sum + (t.total_amount || 0), 0);
              const isExpanded = expandedBatches[date];
              
              // Calculate entity type breakdown for this day
              const entityBreakdown = dayTransactions.reduce((acc, t) => {
                const type = t.entity_type?.toLowerCase() || 'regular';
                acc[type] = (acc[type] || 0) + 1;
                return acc;
              }, {});
              
              return (
                <div key={date} className="bg-white rounded-xl shadow-md overflow-hidden border-2 border-gray-200">
                  {/* Batch Header */}
                  <div 
                    onClick={() => toggleBatch(date)}
                    className="flex items-center justify-between p-5 bg-gradient-to-r from-purple-50 via-blue-50 to-indigo-50 border-b-2 border-gray-300 cursor-pointer hover:from-purple-100 hover:via-blue-100 hover:to-indigo-100 transition-all shadow-sm"
                  >
                    <div className="flex items-center gap-4">
                      <div className="p-3 bg-white rounded-xl shadow-md border-2 border-purple-200">
                        <svg className="w-7 h-7 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                        </svg>
                      </div>
                      <div>
                        <h3 className="text-xl font-bold text-gray-900 dark:text-white">{formatDateLabel(date)}</h3>
                        <p className="text-sm text-gray-600 font-medium">
                          {new Date(date).toLocaleDateString('en-US', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })}
                        </p>
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-6">
                      {/* Entity Type Breakdown - PROMINENT DISPLAY */}
                      <div className="flex items-center gap-3">
                        {entityBreakdown.farmer > 0 && (
                          <div className="flex items-center gap-1.5 px-3 py-1.5 bg-green-100 border-2 border-green-300 rounded-lg">
                            <span className="text-base">👨‍🌾</span>
                            <span className="font-bold text-green-800 text-sm">{entityBreakdown.farmer}</span>
                          </div>
                        )}
                        {entityBreakdown.dealer > 0 && (
                          <div className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-100 border-2 border-blue-300 rounded-lg">
                            <span className="text-base">🏪</span>
                            <span className="font-bold text-blue-800 text-sm">{entityBreakdown.dealer}</span>
                          </div>
                        )}
                        {entityBreakdown.company > 0 && (
                          <div className="flex items-center gap-1.5 px-3 py-1.5 bg-purple-100 border-2 border-purple-300 rounded-lg">
                            <span className="text-base">🏢</span>
                            <span className="font-bold text-purple-800 text-sm">{entityBreakdown.company}</span>
                          </div>
                        )}
                        {(entityBreakdown.regular > 0 || entityBreakdown.irregular > 0) && (
                          <div className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-100 border-2 border-gray-300 rounded-lg">
                            <span className="text-base">👤</span>
                            <span className="font-bold text-gray-800 text-sm">{(entityBreakdown.regular || 0) + (entityBreakdown.irregular || 0)}</span>
                          </div>
                        )}
                      </div>
                      
                      <div className="h-8 w-px bg-gray-300"></div>
                      
                      {/* Transaction Count & Total */}
                      <div className="flex items-center gap-4">
                        <div className="flex items-center gap-2 px-3 py-1.5 bg-white rounded-lg border-2 border-gray-300 shadow-sm">
                          <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                          </svg>
                          <span className="text-sm font-bold text-gray-700">{dayTransactions.length}</span>
                        </div>
                        <div className="flex items-center gap-2 px-4 py-1.5 bg-gradient-to-r from-green-100 to-emerald-100 rounded-lg border-2 border-green-400 shadow-sm">
                          <svg className="w-5 h-5 text-green-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                          <span className="text-base font-bold text-green-800">{formatCurrency(dayTotal)}</span>
                        </div>
                      </div>
                      
                      {/* Expand/Collapse Button */}
                      <button className="p-2 hover:bg-white rounded-lg transition-colors border-2 border-transparent hover:border-gray-300">
                        <svg 
                          className={`w-6 h-6 text-gray-700 transition-transform ${isExpanded ? 'rotate-180' : ''}`} 
                          fill="none" 
                          stroke="currentColor" 
                          viewBox="0 0 24 24"
                        >
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                        </svg>
                      </button>
                    </div>
                  </div>

                  {/* Transaction Cards */}
                  {isExpanded && (
                    <div className="divide-y divide-gray-100">
                      {dayTransactions.map((transaction) => {
                        const badges = getEntityBadges(transaction);
                        
                        return (
                          <div 
                            key={transaction.transaction_id} 
                            className="p-6 hover:bg-gradient-to-r hover:from-blue-50 hover:to-purple-50 dark:hover:from-gray-700 dark:hover:to-gray-700 transition-all duration-200 border-b border-gray-200 dark:border-gray-700 last:border-b-0"
                          >
                            {/* Top Row: Transaction ID, Time & Payment */}
                            <div className="flex items-center justify-between mb-4">
                              <div className="flex items-center gap-3">
                                {/* Transaction Number - Prominent */}
                                <div className="flex items-center gap-2 bg-gradient-to-r from-blue-600 to-purple-600 text-white px-4 py-2 rounded-lg shadow-md">
                                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 20l4-16m2 16l4-16M6 9h14M4 15h14" />
                                  </svg>
                                  <span className="font-bold text-sm">{transaction.transaction_number}</span>
                                </div>
                                
                                {/* Time Badge */}
                                <div className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-100 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg">
                                  <svg className="w-4 h-4 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                                  </svg>
                                  <span className="text-xs font-semibold text-gray-700 dark:text-gray-300">
                                    {formatDate(transaction.transaction_date).split(',')[1]}
                                  </span>
                                </div>
                              </div>
                              
                              {/* Payment Type Badge */}
                              <div className={`flex items-center gap-2 px-4 py-1.5 rounded-lg border-2 font-bold text-sm ${getPaymentTypeBadge(transaction.payment_type)} shadow-sm`}>
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
                                </svg>
                                {transaction.payment_type}
                              </div>
                            </div>
                            
                            {/* Main Content Card */}
                            <div className="bg-white dark:bg-gray-800 border-2 border-gray-200 dark:border-gray-700 rounded-xl shadow-sm overflow-hidden">
                              {/* Entity Badges Row - MOST PROMINENT */}
                              <div className="bg-gradient-to-r from-gray-50 via-white to-gray-50 dark:from-gray-750 dark:via-gray-800 dark:to-gray-750 px-5 py-4 border-b-2 border-gray-200 dark:border-gray-700">
                                <div className="flex items-center gap-3">
                                  {/* Category Badge */}
                                  <div className={`flex items-center gap-2.5 px-4 py-2.5 rounded-xl border-2 shadow-md ${badges.category.bgColor} ${badges.category.textColor} ${badges.category.borderColor}`}>
                                    <span className="text-3xl">{badges.category.icon}</span>
                                    <div className="flex flex-col">
                                      <span className="text-xs font-semibold uppercase tracking-wide opacity-75">Category</span>
                                      <span className="font-bold text-lg uppercase tracking-wide">{badges.category.label}</span>
                                    </div>
                                  </div>
                                  
                                  {/* Status Badge (Permanent/Walk-in) */}
                                  <div className={`flex items-center gap-2.5 px-4 py-2.5 rounded-xl border-2 shadow-md ${badges.status.bgColor} ${badges.status.textColor} ${badges.status.borderColor}`}>
                                    <span className="text-2xl">{badges.status.icon}</span>
                                    <div className="flex flex-col">
                                      <span className="text-xs font-semibold uppercase tracking-wide opacity-75">Status</span>
                                      <span className="font-bold text-base uppercase tracking-wide">{badges.status.label}</span>
                                    </div>
                                  </div>
                                  
                                  <div className="flex-1"></div>
                                  
                                  {/* Entity Name - Right Side */}
                                  <div className="text-right">
                                    <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1">Entity Name</p>
                                    <p className="text-2xl font-bold text-gray-900 dark:text-white">{transaction.entity_name || 'N/A'}</p>
                                  </div>
                                </div>
                              </div>
                              
                              {/* Transaction Details Section */}
                              <div className="p-5">
                                <div className="flex items-center gap-6">
                                  {/* Transaction Type */}
                                  <div className="flex items-center gap-3">
                                    <div className="flex-shrink-0 w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center">
                                      <svg className="w-6 h-6 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                                      </svg>
                                    </div>
                                    <div>
                                      <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase">Transaction Type</p>
                                      <p className="text-base font-bold text-purple-700">{getTransactionTypeLabel(transaction.transaction_type)}</p>
                                    </div>
                                  </div>
                                  
                                  {/* Item Details */}
                                  <div className="flex items-center gap-3">
                                    <div className="flex-shrink-0 w-12 h-12 bg-orange-100 rounded-lg flex items-center justify-center">
                                      <svg className="w-6 h-6 text-orange-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                                      </svg>
                                    </div>
                                    <div>
                                      <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase">Item</p>
                                      <p className="text-base font-bold text-gray-900 dark:text-white">{transaction.item_name || 'N/A'}</p>
                                    </div>
                                  </div>
                                </div>
                              </div>
                            </div>
                            
                            {/* Action Buttons */}
                            <div className="mt-4 flex items-center justify-end gap-3">
                              {/* Void Button (same-day only) */}
                              <PermissionGate permission="can_delete_entities">
                              {transaction.status !== 'VOIDED' && (
                                <button
                                  onClick={() => { setVoidModal({ show: true, transaction }); setActionReason(''); }}
                                  className="inline-flex items-center gap-1.5 px-4 py-2 bg-gradient-to-r from-red-500 to-rose-600 text-white font-bold rounded-xl hover:from-red-600 hover:to-rose-700 transition-all shadow-md text-sm"
                                  title="Void Transaction"
                                >
                                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
                                  </svg>
                                  Void
                                </button>
                              )}
                              </PermissionGate>

                              {/* Delete Button (same-day only) */}
                              <PermissionGate permission="can_delete_entities">
                              {transaction.status !== 'VOIDED' && (
                                <button
                                  onClick={() => { setDeleteModal({ show: true, transaction }); setActionReason(''); }}
                                  className="inline-flex items-center gap-1.5 px-4 py-2 border-2 border-red-300 text-red-700 font-bold rounded-xl hover:bg-red-50 transition-all text-sm"
                                  title="Delete Transaction"
                                >
                                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                  </svg>
                                  Delete
                                </button>
                              )}
                              </PermissionGate>

                              {/* VOIDED Badge */}
                              {transaction.status === 'VOIDED' && (
                                <span className="inline-flex items-center gap-1 px-4 py-2 bg-gray-200 text-gray-600 font-bold rounded-xl text-sm">
                                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
                                  </svg>
                                  VOIDED
                                </span>
                              )}

                              {/* Edit Button */}
                              {transaction.status !== 'VOIDED' && (
                              <button
                                onClick={() => {
                                  navigate(`/transactions/edit/${transaction.transaction_id}`);
                                }}
                                className="inline-flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-amber-500 to-orange-600 text-white font-bold rounded-xl hover:from-amber-600 hover:to-orange-700 transition-all shadow-md hover:shadow-lg transform hover:-translate-y-0.5"
                                title="Edit Transaction"
                              >
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                                </svg>
                                Edit
                              </button>
                              )}
                              
                              {/* View Details Button */}
                              <button
                                onClick={() => {
                                  navigate(`/transactions/${transaction.transaction_id}`);
                                }}
                                className="inline-flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-purple-600 to-blue-600 text-white font-bold rounded-xl hover:from-purple-700 hover:to-blue-700 transition-all shadow-lg hover:shadow-xl transform hover:-translate-y-0.5"
                              >
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                                </svg>
                                View Full Details
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Void Transaction Modal */}
      {voidModal.show && voidModal.transaction && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-xl max-w-md w-full p-6 shadow-2xl">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2 bg-red-100 rounded-lg">
                <svg className="w-6 h-6 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
                </svg>
              </div>
              <div>
                <h3 className="text-lg font-bold text-gray-900 dark:text-white">Void Transaction</h3>
                <p className="text-sm text-gray-500">This will reverse all stock and ledger changes</p>
              </div>
            </div>
            <p className="text-sm text-gray-700 mb-3">
              Void <strong>{voidModal.transaction.transaction_number}</strong>? The transaction record will be kept for audit trail but marked as VOIDED.
            </p>
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-1">Reason for voiding *</label>
              <textarea
                value={actionReason}
                onChange={(e) => setActionReason(e.target.value)}
                className="w-full px-3 py-2 border-2 border-gray-300 rounded-lg text-sm"
                rows="2"
                placeholder="Enter reason..."
              />
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => setVoidModal({ show: false, transaction: null })}
                className="flex-1 px-4 py-2 border-2 border-gray-300 rounded-lg font-semibold"
                disabled={actionProcessing}
              >Cancel</button>
              <button
                onClick={async () => {
                  if (!actionReason.trim()) return;
                  setActionProcessing(true);
                  try {
                    const result = await window.electronAPI.transaction.void(
                      voidModal.transaction.transaction_id,
                      user?.user_id,
                      actionReason
                    );
                    if (result?.success) {
                      dispatch(fetchTransactions(filters));
                      dispatch(fetchTransactionStatistics(filters));
                      setVoidModal({ show: false, transaction: null });
                    } else {
                      alert(result?.message || 'Void failed');
                    }
                  } catch (e) {
                    alert('Error: ' + e.message);
                  } finally {
                    setActionProcessing(false);
                  }
                }}
                className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg font-semibold hover:bg-red-700 disabled:opacity-50"
                disabled={actionProcessing || !actionReason.trim()}
              >{actionProcessing ? 'Voiding...' : 'Void Transaction'}</button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Transaction Modal */}
      {deleteModal.show && deleteModal.transaction && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-xl max-w-md w-full p-6 shadow-2xl">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2 bg-red-100 rounded-lg">
                <svg className="w-6 h-6 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
              </div>
              <div>
                <h3 className="text-lg font-bold text-gray-900 dark:text-white">Delete Transaction</h3>
                <p className="text-sm text-red-500 font-medium">This action is permanent and cannot be undone</p>
              </div>
            </div>
            <p className="text-sm text-gray-700 mb-3">
              Permanently delete <strong>{deleteModal.transaction.transaction_number}</strong>? All stock and ledger changes will be reversed and the record removed.
            </p>
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-1">Reason for deletion *</label>
              <textarea
                value={actionReason}
                onChange={(e) => setActionReason(e.target.value)}
                className="w-full px-3 py-2 border-2 border-gray-300 rounded-lg text-sm"
                rows="2"
                placeholder="Enter reason..."
              />
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => setDeleteModal({ show: false, transaction: null })}
                className="flex-1 px-4 py-2 border-2 border-gray-300 rounded-lg font-semibold"
                disabled={actionProcessing}
              >Cancel</button>
              <button
                onClick={async () => {
                  if (!actionReason.trim()) return;
                  setActionProcessing(true);
                  try {
                    const result = await window.electronAPI.transaction.delete(
                      deleteModal.transaction.transaction_id,
                      user?.user_id,
                      actionReason
                    );
                    if (result?.success) {
                      dispatch(fetchTransactions(filters));
                      dispatch(fetchTransactionStatistics(filters));
                      setDeleteModal({ show: false, transaction: null });
                    } else {
                      alert(result?.message || 'Delete failed');
                    }
                  } catch (e) {
                    alert('Error: ' + e.message);
                  } finally {
                    setActionProcessing(false);
                  }
                }}
                className="flex-1 px-4 py-2 bg-red-700 text-white rounded-lg font-semibold hover:bg-red-800 disabled:opacity-50"
                disabled={actionProcessing || !actionReason.trim()}
              >{actionProcessing ? 'Deleting...' : 'Delete Permanently'}</button>
            </div>
          </div>
        </div>
      )}

      </div>
    </div>
  );
};

export default TransactionsPage;
