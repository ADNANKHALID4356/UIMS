import React, { useState, useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import { useToast } from '../components/common/Toast';
import {
  fetchAllCategories,
  createCategory,
  updateCategory,
  deleteCategory,
  searchCategories,
  clearError,
  clearOperationSuccess,
} from '../store/slices/productCategorySlice';

const ProductCategoriesPage = () => {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const toast = useToast();
  const { categories, loading, error, operationSuccess } = useSelector((state) => state.productCategory);
  const { user } = useSelector((state) => state.auth);

  const [showModal, setShowModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [showClearProductsModal, setShowClearProductsModal] = useState(false);
  const [editingCategory, setEditingCategory] = useState(null);
  const [deletingCategory, setDeletingCategory] = useState(null);
  const [clearReason, setClearReason] = useState('');
  const [clearNotes, setClearNotes] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [searchTimeout, setSearchTimeout] = useState(null);

  const [formData, setFormData] = useState({
    category_name: '',
    description: '',
    is_active: true,
  });

  const [formErrors, setFormErrors] = useState({});

  useEffect(() => {
    dispatch(fetchAllCategories({ is_active: 1 }));
  }, [dispatch]);

  useEffect(() => {
    if (operationSuccess) {
      setShowModal(false);
      setShowDeleteModal(false);
      setEditingCategory(null);
      setDeletingCategory(null);
      resetForm();
      dispatch(fetchAllCategories({ is_active: 1 }));
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
      category_name: '',
      description: '',
      is_active: true,
    });
    setFormErrors({});
  };

  const handleSearch = (value) => {
    setSearchTerm(value);
    if (searchTimeout) clearTimeout(searchTimeout);

    const timeout = setTimeout(() => {
      if (value.trim()) {
        dispatch(searchCategories(value));
      } else {
        dispatch(fetchAllCategories({ is_active: 1 }));
      }
    }, 500);

    setSearchTimeout(timeout);
  };

  const validateForm = () => {
    const errors = {};

    if (!formData.category_name.trim()) {
      errors.category_name = 'Category name is required';
    } else if (formData.category_name.length < 2) {
      errors.category_name = 'Category name must be at least 2 characters';
    }

    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validateForm()) return;

    if (editingCategory) {
      dispatch(updateCategory({
        categoryId: editingCategory.category_id,
        updateData: formData,
        userId: user.user_id,
      }));
    } else {
      dispatch(createCategory({
        categoryData: formData,
        userId: user.user_id,
      }));
    }
  };

  const handleEdit = (category) => {
    setEditingCategory(category);
    setFormData({
      category_name: category.category_name,
      description: category.description || '',
      is_active: category.is_active === 1,
    });
    setShowModal(true);
  };

  const handleDelete = (category) => {
    setDeletingCategory(category);
    setClearReason(''); // Reset reason
    setClearNotes(''); // Reset notes
    
    // Check if category has products
    if (category.product_count && category.product_count > 0) {
      // Show clear products modal first - must remove products before deletion
      setShowClearProductsModal(true);
    } else {
      // No products, proceed directly to delete confirmation
      setShowDeleteModal(true);
    }
  };

  const confirmDelete = async () => {
    if (deletingCategory) {
      const result = await dispatch(deleteCategory({
        categoryId: deletingCategory.category_id,
        userId: user.user_id,
      }));
      
      if (deleteCategory.fulfilled.match(result)) {
        // Success - category deleted
        setShowDeleteModal(false);
        setDeletingCategory(null);
      }
    }
  };

  const handleClearProducts = async () => {
    if (!clearReason) {
      toast.warning('Please select a reason for removing products from this category');
      return;
    }
    
    try {
      // Call backend to clear all products from this category
      const result = await window.electronAPI.productCategory.clearProducts(
        deletingCategory.category_id,
        clearReason,
        clearNotes,
        user.user_id
      );
      
      if (result.success) {
        toast.success(`Successfully removed ${result.productsCleared} product(s) from category "${deletingCategory.category_name}". Products now have no category assigned.`, 'Success', 7000);
        
        // Refetch categories to update product count
        await dispatch(fetchAllCategories({ is_active: 1 }));
        
        // Update deletingCategory with new product count (should be 0)
        const updatedCategories = await dispatch(fetchAllCategories({ is_active: 1 }));
        const updatedCategory = updatedCategories.payload.find(c => c.category_id === deletingCategory.category_id);
        
        // Close clear modal and show delete confirmation
        setShowClearProductsModal(false);
        setShowDeleteModal(true);
      } else {
        toast.error('Failed to clear products: ' + result.message);
      }
    } catch (error) {
      console.error('Error clearing products:', error);
      toast.error('Error clearing products: ' + error.message);
    }
  };

  const cancelDeletion = () => {
    setShowDeleteModal(false);
    setShowClearProductsModal(false);
    setDeletingCategory(null);
    setClearReason('');
    setClearNotes('');
  };

  const openCreateModal = () => {
    setEditingCategory(null);
    resetForm();
    setShowModal(true);
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
          <h1 className="text-3xl font-bold text-gray-900">Product Categories</h1>
          <p className="text-gray-600 mt-2">Manage product categories and classifications</p>
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
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div className="flex-1 max-w-md">
              <input
                type="text"
                placeholder="Search categories..."
                value={searchTerm}
                onChange={(e) => handleSearch(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
              />
            </div>
            <button
              onClick={openCreateModal}
              className="bg-green-600 hover:bg-green-700 text-white px-6 py-2 rounded-lg font-medium transition-colors flex items-center justify-center gap-2"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              Add Category
            </button>
          </div>
        </div>

        {/* Categories Table */}
        <div className="bg-white rounded-lg shadow-sm overflow-hidden">
          {loading ? (
            <div className="flex justify-center items-center h-64">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-600"></div>
            </div>
          ) : categories.length === 0 ? (
            <div className="text-center py-12">
              <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
              </svg>
              <h3 className="mt-2 text-sm font-medium text-gray-900">No categories found</h3>
              <p className="mt-1 text-sm text-gray-500">Get started by creating a new category.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Code</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Name</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Description</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Products</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Created</th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {categories.map((category) => (
                    <tr key={category.category_id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className="text-sm font-mono font-medium text-gray-900">{category.category_code}</span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className="text-sm font-medium text-gray-900">{category.category_name}</span>
                      </td>
                      <td className="px-6 py-4">
                        <span className="text-sm text-gray-600 line-clamp-2">{category.description || 'N/A'}</span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                          {category.product_count || 0} products
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                          category.is_active === 1 ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                        }`}>
                          {category.is_active === 1 ? 'Active' : 'Inactive'}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {new Date(category.created_at).toLocaleDateString()}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                        <button
                          onClick={() => handleEdit(category)}
                          className="text-blue-600 hover:text-blue-900 mr-4"
                          title="Edit"
                        >
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                          </svg>
                        </button>
                        <button
                          onClick={() => handleDelete(category)}
                          className="text-red-600 hover:text-red-900"
                          title="Delete"
                        >
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
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
            <div className="bg-white rounded-lg max-w-md w-full p-6">
              <h2 className="text-xl font-bold mb-4">
                {editingCategory ? 'Edit Category' : 'Create Category'}
              </h2>
              <form onSubmit={handleSubmit}>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Category Name *
                    </label>
                    <input
                      type="text"
                      value={formData.category_name}
                      onChange={(e) => setFormData({ ...formData, category_name: e.target.value })}
                      className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-green-500 ${
                        formErrors.category_name ? 'border-red-500' : 'border-gray-300'
                      }`}
                      placeholder="e.g., Fertilizers"
                    />
                    {formErrors.category_name && (
                      <p className="text-red-500 text-xs mt-1">{formErrors.category_name}</p>
                    )}
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Description
                    </label>
                    <textarea
                      value={formData.description}
                      onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500"
                      rows="3"
                      placeholder="Category description..."
                    />
                  </div>

                  <div className="flex items-center">
                    <input
                      type="checkbox"
                      id="is_active"
                      checked={formData.is_active}
                      onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
                      className="h-4 w-4 text-green-600 focus:ring-green-500 border-gray-300 rounded"
                    />
                    <label htmlFor="is_active" className="ml-2 block text-sm text-gray-700">
                      Active
                    </label>
                  </div>
                </div>

                <div className="mt-6 flex gap-3">
                  <button
                    type="button"
                    onClick={() => setShowModal(false)}
                    className="flex-1 px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={loading}
                    className="flex-1 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50"
                  >
                    {loading ? 'Saving...' : editingCategory ? 'Update' : 'Create'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Clear Products Modal */}
        {showClearProductsModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-lg max-w-2xl w-full p-6">
              {/* Header */}
              <div className="flex items-start gap-3 mb-6">
                <div className="flex-shrink-0 w-12 h-12 bg-red-100 rounded-full flex items-center justify-center">
                  <svg className="w-6 h-6 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                  </svg>
                </div>
                <div className="flex-1">
                  <h2 className="text-xl font-bold text-gray-900">Clear Products from Category</h2>
                  <p className="text-sm text-gray-600 mt-1">
                    Remove all products before deletion
                  </p>
                </div>
                <button
                  onClick={cancelDeletion}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              {/* Category Info */}
              <div className="bg-red-50 border-2 border-red-200 rounded-lg p-4 mb-6">
                <div className="flex items-center gap-3">
                  <div className="flex-shrink-0">
                    <span className="inline-flex items-center justify-center w-10 h-10 bg-red-200 rounded-full">
                      <span className="text-red-800 font-bold text-sm">⚠️</span>
                    </span>
                  </div>
                  <div className="flex-1">
                    <h3 className="text-base font-bold text-red-900">
                      {deletingCategory?.category_name}
                      <span className="ml-2 text-sm font-mono text-red-700">({deletingCategory?.category_code})</span>
                    </h3>
                    <p className="text-sm text-red-800 mt-1">
                      This category contains <span className="font-bold">{deletingCategory?.product_count} product{deletingCategory?.product_count !== 1 ? 's' : ''}</span>
                    </p>
                  </div>
                </div>
              </div>

              {/* Instructions */}
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
                <div className="flex gap-2">
                  <svg className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <div className="text-sm text-blue-800">
                    <p className="font-semibold mb-1">Before deleting this category:</p>
                    <p>All products in this category must be removed (unassigned). Products will have NO category assigned after this operation. You can manually assign them to other categories later if needed.</p>
                  </div>
                </div>
              </div>

              {/* Reason Selector */}
              <div className="mb-4">
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Reason for Removing Products: *
                </label>
                <select
                  value={clearReason}
                  onChange={(e) => setClearReason(e.target.value)}
                  className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-base"
                >
                  <option value="">-- Select Reason --</option>
                  <option value="CATEGORY_DELETION">Category Deletion</option>
                  <option value="REORGANIZATION">Category Reorganization</option>
                  <option value="DATA_CLEANUP">Data Cleanup</option>
                  <option value="BUSINESS_DECISION">Business Decision</option>
                  <option value="INVENTORY_RESTRUCTURE">Inventory Restructure</option>
                  <option value="TEMPORARY_REMOVAL">Temporary Removal</option>
                  <option value="OTHER">Other</option>
                </select>
              </div>

              {/* Notes Field */}
              <div className="mb-6">
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Additional Notes: (Optional)
                </label>
                <textarea
                  value={clearNotes}
                  onChange={(e) => setClearNotes(e.target.value)}
                  placeholder="Add any additional details about removing these products..."
                  className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-base resize-none"
                  rows="3"
                />
              </div>

              {/* Process Summary */}
              {clearReason && (
                <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-6">
                  <h4 className="text-sm font-semibold text-yellow-900 mb-2">⚠️ What will happen:</h4>
                  <ul className="text-sm text-yellow-800 space-y-1 ml-4">
                    <li>• All {deletingCategory?.product_count} product(s) will be REMOVED from this category</li>
                    <li>• Products will have NO category assigned (category_id = NULL)</li>
                    <li>• Products will remain in the system with all their data intact</li>
                    <li>• You can manually assign categories to these products later</li>
                    <li>• Complete audit trail will be maintained</li>
                    <li>• After clearing, you can proceed to delete the category</li>
                  </ul>
                </div>
              )}

              {/* Action Buttons */}
              <div className="flex gap-3">
                <button
                  onClick={cancelDeletion}
                  className="flex-1 px-4 py-3 border-2 border-gray-300 rounded-lg text-gray-700 font-semibold hover:bg-gray-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleClearProducts}
                  disabled={!clearReason || loading}
                  className="flex-1 px-4 py-3 bg-red-600 text-white rounded-lg font-semibold hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
                >
                  {loading ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                      Clearing...
                    </>
                  ) : (
                    <>
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                      Clear All Products
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Final Delete Confirmation Modal */}
        {showDeleteModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-lg max-w-md w-full p-6">
              {/* Header */}
              <div className="flex items-start gap-3 mb-6">
                <div className="flex-shrink-0 w-12 h-12 bg-red-100 rounded-full flex items-center justify-center">
                  <svg className="w-6 h-6 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                </div>
                <div className="flex-1">
                  <h2 className="text-xl font-bold text-red-600">Final Confirmation</h2>
                  <p className="text-sm text-gray-600 mt-1">This action cannot be undone</p>
                </div>
              </div>

              {/* Confirmation Message */}
              <div className="mb-6">
                <p className="text-gray-700 mb-3">
                  Are you sure you want to delete category:
                </p>
                <div className="bg-gray-50 border-2 border-gray-200 rounded-lg p-3">
                  <p className="font-bold text-gray-900">{deletingCategory?.category_name}</p>
                  <p className="text-sm text-gray-600 font-mono">{deletingCategory?.category_code}</p>
                </div>
                
                <div className="mt-4 bg-green-50 border border-green-200 rounded-lg p-3">
                  <p className="text-sm text-green-800">
                    ✓ Category has 0 products (all products have been removed)
                  </p>
                  <p className="text-xs text-green-700 mt-1">
                    This category is now empty and safe to delete.
                  </p>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex gap-3">
                <button
                  onClick={cancelDeletion}
                  className="flex-1 px-4 py-2 border-2 border-gray-300 rounded-lg text-gray-700 font-semibold hover:bg-gray-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={confirmDelete}
                  disabled={loading}
                  className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg font-semibold hover:bg-red-700 disabled:opacity-50 transition-colors flex items-center justify-center gap-2"
                >
                  {loading ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                      Deleting...
                    </>
                  ) : (
                    <>
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                      Delete Category
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default ProductCategoriesPage;
