import React, { useState, useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import { useToast } from '../components/common/Toast';
import {
  fetchAllProducts,
  createProduct,
  updateProduct,
  deleteProduct,
  searchProducts,
  fetchLowStockProducts,
  clearError,
  clearOperationSuccess,
} from '../store/slices/productSlice';
import { 
  fetchAllCategories, 
  createCategory, 
  deleteCategory 
} from '../store/slices/productCategorySlice';
import { addStock, adjustStock } from '../store/slices/stockSlice';
import PermissionGate from '../components/PermissionGate';

const ProductsPage = () => {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const toast = useToast();
  const { products, lowStockProducts, loading, error, operationSuccess } = useSelector((state) => state.product);
  const { categories } = useSelector((state) => state.productCategory);
  const { user } = useSelector((state) => state.auth);
  const { industryConfig } = useSelector((state) => state.organization);

  // Industry feature flags
  const features = industryConfig?.features || {};
  const terminology = industryConfig?.terminology || {};
  const industryType = industryConfig?.industry || industryConfig?.industryType || 'AGRICULTURAL';

  const [showModal, setShowModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [showLowStockModal, setShowLowStockModal] = useState(false);
  const [showCategoryModal, setShowCategoryModal] = useState(false);
  const [showStockAdjustModal, setShowStockAdjustModal] = useState(false);
  const [showClearStockModal, setShowClearStockModal] = useState(false);
  const [editingProduct, setEditingProduct] = useState(null);
  const [deletingProduct, setDeletingProduct] = useState(null);
  const [adjustingProduct, setAdjustingProduct] = useState(null);
  const [clearingForDeletion, setClearingForDeletion] = useState(false);
  const [stockAdjustData, setStockAdjustData] = useState({
    newQuantity: '0',
    reason: '',
  });
  const [clearStockData, setClearStockData] = useState({
    reason: '',
    notes: '',
  });
  const [searchTerm, setSearchTerm] = useState('');
  const [searchTimeout, setSearchTimeout] = useState(null);
  const [filterCategory, setFilterCategory] = useState('');
  const [filterLowStock, setFilterLowStock] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState('');
  const [categoryToDelete, setCategoryToDelete] = useState(null);
  const [categoryDeleteModal, setCategoryDeleteModal] = useState({ open: false, category: null, targetCategoryId: '' });
  const [productStockBatches, setProductStockBatches] = useState({});
  const [expandedProduct, setExpandedProduct] = useState(null);

  // Variants & Serial Numbers management state
  const [showVariantsModal, setShowVariantsModal] = useState(false);
  const [showSerialsModal, setShowSerialsModal] = useState(false);
  const [selectedProductForVariants, setSelectedProductForVariants] = useState(null);
  const [selectedProductForSerials, setSelectedProductForSerials] = useState(null);
  const [variants, setVariants] = useState([]);
  const [serialNumbers, setSerialNumbers] = useState([]);
  const [serialFilter, setSerialFilter] = useState('');
  const [editingVariant, setEditingVariant] = useState(null);
  const [variantFormData, setVariantFormData] = useState({
    variant_name: '', variant_type: '', sku: '', barcode: '', additional_price: '0'
  });
  const [serialFormData, setSerialFormData] = useState({
    serial_number: '', warranty_expiry: '', notes: ''
  });

  const [formData, setFormData] = useState({
    product_name: '',
    category_id: '',
    unit_of_measure: 'kg',
    description: '',
    reorder_level: '0',
    initial_stock: '0',
    unit_price: '0',
    // Retail fields
    sku: '',
    barcode: '',
    brand: '',
    warranty_months: '0',
    serial_tracking: false,
    has_variants: false,
    min_price: '0',
    max_price: '0',
    // Medical fields
    generic_name: '',
    brand_name: '',
    composition: '',
    drug_form: '',
    strength: '',
    requires_prescription: false,
    controlled_substance: false,
    storage_conditions: '',
  });

  const [formErrors, setFormErrors] = useState({});

  const unitOptions = ['kg', 'gram', 'liter', 'piece', 'bag', 'box', 'carton', 'dozen'];

  useEffect(() => {
    dispatch(fetchAllCategories({ is_active: 1 }));
    dispatch(fetchAllProducts({ is_active: 1 }));
  }, [dispatch]);

  // Load stock batch details for all products
  useEffect(() => {
    const loadStockBatches = async () => {
      try {
        const batchesMap = {};
        for (const product of products) {
          const batches = await window.electronAPI.stock.getBatches({
            item_type: 'PRODUCT',
            item_id: product.product_id
          });
          if (batches && batches.length > 0) {
            batchesMap[product.product_id] = batches;
          }
        }
        setProductStockBatches(batchesMap);
      } catch (error) {
        console.error('[ProductsPage] Error loading stock batches:', error);
      }
    };

    if (products.length > 0) {
      loadStockBatches();
    }
  }, [products]);

  useEffect(() => {
    if (operationSuccess) {
      setShowModal(false);
      setShowDeleteModal(false);
      setEditingProduct(null);
      setDeletingProduct(null);
      resetForm();
      dispatch(fetchAllProducts({ is_active: 1 }));
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
      product_name: '',
      category_id: '',
      unit_of_measure: 'kg',
      description: '',
      reorder_level: '0',
      initial_stock: '0',
      unit_price: '0',
      sku: '',
      barcode: '',
      brand: '',
      warranty_months: '0',
      serial_tracking: false,
      has_variants: false,
      min_price: '0',
      max_price: '0',
      generic_name: '',
      brand_name: '',
      composition: '',
      drug_form: '',
      strength: '',
      requires_prescription: false,
      controlled_substance: false,
      storage_conditions: '',
    });
    setFormErrors({});
  };

  const handleSearch = (value) => {
    setSearchTerm(value);
    if (searchTimeout) clearTimeout(searchTimeout);

    const timeout = setTimeout(() => {
      if (value.trim()) {
        dispatch(searchProducts(value));
      } else {
        applyFilters();
      }
    }, 500);

    setSearchTimeout(timeout);
  };

  const applyFilters = () => {
    const filters = { is_active: 1 };
    if (filterCategory) filters.category_id = filterCategory;
    if (filterLowStock) filters.low_stock = true;
    dispatch(fetchAllProducts(filters));
  };

  useEffect(() => {
    if (!searchTerm) {
      applyFilters();
    }
  }, [filterCategory, filterLowStock]);

  const validateForm = () => {
    const errors = {};

    if (!formData.product_name.trim()) {
      errors.product_name = 'Product name is required';
    }

    if (!formData.category_id) {
      errors.category_id = 'Category is required';
    }

    if (!formData.unit_of_measure) {
      errors.unit_of_measure = 'Unit of measure is required';
    }

    const reorderLevel = parseFloat(formData.reorder_level);
    if (isNaN(reorderLevel) || reorderLevel < 0) {
      errors.reorder_level = 'Reorder level must be a positive number';
    }

    const initialStock = parseFloat(formData.initial_stock);
    if (isNaN(initialStock) || initialStock < 0) {
      errors.initial_stock = 'Initial stock must be a positive number';
    }

    const unitPrice = parseFloat(formData.unit_price);
    if (isNaN(unitPrice) || unitPrice < 0) {
      errors.unit_price = 'Unit price must be a positive number';
    }

    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validateForm()) return;

    const productData = {
      product_name: formData.product_name,
      category_id: parseInt(formData.category_id),
      unit_of_measure: formData.unit_of_measure,
      description: formData.description,
      reorder_level: parseFloat(formData.reorder_level),
      is_active: true,
    };

    // Retail industry-specific fields
    if (industryType === 'RETAIL') {
      if (formData.sku) productData.sku = formData.sku;
      if (formData.barcode) productData.barcode = formData.barcode;
      if (formData.brand) productData.brand = formData.brand;
      productData.warranty_months = parseInt(formData.warranty_months) || 0;
      productData.serial_tracking = formData.serial_tracking ? 1 : 0;
      productData.has_variants = formData.has_variants ? 1 : 0;
      productData.min_price = parseFloat(formData.min_price) || 0;
      productData.max_price = parseFloat(formData.max_price) || 0;
    }

    // Medical industry-specific fields
    if (industryType === 'MEDICAL') {
      if (formData.generic_name) productData.generic_name = formData.generic_name;
      if (formData.brand_name) productData.brand_name = formData.brand_name;
      if (formData.composition) productData.composition = formData.composition;
      if (formData.drug_form) productData.drug_form = formData.drug_form;
      if (formData.strength) productData.strength = formData.strength;
      productData.requires_prescription = formData.requires_prescription ? 1 : 0;
      productData.controlled_substance = formData.controlled_substance ? 1 : 0;
      if (formData.storage_conditions) productData.storage_conditions = formData.storage_conditions;
      productData._codePrefix = 'M'; // Medicine prefix
    }

    if (editingProduct) {
      dispatch(updateProduct({
        productId: editingProduct.product_id,
        updateData: productData,
        userId: user.user_id,
      }));
    } else {
      // Create product
      const result = await dispatch(createProduct({
        productData,
        userId: user.user_id,
      }));

      console.log('[ProductsPage] Create product result:', result);

      // If product created successfully and initial stock > 0, add stock
      if (result.payload?.success && parseFloat(formData.initial_stock) > 0) {
        const productId = result.payload.product_id; // Fixed: was result.payload.data.product_id
        console.log('[ProductsPage] Adding initial stock for product:', productId);
        
        const stockResult = await dispatch(addStock({
          itemType: 'PRODUCT',
          itemId: productId,
          quantity: parseFloat(formData.initial_stock),
          unitPrice: parseFloat(formData.unit_price),
          notes: 'Initial stock',
          userId: user.user_id,
        }));
        
        console.log('[ProductsPage] Stock add result:', stockResult);
        
        // Refetch products to show updated stock
        await dispatch(fetchAllProducts({ is_active: 1 }));
      }
    }
  };

  const handleAddCategory = async () => {
    if (!newCategoryName.trim()) return;
    
    console.log('[ProductsPage] Creating category:', newCategoryName);
    
    try {
      const result = await dispatch(createCategory({
        categoryData: {
          category_name: newCategoryName,
          description: '',
          is_active: true,
        },
        userId: user.user_id,
      }));
      
      console.log('[ProductsPage] Create category result:', result);
      
      // Check if the action was fulfilled
      if (createCategory.fulfilled.match(result)) {
        console.log('[ProductsPage] Category created successfully, refetching...');
        setNewCategoryName('');
        await dispatch(fetchAllCategories({ is_active: 1 }));
        console.log('[ProductsPage] Categories refetched');
      } else if (createCategory.rejected.match(result)) {
        console.error('[ProductsPage] Failed to create category:', result.payload);
        toast.error('Failed to create category: ' + (result.payload || 'Unknown error'));
      }
    } catch (error) {
      console.error('[ProductsPage] Error creating category:', error);
      toast.error('Error creating category: ' + error.message);
    }
  };

  const handleDeleteCategory = async (category) => {
    // If category has products, show modal to select target category
    if (category.product_count > 0) {
      setCategoryDeleteModal({ open: true, category, targetCategoryId: '' });
      return;
    }
    
    // No products - confirm and delete directly
    if (window.confirm('Are you sure you want to delete this category?')) {
      await performCategoryDelete(category.category_id, null);
    }
  };

  const performCategoryDelete = async (categoryId, targetCategoryId) => {
    console.log('[ProductsPage] Deleting category:', categoryId, 'target:', targetCategoryId);
    
    try {
      const result = await dispatch(deleteCategory({
        categoryId,
        userId: user.user_id,
        targetCategoryId,
      }));
      
      console.log('[ProductsPage] Delete category result:', result);
      
      // Check if the action was fulfilled
      if (deleteCategory.fulfilled.match(result)) {
        console.log('[ProductsPage] Category deleted successfully, refetching...');
        setCategoryDeleteModal({ open: false, category: null, targetCategoryId: '' });
        await dispatch(fetchAllCategories({ is_active: 1 }));
        await dispatch(fetchAllProducts({ is_active: 1 }));
        console.log('[ProductsPage] Categories and products refetched');
      } else if (deleteCategory.rejected.match(result)) {
        const errorPayload = result.payload;
        console.error('[ProductsPage] Failed to delete category:', errorPayload);
        
        // Check if this is a hasProducts error
        if (errorPayload && typeof errorPayload === 'object' && errorPayload.hasProducts) {
          // Show modal to select target category
          const categoryToDeleteObj = categories.find(c => c.category_id === categoryId);
          setCategoryDeleteModal({ open: true, category: categoryToDeleteObj, targetCategoryId: '' });
        } else {
          toast.error('Failed to delete category: ' + (typeof errorPayload === 'string' ? errorPayload : errorPayload?.message || 'Unknown error'));
        }
      }
    } catch (error) {
      console.error('[ProductsPage] Error deleting category:', error);
      toast.error('Error deleting category: ' + error.message);
    }
  };

  const handleEdit = (product) => {
    setEditingProduct(product);
    setFormData({
      product_name: product.product_name,
      category_id: product.category_id.toString(),
      unit_of_measure: product.unit_of_measure,
      description: product.description || '',
      reorder_level: product.reorder_level?.toString() || '0',
      initial_stock: '0', // Not editable during edit
      unit_price: product.stock_price?.toString() || '0',
      // Retail
      sku: product.sku || '',
      barcode: product.barcode || '',
      brand: product.brand || '',
      warranty_months: product.warranty_months?.toString() || '0',
      serial_tracking: !!product.serial_tracking,
      has_variants: !!product.has_variants,
      min_price: product.min_price?.toString() || '0',
      max_price: product.max_price?.toString() || '0',
      // Medical
      generic_name: product.generic_name || '',
      brand_name: product.brand_name || '',
      composition: product.composition || '',
      drug_form: product.drug_form || '',
      strength: product.strength || '',
      requires_prescription: !!product.requires_prescription,
      controlled_substance: !!product.controlled_substance,
      storage_conditions: product.storage_conditions || '',
    });
    setShowModal(true);
  };

  const handleDelete = (product) => {
    setDeletingProduct(product);
    
    // Check if product has stock
    if (product.current_stock && parseFloat(product.current_stock) > 0) {
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
    if (!deletingProduct) return;
    
    if (!clearStockData.reason) {
      toast.warning('Please select a reason for clearing stock');
      return;
    }

    try {
      console.log('[ProductsPage] Clearing stock for deletion:', {
        productId: deletingProduct.product_id,
        currentStock: deletingProduct.current_stock,
        reason: clearStockData.reason
      });

      // Call backend to clear all stock batches
      const result = await window.electronAPI.stock.clearAllBatches({
        itemType: 'PRODUCT',
        itemId: deletingProduct.product_id,
        reason: clearStockData.reason,
        notes: clearStockData.notes || 'Stock cleared for product deletion',
        userId: user.user_id,
      });

      console.log('[ProductsPage] Clear stock result:', result);

      if (result.success) {
        setShowClearStockModal(false);
        setClearingForDeletion(false);
        
        // Refresh products to get updated stock
        await dispatch(fetchAllProducts({ is_active: 1 }));
        
        // Now show delete confirmation
        toast.success(`Stock cleared successfully. ${result.batches_cleared} batch(es) removed. You can now proceed with deletion.`);
        setShowDeleteModal(true);
      } else {
        toast.error('Failed to clear stock: ' + (result.message || 'Unknown error'));
      }
    } catch (error) {
      console.error('[ProductsPage] Error clearing stock:', error);
      toast.error('Error clearing stock: ' + error.message);
    }
  };

  const confirmDelete = async () => {
    if (deletingProduct) {
      // Final check - ensure stock is 0
      if (deletingProduct.current_stock && parseFloat(deletingProduct.current_stock) > 0) {
        toast.error('Cannot delete product with stock. Please clear stock first.');
        setShowDeleteModal(false);
        return;
      }

      try {
        const result = await dispatch(deleteProduct({
          productId: deletingProduct.product_id,
          userId: user.user_id,
        }));
        
        console.log('[ProductsPage] Delete product result:', result);
        
        if (deleteProduct.fulfilled.match(result)) {
          console.log('[ProductsPage] Product deleted successfully');
          // Modal will close via operationSuccess effect
        } else if (deleteProduct.rejected.match(result)) {
          console.error('[ProductsPage] Delete failed:', result.payload);
          toast.error('Failed to delete product: ' + (result.payload || 'Unknown error'));
          setShowDeleteModal(false);
        }
      } catch (error) {
        console.error('[ProductsPage] Error deleting product:', error);
        toast.error('Error deleting product: ' + error.message);
        setShowDeleteModal(false);
      }
    }
  };

  const openCreateModal = () => {
    setEditingProduct(null);
    resetForm();
    setShowModal(true);
  };

  const openStockAdjustModal = (product) => {
    setAdjustingProduct(product);
    setStockAdjustData({
      newQuantity: product.current_stock?.toString() || '0',
      reason: '',
    });
    setShowStockAdjustModal(true);
  };

  const handleStockAdjustment = async () => {
    if (!adjustingProduct) return;
    
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
      console.log('[ProductsPage] Adjusting stock:', { productId: adjustingProduct.product_id, newQty });
      
      // If setting to 0, clear all batches
      if (newQty === 0) {
        const result = await window.electronAPI.stock.clearAllBatches({
          itemType: 'PRODUCT',
          itemId: adjustingProduct.product_id,
          reason: stockAdjustData.reason,
          notes: `Manual stock adjustment: Set to 0 from ${adjustingProduct.current_stock}`,
          userId: user.user_id,
        });
        
        if (result.success) {
          setShowStockAdjustModal(false);
          setAdjustingProduct(null);
          await dispatch(fetchAllProducts({ is_active: 1 }));
          toast.success(`Stock cleared successfully. ${result.batches_cleared} batch(es) set to 0.`);
        } else {
          toast.error('Failed to clear stock: ' + (result.message || 'Unknown error'));
        }
      } else {
        // Regular adjustment (non-zero)
        const result = await dispatch(adjustStock({
          itemType: 'PRODUCT',
          itemId: adjustingProduct.product_id,
          newQuantity: newQty,
          reason: stockAdjustData.reason,
          notes: `Stock adjusted from ${adjustingProduct.current_stock} to ${newQty}`,
          userId: user.user_id,
        }));
        
        console.log('[ProductsPage] Adjust stock result:', result);
        
        if (adjustStock.fulfilled.match(result)) {
          setShowStockAdjustModal(false);
          setAdjustingProduct(null);
          await dispatch(fetchAllProducts({ is_active: 1 }));
          toast.success('Stock adjusted successfully');
        } else if (adjustStock.rejected.match(result)) {
          toast.error('Failed to adjust stock: ' + (result.payload || 'Unknown error'));
        }
      }
    } catch (error) {
      console.error('[ProductsPage] Error adjusting stock:', error);
      toast.error('Error adjusting stock: ' + error.message);
    }
  };

  const showLowStock = async () => {
    await dispatch(fetchLowStockProducts());
    setShowLowStockModal(true);
  };

  // ═══════════════════════════════════════
  // Variants Management Handlers
  // ═══════════════════════════════════════

  const openVariantsModal = async (product) => {
    setSelectedProductForVariants(product);
    setEditingVariant(null);
    setVariantFormData({ variant_name: '', variant_type: '', sku: '', barcode: '', additional_price: '0' });
    try {
      const data = await window.electronAPI.product.getVariants(product.product_id);
      setVariants(data || []);
    } catch (err) {
      toast.error('Failed to load variants: ' + err.message);
      setVariants([]);
    }
    setShowVariantsModal(true);
  };

  const handleAddVariant = async () => {
    if (!variantFormData.variant_name.trim()) {
      toast.warning('Variant name is required');
      return;
    }
    try {
      const result = await window.electronAPI.product.addVariant(
        selectedProductForVariants.product_id,
        { ...variantFormData, additional_price: parseFloat(variantFormData.additional_price) || 0 }
      );
      if (result.success) {
        toast.success('Variant added successfully');
        const data = await window.electronAPI.product.getVariants(selectedProductForVariants.product_id);
        setVariants(data || []);
        setVariantFormData({ variant_name: '', variant_type: '', sku: '', barcode: '', additional_price: '0' });
        dispatch(fetchAllProducts({ is_active: 1 }));
      }
    } catch (err) {
      toast.error('Failed to add variant: ' + err.message);
    }
  };

  const handleUpdateVariant = async () => {
    if (!variantFormData.variant_name.trim()) {
      toast.warning('Variant name is required');
      return;
    }
    try {
      const result = await window.electronAPI.product.updateVariant(
        editingVariant.variant_id,
        { ...variantFormData, additional_price: parseFloat(variantFormData.additional_price) || 0 }
      );
      if (result.success) {
        toast.success('Variant updated');
        const data = await window.electronAPI.product.getVariants(selectedProductForVariants.product_id);
        setVariants(data || []);
        setEditingVariant(null);
        setVariantFormData({ variant_name: '', variant_type: '', sku: '', barcode: '', additional_price: '0' });
      }
    } catch (err) {
      toast.error('Failed to update variant: ' + err.message);
    }
  };

  const handleDeleteVariant = async (variantId) => {
    try {
      const result = await window.electronAPI.product.deleteVariant(variantId);
      if (result.success) {
        toast.success('Variant removed');
        const data = await window.electronAPI.product.getVariants(selectedProductForVariants.product_id);
        setVariants(data || []);
      }
    } catch (err) {
      toast.error('Failed to delete variant: ' + err.message);
    }
  };

  const startEditVariant = (variant) => {
    setEditingVariant(variant);
    setVariantFormData({
      variant_name: variant.variant_name || '',
      variant_type: variant.variant_type || '',
      sku: variant.sku || '',
      barcode: variant.barcode || '',
      additional_price: variant.additional_price?.toString() || '0',
    });
  };

  // ═══════════════════════════════════════
  // Serial Numbers Management Handlers
  // ═══════════════════════════════════════

  const openSerialsModal = async (product) => {
    setSelectedProductForSerials(product);
    setSerialFilter('');
    setSerialFormData({ serial_number: '', warranty_expiry: '', notes: '' });
    try {
      const data = await window.electronAPI.product.getSerialNumbers(product.product_id, {});
      setSerialNumbers(data || []);
    } catch (err) {
      toast.error('Failed to load serial numbers: ' + err.message);
      setSerialNumbers([]);
    }
    setShowSerialsModal(true);
  };

  const handleAddSerial = async () => {
    if (!serialFormData.serial_number.trim()) {
      toast.warning('Serial number is required');
      return;
    }
    try {
      const result = await window.electronAPI.product.addSerialNumber(
        selectedProductForSerials.product_id,
        serialFormData
      );
      if (result.success) {
        toast.success('Serial number added');
        const data = await window.electronAPI.product.getSerialNumbers(selectedProductForSerials.product_id, {});
        setSerialNumbers(data || []);
        setSerialFormData({ serial_number: '', warranty_expiry: '', notes: '' });
      }
    } catch (err) {
      toast.error('Failed to add serial number: ' + err.message);
    }
  };

  const handleMarkSerialReturned = async (serialId) => {
    try {
      const result = await window.electronAPI.product.markSerialReturned(serialId);
      if (result.success) {
        toast.success('Serial marked as returned');
        const data = await window.electronAPI.product.getSerialNumbers(selectedProductForSerials.product_id, {});
        setSerialNumbers(data || []);
      }
    } catch (err) {
      toast.error('Failed to update serial: ' + err.message);
    }
  };

  const filteredSerials = serialFilter
    ? serialNumbers.filter(s => s.status === serialFilter)
    : serialNumbers;

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header with Back Button */}
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
          <h1 className="text-3xl font-bold text-gray-900">{terminology.items || 'Products'}</h1>
          <p className="text-gray-600 mt-2">Manage {(terminology.items || 'products').toLowerCase()} and inventory items</p>
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
                  placeholder="Search products..."
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
                <PermissionGate permission="can_create_entities">
                  <button
                    onClick={openCreateModal}
                    className="bg-green-600 hover:bg-green-700 text-white px-6 py-2 rounded-lg font-medium transition-colors flex items-center gap-2"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                    </svg>
                    Add Product
                  </button>
                </PermissionGate>
              </div>
            </div>
            
            {/* Filters */}
            <div className="flex flex-wrap gap-3">
              <select
                value={filterCategory}
                onChange={(e) => setFilterCategory(e.target.value)}
                className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
              >
                <option value="">All Categories</option>
                {categories.map((cat) => (
                  <option key={cat.category_id} value={cat.category_id}>
                    {cat.category_name}
                  </option>
                ))}
              </select>
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

        {/* Products Table */}
        <div className="bg-white rounded-lg shadow-sm overflow-hidden">
          {loading ? (
            <div className="flex justify-center items-center h-64">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-600"></div>
            </div>
          ) : products.length === 0 ? (
            <div className="text-center py-12">
              <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
              </svg>
              <h3 className="mt-2 text-sm font-medium text-gray-900">No products found</h3>
              <p className="mt-1 text-sm text-gray-500">Get started by creating a new product.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Code</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Name</th>
                    {industryType === 'RETAIL' && features.hasSKU && (
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">SKU / Brand</th>
                    )}
                    {industryType === 'MEDICAL' && (
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Generic / Form</th>
                    )}
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Category</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Stock</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Unit</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Price</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Reorder</th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {products.map((product) => {
                    const isLowStock = parseFloat(product.current_stock || 0) <= parseFloat(product.reorder_level || 0);
                    return (
                      <React.Fragment key={product.product_id}>
                      <tr className="hover:bg-gray-50">
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className="text-sm font-mono font-medium text-gray-900">{product.product_code}</span>
                        </td>
                        <td className="px-6 py-4">
                          <div>
                            <div className="text-sm font-medium text-gray-900">{product.product_name}</div>
                            {product.description && (
                              <div className="text-sm text-gray-500 line-clamp-1">{product.description}</div>
                            )}
                          </div>
                        </td>
                        {industryType === 'RETAIL' && features.hasSKU && (
                          <td className="px-6 py-4">
                            <div className="space-y-0.5">
                              {product.sku && <div className="text-xs font-mono text-gray-700">{product.sku}</div>}
                              {product.brand && <div className="text-xs text-blue-600 font-medium">{product.brand}</div>}
                              {product.barcode && <div className="text-xs text-gray-400">{product.barcode}</div>}
                              {!product.sku && !product.brand && <span className="text-xs text-gray-400">—</span>}
                            </div>
                          </td>
                        )}
                        {industryType === 'MEDICAL' && (
                          <td className="px-6 py-4">
                            <div className="space-y-0.5">
                              {product.generic_name && <div className="text-xs font-medium text-gray-700">{product.generic_name}</div>}
                              {product.drug_form && product.strength && (
                                <div className="text-xs text-purple-600">{product.drug_form} · {product.strength}</div>
                              )}
                              <div className="flex gap-1">
                                {product.requires_prescription === 1 && (
                                  <span className="px-1.5 py-0.5 bg-orange-100 text-orange-700 text-[10px] font-bold rounded">Rx</span>
                                )}
                                {product.controlled_substance === 1 && (
                                  <span className="px-1.5 py-0.5 bg-red-100 text-red-700 text-[10px] font-bold rounded">Controlled</span>
                                )}
                              </div>
                              {!product.generic_name && !product.drug_form && <span className="text-xs text-gray-400">—</span>}
                            </div>
                          </td>
                        )}
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className="text-sm text-gray-600">{product.category_name}</span>
                        </td>
                        <td className="px-6 py-4">
                          <div className="space-y-1">
                            <div className="flex items-center gap-2">
                              <span className={`text-base font-bold ${isLowStock ? 'text-red-600' : 'text-green-600'}`}>
                                {Math.round(parseFloat(product.current_stock || 0))}
                              </span>
                              <span className="text-xs text-gray-500">{product.unit_of_measure}</span>
                              {isLowStock && (
                                <svg className="w-4 h-4 text-red-600" fill="currentColor" viewBox="0 0 20 20">
                                  <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                                </svg>
                              )}
                            </div>
                            {productStockBatches[product.product_id] && productStockBatches[product.product_id].length > 1 && (
                              <div className="flex items-center gap-1">
                                <span className="px-2 py-0.5 bg-blue-100 text-blue-800 text-xs font-semibold rounded-full">
                                  💰 {productStockBatches[product.product_id].length} price batches
                                </span>
                                <button
                                  onClick={() => setExpandedProduct(expandedProduct === product.product_id ? null : product.product_id)}
                                  className="text-xs text-blue-600 hover:text-blue-800 underline"
                                >
                                  {expandedProduct === product.product_id ? 'Hide' : 'View'}
                                </button>
                              </div>
                            )}
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className="text-sm text-gray-600">{product.unit_of_measure}</span>
                        </td>
                        <td className="px-6 py-4">
                          {productStockBatches[product.product_id] && productStockBatches[product.product_id].length > 1 ? (
                            <div className="space-y-1">
                              <div className="text-xs text-gray-500">Min: Rs. {Math.min(...productStockBatches[product.product_id].map(b => parseFloat(b.unit_price))).toFixed(2)}</div>
                              <div className="text-xs text-gray-500">Max: Rs. {Math.max(...productStockBatches[product.product_id].map(b => parseFloat(b.unit_price))).toFixed(2)}</div>
                              <div className="text-xs font-semibold text-blue-600">Avg: Rs. {(productStockBatches[product.product_id].reduce((sum, b) => sum + parseFloat(b.unit_price), 0) / productStockBatches[product.product_id].length).toFixed(2)}</div>
                            </div>
                          ) : (
                            <span className="text-sm text-gray-900">
                              Rs. {parseFloat(product.stock_price || 0).toFixed(2)}
                            </span>
                          )}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className="text-sm text-gray-600">{parseFloat(product.reorder_level || 0).toFixed(2)}</span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                          <div className="flex items-center justify-end gap-1">
                            {/* Variants button - show for retail products that have variants enabled */}
                            {product.has_variants === 1 && features.hasVariants && (
                              <button
                                onClick={() => openVariantsModal(product)}
                                className="px-2 py-1 text-xs font-medium text-purple-700 bg-purple-50 hover:bg-purple-100 rounded transition-colors"
                                title="Manage Variants"
                              >
                                Variants
                              </button>
                            )}
                            {/* Serial Numbers button - show for products with serial tracking */}
                            {product.serial_tracking === 1 && features.hasSerialNumbers && (
                              <button
                                onClick={() => openSerialsModal(product)}
                                className="px-2 py-1 text-xs font-medium text-teal-700 bg-teal-50 hover:bg-teal-100 rounded transition-colors"
                                title="Manage Serial Numbers"
                              >
                                Serials
                              </button>
                            )}
                            <PermissionGate permission="can_edit_entities">
                              <button
                                onClick={() => handleEdit(product)}
                                className="text-blue-600 hover:text-blue-900 p-1"
                                title="Edit"
                              >
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                                </svg>
                              </button>
                            </PermissionGate>
                            <PermissionGate permission="can_delete_entities">
                              <button
                                onClick={() => handleDelete(product)}
                                className="text-red-600 hover:text-red-900 p-1"
                                title="Delete"
                              >
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                </svg>
                              </button>
                            </PermissionGate>
                          </div>
                        </td>
                      </tr>
                      {expandedProduct === product.product_id && productStockBatches[product.product_id] && (
                        <tr className="bg-blue-50">
                          <td colSpan={8 + ((industryType === 'RETAIL' && features.hasSKU) ? 1 : 0) + (industryType === 'MEDICAL' ? 1 : 0)} className="px-6 py-4">
                            <div className="bg-white rounded-lg border-2 border-blue-300 p-4">
                              <div className="flex items-center justify-between mb-3">
                                <div className="flex items-center gap-2">
                                  <span className="text-xl">💰</span>
                                  <h4 className="text-base font-bold text-blue-900">Price Batch Details for {product.product_name}</h4>
                                  <span className="px-2 py-1 bg-blue-200 text-blue-800 text-xs font-bold rounded">
                                    {productStockBatches[product.product_id].length} Batches
                                  </span>
                                </div>
                                <button
                                  onClick={() => setExpandedProduct(null)}
                                  className="text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-full p-2 transition-colors"
                                  title="Close batch details"
                                >
                                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                  </svg>
                                </button>
                              </div>
                              
                              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                                {productStockBatches[product.product_id].map((batch, index) => (
                                  <div key={batch.stock_id} className="bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-lg p-3">
                                    <div className="flex justify-between items-start mb-2">
                                      <span className="text-xs font-semibold text-blue-700">
                                        Batch #{index + 1}
                                      </span>
                                      <span className="px-2 py-0.5 bg-green-200 text-green-800 text-xs font-bold rounded">
                                        {Math.round(parseFloat(batch.quantity))} {product.unit_of_measure}
                                      </span>
                                    </div>
                                    <div className="space-y-1">
                                      <div className="flex justify-between text-sm">
                                        <span className="text-gray-600">Unit Price:</span>
                                        <span className="font-bold text-blue-900">PKR {parseFloat(batch.unit_price).toFixed(2)}</span>
                                      </div>
                                      <div className="flex justify-between text-xs">
                                        <span className="text-gray-500">Batch Value:</span>
                                        <span className="font-semibold text-gray-700">
                                          PKR {(parseFloat(batch.quantity) * parseFloat(batch.unit_price)).toFixed(2)}
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
                                      {Math.round(productStockBatches[product.product_id].reduce((sum, b) => sum + parseFloat(b.quantity), 0))}
                                    </div>
                                  </div>
                                  <div>
                                    <div className="text-xs text-gray-600">Total Value</div>
                                    <div className="text-lg font-bold text-blue-700">
                                      PKR {productStockBatches[product.product_id].reduce((sum, b) => sum + (parseFloat(b.quantity) * parseFloat(b.unit_price)), 0).toFixed(2)}
                                    </div>
                                  </div>
                                  <div>
                                    <div className="text-xs text-gray-600">Price Range</div>
                                    <div className="text-sm font-semibold text-gray-700">
                                      PKR {Math.min(...productStockBatches[product.product_id].map(b => parseFloat(b.unit_price))).toFixed(2)} - 
                                      PKR {Math.max(...productStockBatches[product.product_id].map(b => parseFloat(b.unit_price))).toFixed(2)}
                                    </div>
                                  </div>
                                  <div>
                                    <div className="text-xs text-gray-600">Avg Price</div>
                                    <div className="text-lg font-bold text-indigo-700">
                                      PKR {(productStockBatches[product.product_id].reduce((sum, b) => sum + parseFloat(b.unit_price), 0) / productStockBatches[product.product_id].length).toFixed(2)}
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

        {/* Create/Edit Modal - Professional Enhanced Version */}
        {showModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-lg max-w-4xl w-full max-h-[90vh] overflow-y-auto">
              {/* Modal Header */}
              <div className="sticky top-0 bg-gradient-to-r from-green-600 to-green-700 text-white px-6 py-4 rounded-t-lg">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="bg-white bg-opacity-20 p-2 rounded-lg">
                      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                      </svg>
                    </div>
                    <div>
                      <h2 className="text-2xl font-bold">
                        {editingProduct ? 'Edit Product' : 'Create New Product'}
                      </h2>
                      <p className="text-green-100 text-sm mt-0.5">
                        {editingProduct ? `Updating ${editingProduct.product_name}` : 'Add a new product to inventory'}
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

              <form onSubmit={handleSubmit} className="p-6">
                {/* Product Code & Metadata Section (Edit Mode Only) */}
                {editingProduct && (
                  <div className="mb-6 p-5 bg-gradient-to-r from-blue-50 to-indigo-50 border-2 border-blue-200 rounded-xl">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-3">
                          <span className="text-2xl">🏷️</span>
                          <h3 className="text-lg font-bold text-blue-900">Product Information</h3>
                        </div>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                          <div>
                            <p className="text-xs text-gray-600 mb-1">Product Code</p>
                            <p className="text-base font-mono font-bold text-blue-700 bg-white px-3 py-2 rounded border-2 border-blue-300">
                              {editingProduct.product_code}
                            </p>
                          </div>
                          <div>
                            <p className="text-xs text-gray-600 mb-1">Created Date</p>
                            <p className="text-sm font-medium text-gray-700 bg-white px-3 py-2 rounded border border-gray-300">
                              {new Date(editingProduct.created_at).toLocaleDateString('en-GB')}
                            </p>
                          </div>
                          <div>
                            <p className="text-xs text-gray-600 mb-1">Last Updated</p>
                            <p className="text-sm font-medium text-gray-700 bg-white px-3 py-2 rounded border border-gray-300">
                              {new Date(editingProduct.updated_at).toLocaleDateString('en-GB')}
                            </p>
                          </div>
                          <div>
                            <p className="text-xs text-gray-600 mb-1">Status</p>
                            <span className="inline-flex items-center px-3 py-2 rounded bg-green-100 border border-green-300">
                              <span className="w-2 h-2 bg-green-500 rounded-full mr-2"></span>
                              <span className="text-sm font-semibold text-green-700">Active</span>
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* Current Stock Summary (Edit Mode Only) */}
                {editingProduct && (
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
                              parseFloat(editingProduct.current_stock || 0) <= parseFloat(editingProduct.reorder_level || 0)
                                ? 'text-red-600'
                                : 'text-green-600'
                            }`}>
                              {Math.round(parseFloat(editingProduct.current_stock || 0))}
                            </p>
                            <p className="text-xs text-gray-600 mt-1">{editingProduct.unit_of_measure}</p>
                          </div>
                          <div className="bg-white rounded-lg p-3 border-2 border-blue-300">
                            <p className="text-xs text-gray-600 mb-1">Current Price</p>
                            <p className="text-2xl font-bold text-blue-600">
                              {parseFloat(editingProduct.stock_price || 0).toFixed(2)}
                            </p>
                            <p className="text-xs text-gray-600 mt-1">PKR per {editingProduct.unit_of_measure}</p>
                          </div>
                          <div className="bg-white rounded-lg p-3 border-2 border-purple-300">
                            <p className="text-xs text-gray-600 mb-1">Stock Value</p>
                            <p className="text-2xl font-bold text-purple-600">
                              {(Math.round(parseFloat(editingProduct.current_stock || 0)) * parseFloat(editingProduct.stock_price || 0)).toFixed(2)}
                            </p>
                            <p className="text-xs text-gray-600 mt-1">PKR Total</p>
                          </div>
                        </div>
                        {/* Integrated Stock Management Section */}
                        <div className="bg-white rounded-xl p-4 border-2 border-blue-300 mt-4">
                          <div className="flex items-center gap-2 mb-4">
                            <div className="bg-blue-600 p-1.5 rounded">
                              <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                              </svg>
                            </div>
                            <h4 className="text-base font-bold text-blue-900">Stock Management</h4>
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
                                      id="addStockQuantity"
                                    />
                                    <span className="absolute right-3 top-2 text-gray-500 text-sm">{editingProduct.unit_of_measure}</span>
                                  </div>
                                </div>
                                <div>
                                  <label className="text-xs font-semibold text-gray-700 block mb-1">Unit Price (PKR)</label>
                                  <div className="relative">
                                    <span className="absolute left-3 top-2 text-gray-500 text-sm">Rs.</span>
                                    <input
                                      type="number"
                                      step="0.01"
                                      min="0"
                                      placeholder="0.00"
                                      defaultValue={editingProduct.stock_price || '0'}
                                      className="w-full pl-9 pr-3 py-2 border-2 border-green-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500"
                                      id="addStockPrice"
                                    />
                                  </div>
                                </div>
                                <div>
                                  <label className="text-xs font-semibold text-gray-700 block mb-1">Notes (Optional)</label>
                                  <input
                                    type="text"
                                    placeholder="e.g., Purchase from supplier"
                                    className="w-full px-3 py-2 border-2 border-green-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500 text-sm"
                                    id="addStockNotes"
                                  />
                                </div>
                                <button
                                  type="button"
                                  onClick={async () => {
                                    const qtyInput = document.getElementById('addStockQuantity');
                                    const priceInput = document.getElementById('addStockPrice');
                                    const notesInput = document.getElementById('addStockNotes');
                                    
                                    const quantity = parseFloat(qtyInput.value);
                                    const price = parseFloat(priceInput.value);
                                    const notes = notesInput.value || 'Stock added from product edit';
                                    
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
                                        itemType: 'PRODUCT',
                                        itemId: editingProduct.product_id,
                                        quantity: quantity,
                                        unitPrice: price,
                                        notes: notes,
                                        userId: user.user_id,
                                      }));
                                      
                                      if (addStock.fulfilled.match(result)) {
                                        toast.success(`Stock added successfully! Added ${quantity} ${editingProduct.unit_of_measure}`);
                                        qtyInput.value = '';
                                        notesInput.value = '';
                                        await dispatch(fetchAllProducts({ is_active: 1 }));
                                        // Update editing product with new stock
                                        const updatedProduct = await dispatch(fetchAllProducts({ is_active: 1 })).then(res => {
                                          return res.payload.find(p => p.product_id === editingProduct.product_id);
                                        });
                                        if (updatedProduct) {
                                          setEditingProduct(updatedProduct);
                                          // Reset price input to updated stock price
                                          priceInput.value = updatedProduct.stock_price || '0';
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
                                      placeholder={editingProduct.current_stock || '0.00'}
                                      defaultValue={editingProduct.current_stock || '0'}
                                      className="w-full px-3 py-2 border-2 border-orange-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                                      id="setStockQuantity"
                                    />
                                    <span className="absolute right-3 top-2 text-gray-500 text-sm">{editingProduct.unit_of_measure}</span>
                                  </div>
                                  <p className="text-xs text-gray-600 mt-1">Current: {Math.round(parseFloat(editingProduct.current_stock || 0))}</p>
                                </div>
                                <div>
                                  <label className="text-xs font-semibold text-gray-700 block mb-1">Reason *</label>
                                  <select
                                    className="w-full px-3 py-2 border-2 border-orange-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500 text-sm"
                                    id="setStockReason"
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
                                    id="setStockNotes"
                                  />
                                </div>
                                <button
                                  type="button"
                                  onClick={async () => {
                                    const qtyInput = document.getElementById('setStockQuantity');
                                    const reasonSelect = document.getElementById('setStockReason');
                                    const notesInput = document.getElementById('setStockNotes');
                                    
                                    const newQty = parseFloat(qtyInput.value);
                                    const reason = reasonSelect.value;
                                    const notes = notesInput.value || `Stock adjusted from ${editingProduct.current_stock} to ${newQty}`;
                                    
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
                                          itemType: 'PRODUCT',
                                          itemId: editingProduct.product_id,
                                          reason: reason,
                                          notes: notes,
                                          userId: user.user_id,
                                        });
                                        
                                        if (result.success) {
                                          toast.success(`Stock cleared successfully. ${result.batches_cleared} batch(es) set to 0.`);
                                          await dispatch(fetchAllProducts({ is_active: 1 }));
                                          const updatedProduct = await dispatch(fetchAllProducts({ is_active: 1 })).then(res => {
                                            return res.payload.find(p => p.product_id === editingProduct.product_id);
                                          });
                                          if (updatedProduct) {
                                            setEditingProduct(updatedProduct);
                                            // Reset input to new current stock value
                                            qtyInput.value = updatedProduct.current_stock || '0';
                                          }
                                          reasonSelect.value = '';
                                          notesInput.value = '';
                                        } else {
                                          toast.error('Failed to clear stock: ' + (result.message || 'Unknown error'));
                                        }
                                      } else {
                                        // Regular adjustment
                                        const result = await dispatch(adjustStock({
                                          itemType: 'PRODUCT',
                                          itemId: editingProduct.product_id,
                                          newQuantity: newQty,
                                          reason: reason,
                                          notes: notes,
                                          userId: user.user_id,
                                        }));
                                        
                                        if (adjustStock.fulfilled.match(result)) {
                                          toast.success(`Stock adjusted successfully to ${newQty} ${editingProduct.unit_of_measure}`);
                                          await dispatch(fetchAllProducts({ is_active: 1 }));
                                          const updatedProduct = await dispatch(fetchAllProducts({ is_active: 1 })).then(res => {
                                            return res.payload.find(p => p.product_id === editingProduct.product_id);
                                          });
                                          if (updatedProduct) {
                                            setEditingProduct(updatedProduct);
                                            // Reset input to new current stock value
                                            qtyInput.value = updatedProduct.current_stock || '0';
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

                          <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                            <p className="text-xs text-blue-800">
                              <span className="font-semibold">💡 Tip:</span> Use "Add Stock" for purchases/receipts. Use "Set Stock Level" for corrections or adjustments. All changes are tracked in Stock Movements.
                            </p>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* Basic Information Section */}
                <div className="mb-6">
                  <div className="flex items-center gap-2 mb-4">
                    <div className="bg-green-600 p-1.5 rounded">
                      <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                    </div>
                    <h3 className="text-lg font-bold text-gray-900">Basic Information</h3>
                    <span className="text-sm text-red-600">* Required fields</span>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* Product Name */}
                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-2">
                        Product Name *
                      </label>
                      <input
                        type="text"
                        value={formData.product_name}
                        onChange={(e) => setFormData({ ...formData, product_name: e.target.value })}
                        className={`w-full px-4 py-2.5 border-2 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500 transition-colors ${
                          formErrors.product_name ? 'border-red-500 bg-red-50' : 'border-gray-300'
                        }`}
                        placeholder="e.g., NPK Fertilizer, Wheat Seeds"
                      />
                      {formErrors.product_name && (
                        <p className="text-red-600 text-xs mt-1 font-medium flex items-center gap-1">
                          <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                          </svg>
                          {formErrors.product_name}
                        </p>
                      )}
                    </div>

                    {/* Category */}
                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-2 flex items-center justify-between">
                        <span>Product Category *</span>
                        <button
                          type="button"
                          onClick={() => setShowCategoryModal(true)}
                          className="px-3 py-1 bg-green-50 text-green-700 hover:bg-green-100 text-xs font-semibold rounded-md border border-green-300 transition-colors flex items-center gap-1"
                        >
                          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                          </svg>
                          Manage
                        </button>
                      </label>
                      <select
                        value={formData.category_id}
                        onChange={(e) => setFormData({ ...formData, category_id: e.target.value })}
                        className={`w-full px-4 py-2.5 border-2 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500 transition-colors ${
                          formErrors.category_id ? 'border-red-500 bg-red-50' : 'border-gray-300'
                        }`}
                      >
                        <option value="">-- Select Category --</option>
                        {categories.filter(c => c.is_active === 1).map((cat) => (
                          <option key={cat.category_id} value={cat.category_id}>
                            📁 {cat.category_name}
                          </option>
                        ))}
                      </select>
                      <p className="text-xs text-gray-500 mt-1">
                        {categories.filter(c => c.is_active === 1).length} categories available
                      </p>
                      {formErrors.category_id && (
                        <p className="text-red-600 text-xs mt-1 font-medium flex items-center gap-1">
                          <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                          </svg>
                          {formErrors.category_id}
                        </p>
                      )}
                    </div>

                    {/* Unit of Measure */}
                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-2">
                        Unit of Measure *
                      </label>
                      <select
                        value={formData.unit_of_measure}
                        onChange={(e) => setFormData({ ...formData, unit_of_measure: e.target.value })}
                        className={`w-full px-4 py-2.5 border-2 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500 transition-colors ${
                          formErrors.unit_of_measure ? 'border-red-500 bg-red-50' : 'border-gray-300'
                        }`}
                      >
                        <optgroup label="📦 Weight">
                          <option value="kg">Kilogram (kg)</option>
                          <option value="gram">Gram (g)</option>
                        </optgroup>
                        <optgroup label="💧 Volume">
                          <option value="liter">Liter (L)</option>
                        </optgroup>
                        <optgroup label="🔢 Quantity">
                          <option value="piece">Piece (pcs)</option>
                          <option value="dozen">Dozen (12 pcs)</option>
                        </optgroup>
                        <optgroup label="📦 Packaging">
                          <option value="bag">Bag</option>
                          <option value="box">Box</option>
                          <option value="carton">Carton</option>
                        </optgroup>
                      </select>
                      {formErrors.unit_of_measure && (
                        <p className="text-red-600 text-xs mt-1 font-medium flex items-center gap-1">
                          <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                          </svg>
                          {formErrors.unit_of_measure}
                        </p>
                      )}
                    </div>

                    {/* Reorder Level */}
                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-2">
                        Reorder Level (Alert Threshold) *
                      </label>
                      <div className="relative">
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          value={formData.reorder_level || ''}
                          onChange={(e) => setFormData({ ...formData, reorder_level: e.target.value })}
                          onKeyDown={(e) => {
                            if (e.key === 'e' || e.key === 'E' || e.key === '+' || e.key === '-') {
                              e.preventDefault();
                            }
                          }}
                          className={`w-full px-4 py-2.5 border-2 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500 transition-colors ${
                            formErrors.reorder_level ? 'border-red-500 bg-red-50' : 'border-gray-300'
                          }`}
                          placeholder="0.00"
                        />
                        <span className="absolute right-3 top-2.5 text-gray-500 text-sm">
                          {formData.unit_of_measure}
                        </span>
                      </div>
                      <p className="text-xs text-gray-500 mt-1">
                        ⚠️ Alert when stock falls below this level
                      </p>
                      {formErrors.reorder_level && (
                        <p className="text-red-600 text-xs mt-1 font-medium flex items-center gap-1">
                          <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                          </svg>
                          {formErrors.reorder_level}
                        </p>
                      )}
                    </div>

                    {/* Initial Stock (Create Mode Only) */}
                    {!editingProduct && (
                      <>
                        <div>
                          <label className="block text-sm font-semibold text-gray-700 mb-2">
                            Initial Stock Quantity *
                          </label>
                          <div className="relative">
                            <input
                              type="number"
                              step="0.01"
                              min="0"
                              value={formData.initial_stock || ''}
                              onChange={(e) => setFormData({ ...formData, initial_stock: e.target.value })}
                              onKeyDown={(e) => {
                                if (e.key === 'e' || e.key === 'E' || e.key === '+' || e.key === '-') {
                                  e.preventDefault();
                                }
                              }}
                              className={`w-full px-4 py-2.5 border-2 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500 transition-colors ${
                                formErrors.initial_stock ? 'border-red-500 bg-red-50' : 'border-gray-300'
                              }`}
                              placeholder="0.00"
                            />
                            <span className="absolute right-3 top-2.5 text-gray-500 text-sm">
                              {formData.unit_of_measure}
                            </span>
                          </div>
                          <p className="text-xs text-gray-500 mt-1">
                            📦 Opening stock when product is created
                          </p>
                          {formErrors.initial_stock && (
                            <p className="text-red-600 text-xs mt-1 font-medium flex items-center gap-1">
                              <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                                <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                              </svg>
                              {formErrors.initial_stock}
                            </p>
                          )}
                        </div>

                        <div>
                          <label className="block text-sm font-semibold text-gray-700 mb-2">
                            Unit Price (PKR) *
                          </label>
                          <div className="relative">
                            <span className="absolute left-3 top-2.5 text-gray-500 text-sm font-medium">
                              Rs.
                            </span>
                            <input
                              type="number"
                              step="0.01"
                              min="0"
                              value={formData.unit_price || ''}
                              onChange={(e) => setFormData({ ...formData, unit_price: e.target.value })}
                              onKeyDown={(e) => {
                                if (e.key === 'e' || e.key === 'E' || e.key === '+' || e.key === '-') {
                                  e.preventDefault();
                                }
                              }}
                              className={`w-full pl-10 pr-4 py-2.5 border-2 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500 transition-colors ${
                                formErrors.unit_price ? 'border-red-500 bg-red-50' : 'border-gray-300'
                              }`}
                              placeholder="0.00"
                            />
                          </div>
                          <p className="text-xs text-gray-500 mt-1">
                            💰 Price per {formData.unit_of_measure}
                          </p>
                          {formErrors.unit_price && (
                            <p className="text-red-600 text-xs mt-1 font-medium flex items-center gap-1">
                              <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                                <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                              </svg>
                              {formErrors.unit_price}
                            </p>
                          )}
                        </div>

                        {/* Initial Stock Value Preview */}
                        {parseFloat(formData.initial_stock) > 0 && parseFloat(formData.unit_price) > 0 && (
                          <div className="md:col-span-2 p-4 bg-purple-50 border-2 border-purple-200 rounded-lg">
                            <div className="flex items-center justify-between">
                              <div>
                                <p className="text-sm font-medium text-purple-900">Initial Stock Value</p>
                                <p className="text-xs text-purple-700 mt-0.5">
                                  {Math.round(parseFloat(formData.initial_stock))} {formData.unit_of_measure} × Rs. {parseFloat(formData.unit_price).toFixed(2)}
                                </p>
                              </div>
                              <div className="text-right">
                                <p className="text-3xl font-bold text-purple-600">
                                  Rs. {(Math.round(parseFloat(formData.initial_stock)) * parseFloat(formData.unit_price)).toFixed(2)}
                                </p>
                                <p className="text-xs text-purple-700">Total Value</p>
                              </div>
                            </div>
                          </div>
                        )}
                      </>
                    )}

                    {/* Description */}
                    <div className="md:col-span-2">
                      <label className="block text-sm font-semibold text-gray-700 mb-2">
                        Product Description (Optional)
                      </label>
                      <textarea
                        value={formData.description}
                        onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                        className="w-full px-4 py-2.5 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500 transition-colors"
                        rows="4"
                        placeholder="Enter detailed product description, specifications, usage instructions, or any other relevant information..."
                      />
                      <p className="text-xs text-gray-500 mt-1">
                        📝 Add details like composition, specifications, usage, or storage instructions
                      </p>
                    </div>
                  </div>
                </div>

                {/* ═══════════════════════════════════════════════════
                    RETAIL Industry-Specific Fields
                    ═══════════════════════════════════════════════════ */}
                {industryType === 'RETAIL' && (
                  <div className="mt-6 p-5 bg-gradient-to-r from-blue-50 to-indigo-50 border-2 border-blue-200 rounded-xl">
                    <div className="flex items-center gap-2 mb-4">
                      <span className="text-xl">🏪</span>
                      <h3 className="text-lg font-bold text-blue-900">Retail Product Details</h3>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      {/* SKU */}
                      {features.hasSKU && (
                        <div>
                          <label className="block text-sm font-semibold text-gray-700 mb-1">SKU</label>
                          <input
                            type="text"
                            value={formData.sku}
                            onChange={(e) => setFormData({ ...formData, sku: e.target.value })}
                            className="w-full px-3 py-2 border-2 border-blue-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                            placeholder="e.g., SKU-12345"
                          />
                        </div>
                      )}
                      {/* Barcode */}
                      {features.hasBarcode && (
                        <div>
                          <label className="block text-sm font-semibold text-gray-700 mb-1">Barcode</label>
                          <input
                            type="text"
                            value={formData.barcode}
                            onChange={(e) => setFormData({ ...formData, barcode: e.target.value })}
                            className="w-full px-3 py-2 border-2 border-blue-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                            placeholder="e.g., 8901234567890"
                          />
                        </div>
                      )}
                      {/* Brand */}
                      {features.hasBrand && (
                        <div>
                          <label className="block text-sm font-semibold text-gray-700 mb-1">Brand</label>
                          <input
                            type="text"
                            value={formData.brand}
                            onChange={(e) => setFormData({ ...formData, brand: e.target.value })}
                            className="w-full px-3 py-2 border-2 border-blue-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                            placeholder="e.g., Samsung, Nike"
                          />
                        </div>
                      )}
                      {/* Warranty */}
                      {features.hasWarranty && (
                        <div>
                          <label className="block text-sm font-semibold text-gray-700 mb-1">Warranty (months)</label>
                          <input
                            type="number"
                            min="0"
                            value={formData.warranty_months}
                            onChange={(e) => setFormData({ ...formData, warranty_months: e.target.value })}
                            className="w-full px-3 py-2 border-2 border-blue-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                          />
                        </div>
                      )}
                      {/* Price Range */}
                      <div>
                        <label className="block text-sm font-semibold text-gray-700 mb-1">Min Price (PKR)</label>
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          value={formData.min_price}
                          onChange={(e) => setFormData({ ...formData, min_price: e.target.value })}
                          className="w-full px-3 py-2 border-2 border-blue-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-semibold text-gray-700 mb-1">Max Price (PKR)</label>
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          value={formData.max_price}
                          onChange={(e) => setFormData({ ...formData, max_price: e.target.value })}
                          className="w-full px-3 py-2 border-2 border-blue-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        />
                      </div>
                    </div>
                    {/* Toggle fields */}
                    <div className="mt-4 flex flex-wrap gap-6">
                      {features.hasSerialNumbers && (
                        <label className="flex items-center gap-2 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={formData.serial_tracking}
                            onChange={(e) => setFormData({ ...formData, serial_tracking: e.target.checked })}
                            className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                          />
                          <span className="text-sm font-medium text-gray-700">Serial Number Tracking</span>
                        </label>
                      )}
                      {features.hasVariants && (
                        <label className="flex items-center gap-2 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={formData.has_variants}
                            onChange={(e) => setFormData({ ...formData, has_variants: e.target.checked })}
                            className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                          />
                          <span className="text-sm font-medium text-gray-700">Has Variants (size, color, etc.)</span>
                        </label>
                      )}
                    </div>
                  </div>
                )}

                {/* ═══════════════════════════════════════════════════
                    MEDICAL Industry-Specific Fields
                    ═══════════════════════════════════════════════════ */}
                {industryType === 'MEDICAL' && (
                  <div className="mt-6 p-5 bg-gradient-to-r from-red-50 to-pink-50 border-2 border-red-200 rounded-xl">
                    <div className="flex items-center gap-2 mb-4">
                      <span className="text-xl">🏥</span>
                      <h3 className="text-lg font-bold text-red-900">Medicine Details</h3>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      {/* Generic Name */}
                      <div>
                        <label className="block text-sm font-semibold text-gray-700 mb-1">Generic Name *</label>
                        <input
                          type="text"
                          value={formData.generic_name}
                          onChange={(e) => setFormData({ ...formData, generic_name: e.target.value })}
                          className="w-full px-3 py-2 border-2 border-red-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-red-500"
                          placeholder="e.g., Paracetamol"
                        />
                      </div>
                      {/* Brand Name */}
                      <div>
                        <label className="block text-sm font-semibold text-gray-700 mb-1">Brand Name</label>
                        <input
                          type="text"
                          value={formData.brand_name}
                          onChange={(e) => setFormData({ ...formData, brand_name: e.target.value })}
                          className="w-full px-3 py-2 border-2 border-red-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-red-500"
                          placeholder="e.g., Panadol"
                        />
                      </div>
                      {/* Drug Form */}
                      <div>
                        <label className="block text-sm font-semibold text-gray-700 mb-1">Drug Form</label>
                        <select
                          value={formData.drug_form}
                          onChange={(e) => setFormData({ ...formData, drug_form: e.target.value })}
                          className="w-full px-3 py-2 border-2 border-red-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-red-500"
                        >
                          <option value="">Select Form</option>
                          <option value="Tablet">Tablet</option>
                          <option value="Capsule">Capsule</option>
                          <option value="Syrup">Syrup</option>
                          <option value="Injection">Injection</option>
                          <option value="Cream">Cream</option>
                          <option value="Ointment">Ointment</option>
                          <option value="Drops">Drops</option>
                          <option value="Inhaler">Inhaler</option>
                          <option value="Powder">Powder</option>
                          <option value="Suppository">Suppository</option>
                          <option value="Gel">Gel</option>
                          <option value="Patch">Patch</option>
                          <option value="Suspension">Suspension</option>
                        </select>
                      </div>
                      {/* Strength */}
                      <div>
                        <label className="block text-sm font-semibold text-gray-700 mb-1">Strength</label>
                        <input
                          type="text"
                          value={formData.strength}
                          onChange={(e) => setFormData({ ...formData, strength: e.target.value })}
                          className="w-full px-3 py-2 border-2 border-red-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-red-500"
                          placeholder="e.g., 500mg, 250mg/5ml"
                        />
                      </div>
                      {/* Composition */}
                      <div className="md:col-span-2">
                        <label className="block text-sm font-semibold text-gray-700 mb-1">Composition</label>
                        <input
                          type="text"
                          value={formData.composition}
                          onChange={(e) => setFormData({ ...formData, composition: e.target.value })}
                          className="w-full px-3 py-2 border-2 border-red-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-red-500"
                          placeholder="Active ingredients"
                        />
                      </div>
                      {/* Storage Conditions */}
                      <div className="md:col-span-3">
                        <label className="block text-sm font-semibold text-gray-700 mb-1">Storage Conditions</label>
                        <input
                          type="text"
                          value={formData.storage_conditions}
                          onChange={(e) => setFormData({ ...formData, storage_conditions: e.target.value })}
                          className="w-full px-3 py-2 border-2 border-red-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-red-500"
                          placeholder="e.g., Store below 25°C, Keep away from light"
                        />
                      </div>
                    </div>
                    {/* Toggle fields */}
                    <div className="mt-4 flex flex-wrap gap-6">
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={formData.requires_prescription}
                          onChange={(e) => setFormData({ ...formData, requires_prescription: e.target.checked })}
                          className="w-4 h-4 text-red-600 border-gray-300 rounded focus:ring-red-500"
                        />
                        <span className="text-sm font-medium text-gray-700">Requires Prescription (Rx)</span>
                      </label>
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={formData.controlled_substance}
                          onChange={(e) => setFormData({ ...formData, controlled_substance: e.target.checked })}
                          className="w-4 h-4 text-red-600 border-gray-300 rounded focus:ring-red-500"
                        />
                        <span className="text-sm font-medium text-red-700 font-bold">⚠️ Controlled Substance</span>
                      </label>
                    </div>
                  </div>
                )}

                {/* Action Buttons */}
                <div className="sticky bottom-0 bg-gray-50 border-t-2 border-gray-200 px-6 py-4 -mx-6 -mb-6 rounded-b-lg">
                  <div className="flex gap-3">
                    <button
                      type="button"
                      onClick={() => setShowModal(false)}
                      className="flex-1 px-6 py-3 border-2 border-gray-300 rounded-lg text-gray-700 font-semibold hover:bg-gray-100 hover:border-gray-400 transition-colors flex items-center justify-center gap-2"
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={loading}
                      className="flex-1 px-6 py-3 bg-green-600 text-white rounded-lg font-semibold hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
                    >
                      {loading ? (
                        <>
                          <svg className="animate-spin h-5 w-5 text-white" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                          </svg>
                          {editingProduct ? 'Updating...' : 'Creating...'}
                        </>
                      ) : (
                        <>
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                          </svg>
                          {editingProduct ? 'Update Product' : 'Create Product'}
                        </>
                      )}
                    </button>
                  </div>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Clear Stock Before Delete Modal */}
        {showClearStockModal && deletingProduct && clearingForDeletion && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-lg max-w-lg w-full p-6">
              <div className="flex items-start mb-4">
                <div className="flex-shrink-0">
                  <svg className="w-10 h-10 text-orange-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                  </svg>
                </div>
                <div className="ml-4 flex-1">
                  <h2 className="text-xl font-bold text-gray-900">Product Has Stock</h2>
                  <p className="text-sm text-gray-600 mt-1">
                    Before deleting "{deletingProduct.product_name}", you must clear its stock inventory.
                  </p>
                </div>
              </div>

              <div className="mb-4 p-4 bg-orange-50 border border-orange-200 rounded-lg">
                <div className="flex justify-between items-center">
                  <span className="text-sm font-medium text-gray-700">Current Stock:</span>
                  <span className="text-lg font-bold text-orange-600">
                    {parseFloat(deletingProduct.current_stock).toFixed(2)} {deletingProduct.unit_of_measure}
                  </span>
                </div>
                {productStockBatches[deletingProduct.product_id] && (
                  <div className="mt-2 text-xs text-gray-600">
                    {productStockBatches[deletingProduct.product_id].length} price batch(es) will be cleared
                  </div>
                )}
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Reason for Clearing Stock *
                  </label>
                  <select
                    value={clearStockData.reason}
                    onChange={(e) => setClearStockData({ ...clearStockData, reason: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500"
                  >
                    <option value="">Select reason...</option>
                    <option value="PRODUCT_DISCONTINUATION">Product Discontinuation</option>
                    <option value="EXPIRED_DAMAGED">Expired/Damaged - Disposed</option>
                    <option value="RETURNED_TO_SUPPLIER">Returned to Supplier</option>
                    <option value="TRANSFERRED_OUT">Transferred Out</option>
                    <option value="INVENTORY_CORRECTION">Inventory Correction</option>
                    <option value="OTHER">Other</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Additional Notes (Optional)
                  </label>
                  <textarea
                    value={clearStockData.notes}
                    onChange={(e) => setClearStockData({ ...clearStockData, notes: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500"
                    rows="2"
                    placeholder="Add any additional details..."
                  />
                </div>

                <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
                  <p className="text-xs text-blue-800">
                    <span className="font-semibold">What happens next:</span>
                    <br />1. All stock batches will be cleared to 0
                    <br />2. Movement history will be recorded
                    <br />3. You'll be able to delete the product
                  </p>
                </div>
              </div>

              <div className="mt-6 flex gap-3">
                <button
                  onClick={() => {
                    setShowClearStockModal(false);
                    setClearingForDeletion(false);
                    setDeletingProduct(null);
                  }}
                  className="flex-1 px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  onClick={handleClearStockForDeletion}
                  className="flex-1 px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 font-medium"
                >
                  Clear Stock & Proceed
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Delete Confirmation Modal */}
        {showDeleteModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-lg max-w-md w-full p-6">
              <div className="flex items-center mb-4">
                <svg className="w-12 h-12 text-red-600 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
                <h2 className="text-xl font-bold text-red-600">Confirm Delete</h2>
              </div>
              
              <p className="text-gray-700 mb-4">
                Are you sure you want to permanently delete:
              </p>
              
              <div className="mb-6 p-4 bg-gray-50 rounded-lg border border-gray-200">
                <p className="font-bold text-gray-900">{deletingProduct?.product_name}</p>
                <p className="text-sm text-gray-600 mt-1">Code: {deletingProduct?.product_code}</p>
                <p className="text-sm text-gray-600">Category: {deletingProduct?.category_name}</p>
                <p className="text-sm font-medium text-green-600 mt-2">
                  ✓ Stock: {parseFloat(deletingProduct?.current_stock || 0).toFixed(2)} {deletingProduct?.unit_of_measure}
                </p>
              </div>

              <div className="p-3 bg-red-50 border border-red-200 rounded-lg mb-6">
                <p className="text-sm text-red-800">
                  <span className="font-semibold">Warning:</span> This action cannot be undone. The product will be deactivated and removed from active listings.
                </p>
              </div>

              <div className="flex gap-3">
                <button
                  onClick={() => {
                    setShowDeleteModal(false);
                    setDeletingProduct(null);
                  }}
                  className="flex-1 px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  onClick={confirmDelete}
                  disabled={loading}
                  className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 font-medium"
                >
                  {loading ? 'Deleting...' : 'Delete Product'}
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
                <h2 className="text-xl font-bold text-orange-600">Low Stock Products</h2>
                <button
                  onClick={() => setShowLowStockModal(false)}
                  className="text-gray-500 hover:text-gray-700"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
              {lowStockProducts.length === 0 ? (
                <p className="text-gray-600 text-center py-8">No products with low stock</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Product</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Current</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Reorder</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Shortage</th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {lowStockProducts.map((product) => {
                        const shortage = parseFloat(product.reorder_level) - parseFloat(product.current_stock || 0);
                        return (
                          <tr key={product.product_id}>
                            <td className="px-4 py-3">
                              <div className="text-sm font-medium text-gray-900">{product.product_name}</div>
                              <div className="text-sm text-gray-500">{product.category_name}</div>
                            </td>
                            <td className="px-4 py-3 text-sm text-red-600 font-medium">
                              {parseFloat(product.current_stock || 0).toFixed(2)} {product.unit_of_measure}
                            </td>
                            <td className="px-4 py-3 text-sm text-gray-900">
                              {parseFloat(product.reorder_level).toFixed(2)} {product.unit_of_measure}
                            </td>
                            <td className="px-4 py-3 text-sm font-medium text-orange-600">
                              {shortage.toFixed(2)} {product.unit_of_measure}
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

        {/* Category Management Modal */}
        {showCategoryModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-lg max-w-2xl w-full p-6 max-h-[90vh] overflow-y-auto">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-xl font-bold text-gray-900">Manage Categories</h2>
                <button
                  onClick={() => setShowCategoryModal(false)}
                  className="text-gray-500 hover:text-gray-700"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              {/* Add New Category */}
              <div className="mb-6 p-4 bg-green-50 rounded-lg border border-green-200">
                <h3 className="text-sm font-semibold text-gray-700 mb-3">Add New Category</h3>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={newCategoryName}
                    onChange={(e) => setNewCategoryName(e.target.value)}
                    placeholder="Enter category name..."
                    className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                    onKeyPress={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        handleAddCategory();
                      }
                    }}
                  />
                  <button
                    onClick={handleAddCategory}
                    disabled={!newCategoryName.trim()}
                    className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed font-medium"
                  >
                    Add
                  </button>
                </div>
              </div>

              {/* Existing Categories List */}
              <div>
                <h3 className="text-sm font-semibold text-gray-700 mb-3">Existing Categories</h3>
                {categories.length === 0 ? (
                  <p className="text-gray-500 text-center py-8">No categories available</p>
                ) : (
                  <div className="space-y-2 max-h-96 overflow-y-auto">
                    {categories.map((category) => (
                      <div
                        key={category.category_id}
                        className="flex items-center justify-between p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
                      >
                        <div className="flex items-center gap-3">
                          <span className="text-sm font-mono text-gray-500">{category.category_code}</span>
                          <span className="font-medium text-gray-900">{category.category_name}</span>
                          {category.is_active === 0 && (
                            <span className="text-xs px-2 py-0.5 bg-red-100 text-red-700 rounded">Inactive</span>
                          )}
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-gray-500">{category.product_count || 0} products</span>
                          <button
                            onClick={() => handleDeleteCategory(category)}
                            className="text-red-600 hover:text-red-800"
                            title={category.product_count > 0 ? 'Delete category (products will be reassigned)' : 'Delete category'}
                          >
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="mt-6 flex justify-end">
                <button
                  onClick={() => setShowCategoryModal(false)}
                  className="px-6 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 font-medium"
                >
                  Done
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Stock Adjustment Modal */}
        {showStockAdjustModal && adjustingProduct && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-lg max-w-md w-full p-6">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-xl font-bold text-gray-900">Adjust Stock</h2>
                <button
                  onClick={() => setShowStockAdjustModal(false)}
                  className="text-gray-500 hover:text-gray-700"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              <div className="mb-4 p-3 bg-gray-50 rounded-lg">
                <p className="text-sm text-gray-700">
                  <span className="font-semibold">Product:</span> {adjustingProduct.product_name}
                </p>
                <p className="text-sm text-gray-700 mt-1">
                  <span className="font-semibold">Current Stock:</span> {parseFloat(adjustingProduct.current_stock || 0).toFixed(2)} {adjustingProduct.unit_of_measure}
                </p>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    New Quantity *
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={stockAdjustData.newQuantity}
                    onChange={(e) => setStockAdjustData({ ...stockAdjustData, newQuantity: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    placeholder="Enter new quantity"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Reason for Adjustment *
                  </label>
                  <select
                    value={stockAdjustData.reason}
                    onChange={(e) => setStockAdjustData({ ...stockAdjustData, reason: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">Select reason...</option>
                    <option value="INVENTORY_COUNT">Inventory Count</option>
                    <option value="DAMAGE">Damage/Spoilage</option>
                    <option value="LOSS">Loss/Theft</option>
                    <option value="FOUND">Found Items</option>
                    <option value="CORRECTION">Data Correction</option>
                    <option value="EXPIRED">Expired/Disposed</option>
                    <option value="OTHER">Other</option>
                  </select>
                </div>

                <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                  <p className="text-xs text-yellow-800">
                    <span className="font-semibold">Note:</span> This will set the stock to the exact quantity entered. 
                    {parseFloat(stockAdjustData.newQuantity) === 0 && (
                      <span className="block mt-1 text-orange-700 font-semibold">
                        ⚠️ Setting to 0 will clear all price batches for this product.
                      </span>
                    )}
                  </p>
                </div>
              </div>

              <div className="mt-6 flex gap-3">
                <button
                  onClick={() => setShowStockAdjustModal(false)}
                  className="flex-1 px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  onClick={handleStockAdjustment}
                  className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                >
                  Adjust Stock
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Category Delete with Reassignment Modal */}
        {categoryDeleteModal.open && categoryDeleteModal.category && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="p-2 bg-red-100 rounded-full">
                  <svg className="w-6 h-6 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                </div>
                <div>
                  <h2 className="text-xl font-bold text-gray-900">Delete Category</h2>
                  <p className="text-sm text-gray-500">{categoryDeleteModal.category.category_name}</p>
                </div>
              </div>

              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-4">
                <p className="text-yellow-800">
                  <span className="font-semibold">Warning:</span> This category has <span className="font-bold">{categoryDeleteModal.category.product_count}</span> product(s). 
                  Please select a category to reassign them before deletion.
                </p>
              </div>

              <div className="mb-6">
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Reassign Products To
                </label>
                <select
                  value={categoryDeleteModal.targetCategoryId}
                  onChange={(e) => setCategoryDeleteModal(prev => ({ ...prev, targetCategoryId: e.target.value }))}
                  className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-blue-500 focus:ring-0 transition-colors"
                >
                  <option value="">Select a category...</option>
                  {categories
                    .filter(c => c.category_id !== categoryDeleteModal.category.category_id && c.is_active !== 0)
                    .map(c => (
                      <option key={c.category_id} value={c.category_id}>
                        {c.category_name} ({c.product_count || 0} existing products)
                      </option>
                    ))
                  }
                </select>
              </div>

              <div className="flex gap-3">
                <button
                  onClick={() => setCategoryDeleteModal({ open: false, category: null, targetCategoryId: '' })}
                  className="flex-1 px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  onClick={() => performCategoryDelete(categoryDeleteModal.category.category_id, parseInt(categoryDeleteModal.targetCategoryId))}
                  disabled={!categoryDeleteModal.targetCategoryId}
                  className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Delete & Reassign
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ═══════════════════════════════════════════════ */}
        {/* Product Variants Management Modal              */}
        {/* ═══════════════════════════════════════════════ */}
        {showVariantsModal && selectedProductForVariants && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-2xl shadow-2xl max-w-3xl w-full max-h-[85vh] flex flex-col">
              {/* Header */}
              <div className="p-6 border-b border-gray-200 flex items-center justify-between">
                <div>
                  <h2 className="text-xl font-bold text-gray-900">Product Variants</h2>
                  <p className="text-sm text-gray-500 mt-1">{selectedProductForVariants.product_name}</p>
                </div>
                <button
                  onClick={() => { setShowVariantsModal(false); setSelectedProductForVariants(null); }}
                  className="text-gray-400 hover:text-gray-600 p-2 hover:bg-gray-100 rounded-full transition-colors"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              {/* Add / Edit Variant Form */}
              <div className="p-6 border-b border-gray-100 bg-gray-50">
                <h3 className="text-sm font-semibold text-gray-700 mb-3">
                  {editingVariant ? 'Edit Variant' : 'Add New Variant'}
                </h3>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                  <input
                    type="text"
                    placeholder="Variant name *"
                    value={variantFormData.variant_name}
                    onChange={(e) => setVariantFormData({ ...variantFormData, variant_name: e.target.value })}
                    className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                  />
                  <input
                    type="text"
                    placeholder="Type (e.g., Size, Color)"
                    value={variantFormData.variant_type}
                    onChange={(e) => setVariantFormData({ ...variantFormData, variant_type: e.target.value })}
                    className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                  />
                  <input
                    type="text"
                    placeholder="SKU"
                    value={variantFormData.sku}
                    onChange={(e) => setVariantFormData({ ...variantFormData, sku: e.target.value })}
                    className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                  />
                  <input
                    type="text"
                    placeholder="Barcode"
                    value={variantFormData.barcode}
                    onChange={(e) => setVariantFormData({ ...variantFormData, barcode: e.target.value })}
                    className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                  />
                  <input
                    type="number"
                    step="0.01"
                    placeholder="Additional Price"
                    value={variantFormData.additional_price}
                    onChange={(e) => setVariantFormData({ ...variantFormData, additional_price: e.target.value })}
                    className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                  />
                  <div className="flex gap-2">
                    <button
                      onClick={editingVariant ? handleUpdateVariant : handleAddVariant}
                      className="flex-1 px-4 py-2 bg-purple-600 text-white rounded-lg text-sm font-medium hover:bg-purple-700 transition-colors"
                    >
                      {editingVariant ? 'Update' : 'Add'}
                    </button>
                    {editingVariant && (
                      <button
                        onClick={() => {
                          setEditingVariant(null);
                          setVariantFormData({ variant_name: '', variant_type: '', sku: '', barcode: '', additional_price: '0' });
                        }}
                        className="px-3 py-2 border border-gray-300 text-gray-600 rounded-lg text-sm hover:bg-gray-100 transition-colors"
                      >
                        Cancel
                      </button>
                    )}
                  </div>
                </div>
              </div>

              {/* Variants List */}
              <div className="flex-1 overflow-y-auto p-6">
                {variants.length === 0 ? (
                  <div className="text-center py-8 text-gray-500">
                    <svg className="mx-auto h-10 w-10 text-gray-300 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                    </svg>
                    <p className="text-sm">No variants yet. Add your first variant above.</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {variants.map((variant) => (
                      <div
                        key={variant.variant_id}
                        className="flex items-center justify-between p-3 bg-white border border-gray-200 rounded-lg hover:border-purple-200 transition-colors"
                      >
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="font-medium text-gray-900">{variant.variant_name}</span>
                            {variant.variant_type && (
                              <span className="px-2 py-0.5 bg-purple-100 text-purple-700 text-xs font-medium rounded">
                                {variant.variant_type}
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-3 mt-1 text-xs text-gray-500">
                            {variant.sku && <span>SKU: {variant.sku}</span>}
                            {variant.barcode && <span>Barcode: {variant.barcode}</span>}
                            {parseFloat(variant.additional_price) > 0 && (
                              <span className="text-green-600 font-medium">+Rs. {parseFloat(variant.additional_price).toFixed(2)}</span>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-1 ml-3">
                          <button
                            onClick={() => startEditVariant(variant)}
                            className="p-1.5 text-blue-600 hover:bg-blue-50 rounded transition-colors"
                            title="Edit"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                            </svg>
                          </button>
                          <button
                            onClick={() => handleDeleteVariant(variant.variant_id)}
                            className="p-1.5 text-red-600 hover:bg-red-50 rounded transition-colors"
                            title="Remove"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Footer */}
              <div className="p-4 border-t border-gray-200 bg-gray-50 rounded-b-2xl">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-500">{variants.length} variant(s)</span>
                  <button
                    onClick={() => { setShowVariantsModal(false); setSelectedProductForVariants(null); }}
                    className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-300 transition-colors"
                  >
                    Close
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ═══════════════════════════════════════════════ */}
        {/* Serial Numbers Management Modal                */}
        {/* ═══════════════════════════════════════════════ */}
        {showSerialsModal && selectedProductForSerials && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-2xl shadow-2xl max-w-3xl w-full max-h-[85vh] flex flex-col">
              {/* Header */}
              <div className="p-6 border-b border-gray-200 flex items-center justify-between">
                <div>
                  <h2 className="text-xl font-bold text-gray-900">Serial Numbers</h2>
                  <p className="text-sm text-gray-500 mt-1">{selectedProductForSerials.product_name}</p>
                </div>
                <button
                  onClick={() => { setShowSerialsModal(false); setSelectedProductForSerials(null); }}
                  className="text-gray-400 hover:text-gray-600 p-2 hover:bg-gray-100 rounded-full transition-colors"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              {/* Add Serial Form */}
              <div className="p-6 border-b border-gray-100 bg-gray-50">
                <h3 className="text-sm font-semibold text-gray-700 mb-3">Add New Serial Number</h3>
                <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                  <input
                    type="text"
                    placeholder="Serial number *"
                    value={serialFormData.serial_number}
                    onChange={(e) => setSerialFormData({ ...serialFormData, serial_number: e.target.value })}
                    className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                  />
                  <input
                    type="date"
                    placeholder="Warranty expiry"
                    value={serialFormData.warranty_expiry}
                    onChange={(e) => setSerialFormData({ ...serialFormData, warranty_expiry: e.target.value })}
                    className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                  />
                  <input
                    type="text"
                    placeholder="Notes"
                    value={serialFormData.notes}
                    onChange={(e) => setSerialFormData({ ...serialFormData, notes: e.target.value })}
                    className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                  />
                  <button
                    onClick={handleAddSerial}
                    className="px-4 py-2 bg-teal-600 text-white rounded-lg text-sm font-medium hover:bg-teal-700 transition-colors"
                  >
                    Add Serial
                  </button>
                </div>
              </div>

              {/* Filter Tabs */}
              <div className="px-6 pt-4 flex items-center gap-2">
                {[
                  { label: 'All', value: '', count: serialNumbers.length },
                  { label: 'In Stock', value: 'in_stock', count: serialNumbers.filter(s => s.status === 'in_stock').length },
                  { label: 'Sold', value: 'sold', count: serialNumbers.filter(s => s.status === 'sold').length },
                  { label: 'Returned', value: 'returned', count: serialNumbers.filter(s => s.status === 'returned').length },
                ].map((tab) => (
                  <button
                    key={tab.value}
                    onClick={() => setSerialFilter(tab.value)}
                    className={`px-3 py-1.5 text-xs font-medium rounded-full transition-colors ${
                      serialFilter === tab.value
                        ? 'bg-teal-600 text-white'
                        : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                    }`}
                  >
                    {tab.label} ({tab.count})
                  </button>
                ))}
              </div>

              {/* Serial Numbers List */}
              <div className="flex-1 overflow-y-auto p-6">
                {filteredSerials.length === 0 ? (
                  <div className="text-center py-8 text-gray-500">
                    <svg className="mx-auto h-10 w-10 text-gray-300 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
                    </svg>
                    <p className="text-sm">No serial numbers found.</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {filteredSerials.map((serial) => (
                      <div
                        key={serial.serial_id}
                        className="flex items-center justify-between p-3 bg-white border border-gray-200 rounded-lg hover:border-teal-200 transition-colors"
                      >
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="font-mono font-medium text-gray-900">{serial.serial_number}</span>
                            <span className={`px-2 py-0.5 text-xs font-bold rounded ${
                              serial.status === 'in_stock'
                                ? 'bg-green-100 text-green-700'
                                : serial.status === 'sold'
                                ? 'bg-blue-100 text-blue-700'
                                : 'bg-yellow-100 text-yellow-700'
                            }`}>
                              {serial.status === 'in_stock' ? 'In Stock' : serial.status === 'sold' ? 'Sold' : 'Returned'}
                            </span>
                          </div>
                          <div className="flex items-center gap-3 mt-1 text-xs text-gray-500">
                            {serial.warranty_expiry && (
                              <span>Warranty: {new Date(serial.warranty_expiry).toLocaleDateString()}</span>
                            )}
                            {serial.notes && <span>{serial.notes}</span>}
                            {serial.created_at && (
                              <span>Added: {new Date(serial.created_at).toLocaleDateString()}</span>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-1 ml-3">
                          {serial.status === 'sold' && (
                            <button
                              onClick={() => handleMarkSerialReturned(serial.serial_id)}
                              className="px-2 py-1 text-xs font-medium text-yellow-700 bg-yellow-50 hover:bg-yellow-100 rounded transition-colors"
                              title="Mark as Returned"
                            >
                              Return
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Footer */}
              <div className="p-4 border-t border-gray-200 bg-gray-50 rounded-b-2xl">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4 text-sm text-gray-500">
                    <span>{serialNumbers.length} total</span>
                    <span className="text-green-600">{serialNumbers.filter(s => s.status === 'in_stock').length} in stock</span>
                    <span className="text-blue-600">{serialNumbers.filter(s => s.status === 'sold').length} sold</span>
                  </div>
                  <button
                    onClick={() => { setShowSerialsModal(false); setSelectedProductForSerials(null); }}
                    className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-300 transition-colors"
                  >
                    Close
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

export default ProductsPage;
