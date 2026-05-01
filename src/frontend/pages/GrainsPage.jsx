import React, { useState, useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import { useToast } from '../components/common/Toast';
import {
  fetchAllGrains,
  createGrain,
  updateGrain,
  deleteGrain,
  searchGrains,
  fetchLowStockGrains,
  clearError,
  clearOperationSuccess,
} from '../store/slices/grainSlice';
import { addStock, adjustStock } from '../store/slices/stockSlice';

const GrainsPage = () => {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const toast = useToast();
  const { grains, lowStockGrains, loading, error, operationSuccess } = useSelector((state) => state.grain);
  const { user } = useSelector((state) => state.auth);

  const [showModal, setShowModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [showLowStockModal, setShowLowStockModal] = useState(false);
  const [showStockAdjustModal, setShowStockAdjustModal] = useState(false);
  const [showClearStockModal, setShowClearStockModal] = useState(false);
  const [editingGrain, setEditingGrain] = useState(null);
  const [deletingGrain, setDeletingGrain] = useState(null);
  const [adjustingGrain, setAdjustingGrain] = useState(null);
  const [clearingForDeletion, setClearingForDeletion] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [searchTimeout, setSearchTimeout] = useState(null);
  const [filterLowStock, setFilterLowStock] = useState(false);
  const [grainStockBatches, setGrainStockBatches] = useState({});
  const [expandedGrain, setExpandedGrain] = useState(null);

  const [stockAdjustData, setStockAdjustData] = useState({
    newQuantity: '0',
    reason: '',
  });
  
  const [clearStockData, setClearStockData] = useState({
    reason: '',
    notes: '',
  });

  const [formData, setFormData] = useState({
    grain_name: '',
    unit_type: 'kg',
    description: '',
    reorder_level: '0',
    initial_stock: '0',
    unit_price: '0',
    is_active: true,
  });

  const [formErrors, setFormErrors] = useState({});

  const unitOptions = ['kg', 'maund', 'quintal', 'ton', 'bag'];

  useEffect(() => {
    dispatch(fetchAllGrains());
  }, [dispatch]);

  // Load stock batch details for all grains
  useEffect(() => {
    const loadStockBatches = async () => {
      try {
        const batchesMap = {};
        for (const grain of grains) {
          const batches = await window.electronAPI.stock.getBatches({
            item_type: 'GRAIN',
            item_id: grain.grain_id
          });
          if (batches && batches.length > 0) {
            batchesMap[grain.grain_id] = batches;
          }
        }
        setGrainStockBatches(batchesMap);
      } catch (error) {
        console.error('[GrainsPage] Error loading stock batches:', error);
      }
    };

    if (grains.length > 0) {
      loadStockBatches();
    }
  }, [grains]);

  useEffect(() => {
    if (operationSuccess) {
      setShowModal(false);
      setShowDeleteModal(false);
      setEditingGrain(null);
      setDeletingGrain(null);
      resetForm();
      dispatch(fetchAllGrains());
      setTimeout(() => dispatch(clearOperationSuccess()), 3000);
    }
  }, [operationSuccess, dispatch]);

  useEffect(() => {
    if (error) {
      setTimeout(() => dispatch(clearError()), 5000);
    }
  }, [error, dispatch]);

  const resetForm = () => {
    setFormData({
      grain_name: '',
      unit_type: 'kg',
      description: '',
      reorder_level: '0',
      initial_stock: '0',
      unit_price: '0',
      is_active: true,
    });
    setFormErrors({});
  };

  const handleSearch = (value) => {
    setSearchTerm(value);
    if (searchTimeout) clearTimeout(searchTimeout);

    const timeout = setTimeout(() => {
      if (value.trim()) {
        dispatch(searchGrains(value));
      } else {
        applyFilters();
      }
    }, 500);

    setSearchTimeout(timeout);
  };

  const applyFilters = () => {
    const filters = {};
    if (filterLowStock) filters.low_stock = true;
    dispatch(fetchAllGrains(filters));
  };

  useEffect(() => {
    if (!searchTerm) {
      applyFilters();
    }
  }, [filterLowStock]);

  const validateForm = () => {
    const errors = {};

    if (!formData.grain_name.trim()) {
      errors.grain_name = 'Grain name is required';
    }

    if (!formData.unit_type) {
      errors.unit_type = 'Unit type is required';
    }

    const reorderLevel = parseFloat(formData.reorder_level);
    if (isNaN(reorderLevel) || reorderLevel < 0) {
      errors.reorder_level = 'Reorder level must be a positive number';
    }

    if (!editingGrain) {
      const initialStock = parseFloat(formData.initial_stock);
      if (isNaN(initialStock) || initialStock < 0) {
        errors.initial_stock = 'Initial stock must be a positive number';
      }

      const unitPrice = parseFloat(formData.unit_price);
      if (isNaN(unitPrice) || unitPrice < 0) {
        errors.unit_price = 'Unit price must be a positive number';
      }
    }

    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validateForm()) return;

    const grainData = {
      grain_name: formData.grain_name,
      unit_type: formData.unit_type,
      description: formData.description,
      reorder_level: parseFloat(formData.reorder_level),
      is_active: formData.is_active,
    };

    if (editingGrain) {
      dispatch(updateGrain({
        grainId: editingGrain.grain_id,
        updateData: grainData,
        userId: user.user_id,
      }));
    } else {
      // Create grain
      const result = await dispatch(createGrain({
        grainData,
        userId: user.user_id,
      }));

      console.log('[GrainsPage] Create grain result:', result);

      // If grain created successfully and initial stock > 0, add stock
      if (result.payload?.success && parseFloat(formData.initial_stock) > 0) {
        const grainId = result.payload.grain_id;
        console.log('[GrainsPage] Adding initial stock for grain:', grainId);
        
        const stockResult = await dispatch(addStock({
          itemType: 'GRAIN',
          itemId: grainId,
          quantity: parseFloat(formData.initial_stock),
          unitPrice: parseFloat(formData.unit_price),
          notes: 'Initial stock',
          userId: user.user_id,
        }));
        
        console.log('[GrainsPage] Stock add result:', stockResult);
        
        // Refetch grains to show updated stock
        await dispatch(fetchAllGrains());
      }
    }
  };

  const handleEdit = (grain) => {
    setEditingGrain(grain);
    setFormData({
      grain_name: grain.grain_name,
      unit_type: grain.unit_of_measure || grain.unit_type || 'kg',
      description: grain.description || '',
      reorder_level: grain.reorder_level?.toString() || '0',
      initial_stock: '0', // Not editable during edit
      unit_price: grain.stock_price?.toString() || grain.current_price?.toString() || '0',
      is_active: grain.is_active === 1,
    });
    setShowModal(true);
  };

  const handleDelete = (grain) => {
    setDeletingGrain(grain);
    
    // Check if grain has stock
    if (grain.current_stock && parseFloat(grain.current_stock) > 0) {
      // Prompt to clear stock first
      setClearingForDeletion(true);
      setShowClearStockModal(true);
      setClearStockData({
        reason: '',
        notes: '',
      });
    } else {
      // No stock, proceed to delete confirmation
      setShowDeleteModal(true);
    }
  };

  const handleClearStockForDeletion = async () => {
    if (!deletingGrain) return;
    
    if (!clearStockData.reason) {
      toast.warning('Please select a reason for clearing stock');
      return;
    }

    try {
      console.log('[GrainsPage] Clearing stock for deletion:', {
        grainId: deletingGrain.grain_id,
        currentStock: deletingGrain.current_stock,
        reason: clearStockData.reason
      });

      // Call backend to clear all stock batches
      const result = await window.electronAPI.stock.clearAllBatches({
        itemType: 'GRAIN',
        itemId: deletingGrain.grain_id,
        reason: clearStockData.reason,
        notes: clearStockData.notes || 'Stock cleared for grain deletion',
        userId: user.user_id,
      });

      console.log('[GrainsPage] Clear stock result:', result);

      if (result.success) {
        setShowClearStockModal(false);
        setClearingForDeletion(false);
        
        // Refresh grains to get updated stock
        const refreshResult = await dispatch(fetchAllGrains());
        
        // Update deletingGrain with refreshed data (stock should now be 0)
        if (refreshResult.payload) {
          const updatedGrain = refreshResult.payload.find(g => g.grain_id === deletingGrain.grain_id);
          if (updatedGrain) {
            setDeletingGrain(updatedGrain);
          }
        }
        
        // Now show delete confirmation
        toast.success(`Stock cleared successfully. ${result.batches_cleared} batch(es) removed. You can now proceed with deletion.`);
        setShowDeleteModal(true);
      } else {
        toast.error('Failed to clear stock: ' + (result.message || 'Unknown error'));
      }
    } catch (error) {
      console.error('[GrainsPage] Error clearing stock:', error);
      toast.error('Error clearing stock: ' + error.message);
    }
  };

  const confirmDelete = async () => {
    if (deletingGrain) {
      // Final check - ensure stock is 0
      if (deletingGrain.current_stock && parseFloat(deletingGrain.current_stock) > 0) {
        toast.error('Cannot delete grain with stock. Please clear stock first.');
        setShowDeleteModal(false);
        return;
      }

      dispatch(deleteGrain({
        grainId: deletingGrain.grain_id,
        userId: user.user_id,
      }));
    }
  };

  const openStockAdjustModal = (grain) => {
    setAdjustingGrain(grain);
    setStockAdjustData({
      newQuantity: grain.current_stock?.toString() || '0',
      reason: '',
    });
    setShowStockAdjustModal(true);
  };

  const handleStockAdjustment = async () => {
    if (!adjustingGrain) return;
    
    const newQty = parseFloat(stockAdjustData.newQuantity);
    if (isNaN(newQty) || newQty < 0) {
      toast.warning('Please enter a valid quantity (0 or greater)');
      return;
    }
    
    if (!stockAdjustData.reason) {
      toast.warning('Please select a reason for stock adjustment');
      return;
    }

    try {
      console.log('[GrainsPage] Adjusting stock:', { grainId: adjustingGrain.grain_id, newQty });
      
      // If setting to 0, clear all batches
      if (newQty === 0) {
        const result = await window.electronAPI.stock.clearAllBatches({
          itemType: 'GRAIN',
          itemId: adjustingGrain.grain_id,
          reason: stockAdjustData.reason,
          notes: `Manual stock adjustment: Set to 0 from ${adjustingGrain.current_stock}`,
          userId: user.user_id,
        });
        
        if (result.success) {
          setShowStockAdjustModal(false);
          setAdjustingGrain(null);
          await dispatch(fetchAllGrains());
          toast.success(`Stock cleared successfully. ${result.batches_cleared} batch(es) set to 0.`);
        } else {
          toast.error('Failed to clear stock: ' + (result.message || 'Unknown error'));
        }
      } else {
        // Regular adjustment (non-zero)
        const result = await dispatch(adjustStock({
          itemType: 'GRAIN',
          itemId: adjustingGrain.grain_id,
          newQuantity: newQty,
          reason: stockAdjustData.reason,
          notes: `Stock adjusted from ${adjustingGrain.current_stock} to ${newQty}`,
          userId: user.user_id,
        }));
        
        console.log('[GrainsPage] Adjust stock result:', result);
        
        if (adjustStock.fulfilled.match(result)) {
          setShowStockAdjustModal(false);
          setAdjustingGrain(null);
          await dispatch(fetchAllGrains());
          toast.success('Stock adjusted successfully');
        } else if (adjustStock.rejected.match(result)) {
          toast.error('Failed to adjust stock: ' + (result.payload || 'Unknown error'));
        }
      }
    } catch (error) {
      console.error('[GrainsPage] Error adjusting stock:', error);
      toast.error('Error adjusting stock: ' + error.message);
    }
  };

  const openCreateModal = () => {
    setEditingGrain(null);
    resetForm();
    setShowModal(true);
  };

  const showLowStock = async () => {
    await dispatch(fetchLowStockGrains());
    setShowLowStockModal(true);
  };

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-4 mb-4">
            <button
              onClick={() => navigate('/dashboard')}
              className="flex items-center gap-2 px-4 py-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
              </svg>
              Back to Dashboard
            </button>
          </div>
          <h1 className="text-3xl font-bold text-gray-900">Grains</h1>
          <p className="text-gray-600 mt-2">Manage grain types, varieties, and inventory</p>
        </div>

        {/* Success Message */}
        {operationSuccess && (
          <div className="mb-6 bg-green-50 border-l-4 border-green-500 p-4 rounded">
            <p className="text-green-800">{operationSuccess}</p>
          </div>
        )}

        {/* Error Message */}
        {error && (
          <div className="mb-6 bg-red-50 border-l-4 border-red-500 p-4 rounded">
            <p className="text-red-800">{error}</p>
          </div>
        )}

        {/* Actions Bar */}
        <div className="bg-white rounded-lg shadow-sm p-4 mb-6">
          <div className="flex flex-col gap-4">
            <div className="flex flex-col md:flex-row md:items-center gap-4">
              <div className="flex-1">
                <input
                  type="text"
                  placeholder="Search grains..."
                  value={searchTerm}
                  onChange={(e) => handleSearch(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                />
              </div>
              <div className="flex gap-2">
                <button
                  onClick={showLowStock}
                  className="bg-orange-600 hover:bg-orange-700 text-white px-4 py-2 rounded-lg font-medium transition-colors flex items-center gap-2"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                  </svg>
                  Low Stock
                </button>
                <button
                  onClick={openCreateModal}
                  className="bg-green-600 hover:bg-green-700 text-white px-6 py-2 rounded-lg font-medium transition-colors flex items-center gap-2"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                  </svg>
                  Add Grain
                </button>
              </div>
            </div>
            
            {/* Filters */}
            <div className="flex flex-wrap gap-3">
              <label className="flex items-center gap-2 px-4 py-2 border border-gray-300 rounded-lg cursor-pointer hover:bg-gray-50">
                <input
                  type="checkbox"
                  checked={filterLowStock}
                  onChange={(e) => setFilterLowStock(e.target.checked)}
                  className="h-4 w-4 text-green-600 focus:ring-green-500 border-gray-300 rounded"
                />
                <span className="text-sm text-gray-700">Low Stock Only</span>
              </label>
            </div>
          </div>
        </div>

        {/* Grains Table */}
        <div className="bg-white rounded-lg shadow-sm overflow-hidden">
          {loading ? (
            <div className="flex justify-center items-center h-64">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-600"></div>
            </div>
          ) : grains.length === 0 ? (
            <div className="text-center py-12">
              <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
              </svg>
              <h3 className="mt-2 text-sm font-medium text-gray-900">No grains found</h3>
              <p className="mt-1 text-sm text-gray-500">Get started by adding a new grain type.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Code</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Name</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Unit</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Stock</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Reorder</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Price</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {grains.map((grain) => {
                    const isLowStock = parseFloat(grain.current_stock || 0) <= parseFloat(grain.reorder_level || 0);
                    const hasBatches = grainStockBatches[grain.grain_id] && grainStockBatches[grain.grain_id].length > 0;
                    const unitType = grain.unit_of_measure || grain.unit_type || 'kg';
                    return (
                      <React.Fragment key={grain.grain_id}>
                      <tr className="hover:bg-gray-50">
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex items-center gap-2">
                            {hasBatches && (
                              <button
                                onClick={() => setExpandedGrain(expandedGrain === grain.grain_id ? null : grain.grain_id)}
                                className={`p-1 rounded hover:bg-gray-200 transition-colors ${
                                  expandedGrain === grain.grain_id ? 'bg-green-100' : ''
                                }`}
                                title={expandedGrain === grain.grain_id ? 'Hide batch details' : 'Show batch details'}
                              >
                                <svg className={`w-4 h-4 text-green-600 transform transition-transform ${
                                  expandedGrain === grain.grain_id ? 'rotate-90' : ''
                                }`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                                </svg>
                              </button>
                            )}
                            <span className="text-sm font-mono font-medium text-gray-900">{grain.grain_code}</span>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <div>
                            <div className="text-sm font-medium text-gray-900">{grain.grain_name}</div>
                            {grain.description && (
                              <div className="text-sm text-gray-500 line-clamp-1">{grain.description}</div>
                            )}
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className="text-sm text-gray-600">{unitType}</span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex items-center gap-2">
                            <span className={`text-sm font-medium ${isLowStock ? 'text-red-600' : 'text-gray-900'}`}>
                              {Math.round(parseFloat(grain.current_stock || 0))}
                              {isLowStock && (
                                <svg className="inline w-4 h-4 ml-1 text-red-600" fill="currentColor" viewBox="0 0 20 20">
                                  <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                                </svg>
                              )}
                            </span>
                            {hasBatches && (
                              <span className="px-1.5 py-0.5 bg-green-100 text-green-700 text-xs font-medium rounded">
                                {grainStockBatches[grain.grain_id].length} batches
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className="text-sm text-gray-600">{Math.round(parseFloat(grain.reorder_level || 0))}</span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          {hasBatches && grainStockBatches[grain.grain_id].length > 1 ? (
                            <div className="space-y-0.5">
                              <div className="text-xs text-gray-500">Min: Rs. {Math.min(...grainStockBatches[grain.grain_id].map(b => parseFloat(b.unit_price))).toFixed(2)}</div>
                              <div className="text-xs text-gray-500">Max: Rs. {Math.max(...grainStockBatches[grain.grain_id].map(b => parseFloat(b.unit_price))).toFixed(2)}</div>
                              <div className="text-xs font-semibold text-green-600">Avg: Rs. {(grainStockBatches[grain.grain_id].reduce((sum, b) => sum + parseFloat(b.unit_price), 0) / grainStockBatches[grain.grain_id].length).toFixed(2)}</div>
                            </div>
                          ) : (
                            <span className="text-sm text-gray-900">
                              Rs. {parseFloat(grain.current_price || grain.stock_price || 0).toFixed(2)}
                            </span>
                          )}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                            grain.is_active === 1 ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                          }`}>
                            {grain.is_active === 1 ? 'Active' : 'Inactive'}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                          <button
                            onClick={() => openStockAdjustModal(grain)}
                            className="text-green-600 hover:text-green-900 mr-3"
                            title="Adjust Stock"
                          >
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" />
                            </svg>
                          </button>
                          <button
                            onClick={() => handleEdit(grain)}
                            className="text-blue-600 hover:text-blue-900 mr-3"
                            title="Edit"
                          >
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                            </svg>
                          </button>
                          <button
                            onClick={() => handleDelete(grain)}
                            className="text-red-600 hover:text-red-900"
                            title="Delete"
                          >
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                          </button>
                        </td>
                      </tr>
                      {expandedGrain === grain.grain_id && grainStockBatches[grain.grain_id] && (
                        <tr className="bg-green-50">
                          <td colSpan="8" className="px-6 py-4">
                            <div className="bg-white rounded-lg border-2 border-green-300 p-4">
                              <div className="flex items-center justify-between mb-3">
                                <div className="flex items-center gap-2">
                                  <span className="text-xl">🌾</span>
                                  <h4 className="text-base font-bold text-green-900">Stock Batch Details for {grain.grain_name}</h4>
                                  <span className="px-2 py-1 bg-green-200 text-green-800 text-xs font-bold rounded">
                                    {grainStockBatches[grain.grain_id].length} Batches
                                  </span>
                                </div>
                                <button
                                  onClick={() => setExpandedGrain(null)}
                                  className="text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-full p-2 transition-colors"
                                  title="Close batch details"
                                >
                                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                  </svg>
                                </button>
                              </div>
                              
                              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                                {grainStockBatches[grain.grain_id].map((batch, index) => (
                                  <div key={batch.stock_id} className="bg-gradient-to-r from-green-50 to-emerald-50 border border-green-200 rounded-lg p-3">
                                    <div className="flex justify-between items-start mb-2">
                                      <span className="text-xs font-semibold text-green-700">
                                        Batch #{index + 1}
                                      </span>
                                      <span className="px-2 py-0.5 bg-green-200 text-green-800 text-xs font-bold rounded">
                                        {Math.round(parseFloat(batch.quantity))} {unitType}
                                      </span>
                                    </div>
                                    <div className="space-y-1">
                                      <div className="flex justify-between text-sm">
                                        <span className="text-gray-600">Unit Price:</span>
                                        <span className="font-bold text-green-900">Rs. {parseFloat(batch.unit_price).toFixed(2)}</span>
                                      </div>
                                      <div className="flex justify-between text-xs">
                                        <span className="text-gray-500">Batch Value:</span>
                                        <span className="font-semibold text-gray-700">
                                          Rs. {(parseFloat(batch.quantity) * parseFloat(batch.unit_price)).toFixed(2)}
                                        </span>
                                      </div>
                                      {batch.stock_location && (
                                        <div className="flex justify-between text-xs">
                                          <span className="text-gray-500">📍 Location:</span>
                                          <span className="font-medium text-gray-600">{batch.stock_location}</span>
                                        </div>
                                      )}
                                      <div className="text-xs text-gray-400 mt-2">
                                        Ref: {batch.batch_reference}
                                      </div>
                                    </div>
                                  </div>
                                ))}
                              </div>
                              
                              {/* Summary */}
                              <div className="mt-4 p-3 bg-gradient-to-r from-green-50 to-emerald-50 border border-green-300 rounded-lg">
                                <div className="grid grid-cols-4 gap-4 text-center">
                                  <div>
                                    <div className="text-xs text-gray-600">Total Quantity</div>
                                    <div className="text-lg font-bold text-green-700">
                                      {Math.round(grainStockBatches[grain.grain_id].reduce((sum, b) => sum + parseFloat(b.quantity), 0))} {unitType}
                                    </div>
                                  </div>
                                  <div>
                                    <div className="text-xs text-gray-600">Total Value</div>
                                    <div className="text-lg font-bold text-blue-700">
                                      Rs. {grainStockBatches[grain.grain_id].reduce((sum, b) => sum + (parseFloat(b.quantity) * parseFloat(b.unit_price)), 0).toFixed(2)}
                                    </div>
                                  </div>
                                  <div>
                                    <div className="text-xs text-gray-600">Price Range</div>
                                    <div className="text-sm font-semibold text-gray-700">
                                      Rs. {Math.min(...grainStockBatches[grain.grain_id].map(b => parseFloat(b.unit_price))).toFixed(2)} - 
                                      Rs. {Math.max(...grainStockBatches[grain.grain_id].map(b => parseFloat(b.unit_price))).toFixed(2)}
                                    </div>
                                  </div>
                                  <div>
                                    <div className="text-xs text-gray-600">Avg Price</div>
                                    <div className="text-lg font-bold text-indigo-700">
                                      Rs. {(grainStockBatches[grain.grain_id].reduce((sum, b) => sum + parseFloat(b.unit_price), 0) / grainStockBatches[grain.grain_id].length).toFixed(2)}
                                    </div>
                                  </div>
                                </div>
                              </div>
                            </div>
                          </td>
                        </tr>
                      )}
                      </React.Fragment>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Create/Edit Modal */}
        {showModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-xl max-w-3xl w-full shadow-2xl max-h-[90vh] overflow-hidden flex flex-col">
              {/* Professional Header */}
              <div className="bg-gradient-to-r from-green-600 via-green-500 to-emerald-600 px-6 py-5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="bg-white/20 p-3 rounded-xl">
                      <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                    </div>
                    <div>
                      <h2 className="text-2xl font-bold text-white">
                        {editingGrain ? 'Edit Grain' : 'Add New Grain'}
                      </h2>
                      <p className="text-green-100 text-sm mt-0.5">
                        {editingGrain ? `Updating ${editingGrain.grain_name}` : 'Add a new grain type to inventory'}
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowModal(false)}
                    className="text-white hover:bg-white hover:bg-opacity-20 rounded-full p-2 transition-colors"
                  >
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              </div>

              <form onSubmit={handleSubmit} className="p-6 overflow-y-auto flex-1">
                {/* Grain Code & Metadata Section (Edit Mode Only) */}
                {editingGrain && (
                  <div className="mb-6 p-5 bg-gradient-to-r from-amber-50 to-yellow-50 border-2 border-amber-200 rounded-xl">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-3">
                          <span className="text-2xl">🌾</span>
                          <h3 className="text-lg font-bold text-amber-900">Grain Information</h3>
                        </div>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                          <div>
                            <p className="text-xs text-gray-600 mb-1">Grain Code</p>
                            <p className="text-base font-mono font-bold text-amber-700 bg-white px-3 py-2 rounded border-2 border-amber-300">
                              {editingGrain.grain_code}
                            </p>
                          </div>
                          <div>
                            <p className="text-xs text-gray-600 mb-1">Created Date</p>
                            <p className="text-sm font-medium text-gray-700 bg-white px-3 py-2 rounded border border-gray-300">
                              {editingGrain.created_at ? new Date(editingGrain.created_at).toLocaleDateString('en-GB') : 'N/A'}
                            </p>
                          </div>
                          <div>
                            <p className="text-xs text-gray-600 mb-1">Last Updated</p>
                            <p className="text-sm font-medium text-gray-700 bg-white px-3 py-2 rounded border border-gray-300">
                              {editingGrain.updated_at ? new Date(editingGrain.updated_at).toLocaleDateString('en-GB') : 'N/A'}
                            </p>
                          </div>
                          <div>
                            <p className="text-xs text-gray-600 mb-1">Status</p>
                            <span className={`inline-flex items-center px-3 py-2 rounded ${
                              editingGrain.is_active === 1 ? 'bg-green-100 border border-green-300' : 'bg-red-100 border border-red-300'
                            }`}>
                              <span className={`w-2 h-2 rounded-full mr-2 ${editingGrain.is_active === 1 ? 'bg-green-500' : 'bg-red-500'}`}></span>
                              <span className={`text-sm font-semibold ${editingGrain.is_active === 1 ? 'text-green-700' : 'text-red-700'}`}>
                                {editingGrain.is_active === 1 ? 'Active' : 'Inactive'}
                              </span>
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* Current Stock Summary (Edit Mode Only) */}
                {editingGrain && (
                  <div className="mb-6 p-5 bg-gradient-to-r from-green-50 to-emerald-50 border-2 border-green-200 rounded-xl">
                    <div className="flex items-start gap-4">
                      <div className="flex-shrink-0">
                        <div className="bg-green-600 p-3 rounded-lg">
                          <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                          </svg>
                        </div>
                      </div>
                      <div className="flex-1">
                        <h3 className="text-lg font-bold text-green-900 mb-3">Current Stock Status</h3>
                        <div className="grid grid-cols-3 gap-4 mb-3">
                          <div className="bg-white rounded-lg p-3 border-2 border-green-300">
                            <p className="text-xs text-gray-600 mb-1">Stock Quantity</p>
                            <p className={`text-2xl font-bold ${
                              parseFloat(editingGrain.current_stock || 0) <= parseFloat(editingGrain.reorder_level || 0)
                                ? 'text-red-600'
                                : 'text-green-600'
                            }`}>
                              {Math.round(parseFloat(editingGrain.current_stock || 0))}
                            </p>
                            <p className="text-xs text-gray-600 mt-1">{editingGrain.unit_of_measure || editingGrain.unit_type || 'kg'}</p>
                          </div>
                          <div className="bg-white rounded-lg p-3 border-2 border-blue-300">
                            <p className="text-xs text-gray-600 mb-1">Current Price</p>
                            <p className="text-2xl font-bold text-blue-600">
                              {parseFloat(editingGrain.stock_price || editingGrain.current_price || 0).toFixed(2)}
                            </p>
                            <p className="text-xs text-gray-600 mt-1">Rs. per {editingGrain.unit_of_measure || editingGrain.unit_type || 'kg'}</p>
                          </div>
                          <div className="bg-white rounded-lg p-3 border-2 border-purple-300">
                            <p className="text-xs text-gray-600 mb-1">Stock Value</p>
                            <p className="text-2xl font-bold text-purple-600">
                              {(Math.round(parseFloat(editingGrain.current_stock || 0)) * parseFloat(editingGrain.stock_price || editingGrain.current_price || 0)).toFixed(2)}
                            </p>
                            <p className="text-xs text-gray-600 mt-1">Rs. Total</p>
                          </div>
                        </div>

                        {/* Batch Details */}
                        {grainStockBatches[editingGrain.grain_id] && grainStockBatches[editingGrain.grain_id].length > 0 && (
                          <div className="bg-white rounded-lg p-3 border border-green-200 mb-3">
                            <div className="flex items-center gap-2 mb-2">
                              <span className="text-base">📦</span>
                              <span className="text-sm font-semibold text-gray-700">Stock Batches: {grainStockBatches[editingGrain.grain_id].length}</span>
                            </div>
                            <div className="flex flex-wrap gap-2">
                              {grainStockBatches[editingGrain.grain_id].slice(0, 4).map((batch, idx) => (
                                <span key={batch.stock_id} className="px-2 py-1 bg-green-100 text-green-700 text-xs rounded-full">
                                  Batch {idx + 1}: {Math.round(parseFloat(batch.quantity))} @ Rs.{parseFloat(batch.unit_price).toFixed(2)}
                                </span>
                              ))}
                              {grainStockBatches[editingGrain.grain_id].length > 4 && (
                                <span className="px-2 py-1 bg-gray-100 text-gray-600 text-xs rounded-full">
                                  +{grainStockBatches[editingGrain.grain_id].length - 4} more
                                </span>
                              )}
                            </div>
                          </div>
                        )}

                        {/* Integrated Stock Management Section */}
                        <div className="bg-white rounded-xl p-4 border-2 border-green-300 mt-4">
                          <div className="flex items-center gap-2 mb-4">
                            <div className="bg-green-600 p-1.5 rounded">
                              <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                              </svg>
                            </div>
                            <h4 className="text-base font-bold text-green-900">Stock Management</h4>
                            <span className="ml-auto text-xs text-gray-500">Update inventory levels</span>
                          </div>

                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {/* Add Stock Card */}
                            <div className="bg-gradient-to-br from-green-50 to-emerald-50 border-2 border-green-300 rounded-lg p-4">
                              <div className="flex items-center gap-2 mb-3">
                                <svg className="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v3m0 0v3m0-3h3m-3 0H9m12 0a9 9 0 11-18 0 9 9 0 0118 0z" />
                                </svg>
                                <h5 className="text-sm font-bold text-green-900">Add New Stock</h5>
                              </div>
                              <div className="space-y-3">
                                <div>
                                  <label className="text-xs font-semibold text-gray-700 block mb-1">Quantity to Add</label>
                                  <div className="relative">
                                    <input
                                      type="number"
                                      step="0.01"
                                      min="0.01"
                                      placeholder="0.00"
                                      className="w-full px-3 py-2 border-2 border-green-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500"
                                      id="grainAddStockQuantity"
                                    />
                                    <span className="absolute right-3 top-2 text-gray-500 text-sm">{editingGrain.unit_of_measure || editingGrain.unit_type || 'kg'}</span>
                                  </div>
                                </div>
                                <div>
                                  <label className="text-xs font-semibold text-gray-700 block mb-1">Unit Price (Rs.)</label>
                                  <div className="relative">
                                    <span className="absolute left-3 top-2 text-gray-500 text-sm">Rs.</span>
                                    <input
                                      type="number"
                                      step="0.01"
                                      min="0"
                                      placeholder="0.00"
                                      defaultValue={editingGrain.stock_price || editingGrain.current_price || '0'}
                                      className="w-full pl-9 pr-3 py-2 border-2 border-green-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500"
                                      id="grainAddStockPrice"
                                    />
                                  </div>
                                </div>
                                <div>
                                  <label className="text-xs font-semibold text-gray-700 block mb-1">Notes (Optional)</label>
                                  <input
                                    type="text"
                                    placeholder="e.g., Purchase from supplier"
                                    className="w-full px-3 py-2 border-2 border-green-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500 text-sm"
                                    id="grainAddStockNotes"
                                  />
                                </div>
                                <button
                                  type="button"
                                  onClick={async () => {
                                    const qtyInput = document.getElementById('grainAddStockQuantity');
                                    const priceInput = document.getElementById('grainAddStockPrice');
                                    const notesInput = document.getElementById('grainAddStockNotes');
                                    
                                    const quantity = parseFloat(qtyInput.value);
                                    const price = parseFloat(priceInput.value);
                                    const notes = notesInput.value || 'Stock added from grain edit';
                                    
                                    if (isNaN(quantity) || quantity <= 0) {
                                      toast.warning('Please enter a valid quantity greater than 0');
                                      return;
                                    }
                                    if (isNaN(price) || price < 0) {
                                      toast.warning('Please enter a valid price');
                                      return;
                                    }
                                    
                                    try {
                                      const result = await dispatch(addStock({
                                        itemType: 'GRAIN',
                                        itemId: editingGrain.grain_id,
                                        quantity: quantity,
                                        unitPrice: price,
                                        notes: notes,
                                        userId: user.user_id,
                                      }));
                                      
                                      if (addStock.fulfilled.match(result)) {
                                        toast.success(`Stock added successfully! Added ${quantity} ${editingGrain.unit_of_measure || editingGrain.unit_type || 'kg'}`);
                                        qtyInput.value = '';
                                        notesInput.value = '';
                                        await dispatch(fetchAllGrains());
                                        // Update editing grain with new stock
                                        const updatedGrains = await dispatch(fetchAllGrains());
                                        const updatedGrain = updatedGrains.payload?.find(g => g.grain_id === editingGrain.grain_id);
                                        if (updatedGrain) {
                                          setEditingGrain(updatedGrain);
                                          // Reset price input to updated stock price
                                          priceInput.value = updatedGrain.stock_price || updatedGrain.current_price || '0';
                                        }
                                      } else {
                                        toast.error('Failed to add stock: ' + (result.payload || 'Unknown error'));
                                      }
                                    } catch (error) {
                                      toast.error('Error adding stock: ' + error.message);
                                    }
                                  }}
                                  className="w-full px-4 py-2.5 bg-green-600 text-white text-sm font-bold rounded-lg hover:bg-green-700 transition-colors flex items-center justify-center gap-2"
                                >
                                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                                  </svg>
                                  Add Stock
                                </button>
                              </div>
                            </div>

                            {/* Set Stock Level Card */}
                            <div className="bg-gradient-to-br from-orange-50 to-yellow-50 border-2 border-orange-300 rounded-lg p-4">
                              <div className="flex items-center gap-2 mb-3">
                                <svg className="w-5 h-5 text-orange-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" />
                                </svg>
                                <h5 className="text-sm font-bold text-orange-900">Set Stock Level</h5>
                              </div>
                              <div className="space-y-3">
                                <div>
                                  <label className="text-xs font-semibold text-gray-700 block mb-1">New Stock Level</label>
                                  <div className="relative">
                                    <input
                                      type="number"
                                      step="0.01"
                                      min="0"
                                      placeholder={editingGrain.current_stock || '0.00'}
                                      defaultValue={editingGrain.current_stock || '0'}
                                      className="w-full px-3 py-2 border-2 border-orange-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                                      id="grainSetStockQuantity"
                                    />
                                    <span className="absolute right-3 top-2 text-gray-500 text-sm">{editingGrain.unit_of_measure || editingGrain.unit_type || 'kg'}</span>
                                  </div>
                                  <p className="text-xs text-gray-600 mt-1">Current: {Math.round(parseFloat(editingGrain.current_stock || 0))}</p>
                                </div>
                                <div>
                                  <label className="text-xs font-semibold text-gray-700 block mb-1">Reason *</label>
                                  <select
                                    className="w-full px-3 py-2 border-2 border-orange-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500 text-sm"
                                    id="grainSetStockReason"
                                  >
                                    <option value="">Select reason...</option>
                                    <option value="INVENTORY_COUNT">Inventory Count</option>
                                    <option value="DAMAGE_SPOILAGE">Damage/Spoilage</option>
                                    <option value="LOSS_THEFT">Loss/Theft</option>
                                    <option value="FOUND_ITEMS">Found Items</option>
                                    <option value="DATA_CORRECTION">Data Correction</option>
                                    <option value="EXPIRED_DISPOSED">Expired/Disposed</option>
                                    <option value="OTHER">Other</option>
                                  </select>
                                </div>
                                <div>
                                  <label className="text-xs font-semibold text-gray-700 block mb-1">Notes (Optional)</label>
                                  <input
                                    type="text"
                                    placeholder="Adjustment details"
                                    className="w-full px-3 py-2 border-2 border-orange-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500 text-sm"
                                    id="grainSetStockNotes"
                                  />
                                </div>
                                <button
                                  type="button"
                                  onClick={async () => {
                                    const qtyInput = document.getElementById('grainSetStockQuantity');
                                    const reasonSelect = document.getElementById('grainSetStockReason');
                                    const notesInput = document.getElementById('grainSetStockNotes');
                                    
                                    const newQty = parseFloat(qtyInput.value);
                                    const reason = reasonSelect.value;
                                    const notes = notesInput.value || `Stock adjusted from ${editingGrain.current_stock} to ${newQty}`;
                                    
                                    if (isNaN(newQty) || newQty < 0) {
                                      toast.warning('Please enter a valid quantity (0 or greater)');
                                      return;
                                    }
                                    if (!reason) {
                                      toast.warning('Please select a reason for adjustment');
                                      return;
                                    }
                                    
                                    try {
                                      // If setting to 0, clear all batches
                                      if (newQty === 0) {
                                        const result = await window.electronAPI.stock.clearAllBatches({
                                          itemType: 'GRAIN',
                                          itemId: editingGrain.grain_id,
                                          reason: reason,
                                          notes: notes,
                                          userId: user.user_id,
                                        });
                                        
                                        if (result.success) {
                                          toast.success(`Stock cleared successfully. ${result.batches_cleared} batch(es) set to 0.`);
                                          await dispatch(fetchAllGrains());
                                          const updatedGrains = await dispatch(fetchAllGrains());
                                          const updatedGrain = updatedGrains.payload?.find(g => g.grain_id === editingGrain.grain_id);
                                          if (updatedGrain) {
                                            setEditingGrain(updatedGrain);
                                            // Reset input to new current stock value
                                            qtyInput.value = updatedGrain.current_stock || '0';
                                          }
                                          reasonSelect.value = '';
                                          notesInput.value = '';
                                        } else {
                                          toast.error('Failed to clear stock: ' + (result.message || 'Unknown error'));
                                        }
                                      } else {
                                        // Regular adjustment
                                        const result = await dispatch(adjustStock({
                                          itemType: 'GRAIN',
                                          itemId: editingGrain.grain_id,
                                          newQuantity: newQty,
                                          reason: reason,
                                          notes: notes,
                                          userId: user.user_id,
                                        }));
                                        
                                        if (adjustStock.fulfilled.match(result)) {
                                          toast.success(`Stock adjusted successfully to ${newQty} ${editingGrain.unit_of_measure || editingGrain.unit_type || 'kg'}`);
                                          await dispatch(fetchAllGrains());
                                          const updatedGrains = await dispatch(fetchAllGrains());
                                          const updatedGrain = updatedGrains.payload?.find(g => g.grain_id === editingGrain.grain_id);
                                          if (updatedGrain) {
                                            setEditingGrain(updatedGrain);
                                            // Reset input to new current stock value
                                            qtyInput.value = updatedGrain.current_stock || '0';
                                          }
                                          reasonSelect.value = '';
                                          notesInput.value = '';
                                        } else {
                                          toast.error('Failed to adjust stock: ' + (result.payload || 'Unknown error'));
                                        }
                                      }
                                    } catch (error) {
                                      toast.error('Error adjusting stock: ' + error.message);
                                    }
                                  }}
                                  className="w-full px-4 py-2.5 bg-orange-600 text-white text-sm font-bold rounded-lg hover:bg-orange-700 transition-colors flex items-center justify-center gap-2"
                                >
                                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                                  </svg>
                                  Update Level
                                </button>
                              </div>
                            </div>
                          </div>

                          <div className="mt-4 p-3 bg-green-50 border border-green-200 rounded-lg">
                            <p className="text-xs text-green-800">
                              <span className="font-semibold">💡 Tip:</span> Use "Add Stock" for purchases/receipts. Use "Set Stock Level" for corrections or adjustments. All changes are tracked in Stock Movements.
                            </p>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* Form Fields */}
                <div className="bg-gray-50 rounded-xl p-5 border border-gray-200">
                  <div className="flex items-center gap-2 mb-4">
                    <span className="text-xl">✏️</span>
                    <h3 className="text-lg font-bold text-gray-800">
                      {editingGrain ? 'Edit Details' : 'Grain Details'}
                    </h3>
                  </div>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Grain Name *
                      </label>
                      <input
                        type="text"
                        value={formData.grain_name}
                        onChange={(e) => setFormData({ ...formData, grain_name: e.target.value })}
                        className={`w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent ${
                          formErrors.grain_name ? 'border-red-500' : 'border-gray-300'
                        }`}
                        placeholder="e.g., Wheat, Rice, Corn"
                      />
                      {formErrors.grain_name && (
                        <p className="text-red-500 text-xs mt-1">{formErrors.grain_name}</p>
                      )}
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Unit Type *
                      </label>
                      <select
                        value={formData.unit_type}
                        onChange={(e) => setFormData({ ...formData, unit_type: e.target.value })}
                        className={`w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent ${
                          formErrors.unit_type ? 'border-red-500' : 'border-gray-300'
                        }`}
                      >
                        {unitOptions.map((unit) => (
                          <option key={unit} value={unit}>{unit}</option>
                        ))}
                      </select>
                      {formErrors.unit_type && (
                        <p className="text-red-500 text-xs mt-1">{formErrors.unit_type}</p>
                      )}
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Reorder Level *
                      </label>
                      <div className="relative">
                        <input
                          type="number"
                          step="0.01"
                          value={formData.reorder_level || ''}
                          onChange={(e) => setFormData({ ...formData, reorder_level: e.target.value })}
                          onKeyDown={(e) => {
                            if (e.key === 'e' || e.key === 'E' || e.key === '+' || e.key === '-') {
                              e.preventDefault();
                            }
                          }}
                          className={`w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent ${
                            formErrors.reorder_level ? 'border-red-500' : 'border-gray-300'
                          }`}
                          placeholder="0.00"
                          min="0"
                        />
                        <span className="absolute right-4 top-1/2 transform -translate-y-1/2 text-gray-500 text-sm">
                          {formData.unit_type}
                        </span>
                      </div>
                      {formErrors.reorder_level && (
                        <p className="text-red-500 text-xs mt-1">{formErrors.reorder_level}</p>
                      )}
                    </div>

                    <div className="flex items-center">
                      <label className="relative inline-flex items-center cursor-pointer">
                        <input
                          type="checkbox"
                          id="is_active_grain"
                          checked={formData.is_active}
                          onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
                          className="sr-only peer"
                        />
                        <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-green-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-green-600"></div>
                        <span className="ml-3 text-sm font-medium text-gray-700">Active Status</span>
                      </label>
                    </div>

                    {!editingGrain && (
                      <>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">
                            Initial Stock *
                          </label>
                          <div className="relative">
                            <input
                              type="number"
                              step="0.01"
                              value={formData.initial_stock || ''}
                              onChange={(e) => setFormData({ ...formData, initial_stock: e.target.value })}
                              onKeyDown={(e) => {
                                if (e.key === 'e' || e.key === 'E' || e.key === '+' || e.key === '-') {
                                  e.preventDefault();
                                }
                              }}
                              className={`w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent ${
                                formErrors.initial_stock ? 'border-red-500' : 'border-gray-300'
                              }`}
                              placeholder="0.00"
                              min="0"
                            />
                            <span className="absolute right-4 top-1/2 transform -translate-y-1/2 text-gray-500 text-sm">
                              {formData.unit_type}
                            </span>
                          </div>
                          {formErrors.initial_stock && (
                            <p className="text-red-500 text-xs mt-1">{formErrors.initial_stock}</p>
                          )}
                          <p className="text-xs text-gray-500 mt-1">Opening stock quantity</p>
                        </div>

                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">
                            Unit Price (Rs.) *
                          </label>
                          <div className="relative">
                            <span className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-500 text-sm">
                              Rs.
                            </span>
                            <input
                              type="number"
                              step="0.01"
                              value={formData.purchase_price || ''}
                              onChange={(e) => setFormData({ ...formData, purchase_price: e.target.value })}
                              onKeyDown={(e) => {
                                if (e.key === 'e' || e.key === 'E' || e.key === '+' || e.key === '-') {
                                  e.preventDefault();
                                }
                              }}
                              className={`w-full pl-12 pr-4 py-3 border rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent ${
                                formErrors.purchase_price ? 'border-red-500' : 'border-gray-300'
                              }`}
                              placeholder="0.00"
                              min="0"
                            />
                          </div>
                          {formErrors.unit_price && (
                            <p className="text-red-500 text-xs mt-1">{formErrors.unit_price}</p>
                          )}
                          <p className="text-xs text-gray-500 mt-1">Price per {formData.unit_type}</p>
                        </div>
                      </>
                    )}

                    <div className="md:col-span-2">
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Description
                      </label>
                      <textarea
                        value={formData.description}
                        onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                        className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                        rows="3"
                        placeholder="Additional details about the grain..."
                      />
                    </div>
                  </div>
                </div>

                {/* Action Buttons */}
                <div className="mt-6 flex gap-3">
                  <button
                    type="button"
                    onClick={() => setShowModal(false)}
                    className="flex-1 px-4 py-3 border-2 border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 font-medium transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={loading}
                    className="flex-1 px-4 py-3 bg-gradient-to-r from-green-600 to-emerald-600 text-white rounded-lg hover:from-green-700 hover:to-emerald-700 font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                  >
                    {loading ? (
                      <>
                        <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                        Saving...
                      </>
                    ) : (
                      <>
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                        {editingGrain ? 'Update Grain' : 'Create Grain'}
                      </>
                    )}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Delete Confirmation Modal */}
        {showDeleteModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-lg max-w-md w-full p-6">
              <h2 className="text-xl font-bold mb-4 text-red-600">Confirm Delete</h2>
              <p className="text-gray-700 mb-6">
                Are you sure you want to delete grain "{deletingGrain?.grain_name}"?
                {deletingGrain?.current_stock > 0 && (
                  <span className="block mt-2 text-red-600 font-medium">
                    Warning: This grain has {Math.round(parseFloat(deletingGrain.current_stock))} {deletingGrain.unit_of_measure || deletingGrain.unit_type || 'kg'} in stock.
                  </span>
                )}
              </p>
              <div className="flex gap-3">
                <button
                  onClick={() => setShowDeleteModal(false)}
                  className="flex-1 px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  onClick={confirmDelete}
                  disabled={loading}
                  className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50"
                >
                  {loading ? 'Deleting...' : 'Delete'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Low Stock Modal */}
        {showLowStockModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-lg max-w-4xl w-full p-6 max-h-[90vh] overflow-y-auto">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-xl font-bold text-orange-600">Low Stock Grains</h2>
                <button
                  onClick={() => setShowLowStockModal(false)}
                  className="text-gray-500 hover:text-gray-700"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
              {lowStockGrains.length === 0 ? (
                <p className="text-gray-600 text-center py-8">No grains with low stock</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Grain</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Unit</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Current</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Reorder</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Shortage</th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {lowStockGrains.map((grain) => {
                        const shortage = parseFloat(grain.reorder_level) - parseFloat(grain.current_stock || 0);
                        const unitType = grain.unit_of_measure || grain.unit_type || 'kg';
                        return (
                          <tr key={grain.grain_id}>
                            <td className="px-4 py-3 text-sm font-medium text-gray-900">{grain.grain_name}</td>
                            <td className="px-4 py-3 text-sm text-gray-600">{unitType}</td>
                            <td className="px-4 py-3 text-sm text-red-600 font-medium">
                              {parseFloat(grain.current_stock || 0).toFixed(2)} {unitType}
                            </td>
                            <td className="px-4 py-3 text-sm text-gray-900">
                              {parseFloat(grain.reorder_level).toFixed(2)} {unitType}
                            </td>
                            <td className="px-4 py-3 text-sm font-medium text-orange-600">
                              {shortage.toFixed(2)} {unitType}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Stock Adjustment Modal */}
        {showStockAdjustModal && adjustingGrain && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-xl max-w-lg w-full shadow-2xl overflow-hidden">
              {/* Professional Header */}
              <div className="bg-gradient-to-r from-green-600 via-green-500 to-emerald-600 px-6 py-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="bg-white/20 p-2 rounded-lg">
                      <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" />
                      </svg>
                    </div>
                    <div>
                      <h2 className="text-xl font-bold text-white">Adjust Stock</h2>
                      <p className="text-green-100 text-sm">{adjustingGrain.grain_name}</p>
                    </div>
                  </div>
                  <button
                    onClick={() => {
                      setShowStockAdjustModal(false);
                      setAdjustingGrain(null);
                    }}
                    className="text-white/80 hover:text-white hover:bg-white/20 rounded-full p-2 transition-colors"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              </div>

              <div className="p-6">
                {/* Current Stock Info */}
                <div className="bg-gradient-to-r from-green-50 to-emerald-50 border border-green-200 rounded-lg p-4 mb-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="text-sm text-gray-600">Current Stock Level</span>
                      <div className="flex items-center gap-2 mt-1">
                        <span className="text-2xl font-bold text-green-700">
                          {parseFloat(adjustingGrain.current_stock || 0).toFixed(2)}
                        </span>
                        <span className="text-green-600 font-medium">
                          {adjustingGrain.unit_of_measure || adjustingGrain.unit_type || 'kg'}
                        </span>
                      </div>
                    </div>
                    <div className="text-right">
                      <span className="text-sm text-gray-600">Reorder Level</span>
                      <div className="text-lg font-semibold text-gray-700 mt-1">
                        {parseFloat(adjustingGrain.reorder_level || 0).toFixed(2)} {adjustingGrain.unit_of_measure || adjustingGrain.unit_type || 'kg'}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Adjustment Form */}
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      New Quantity *
                    </label>
                    <div className="relative">
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        value={stockAdjustData.newQuantity}
                        onChange={(e) => setStockAdjustData({ ...stockAdjustData, newQuantity: e.target.value })}
                        onKeyDown={(e) => {
                          if (e.key === 'e' || e.key === 'E' || e.key === '+' || e.key === '-') {
                            e.preventDefault();
                          }
                        }}
                        className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent text-lg"
                        placeholder="Enter new quantity"
                      />
                      <span className="absolute right-4 top-1/2 transform -translate-y-1/2 text-gray-500 font-medium">
                        {adjustingGrain.unit_of_measure || adjustingGrain.unit_type || 'kg'}
                      </span>
                    </div>
                    {parseFloat(stockAdjustData.newQuantity || 0) !== parseFloat(adjustingGrain.current_stock || 0) && (
                      <div className={`mt-2 text-sm font-medium ${
                        parseFloat(stockAdjustData.newQuantity || 0) > parseFloat(adjustingGrain.current_stock || 0)
                          ? 'text-green-600' : 'text-red-600'
                      }`}>
                        {parseFloat(stockAdjustData.newQuantity || 0) > parseFloat(adjustingGrain.current_stock || 0)
                          ? `↑ Increase of ${(parseFloat(stockAdjustData.newQuantity || 0) - parseFloat(adjustingGrain.current_stock || 0)).toFixed(2)}`
                          : `↓ Decrease of ${(parseFloat(adjustingGrain.current_stock || 0) - parseFloat(stockAdjustData.newQuantity || 0)).toFixed(2)}`
                        }
                      </div>
                    )}
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Reason for Adjustment *
                    </label>
                    <select
                      value={stockAdjustData.reason}
                      onChange={(e) => setStockAdjustData({ ...stockAdjustData, reason: e.target.value })}
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                    >
                      <option value="">Select a reason...</option>
                      <option value="Inventory Count">Inventory Count</option>
                      <option value="Damage">Damage</option>
                      <option value="Expired">Expired / Spoilage</option>
                      <option value="Manual Adjustment">Manual Adjustment</option>
                      <option value="Quality Issue">Quality Issue</option>
                      <option value="Transfer">Transfer</option>
                      <option value="Other">Other</option>
                    </select>
                  </div>
                </div>

                {/* Action Buttons */}
                <div className="flex gap-3 mt-6">
                  <button
                    onClick={() => {
                      setShowStockAdjustModal(false);
                      setAdjustingGrain(null);
                    }}
                    className="flex-1 px-4 py-3 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 font-medium transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleStockAdjustment}
                    disabled={loading || !stockAdjustData.reason}
                    className="flex-1 px-4 py-3 bg-gradient-to-r from-green-600 to-emerald-600 text-white rounded-lg hover:from-green-700 hover:to-emerald-700 font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {loading ? 'Adjusting...' : 'Apply Adjustment'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Clear Stock Modal */}
        {showClearStockModal && deletingGrain && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-xl max-w-lg w-full shadow-2xl overflow-hidden">
              {/* Warning Header */}
              <div className="bg-gradient-to-r from-orange-600 via-orange-500 to-amber-600 px-6 py-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="bg-white/20 p-2 rounded-lg">
                      <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                      </svg>
                    </div>
                    <div>
                      <h2 className="text-xl font-bold text-white">Clear Stock Required</h2>
                      <p className="text-orange-100 text-sm">{deletingGrain.grain_name}</p>
                    </div>
                  </div>
                  <button
                    onClick={() => {
                      setShowClearStockModal(false);
                      setDeletingGrain(null);
                      setClearingForDeletion(false);
                    }}
                    className="text-white/80 hover:text-white hover:bg-white/20 rounded-full p-2 transition-colors"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              </div>

              <div className="p-6">
                {/* Warning Message */}
                <div className="bg-gradient-to-r from-red-50 to-orange-50 border border-red-200 rounded-lg p-4 mb-6">
                  <div className="flex items-start gap-3">
                    <svg className="w-6 h-6 text-red-600 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                    </svg>
                    <div>
                      <h4 className="text-red-800 font-semibold">Stock Must Be Cleared Before Deletion</h4>
                      <p className="text-red-700 text-sm mt-1">
                        This grain has <span className="font-bold">{parseFloat(deletingGrain.current_stock || 0).toFixed(2)} {deletingGrain.unit_of_measure || deletingGrain.unit_type || 'kg'}</span> in stock.
                        You must clear all stock before deleting this grain.
                      </p>
                    </div>
                  </div>
                </div>

                {/* Reason Selection */}
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Reason for Clearing Stock *
                    </label>
                    <select
                      value={clearStockData.reason}
                      onChange={(e) => setClearStockData({ ...clearStockData, reason: e.target.value })}
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                    >
                      <option value="">Select a reason...</option>
                      <option value="Inventory Write-off">Inventory Write-off</option>
                      <option value="Grain Discontinued">Grain Discontinued</option>
                      <option value="Quality Issue">Quality Issue</option>
                      <option value="Expired/Spoiled">Expired / Spoiled</option>
                      <option value="Manual Correction">Manual Correction</option>
                      <option value="Other">Other</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Additional Notes (Optional)
                    </label>
                    <textarea
                      value={clearStockData.notes}
                      onChange={(e) => setClearStockData({ ...clearStockData, notes: e.target.value })}
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                      rows="2"
                      placeholder="Any additional notes about this stock clearance..."
                    />
                  </div>
                </div>

                {/* Action Buttons */}
                <div className="flex gap-3 mt-6">
                  <button
                    onClick={() => {
                      setShowClearStockModal(false);
                      setDeletingGrain(null);
                      setClearingForDeletion(false);
                    }}
                    className="flex-1 px-4 py-3 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 font-medium transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleClearStockForDeletion}
                    disabled={loading || !clearStockData.reason}
                    className="flex-1 px-4 py-3 bg-gradient-to-r from-orange-600 to-amber-600 text-white rounded-lg hover:from-orange-700 hover:to-amber-700 font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {loading ? 'Clearing...' : 'Clear Stock & Continue'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default GrainsPage;
