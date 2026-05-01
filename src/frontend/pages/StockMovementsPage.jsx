/**
 * StockMovementsPage - Professional Stock Movement History (View-Only)
 * 
 * PURPOSE: Display comprehensive stock movement history and analytics
 * 
 * STOCK OPERATIONS: Routed through Universal Transaction System for:
 * - Add Stock → Company Delivery Transaction
 * - Remove Stock → Manual Stock Adjustment
 * - Professional features: location tracking, batch awareness, inline creation
 * 
 * This page focuses on:
 * - Movement history with detailed filters
 * - Analytics and reporting
 * - Professional agricultural inventory tracking
 * 
 * DESIGN: Matches TransactionsPage professional styling
 */

import React, { useState, useEffect, useMemo } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import {
  ArrowLeftIcon,
  MagnifyingGlassIcon,
  ArrowPathIcon,
  PlusIcon,
  ArrowTrendingUpIcon,
  ArrowTrendingDownIcon,
  ArrowsRightLeftIcon,
} from '@heroicons/react/24/outline';
import {
  fetchAllStock,
  fetchAllMovements,
  clearError,
} from '../store/slices/stockSlice';
import { fetchAllProducts } from '../store/slices/productSlice';
import { fetchAllGrains } from '../store/slices/grainSlice';

const StockMovementsPage = () => {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const { movements, loading, error } = useSelector((state) => state.stock);
  const { products } = useSelector((state) => state.product);
  const { grains } = useSelector((state) => state.grain);

  // Filters state
  const [filters, setFilters] = useState({
    movement_type: '',
    item_type: '',
    date_from: '',
    date_to: '',
  });
  const [searchTerm, setSearchTerm] = useState('');
  const [expandedBatches, setExpandedBatches] = useState({});

  useEffect(() => {
    dispatch(fetchAllMovements({}));
    dispatch(fetchAllProducts());
    dispatch(fetchAllGrains());
    dispatch(fetchAllStock());
  }, [dispatch]);

  useEffect(() => {
    if (error) {
      setTimeout(() => dispatch(clearError()), 5000);
    }
  }, [error, dispatch]);

  // Filter change handler
  const handleFilterChange = (key, value) => {
    setFilters(prev => ({ ...prev, [key]: value }));
  };

  // Apply filters
  const handleApplyFilters = () => {
    const filterParams = {};
    if (filters.movement_type) filterParams.movement_type = filters.movement_type;
    if (filters.item_type) filterParams.item_type = filters.item_type;
    if (filters.date_from) filterParams.date_from = filters.date_from;
    if (filters.date_to) filterParams.date_to = filters.date_to;
    dispatch(fetchAllMovements({ filters: filterParams }));
  };

  // Reset filters
  const handleResetFilters = () => {
    setFilters({ movement_type: '', item_type: '', date_from: '', date_to: '' });
    setSearchTerm('');
    dispatch(fetchAllMovements({}));
  };

  // Apply filters when they change
  useEffect(() => {
    handleApplyFilters();
  }, [filters]);

  const getItemName = (movement) => {
    if (movement.item_type === 'PRODUCT') {
      const product = products.find(p => p.product_id === movement.item_id);
      return product ? `${product.product_name} (${product.product_code})` : `Product ID: ${movement.item_id}`;
    } else {
      const grain = grains.find(g => g.grain_id === movement.item_id);
      return grain ? `${grain.grain_name} - ${grain.variety} (${grain.grain_code})` : `Grain ID: ${movement.item_id}`;
    }
  };

  // Format currency
  const formatCurrency = (amount) => {
    return `PKR ${parseFloat(amount || 0).toLocaleString('en-PK', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  // Format date with time
  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  // Format date label (Today, Yesterday, or full date)
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

  // Toggle batch expansion
  const toggleBatch = (dateKey) => {
    setExpandedBatches(prev => ({ ...prev, [dateKey]: !prev[dateKey] }));
  };

  // Get movement type badge styling
  const getMovementTypeBadge = (type) => {
    switch (type) {
      case 'IN':
        return { bg: 'bg-green-100', text: 'text-green-800', border: 'border-green-300', icon: '⬆️', label: 'STOCK IN' };
      case 'OUT':
        return { bg: 'bg-red-100', text: 'text-red-800', border: 'border-red-300', icon: '⬇️', label: 'STOCK OUT' };
      case 'ADJUSTMENT':
        return { bg: 'bg-blue-100', text: 'text-blue-800', border: 'border-blue-300', icon: '🔄', label: 'ADJUSTMENT' };
      default:
        return { bg: 'bg-gray-100', text: 'text-gray-800', border: 'border-gray-300', icon: '📦', label: type };
    }
  };

  // Get item type badge styling
  const getItemTypeBadge = (type) => {
    if (type === 'PRODUCT') {
      return { bg: 'bg-purple-100', text: 'text-purple-800', border: 'border-purple-300', icon: '📦', label: 'PRODUCT' };
    } else {
      return { bg: 'bg-amber-100', text: 'text-amber-800', border: 'border-amber-300', icon: '🌾', label: 'GRAIN' };
    }
  };

  // Filter movements by search term
  const filteredMovements = useMemo(() => {
    if (!searchTerm.trim()) return movements;
    const term = searchTerm.toLowerCase();
    return movements.filter(m => {
      const itemName = getItemName(m).toLowerCase();
      const notes = (m.notes || '').toLowerCase();
      const movementType = (m.movement_type || '').toLowerCase();
      return itemName.includes(term) || notes.includes(term) || movementType.includes(term);
    });
  }, [movements, searchTerm, products, grains]);

  // Calculate statistics from filtered movements
  const statistics = useMemo(() => ({
    totalMovements: filteredMovements.length,
    stockIn: filteredMovements.filter(m => m.movement_type === 'IN').length,
    stockOut: filteredMovements.filter(m => m.movement_type === 'OUT').length,
    adjustments: filteredMovements.filter(m => m.movement_type === 'ADJUSTMENT').length,
    totalValueIn: filteredMovements
      .filter(m => m.movement_type === 'IN' && m.unit_price)
      .reduce((sum, m) => sum + (parseFloat(m.quantity) * parseFloat(m.unit_price)), 0),
  }), [filteredMovements]);

  // Group filtered movements by date
  const groupedMovements = useMemo(() => {
    const groups = {};
    filteredMovements.forEach(movement => {
      const date = new Date(movement.created_at || movement.movement_date).toDateString();
      if (!groups[date]) {
        groups[date] = [];
      }
      groups[date].push(movement);
    });
    
    // Convert to array and sort by date (newest first)
    return Object.entries(groups)
      .sort(([dateA], [dateB]) => new Date(dateB) - new Date(dateA));
  }, [filteredMovements]);

  // Initialize expanded batches when groupedMovements change
  useEffect(() => {
    if (groupedMovements.length > 0) {
      const newExpanded = {};
      groupedMovements.forEach(([date]) => {
        newExpanded[date] = expandedBatches[date] !== undefined ? expandedBatches[date] : true;
      });
      setExpandedBatches(newExpanded);
    }
  }, [filteredMovements.length]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-blue-50 to-indigo-50">
      <div className="max-w-7xl mx-auto px-4 py-6">
        
        {/* Navigation Header - Professional Gradient Design */}
        <div className="mb-6">
          <button
            onClick={() => navigate('/dashboard')}
            className="flex items-center gap-2 px-4 py-2 text-gray-600 hover:text-gray-900 hover:bg-white/80 rounded-lg transition-all mb-4"
          >
            <ArrowLeftIcon className="h-5 w-5" />
            <span className="font-medium">Back to Dashboard</span>
          </button>
          
          <div className="bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 rounded-2xl shadow-xl p-6 text-white">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="p-4 bg-white/20 rounded-xl backdrop-blur-sm">
                  <svg className="w-10 h-10 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
                  </svg>
                </div>
                <div>
                  <h1 className="text-3xl font-bold">Stock Movement History</h1>
                  <p className="text-blue-100 mt-1">Comprehensive inventory movement tracking and analytics</p>
                </div>
              </div>
              <button
                onClick={() => navigate('/transactions/new')}
                className="flex items-center gap-2 px-6 py-3 bg-white text-indigo-700 rounded-xl font-bold hover:bg-blue-50 transition-all shadow-lg hover:shadow-xl transform hover:-translate-y-0.5"
              >
                <PlusIcon className="h-5 w-5" />
                Add Stock
              </button>
            </div>
          </div>
        </div>

        {/* Movement Type Legend - Similar to Entity Type Legend */}
        <div className="mb-6 bg-white rounded-xl shadow-md p-5 border-2 border-gray-200">
          <h3 className="text-lg font-bold text-gray-800 mb-4 flex items-center gap-2">
            <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            Movement Types Guide
          </h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-gradient-to-r from-green-50 to-emerald-50 rounded-lg p-4 border-2 border-green-200">
              <div className="flex items-center gap-2 mb-2">
                <span className="text-2xl">⬆️</span>
                <span className="font-bold text-green-800">STOCK IN</span>
              </div>
              <p className="text-xs text-green-700">Incoming inventory - purchases, deliveries, returns</p>
            </div>
            <div className="bg-gradient-to-r from-red-50 to-rose-50 rounded-lg p-4 border-2 border-red-200">
              <div className="flex items-center gap-2 mb-2">
                <span className="text-2xl">⬇️</span>
                <span className="font-bold text-red-800">STOCK OUT</span>
              </div>
              <p className="text-xs text-red-700">Outgoing inventory - sales, transfers, consumption</p>
            </div>
            <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-lg p-4 border-2 border-blue-200">
              <div className="flex items-center gap-2 mb-2">
                <span className="text-2xl">🔄</span>
                <span className="font-bold text-blue-800">ADJUSTMENT</span>
              </div>
              <p className="text-xs text-blue-700">Stock corrections - damage, expiry, reconciliation</p>
            </div>
            <div className="bg-gradient-to-r from-purple-50 to-pink-50 rounded-lg p-4 border-2 border-purple-200">
              <div className="flex items-center gap-2 mb-2">
                <span className="text-2xl">📦</span>
                <span className="font-bold text-purple-800">PRODUCTS</span>
                <span className="mx-1">|</span>
                <span className="text-2xl">🌾</span>
                <span className="font-bold text-amber-800">GRAINS</span>
              </div>
              <p className="text-xs text-purple-700">Inventory categories tracked in this system</p>
            </div>
          </div>
        </div>

        {/* Error Message */}
        {error && (
          <div className="mb-6 bg-red-50 border-l-4 border-red-500 p-4 rounded-lg shadow">
            <div className="flex items-center gap-2">
              <svg className="w-5 h-5 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <p className="text-red-800 font-medium">{error}</p>
            </div>
          </div>
        )}

        {/* Statistics Cards - Enhanced Design */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <div className="bg-white rounded-xl shadow-md p-5 border-2 border-gray-200 hover:shadow-lg transition-shadow">
            <div className="flex items-center gap-3 mb-2">
              <div className="p-2 bg-gray-100 rounded-lg">
                <svg className="w-6 h-6 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                </svg>
              </div>
              <span className="text-sm font-medium text-gray-600">Total Movements</span>
            </div>
            <div className="text-3xl font-bold text-gray-900">{statistics.totalMovements}</div>
          </div>
          
          <div className="bg-white rounded-xl shadow-md p-5 border-2 border-green-200 hover:shadow-lg transition-shadow">
            <div className="flex items-center gap-3 mb-2">
              <div className="p-2 bg-green-100 rounded-lg">
                <ArrowTrendingUpIcon className="w-6 h-6 text-green-600" />
              </div>
              <span className="text-sm font-medium text-gray-600">Stock IN</span>
            </div>
            <div className="text-3xl font-bold text-green-600">{statistics.stockIn}</div>
          </div>
          
          <div className="bg-white rounded-xl shadow-md p-5 border-2 border-red-200 hover:shadow-lg transition-shadow">
            <div className="flex items-center gap-3 mb-2">
              <div className="p-2 bg-red-100 rounded-lg">
                <ArrowTrendingDownIcon className="w-6 h-6 text-red-600" />
              </div>
              <span className="text-sm font-medium text-gray-600">Stock OUT</span>
            </div>
            <div className="text-3xl font-bold text-red-600">{statistics.stockOut}</div>
          </div>
          
          <div className="bg-white rounded-xl shadow-md p-5 border-2 border-yellow-200 hover:shadow-lg transition-shadow">
            <div className="flex items-center gap-3 mb-2">
              <div className="p-2 bg-yellow-100 rounded-lg">
                <svg className="w-6 h-6 text-yellow-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <span className="text-sm font-medium text-gray-600">Total Value IN</span>
            </div>
            <div className="text-2xl font-bold text-yellow-700">{formatCurrency(statistics.totalValueIn)}</div>
          </div>
        </div>

        {/* Filters */}
        <div className="bg-white rounded-xl shadow-md p-5 mb-6 border-2 border-gray-200">
          <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-4 mb-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Movement Type
              </label>
              <select
                value={filters.movement_type}
                onChange={(e) => handleFilterChange('movement_type', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">All Types</option>
                <option value="IN">Stock IN ⬆️</option>
                <option value="OUT">Stock OUT ⬇️</option>
                <option value="ADJUSTMENT">Adjustments 🔄</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Item Type
              </label>
              <select
                value={filters.item_type}
                onChange={(e) => handleFilterChange('item_type', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">All Items</option>
                <option value="PRODUCT">📦 Products</option>
                <option value="GRAIN">🌾 Grains</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Date From
              </label>
              <input
                type="date"
                value={filters.date_from}
                onChange={(e) => handleFilterChange('date_from', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Date To
              </label>
              <input
                type="date"
                value={filters.date_to}
                onChange={(e) => handleFilterChange('date_to', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div className="flex items-end gap-2">
              <button
                onClick={handleApplyFilters}
                className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
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
        <div className="bg-white rounded-xl shadow-md p-4 mb-6 border-2 border-gray-200">
          <div className="flex flex-col sm:flex-row gap-4 justify-between items-center">
            <div className="relative flex-1 w-full">
              <MagnifyingGlassIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
              <input
                type="text"
                placeholder="Search movements by item name, notes, or type..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <button
              onClick={() => navigate('/transactions/new')}
              className="flex items-center gap-2 px-6 py-2 bg-gradient-to-r from-green-600 to-emerald-600 text-white rounded-lg hover:from-green-700 hover:to-emerald-700 transition-all whitespace-nowrap font-medium shadow-md"
            >
              <PlusIcon className="h-5 w-5" />
              New Stock Entry
            </button>
          </div>
        </div>

        {/* Movements Display - Professional Cards */}
        <div className="bg-white rounded-xl shadow-md overflow-hidden border-2 border-gray-200">
          {loading ? (
            <div className="flex justify-center items-center p-12">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
            </div>
          ) : filteredMovements.length === 0 ? (
            <div className="text-center py-16 px-6">
              <div className="inline-block p-6 bg-blue-100 rounded-full mb-4">
                <svg className="w-16 h-16 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                </svg>
              </div>
              <h3 className="text-2xl font-bold text-gray-900 mb-2">No Stock Movements Found</h3>
              <p className="text-lg text-gray-600 mb-2">
                This is the Stock Movement History Page
              </p>
              <p className="text-sm text-gray-500 mb-8 max-w-md mx-auto">
                Stock movements are recorded automatically when transactions occur. Create a transaction to see movement records here.
              </p>
              <div className="flex gap-4 justify-center">
                <button
                  onClick={() => navigate('/transactions/new')}
                  className="inline-flex items-center px-6 py-3 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-lg hover:shadow-lg transition-all hover:-translate-y-0.5 text-lg font-medium"
                >
                  <PlusIcon className="h-6 w-6 mr-2" />
                  Create Transaction
                </button>
                <button
                  onClick={() => navigate('/dashboard')}
                  className="inline-flex items-center px-6 py-3 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors text-lg font-medium"
                >
                  ← Back to Dashboard
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-4 p-4">
              {groupedMovements.map(([date, dayMovements]) => {
                const dayStats = dayMovements.reduce((acc, m) => {
                  acc.total++;
                  if (m.movement_type === 'IN') {
                    acc.stockIn++;
                    acc.valueIn += (parseFloat(m.quantity) * parseFloat(m.unit_price || 0));
                  } else if (m.movement_type === 'OUT') acc.stockOut++;
                  else acc.adjustments++;
                  return acc;
                }, { total: 0, stockIn: 0, stockOut: 0, adjustments: 0, valueIn: 0 });
                
                const isExpanded = expandedBatches[date];
                
                // Calculate item type breakdown for this day
                const itemBreakdown = dayMovements.reduce((acc, m) => {
                  const type = m.item_type || 'PRODUCT';
                  acc[type] = (acc[type] || 0) + 1;
                  return acc;
                }, {});
                
                return (
                  <div key={date} className="bg-white rounded-xl shadow-md overflow-hidden border-2 border-gray-200">
                    {/* Batch Header */}
                    <div 
                      onClick={() => toggleBatch(date)}
                      className="flex items-center justify-between p-5 bg-gradient-to-r from-blue-50 via-indigo-50 to-purple-50 border-b-2 border-gray-300 cursor-pointer hover:from-blue-100 hover:via-indigo-100 hover:to-purple-100 transition-all shadow-sm"
                    >
                      <div className="flex items-center gap-4">
                        <div className="p-3 bg-white rounded-xl shadow-md border-2 border-blue-200">
                          <svg className="w-7 h-7 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                          </svg>
                        </div>
                        <div>
                          <h3 className="text-xl font-bold text-gray-900">{formatDateLabel(date)}</h3>
                          <p className="text-sm text-gray-600 font-medium">
                            {new Date(date).toLocaleDateString('en-US', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })}
                          </p>
                        </div>
                      </div>
                      
                      <div className="flex items-center gap-6">
                        {/* Item Type Breakdown - PROMINENT DISPLAY */}
                        <div className="flex items-center gap-3">
                          {itemBreakdown.PRODUCT > 0 && (
                            <div className="flex items-center gap-1.5 px-3 py-1.5 bg-purple-100 border-2 border-purple-300 rounded-lg">
                              <span className="text-base">📦</span>
                              <span className="font-bold text-purple-800 text-sm">{itemBreakdown.PRODUCT}</span>
                            </div>
                          )}
                          {itemBreakdown.GRAIN > 0 && (
                            <div className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-100 border-2 border-amber-300 rounded-lg">
                              <span className="text-base">🌾</span>
                              <span className="font-bold text-amber-800 text-sm">{itemBreakdown.GRAIN}</span>
                            </div>
                          )}
                        </div>
                        
                        <div className="h-8 w-px bg-gray-300"></div>
                        
                        {/* Movement Type Stats */}
                        <div className="flex items-center gap-3">
                          {dayStats.stockIn > 0 && (
                            <div className="flex items-center gap-1.5 px-3 py-1.5 bg-green-100 border-2 border-green-300 rounded-lg">
                              <span className="text-base">⬆️</span>
                              <span className="font-bold text-green-800 text-sm">{dayStats.stockIn}</span>
                            </div>
                          )}
                          {dayStats.stockOut > 0 && (
                            <div className="flex items-center gap-1.5 px-3 py-1.5 bg-red-100 border-2 border-red-300 rounded-lg">
                              <span className="text-base">⬇️</span>
                              <span className="font-bold text-red-800 text-sm">{dayStats.stockOut}</span>
                            </div>
                          )}
                          {dayStats.adjustments > 0 && (
                            <div className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-100 border-2 border-blue-300 rounded-lg">
                              <span className="text-base">🔄</span>
                              <span className="font-bold text-blue-800 text-sm">{dayStats.adjustments}</span>
                            </div>
                          )}
                        </div>
                        
                        <div className="h-8 w-px bg-gray-300"></div>
                        
                        {/* Movement Count & Total Value */}
                        <div className="flex items-center gap-4">
                          <div className="flex items-center gap-2 px-3 py-1.5 bg-white rounded-lg border-2 border-gray-300 shadow-sm">
                            <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                            </svg>
                            <span className="text-sm font-bold text-gray-700">{dayStats.total}</span>
                          </div>
                          <div className="flex items-center gap-2 px-4 py-1.5 bg-gradient-to-r from-yellow-100 to-amber-100 rounded-lg border-2 border-yellow-400 shadow-sm">
                            <svg className="w-5 h-5 text-yellow-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                            <span className="text-base font-bold text-yellow-800">{formatCurrency(dayStats.valueIn)}</span>
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

                    {/* Movement Cards */}
                    {isExpanded && (
                      <div className="divide-y divide-gray-100">
                        {dayMovements.map((movement) => {
                          const movementBadge = getMovementTypeBadge(movement.movement_type);
                          const itemBadge = getItemTypeBadge(movement.item_type);
                          
                          return (
                            <div 
                              key={movement.movement_id} 
                              className="p-6 hover:bg-gradient-to-r hover:from-blue-50 hover:to-indigo-50 transition-all duration-200 border-b border-gray-200 last:border-b-0"
                            >
                              {/* Top Row: Time & Movement Type */}
                              <div className="flex items-center justify-between mb-4">
                                <div className="flex items-center gap-3">
                                  {/* Movement ID */}
                                  <div className="flex items-center gap-2 bg-gradient-to-r from-gray-600 to-gray-700 text-white px-4 py-2 rounded-lg shadow-md">
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 20l4-16m2 16l4-16M6 9h14M4 15h14" />
                                    </svg>
                                    <span className="font-bold text-sm">#{movement.movement_id}</span>
                                  </div>
                                  
                                  {/* Time Badge */}
                                  <div className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-100 border border-gray-300 rounded-lg">
                                    <svg className="w-4 h-4 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                                    </svg>
                                    <span className="text-xs font-semibold text-gray-700">
                                      {new Date(movement.movement_date).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
                                    </span>
                                  </div>
                                </div>
                                
                                {/* Movement Type Badge */}
                                <div className={`flex items-center gap-2 px-4 py-1.5 rounded-lg border-2 font-bold text-sm ${movementBadge.bg} ${movementBadge.text} ${movementBadge.border} shadow-sm`}>
                                  <span className="text-lg">{movementBadge.icon}</span>
                                  {movementBadge.label}
                                </div>
                              </div>
                              
                              {/* Main Content Card */}
                              <div className="bg-white border-2 border-gray-200 rounded-xl shadow-sm overflow-hidden">
                                {/* Item Type and Category Row - MOST PROMINENT */}
                                <div className="bg-gradient-to-r from-gray-50 via-white to-gray-50 px-5 py-4 border-b-2 border-gray-200">
                                  <div className="flex items-center gap-3">
                                    {/* Item Type Badge */}
                                    <div className={`flex items-center gap-2.5 px-4 py-2.5 rounded-xl border-2 shadow-md ${itemBadge.bg} ${itemBadge.text} ${itemBadge.border}`}>
                                      <span className="text-3xl">{itemBadge.icon}</span>
                                      <div className="flex flex-col">
                                        <span className="text-xs font-semibold uppercase tracking-wide opacity-75">Category</span>
                                        <span className="font-bold text-lg uppercase tracking-wide">{itemBadge.label}</span>
                                      </div>
                                    </div>
                                    
                                    {/* Quantity Change Badge */}
                                    <div className={`flex items-center gap-2.5 px-4 py-2.5 rounded-xl border-2 shadow-md ${
                                      movement.movement_type === 'IN' ? 'bg-green-100 border-green-300' :
                                      movement.movement_type === 'OUT' ? 'bg-red-100 border-red-300' :
                                      'bg-blue-100 border-blue-300'
                                    }`}>
                                      <span className="text-2xl">{movement.movement_type === 'IN' ? '📈' : movement.movement_type === 'OUT' ? '📉' : '⚖️'}</span>
                                      <div className="flex flex-col">
                                        <span className="text-xs font-semibold uppercase tracking-wide opacity-75">Quantity</span>
                                        <span className={`font-bold text-base uppercase tracking-wide ${
                                          movement.movement_type === 'IN' ? 'text-green-800' :
                                          movement.movement_type === 'OUT' ? 'text-red-800' :
                                          'text-blue-800'
                                        }`}>
                                          {movement.movement_type === 'IN' ? '+' : movement.movement_type === 'OUT' ? '-' : ''}
                                          {Math.round(parseFloat(movement.quantity))}
                                        </span>
                                      </div>
                                    </div>
                                    
                                    <div className="flex-1"></div>
                                    
                                    {/* Item Name - Right Side */}
                                    <div className="text-right">
                                      <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Item Name</p>
                                      <p className="text-xl font-bold text-gray-900">{getItemName(movement)}</p>
                                    </div>
                                  </div>
                                </div>
                                
                                {/* Movement Details Section */}
                                <div className="p-5">
                                  <div className="flex items-center gap-6 flex-wrap">
                                    {/* Stock Before/After */}
                                    <div className="flex items-center gap-3">
                                      <div className="flex-shrink-0 w-12 h-12 bg-gray-100 rounded-lg flex items-center justify-center">
                                        <ArrowsRightLeftIcon className="w-6 h-6 text-gray-600" />
                                      </div>
                                      <div>
                                        <p className="text-xs font-semibold text-gray-500 uppercase">Stock Level</p>
                                        <p className="text-base font-bold text-gray-700">
                                          {Math.round(parseFloat(movement.previous_quantity || 0))} → {Math.round(parseFloat(movement.new_quantity || 0))}
                                        </p>
                                      </div>
                                    </div>
                                    
                                    {/* Unit Price */}
                                    {movement.unit_price && (
                                      <div className="flex items-center gap-3">
                                        <div className="flex-shrink-0 w-12 h-12 bg-yellow-100 rounded-lg flex items-center justify-center">
                                          <svg className="w-6 h-6 text-yellow-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                          </svg>
                                        </div>
                                        <div>
                                          <p className="text-xs font-semibold text-gray-500 uppercase">Unit Price</p>
                                          <p className="text-base font-bold text-yellow-700">{formatCurrency(movement.unit_price)}</p>
                                        </div>
                                      </div>
                                    )}
                                    
                                    {/* Notes */}
                                    {movement.notes && (
                                      <div className="flex items-center gap-3 flex-1">
                                        <div className="flex-shrink-0 w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center">
                                          <svg className="w-6 h-6 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                                          </svg>
                                        </div>
                                        <div className="flex-1">
                                          <p className="text-xs font-semibold text-gray-500 uppercase">Notes</p>
                                          <p className="text-sm text-gray-700 line-clamp-2">{movement.notes}</p>
                                        </div>
                                      </div>
                                    )}
                                  </div>
                                </div>
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
      </div>
    </div>
  );
};

export default StockMovementsPage;
