import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSelector } from 'react-redux';
import { useToast } from '../components/common/Toast';
import {
  ArrowLeftIcon,
  UserGroupIcon,
  BuildingOfficeIcon,
  UserIcon,
  CubeIcon,
  CheckCircleIcon,
  ShoppingCartIcon,
  PrinterIcon,
  DocumentTextIcon
} from '@heroicons/react/24/outline';
import MultiItemTransactionForm from '../components/transaction/MultiItemTransactionForm';

const UniversalTransactionPage = () => {
  const navigate = useNavigate();
  const { user: currentUser } = useSelector((state) => state.auth);
  const { industryConfig } = useSelector((state) => state.organization);
  const toast = useToast();

  // Industry-aware configuration
  const terminology = industryConfig?.terminology || {};
  const features = industryConfig?.features || {};
  const industryType = industryConfig?.industry || industryConfig?.industryType || 'AGRICULTURAL';
  const isRetail = industryType === 'RETAIL';

  console.log('[UniversalTransactionPage] Component mounted successfully');
  console.log('[UniversalTransactionPage] Current route:', window.location.hash);
  console.log('[UniversalTransactionPage] Industry:', industryType);

  // Step management
  const [step, setStep] = useState(1);
  
  // Sprint 6: Multi-item mode toggle
  const [isMultiItemMode, setIsMultiItemMode] = useState(false);
  const [multiItemList, setMultiItemList] = useState([]);
  
  // Last transaction result for receipt
  const [lastTransactionId, setLastTransactionId] = useState(null);
  const [lastTransactionNumber, setLastTransactionNumber] = useState(null);
  
  // Module selection
  const [selectedModule, setSelectedModule] = useState(''); // 'farmer', 'company', 'dealer'
  
  // Entity type
  const [entityType, setEntityType] = useState(''); // 'regular', 'irregular'
  const [isNewEntity, setIsNewEntity] = useState(false); // For regular: new or existing
  
  // Entity data
  const [selectedEntity, setSelectedEntity] = useState(null);
  const [entities, setEntities] = useState([]);
  const [entitySearchTerm, setEntitySearchTerm] = useState('');
  
  // Transaction type
  const [transactionType, setTransactionType] = useState(''); // 'buy', 'sell', 'delivery', 'purchase', 'adjustment'
  
  // Transaction data
  const [transactionData, setTransactionData] = useState({
    // Entity info (for irregular customers)
    entity_name: '',
    entity_father_name: '',
    entity_cnic: '',
    entity_phone: '',
    entity_address: '',
    
    // Transaction details
    item_type: 'product', // 'product' or 'grain'
    item_id: '',
    quantity: '',
    unit_price: '',
    total_amount: 0,
    payment_type: 'CASH', // 'CASH', 'CREDIT', 'PARTIAL'
    cash_paid: '',
    credit_amount: '',
    description: '',
  });
  
  // Available items
  const [products, setProducts] = useState([]);
  const [grains, setGrains] = useState([]);
  const [selectedItem, setSelectedItem] = useState(null);
  
  // Quick grain creation
  const [showQuickGrainForm, setShowQuickGrainForm] = useState(false);
  const [newGrainData, setNewGrainData] = useState({
    grain_name: '',
    unit_of_measure: 'kg',
    description: ''
  });
  const [isCreatingGrain, setIsCreatingGrain] = useState(false);

  // Quick product creation
  const [showQuickProductForm, setShowQuickProductForm] = useState(false);
  const [newProductData, setNewProductData] = useState({
    product_name: '',
    category_id: '',
    unit_of_measure: 'piece',
    description: '',
    reorder_level: 0,
    // Initial stock delivery info
    initial_quantity: '',
    initial_price: '',
    initial_storage_location: 'Main Warehouse'
  });
  const [isCreatingProduct, setIsCreatingProduct] = useState(false);
  
  // Quick category creation (nested in product creation)
  const [showQuickCategoryForm, setShowQuickCategoryForm] = useState(false);
  const [newCategoryData, setNewCategoryData] = useState({
    category_name: '',
    description: ''
  });
  const [isCreatingCategory, setIsCreatingCategory] = useState(false);
  const [categories, setCategories] = useState([]);

  // Stock location for grain IN transactions
  const [stockLocation, setStockLocation] = useState('Main Warehouse');
  const stockLocations = [
    'Main Warehouse',
    'Warehouse A',
    'Warehouse B',
    'Godown 1',
    'Godown 2',
    'Cold Storage',
    'Open Storage',
    'Processing Unit'
  ];

  // Load data based on module
  useEffect(() => {
    if (selectedModule) {
      loadEntities();
      loadProducts();
      loadGrains();
    }
  }, [selectedModule]);

  // Load categories when product modal opens
  useEffect(() => {
    if (showQuickProductForm) {
      loadCategories();
    }
  }, [showQuickProductForm]);

  // AUTO-CALCULATE CREDIT AMOUNT when cash_paid or total_amount changes
  // Feature: Automatic credit calculation for secure transaction entry
  useEffect(() => {
    // Get total from multi-item mode or single-item mode
    const totalAmount = isMultiItemMode 
      ? parseFloat(multiItemList?.overallDiscount?.grandTotal || 0)
      : parseFloat(transactionData.total_amount) || 0;
    const cashPaid = parseFloat(transactionData.cash_paid) || 0;
    
    // Only auto-calculate for PARTIAL payment type
    if (transactionData.payment_type === 'PARTIAL' && totalAmount > 0) {
      const calculatedCredit = Math.max(0, totalAmount - cashPaid);
      
      // Update credit_amount if it's different (avoid infinite loop)
      const currentCredit = parseFloat(transactionData.credit_amount) || 0;
      if (Math.abs(calculatedCredit - currentCredit) > 0.01) {
        setTransactionData(prev => ({
          ...prev,
          credit_amount: calculatedCredit.toFixed(2)
        }));
      }
    }
  }, [transactionData.cash_paid, transactionData.total_amount, transactionData.payment_type, isMultiItemMode, multiItemList]);

  const loadEntities = async () => {
    try {
      let result;
      if (selectedModule === 'farmer') {
        result = await window.electronAPI.farmer.getAll(true);
        setEntities(result?.data || result || []);
      } else if (selectedModule === 'company') {
        result = await window.electronAPI.company.getAll(true);
        setEntities(result?.data || result || []);
      } else if (selectedModule === 'dealer') {
        result = await window.electronAPI.dealer.getAll(true);
        setEntities(result?.data || result || []);
      }
    } catch (error) {
      console.error('Error loading entities:', error);
      setEntities([]);
    }
  };

  const loadProducts = async () => {
    try {
      const result = await window.electronAPI.product.getAll({ is_active: 1 });
      const productsData = result?.data || result || [];
      
      // Load stock levels for each product
      const stockResult = await window.electronAPI.stock.getLevels({ item_type: 'PRODUCT' });
      const stockData = stockResult?.data || stockResult || [];
      
      // Merge product data with stock info
      const productsWithStock = productsData.map(product => {
        const stock = stockData.find(s => s.item_id === product.product_id);
        return {
          ...product,
          available_quantity: stock?.total_quantity || 0,
          min_price: stock?.min_price || 0,
          max_price: stock?.max_price || 0,
          avg_price: stock?.avg_price || 0,
          price_variants: stock?.price_variants || 0
        };
      });
      
      setProducts(productsWithStock);
    } catch (error) {
      console.error('Error loading products:', error);
    }
  };

  const loadGrains = async () => {
    try {
      const result = await window.electronAPI.grain.getAll({ is_active: 1 });
      const grainsData = result?.data || result || [];
      
      // Load stock levels for each grain
      const stockResult = await window.electronAPI.stock.getLevels({ item_type: 'GRAIN' });
      const stockData = stockResult?.data || stockResult || [];
      
      // Merge grain data with stock info
      const grainsWithStock = grainsData.map(grain => {
        const stock = stockData.find(s => s.item_id === grain.grain_id);
        return {
          ...grain,
          available_quantity: stock?.total_quantity || 0,
          min_price: stock?.min_price || 0,
          max_price: stock?.max_price || 0,
          avg_price: stock?.avg_price || 0,
          price_variants: stock?.price_variants || 0
        };
      });
      
      setGrains(grainsWithStock);
    } catch (error) {
      console.error('Error loading grains:', error);
    }
  };

  // Load product categories
  const loadCategories = async () => {
    try {
      const result = await window.electronAPI.productCategory.getAll({ is_active: 1 });
      setCategories(result?.data || result || []);
    } catch (error) {
      console.error('Error loading categories:', error);
      setCategories([]);
    }
  };

  // Calculate total amount
  useEffect(() => {
    if (transactionData.quantity && transactionData.unit_price) {
      const total = parseFloat(transactionData.quantity) * parseFloat(transactionData.unit_price);
      setTransactionData(prev => ({ ...prev, total_amount: total }));
    }
  }, [transactionData.quantity, transactionData.unit_price]);

  const handleModuleSelect = (module) => {
    setSelectedModule(module);
    setStep(2);
  };

  const handleEntityTypeSelect = (type) => {
    setEntityType(type);
    if (type === 'irregular') {
      setStep(5); // Skip directly to transaction type selection (no entity selection needed)
    } else {
      setStep(3); // Go to new/existing selection for regular customers
    }
  };

  const handleNewExistingSelect = (isNew) => {
    setIsNewEntity(isNew);
    if (isNew) {
      // Redirect to create entity page based on module
      if (selectedModule === 'farmer') {
        navigate('/farmers?action=create&returnTo=/transactions/new');
      } else if (selectedModule === 'company') {
        navigate('/companies?action=create&returnTo=/transactions/new');
      } else if (selectedModule === 'dealer') {
        navigate('/dealers?action=create&returnTo=/transactions/new');
      }
    } else {
      setStep(4); // Select existing entity
    }
  };

  const handleEntitySelect = (entity) => {
    setSelectedEntity(entity);
    setStep(5); // Go to transaction type selection
  };

  const handleTransactionTypeSelect = (type) => {
    setTransactionType(type);
    
    // Set item_type based on industry and transaction type
    if (!features.hasSecondaryItem) {
      // Retail / industries without secondary items: always product
      setTransactionData(prev => ({ ...prev, item_type: 'product' }));
    } else if (type === 'buy' || type === 'delivery') {
      setTransactionData(prev => ({ ...prev, item_type: 'product' }));
    } else if (type === 'sell' || type === 'purchase') {
      setTransactionData(prev => ({ ...prev, item_type: 'grain' }));
    }
    
    setStep(6); // Go to transaction details
  };

  const handleQuickGrainCreate = async () => {
    if (!newGrainData.grain_name.trim()) {
      toast.warning('Please enter grain name');
      return;
    }

    try {
      setIsCreatingGrain(true);
      const result = await window.electronAPI.grain.create({
        ...newGrainData,
        is_active: 1
      });

      if (result.success) {
        // Refresh grain list
        await loadGrains();
        
        // Auto-select the newly created grain
        setTransactionData(prev => ({
          ...prev,
          item_id: result.grain_id
        }));
        
        // Find and set the selected item
        const newGrain = await window.electronAPI.grain.getById(result.grain_id);
        if (newGrain?.data) {
          setSelectedItem(newGrain.data);
        }

        // Reset form and close modal
        setNewGrainData({
          grain_name: '',
          unit_of_measure: 'kg',
          description: ''
        });
        setShowQuickGrainForm(false);
        
        toast.success(`Grain "${newGrainData.grain_name}" created successfully!`);
      }
    } catch (error) {
      console.error('Error creating grain:', error);
      toast.error('Failed to create grain: ' + error.message);
    } finally {
      setIsCreatingGrain(false);
    }
  };

  // Handle quick product creation
  const handleQuickProductCreate = async () => {
    if (!newProductData.product_name.trim()) {
      toast.warning('Please enter product name');
      return;
    }

    if (!newProductData.category_id) {
      toast.warning('Please select a product category');
      return;
    }

    try {
      setIsCreatingProduct(true);
      console.log('[UniversalTransactionPage] 🎯 Creating new product:', newProductData);

      const result = await window.electronAPI.product.create({
        ...newProductData,
        is_active: 1
      }, currentUser.user_id);

      console.log('[UniversalTransactionPage] ✅ Product created:', result);

      // Reload products
      await loadProducts();

      // Auto-select the newly created product
      if (result.product_id) {
        handleItemSelect(result.product_id.toString());
      }

      // Auto-populate transaction form with initial stock details
      if (newProductData.initial_quantity && newProductData.initial_price) {
        console.log('[UniversalTransactionPage] 📦 Auto-populating transaction with initial stock:', {
          quantity: newProductData.initial_quantity,
          price: newProductData.initial_price,
          storage: newProductData.initial_storage_location
        });
        
        setTransactionData(prev => ({
          ...prev,
          quantity: newProductData.initial_quantity,
          unit_price: newProductData.initial_price,
          total_amount: parseFloat(newProductData.initial_quantity) * parseFloat(newProductData.initial_price)
        }));
        
        setStockLocation(newProductData.initial_storage_location || 'Main Warehouse');
      }

      // Close modal and reset form
      setShowQuickProductForm(false);
      const productName = newProductData.product_name;
      setNewProductData({
        product_name: '',
        category_id: '',
        unit_of_measure: 'piece',
        description: '',
        reorder_level: 0,
        initial_quantity: '',
        initial_price: '',
        initial_storage_location: 'Main Warehouse'
      });

      const stockInfo = newProductData.initial_quantity && newProductData.initial_price 
        ? ` Transaction form auto-filled with ${newProductData.initial_quantity} ${newProductData.unit_of_measure}(s) at PKR ${newProductData.initial_price} each.`
        : '';
      toast.success(`Product "${productName}" created successfully with code ${result.product_code}!${stockInfo}`, 'Success', 7000);
    } catch (error) {
      console.error('Error creating product:', error);
      toast.error('Failed to create product. Please try again.');
    } finally {
      setIsCreatingProduct(false);
    }
  };

  // Handle quick category creation (nested in product creation)
  const handleQuickCategoryCreate = async () => {
    if (!newCategoryData.category_name.trim()) {
      toast.warning('Please enter category name');
      return;
    }

    try {
      setIsCreatingCategory(true);
      console.log('[UniversalTransactionPage] 🏷️ Creating new category:', newCategoryData);

      const result = await window.electronAPI.productCategory.create({
        ...newCategoryData,
        is_active: 1
      }, currentUser.user_id);

      console.log('[UniversalTransactionPage] ✅ Category created:', result);

      // Reload categories
      await loadCategories();

      // Auto-select the newly created category
      if (result.category_id) {
        setNewProductData(prev => ({ ...prev, category_id: result.category_id }));
      }

      // Close category modal and reset form
      setShowQuickCategoryForm(false);
      setNewCategoryData({
        category_name: '',
        description: ''
      });

      toast.success(`Category "${newCategoryData.category_name}" created successfully with code ${result.category_code}!`);
    } catch (error) {
      console.error('Error creating category:', error);
      toast.error('Failed to create category. Please try again.');
    } finally {
      setIsCreatingCategory(false);
    }
  };

  const handleInputChange = (field, value) => {
    setTransactionData(prev => {
      const updated = { ...prev, [field]: value };
      
      // Auto-calculate payment amounts when payment type changes
      if (field === 'payment_type') {
        // Get total from multi-item mode or single-item mode
        const total = isMultiItemMode 
          ? parseFloat(multiItemList?.overallDiscount?.grandTotal || 0)
          : parseFloat(prev.total_amount) || 0;
        
        if (total > 0) {
          if (value === 'CASH') {
            updated.cash_paid = total.toString();
            updated.credit_amount = '0';
          } else if (value === 'CREDIT') {
            updated.cash_paid = '0';
            updated.credit_amount = total.toString();
          }
        }
      }
      
      return updated;
    });
  };

  const handleItemSelect = (itemId) => {
    const items = transactionData.item_type === 'product' ? products : grains;
    const item = items.find(i => 
      transactionData.item_type === 'product' 
        ? i.product_id === parseInt(itemId)
        : i.grain_id === parseInt(itemId)
    );
    
    setSelectedItem(item);
    
    // Check if item has stock
    if (!item || item.available_quantity <= 0) {
      toast.warning(`${item?.product_name || item?.grain_name || 'This item'} has no stock available!`);
    }
    
    setTransactionData(prev => ({
      ...prev,
      item_id: itemId,
      // Use average price from stock batches, or suggest user to enter price
      unit_price: item?.avg_price ? item.avg_price.toFixed(2) : ''
    }));
  };

  const handleSubmit = async () => {
    try {
      if (!currentUser || !currentUser.user_id) {
        toast.error('Session expired. Please log in again.');
        navigate('/login');
        return;
      }

      // Sprint 6: Handle multi-item transactions
      if (isMultiItemMode) {
        // Handle new structure with items and overall discount
        const itemsList = multiItemList?.items || multiItemList || [];
        const overallDiscount = multiItemList?.overallDiscount || { type: 'amount', value: 0, amount: 0 };
        
        if (!itemsList || itemsList.length === 0) {
          toast.warning('Please add at least one item to the transaction');
          return;
        }

        // Calculate totals
        const itemsTotal = itemsList.reduce((sum, item) => {
          return sum + ((item.quantity * item.unit_price) - (item.discount_amount || 0));
        }, 0);
        
        const calculatedTotal = Math.max(0, itemsTotal - overallDiscount.amount);

        // Calculate payment amounts based on payment type
        let cashPaid = 0;
        let creditAmount = 0;
        
        if (transactionData.payment_type === 'CASH') {
          cashPaid = calculatedTotal;
          creditAmount = 0;
        } else if (transactionData.payment_type === 'CREDIT') {
          cashPaid = 0;
          creditAmount = calculatedTotal;
        } else if (transactionData.payment_type === 'PARTIAL') {
          cashPaid = parseFloat(transactionData.cash_paid) || 0;
          creditAmount = Math.max(0, calculatedTotal - cashPaid);
        }

        const multiTransactionData = {
          transaction_type: getTransactionTypeCode(),
          entity_type: entityType,
          entity_id: selectedEntity ? 
            (selectedModule === 'farmer' ? selectedEntity.farmer_id :
             selectedModule === 'company' ? selectedEntity.company_id :
             selectedEntity.dealer_id) : null,
          
          // For irregular customers
          temp_info: entityType === 'irregular' ? {
            name: transactionData.entity_name,
            father_name: transactionData.entity_father_name,
            cnic: transactionData.entity_cnic,
            phone: transactionData.entity_phone,
            address: transactionData.entity_address,
          } : null,
          
          subtotal: itemsTotal,
          overall_discount_type: overallDiscount.type,
          overall_discount_value: overallDiscount.value,
          overall_discount_amount: overallDiscount.amount,
          total_amount: calculatedTotal,
          payment_type: transactionData.payment_type,
          cash_paid: cashPaid,
          credit_amount: creditAmount,
          description: transactionData.description,
          module: selectedModule
        };

        console.log('[Sprint 6] Submitting multi-item transaction:', itemsList.length, 'items, Overall Discount:', overallDiscount);
        
        // Call appropriate multi-item API based on transaction type
        let result;
        const apiMethod = getMultiItemAPIMethod();
        result = await apiMethod(multiTransactionData, itemsList, currentUser.user_id);

        if (result.success) {
          setLastTransactionId(result.transaction_id);
          setLastTransactionNumber(result.transaction_number);
          setStep(7); // Success step
        } else {
          toast.error('Transaction failed: ' + result.message);
        }
        return;
      }

      // Original single-item transaction logic
      const payload = {
        module: selectedModule,
        entity_type: entityType,
        transaction_type: transactionType,
        entity_id: selectedEntity ? 
          (selectedModule === 'farmer' ? selectedEntity.farmer_id :
           selectedModule === 'company' ? selectedEntity.company_id :
           selectedEntity.dealer_id) : null,
        
        // For irregular customers
        entity_info: entityType === 'irregular' ? {
          name: transactionData.entity_name,
          father_name: transactionData.entity_father_name,
          cnic: transactionData.entity_cnic,
          phone: transactionData.entity_phone,
          address: transactionData.entity_address,
        } : null,
        
        // Transaction details
        item_type: transactionData.item_type, // Keep lowercase for Transactions table
        item_id: parseInt(transactionData.item_id),
        quantity: parseFloat(transactionData.quantity),
        unit_price: parseFloat(transactionData.unit_price),
        total_amount: transactionData.total_amount,
        payment_type: transactionData.payment_type,
        cash_paid: parseFloat(transactionData.cash_paid) || 0,
        credit_amount: parseFloat(transactionData.credit_amount) || 0,
        description: transactionData.description,
        created_by: currentUser.user_id,
        
        // Stock location (for IN transactions — grain from farmers, products from companies/distributors/returns)
        stock_location: (
          (transactionData.item_type === 'grain' && transactionType === 'sell') ||
          (transactionData.item_type === 'product' && transactionType === 'delivery') ||
          (isRetail && ['purchase', 'distributor-purchase', 'return-in'].includes(transactionType))
        ) ? stockLocation : null,
      };

      console.log('Submitting universal transaction:', JSON.stringify(payload, null, 2));
      
      const result = await window.electronAPI.transaction.createUniversal(payload);
      
      if (result.success) {
        setLastTransactionId(result.transaction_id);
        setLastTransactionNumber(result.transaction_number);
        setStep(7); // Success step
      } else {
        toast.error('Transaction failed: ' + result.message);
      }
    } catch (error) {
      console.error('Transaction error:', error);
      toast.error('Error creating transaction: ' + error.message);
    }
  };

  // Helper function to get multi-item API method
  const getMultiItemAPIMethod = () => {
    const typeMap = {
      // Agricultural
      'farmer-buy': window.electronAPI.transaction.createFarmerPurchaseMulti,
      'farmer-sell': window.electronAPI.transaction.createFarmerSaleMulti,
      'dealer-purchase': window.electronAPI.transaction.createDealerPurchaseMulti,
      'company-delivery': window.electronAPI.transaction.createCompanyDeliveryMulti,
      // Retail
      'farmer-sale': window.electronAPI.transaction.createRetailSaleMulti,
      'farmer-return-in': window.electronAPI.transaction.createRetailReturnInMulti,
      'company-purchase': window.electronAPI.transaction.createRetailPurchaseMulti,
      'company-return-out': window.electronAPI.transaction.createRetailReturnOutMulti,
      'dealer-distributor-purchase': window.electronAPI.transaction.createRetailDistributorPurchaseMulti,
    };
    
    const key = `${selectedModule}-${transactionType}`;
    return typeMap[key] || window.electronAPI.transaction.createFarmerPurchaseMulti;
  };

  // Helper function to get transaction type code
  const getTransactionTypeCode = () => {
    const typeMap = {
      // Agricultural
      'farmer-buy': 'FARMER_PURCHASE',
      'farmer-sell': 'FARMER_SALE_GRAIN',
      'dealer-purchase': 'DEALER_PURCHASE',
      'company-delivery': 'COMPANY_DELIVERY',
      // Retail
      'farmer-sale': 'RETAIL_SALE',
      'farmer-return-in': 'RETAIL_RETURN_IN',
      'company-purchase': 'RETAIL_PURCHASE',
      'company-return-out': 'RETAIL_RETURN_OUT',
      'dealer-distributor-purchase': 'RETAIL_DISTRIBUTOR_PURCHASE',
    };
    
    return typeMap[`${selectedModule}-${transactionType}`] || 'FARMER_PURCHASE';
  };

  // Step 1: Module Selection
  const renderStep1 = () => (
    <div className="max-w-4xl mx-auto">
      <h2 className="text-3xl font-bold text-gray-900 mb-8 text-center">Select Module</h2>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-3xl mx-auto">
        <button
          onClick={() => handleModuleSelect('farmer')}
          className="p-8 bg-white border-2 border-gray-200 rounded-xl hover:border-green-500 hover:shadow-lg transition-all"
        >
          <UserGroupIcon className="h-16 w-16 mx-auto text-green-600 mb-4" />
          <h3 className="text-xl font-bold text-gray-900">{terminology.customers || 'Customers'}</h3>
          <p className="text-sm text-gray-600 mt-2">{terminology.customer || 'Customer'} transactions</p>
        </button>

        <button
          onClick={() => handleModuleSelect('company')}
          className="p-8 bg-white border-2 border-gray-200 rounded-xl hover:border-blue-500 hover:shadow-lg transition-all"
        >
          <BuildingOfficeIcon className="h-16 w-16 mx-auto text-blue-600 mb-4" />
          <h3 className="text-xl font-bold text-gray-900">{terminology.suppliers || 'Suppliers'}</h3>
          <p className="text-sm text-gray-600 mt-2">{terminology.supplier || 'Supplier'} transactions</p>
        </button>

        <button
          onClick={() => handleModuleSelect('dealer')}
          className="p-8 bg-white border-2 border-gray-200 rounded-xl hover:border-purple-500 hover:shadow-lg transition-all"
        >
          <UserIcon className="h-16 w-16 mx-auto text-purple-600 mb-4" />
          <h3 className="text-xl font-bold text-gray-900">{terminology.dealers || 'Dealers'}</h3>
          <p className="text-sm text-gray-600 mt-2">{terminology.dealer || 'Dealer'} transactions</p>
        </button>
      </div>
    </div>
  );

  // Step 2: Regular/Irregular Selection
  const renderStep2 = () => {
    const entityLabel = selectedModule === 'farmer' ? (terminology.customer || 'Customer') : selectedModule === 'company' ? (terminology.supplier || 'Supplier') : (terminology.dealer || 'Dealer');
    return (
      <div className="max-w-2xl mx-auto">
        <h2 className="text-2xl font-bold text-gray-900 mb-6">{entityLabel} Type</h2>
        <div className="grid grid-cols-2 gap-6">
          <button
            onClick={() => handleEntityTypeSelect('regular')}
            className="p-8 bg-white border-2 border-gray-200 rounded-xl hover:border-green-500 hover:shadow-lg transition-all"
          >
            <CheckCircleIcon className="h-16 w-16 mx-auto text-green-600 mb-4" />
            <h3 className="text-xl font-bold text-gray-900">Regular {entityLabel}</h3>
            <p className="text-sm text-gray-600 mt-2">Registered in system</p>
          </button>

          <button
            onClick={() => handleEntityTypeSelect('irregular')}
            className="p-8 bg-white border-2 border-gray-200 rounded-xl hover:border-yellow-500 hover:shadow-lg transition-all"
          >
            <UserIcon className="h-16 w-16 mx-auto text-yellow-600 mb-4" />
            <h3 className="text-xl font-bold text-gray-900">One-Time {entityLabel}</h3>
            <p className="text-sm text-gray-600 mt-2">Temporary transaction</p>
          </button>
        </div>

        <button
          onClick={() => setStep(1)}
          className="mt-6 px-6 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300"
        >
          ← Back
        </button>
      </div>
    );
  };

  // Step 3: New/Existing Entity
  const renderStep3 = () => {
    const entityLabel = selectedModule === 'farmer' ? (terminology.customer || 'Customer') : selectedModule === 'company' ? (terminology.supplier || 'Supplier') : (terminology.dealer || 'Dealer');
    return (
      <div className="max-w-2xl mx-auto">
        <h2 className="text-2xl font-bold text-gray-900 mb-6">Select Option</h2>
        <div className="grid grid-cols-2 gap-6">
          <button
            onClick={() => handleNewExistingSelect(true)}
            className="p-8 bg-white border-2 border-gray-200 rounded-xl hover:border-blue-500 hover:shadow-lg transition-all"
          >
            <div className="text-4xl mb-4">➕</div>
            <h3 className="text-xl font-bold text-gray-900">New {entityLabel}</h3>
            <p className="text-sm text-gray-600 mt-2">Create and add to system</p>
          </button>

          <button
            onClick={() => handleNewExistingSelect(false)}
            className="p-8 bg-white border-2 border-gray-200 rounded-xl hover:border-green-500 hover:shadow-lg transition-all"
          >
            <div className="text-4xl mb-4">📋</div>
            <h3 className="text-xl font-bold text-gray-900">Existing {entityLabel}</h3>
            <p className="text-sm text-gray-600 mt-2">Select from list</p>
          </button>
        </div>

        <button
          onClick={() => setStep(2)}
          className="mt-6 px-6 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300"
        >
          ← Back
        </button>
      </div>
    );
  };

  // Step 4: Select Existing Entity
  const renderStep4 = () => {
    const entityLabel = selectedModule === 'farmer' ? (terminology.customer || 'Customer') : selectedModule === 'company' ? (terminology.supplier || 'Supplier') : (terminology.dealer || 'Dealer');
    const entitiesLabel = selectedModule === 'farmer' ? (terminology.customers || 'Customers') : selectedModule === 'company' ? (terminology.suppliers || 'Suppliers') : (terminology.dealers || 'Dealers');
    
    const filteredEntities = entities.filter(entity => {
      if (!entitySearchTerm.trim()) return true;
      const term = entitySearchTerm.toLowerCase();
      const name = (entity.name || entity.company_name || '').toLowerCase();
      const code = (entity.specific_id || entity.company_code || entity.dealer_code || '').toLowerCase();
      const phone = (entity.phone || '').toLowerCase();
      return name.includes(term) || code.includes(term) || phone.includes(term);
    });

    return (
    <div className="max-w-2xl mx-auto">
      <h2 className="text-2xl font-bold text-gray-900 mb-6">Select {entityLabel}</h2>
      
      {entities.length === 0 ? (
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-6 text-center">
          <p className="text-yellow-800">No {entitiesLabel.toLowerCase()} found. Please create one first.</p>
          <button
            onClick={() => setStep(3)}
            className="mt-4 px-6 py-2 bg-yellow-600 text-white rounded-lg hover:bg-yellow-700"
          >
            Create New {entityLabel}
          </button>
        </div>
      ) : (
        <div className="bg-white rounded-lg shadow p-6">
          {/* Search Input */}
          <div className="relative mb-4">
            <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input
              type="text"
              value={entitySearchTerm}
              onChange={(e) => setEntitySearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
              placeholder={`Search by name, code or phone...`}
              autoFocus
            />
            {entitySearchTerm && (
              <button
                onClick={() => setEntitySearchTerm('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
              >
                ✕
              </button>
            )}
          </div>
          <p className="text-xs text-gray-500 mb-3">{filteredEntities.length} of {entities.length} {entitiesLabel.toLowerCase()}</p>
...

          {/* Entity List */}
          <div className="max-h-72 overflow-y-auto space-y-1 border border-gray-200 rounded-lg">
            {filteredEntities.length === 0 ? (
              <div className="p-4 text-center text-gray-500 text-sm">
                No matches found for "{entitySearchTerm}"
              </div>
            ) : (
              filteredEntities.map(entity => {
                const entityId = entity.farmer_id || entity.company_id || entity.dealer_id;
                const entityName = entity.name || entity.company_name;
                const entityCode = entity.specific_id || entity.company_code || entity.dealer_code;
                return (
                  <button
                    key={entityId}
                    onClick={() => { setEntitySearchTerm(''); handleEntitySelect(entity); }}
                    className="w-full flex items-center justify-between px-4 py-3 hover:bg-blue-50 transition-colors text-left border-b border-gray-100 last:border-b-0"
                  >
                    <div>
                      <span className="text-sm font-semibold text-gray-900">{entityName}</span>
                      <span className="ml-2 text-xs text-gray-500">({entityCode})</span>
                      {entity.phone && <span className="ml-2 text-xs text-gray-400">📞 {entity.phone}</span>}
                    </div>
                    <div className="text-right text-xs">
                      {entity.balance > 0 && <span className="text-green-600 font-medium">Bal: {entity.balance}</span>}
                      {entity.credit > 0 && <span className="ml-2 text-orange-600 font-medium">Cr: {entity.credit}</span>}
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </div>
      )}

      <button
        onClick={() => { setEntitySearchTerm(''); setStep(entityType === 'irregular' ? 2 : 3); }}
        className="mt-6 px-6 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300"
      >
        ← Back
      </button>
    </div>
  );
  };

  // Step 5: Transaction Type Selection
  const renderStep5 = () => {
    let transactionTypes = [];
    
    if (isRetail) {
      // Retail transaction types
      if (selectedModule === 'farmer') {
        transactionTypes = [
          { type: 'sale', label: 'Sale to Customer', icon: '🛒', description: 'Sell products to customer — Stock goes OUT' },
          { type: 'return-in', label: 'Customer Return', icon: '↩️', description: 'Customer returns products — Stock comes IN' },
        ];
      } else if (selectedModule === 'company') {
        transactionTypes = [
          { type: 'purchase', label: 'Purchase from Supplier', icon: '📦', description: 'Buy products from supplier — Stock comes IN' },
          { type: 'return-out', label: 'Return to Supplier', icon: '↩️', description: 'Return products to supplier — Stock goes OUT' },
        ];
      } else if (selectedModule === 'dealer') {
        transactionTypes = [
          { type: 'distributor-purchase', label: 'Purchase from Distributor', icon: '🚛', description: 'Buy products from distributor — Stock comes IN' },
        ];
      }
    } else {
      // Agricultural transaction types
      if (selectedModule === 'farmer') {
        transactionTypes = [
          { type: 'buy', label: 'Farmer Buys Products', icon: '🛒', description: 'Farmer purchases fertilizer, seeds, etc.' },
          { type: 'sell', label: 'Farmer Sells Grain', icon: '🌾', description: 'Farmer sells wheat, rice, etc.' },
        ];
      } else if (selectedModule === 'company') {
        transactionTypes = [
          { type: 'delivery', label: 'Company Delivery', icon: '🚚', description: 'Company supplies products to shop' },
        ];
      } else if (selectedModule === 'dealer') {
        transactionTypes = [
          { type: 'purchase', label: 'Dealer Purchase', icon: '🛍️', description: 'Dealer buys grains from shop' },
        ];
      }
    }

    return (
      <div className="max-w-5xl mx-auto">
        <h2 className="text-2xl font-bold text-gray-900 mb-6">Select Transaction Type</h2>
        
        {selectedEntity && (
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
            <p className="text-sm text-blue-800">
              <strong>Selected:</strong> {selectedEntity.name || selectedEntity.company_name} - 
              {selectedEntity.specific_id || selectedEntity.company_code || selectedEntity.dealer_code}
            </p>
          </div>
        )}

        <div className="grid grid-cols-2 gap-6">
          {transactionTypes.map(tx => (
            <button
              key={tx.type}
              onClick={() => handleTransactionTypeSelect(tx.type)}
              className="p-8 bg-white border-2 border-gray-200 rounded-xl hover:border-green-500 hover:shadow-lg transition-all"
            >
              <div className="text-5xl mb-4">{tx.icon}</div>
              <h3 className="text-xl font-bold text-gray-900 mb-2">{tx.label}</h3>
              <p className="text-sm text-gray-600">{tx.description}</p>
            </button>
          ))}
        </div>

        <button
          onClick={() => setStep(entityType === 'irregular' ? 2 : 4)}
          className="mt-6 px-6 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300"
        >
          ← Back
        </button>
      </div>
    );
  };

  // Step 6: Transaction Details
  const renderStep6 = () => {
    const isIncoming = ['buy', 'delivery', 'purchase', 'distributor-purchase', 'sell', 'return-in'].includes(transactionType);
    const itemLabel = transactionData.item_type === 'product' ? (terminology.item || 'Product') : (terminology.secondaryItem || 'Grain');
    const entityLabel = selectedModule === 'farmer' ? (terminology.customer || 'Customer') : selectedModule === 'company' ? (terminology.supplier || 'Supplier') : (terminology.dealer || 'Dealer');

    return (
    <div className="max-w-6xl mx-auto">
      <h2 className="text-2xl font-bold text-gray-900 mb-6">Transaction Details</h2>

      {/* Dynamic Industry Banner */}
      <div className={`bg-gradient-to-r ${isIncoming ? 'from-blue-50 to-indigo-50 border-blue-600' : 'from-green-50 to-emerald-50 border-green-600'} border-l-4 rounded-lg p-5 mb-6 shadow-sm`}>
        <div className="flex items-start">
          <div className="flex-shrink-0">
            <span className="text-3xl">{isIncoming ? '📦' : '🛒'}</span>
          </div>
          <div className="ml-4 flex-1">
            <h3 className={`text-lg font-bold mb-2 ${isIncoming ? 'text-blue-900' : 'text-green-900'}`}>
              {isIncoming ? `Receiving ${itemLabel} (Stock IN)` : `Selling ${itemLabel} (Stock OUT)`}
            </h3>
            <div className={`text-sm space-y-1 ${isIncoming ? 'text-blue-800' : 'text-green-800'}`}>
              <p>✓ <strong>{itemLabel}s are {isIncoming ? 'coming IN to' : 'going OUT from'}</strong> your shop</p>
              <p>✓ Transacting with {entityLabel}: <strong>{selectedEntity?.name || selectedEntity?.company_name || transactionData.entity_name}</strong></p>
              <p>✓ Stock will be <strong>updated automatically</strong> upon submission</p>
              <p>✓ Select payment method to reflect in {entityLabel}'s ledger</p>
            </div>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow p-6 space-y-6">
        {/* Irregular entity info - Different for Company vs Farmer/Dealer */}
        {entityType === 'irregular' && (
          <div className="border-b pb-6">
            {/* COMPANY - Irregular Company Information */}
            {selectedModule === 'company' ? (
              <>
                <h3 className="text-lg font-bold text-blue-900 mb-4">
                  🏢 {terminology.supplier || 'Company'} Information (One-Time/Irregular)
                </h3>
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
                  <p className="text-sm text-blue-800">
                    💡 <strong>Tip:</strong> This is for a one-time {(terminology.supplier || 'company').toLowerCase()} transaction. Enter details below.
                  </p>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <input
                    type="text"
                    placeholder={`${terminology.supplier || 'Company'} Name *`}
                    value={transactionData.entity_name}
                    onChange={(e) => handleInputChange('entity_name', e.target.value)}
                    className="px-4 py-2 border-2 border-blue-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    required
                  />
                  <input
                    type="text"
                    placeholder="Contact Person Name"
                    value={transactionData.entity_father_name}
                    onChange={(e) => handleInputChange('entity_father_name', e.target.value)}
                    className="px-4 py-2 border-2 border-blue-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                  <input
                    type="text"
                    placeholder="Phone Number"
                    value={transactionData.entity_phone}
                    onChange={(e) => handleInputChange('entity_phone', e.target.value)}
                    className="px-4 py-2 border-2 border-blue-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                  <input
                    type="text"
                    placeholder="Email (Optional)"
                    value={transactionData.entity_cnic}
                    onChange={(e) => handleInputChange('entity_cnic', e.target.value)}
                    className="px-4 py-2 border-2 border-blue-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                  <input
                    type="text"
                    placeholder={`${terminology.supplier || 'Company'} Address`}
                    value={transactionData.entity_address}
                    onChange={(e) => handleInputChange('entity_address', e.target.value)}
                    className="col-span-2 px-4 py-2 border-2 border-blue-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </>
            ) : (
              /* FARMER/DEALER - Irregular Customer Information */
              <>
                <h3 className="text-lg font-bold text-green-900 mb-4">
                  👤 {selectedModule === 'farmer' ? (terminology.customer || 'Farmer') : (terminology.dealer || 'Dealer')} Information (One-Time/Walk-In)
                </h3>
                <div className="bg-green-50 border border-green-200 rounded-lg p-4 mb-4">
                  <p className="text-sm text-green-800">
                    💡 <strong>Tip:</strong> This is for a one-time {selectedModule === 'farmer' ? (terminology.customer || 'farmer').toLowerCase() : (terminology.dealer || 'dealer').toLowerCase()} transaction. Enter their details below.
                  </p>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <input
                    type="text"
                    placeholder={`${selectedModule === 'farmer' ? (terminology.customer || 'Farmer') : (terminology.dealer || 'Dealer')} Name *`}
                    value={transactionData.entity_name}
                    onChange={(e) => handleInputChange('entity_name', e.target.value)}
                    className="px-4 py-2 border-2 border-green-300 rounded-lg focus:ring-2 focus:ring-green-500"
                    required
                  />
                  <input
                    type="text"
                    placeholder="Father Name"
                    value={transactionData.entity_father_name}
                    onChange={(e) => handleInputChange('entity_father_name', e.target.value)}
                    className="px-4 py-2 border-2 border-green-300 rounded-lg focus:ring-2 focus:ring-green-500"
                  />
                  <input
                    type="text"
                    placeholder="CNIC (13 digits)"
                    value={transactionData.entity_cnic}
                    onChange={(e) => handleInputChange('entity_cnic', e.target.value)}
                    className="px-4 py-2 border-2 border-green-300 rounded-lg focus:ring-2 focus:ring-green-500"
                  />
                  <input
                    type="text"
                    placeholder="Phone Number"
                    value={transactionData.entity_phone}
                    onChange={(e) => handleInputChange('entity_phone', e.target.value)}
                    className="px-4 py-2 border-2 border-green-300 rounded-lg focus:ring-2 focus:ring-green-500"
                  />
                  <input
                    type="text"
                    placeholder="Address"
                    value={transactionData.entity_address}
                    onChange={(e) => handleInputChange('entity_address', e.target.value)}
                    className="col-span-2 px-4 py-2 border-2 border-green-300 rounded-lg focus:ring-2 focus:ring-green-500"
                  />
                </div>
              </>
            )}
          </div>
        )}

        {/* Regular customer display */}
        {entityType === 'regular' && selectedEntity && (
          <div className={`rounded-lg p-4 ${
            selectedModule === 'company' 
              ? 'bg-blue-50 border border-blue-200' 
              : 'bg-green-50 border border-green-200'
          }`}>
            <h3 className={`font-bold mb-2 ${
              selectedModule === 'company' ? 'text-blue-900' : 'text-green-900'
            }`}>
              {selectedModule === 'company' 
                ? `🏢 ${terminology.supplier || 'Company'} Information` 
                : `👤 ${selectedModule === 'farmer' ? (terminology.customer || 'Customer') : (terminology.dealer || 'Dealer')} Information`}
            </h3>
            <div className={`text-sm space-y-1 ${
              selectedModule === 'company' ? 'text-blue-800' : 'text-green-800'
            }`}>
              <p><strong>Name:</strong> {selectedEntity.name || selectedEntity.company_name}</p>
              {selectedEntity.specific_id && (
                <p><strong>ID:</strong> {selectedEntity.specific_id}</p>
              )}
              {selectedEntity.contact_person && (
                <p><strong>Contact Person:</strong> {selectedEntity.contact_person}</p>
              )}
              <p><strong>Phone:</strong> {selectedEntity.phone || 'N/A'}</p>
              <p><strong>Address:</strong> {selectedEntity.address || 'N/A'}</p>
              {selectedEntity.balance !== undefined && (
                <p><strong>Current Balance:</strong> PKR {parseFloat(selectedEntity.balance || 0).toFixed(2)}</p>
              )}
              {selectedEntity.credit !== undefined && (
                <p><strong>Current Credit:</strong> PKR {parseFloat(selectedEntity.credit || 0).toFixed(2)}</p>
              )}
            </div>
          </div>
        )}

        {/* Sprint 6: Multi-Item Mode Toggle */}
        <div className="bg-gradient-to-r from-purple-50 to-indigo-50 border-2 border-purple-300 rounded-lg p-4 mb-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <ShoppingCartIcon className="w-6 h-6 text-purple-600" />
              <div>
                <h4 className="font-bold text-gray-900">Multi-Item Transaction</h4>
                <p className="text-sm text-gray-600">Add multiple {features.hasSecondaryItem ? 'products/grains' : 'products'} in one transaction</p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setIsMultiItemMode(!isMultiItemMode)}
              className={`relative inline-flex h-8 w-14 items-center rounded-full transition-colors ${
                isMultiItemMode ? 'bg-purple-600' : 'bg-gray-300'
              }`}
            >
              <span
                className={`inline-block h-6 w-6 transform rounded-full bg-white transition-transform ${
                  isMultiItemMode ? 'translate-x-7' : 'translate-x-1'
                }`}
              />
            </button>
          </div>
          {isMultiItemMode && (
            <div className="mt-3 p-3 bg-white rounded-lg border border-purple-200">
              <p className="text-sm text-purple-800">
                ✨ <strong>Multi-Item Mode Active:</strong> You can now add multiple items to this transaction. Single item fields below are hidden.
              </p>
            </div>
          )}
        </div>

        {/* Multi-Item Form (Sprint 6) */}
        {isMultiItemMode ? (
          <MultiItemTransactionForm
            transactionType={getTransactionTypeCode()}
            items={multiItemList}
            onChange={setMultiItemList}
            availableProducts={products}
            availableGrains={grains}
            disabled={false}
          />
        ) : (
          <>
            {/* Original Single Item Selection */}
            <div>
          <div className="flex justify-between items-center mb-2">
            <label className="block text-sm font-medium text-gray-700">
              Select {transactionData.item_type === 'product' ? 'Product' : 'Grain'} *
            </label>
            {transactionData.item_type === 'grain' && (
              <button
                type="button"
                onClick={() => setShowQuickGrainForm(true)}
                className="px-3 py-1 text-sm bg-green-600 text-white rounded hover:bg-green-700 flex items-center gap-1"
              >
                <span>➕</span>
                <span>Add New Grain</span>
              </button>
            )}
            {transactionData.item_type === 'product' && (
              <button
                type="button"
                onClick={() => setShowQuickProductForm(true)}
                className="px-3 py-1 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 flex items-center gap-1"
              >
                <span>➕</span>
                <span>Add New Product</span>
              </button>
            )}
          </div>
          <select
            value={transactionData.item_id}
            onChange={(e) => handleItemSelect(e.target.value)}
            className="w-full px-4 py-2 border rounded-lg"
            required
          >
            <option value="">-- Select Item --</option>
            {(transactionData.item_type === 'product' ? products : grains).map(item => {
              const hasStock = item.available_quantity > 0;
              const stockInfo = hasStock 
                ? `(Stock: ${item.available_quantity} ${item.unit_of_measure || 'units'})` 
                : '(OUT OF STOCK)';
              return (
                <option 
                  key={item.product_id || item.grain_id} 
                  value={item.product_id || item.grain_id}
                  className={!hasStock ? 'text-red-600' : ''}
                >
                  {item.product_name || item.grain_name} - {item.product_code || item.grain_code} {stockInfo}
                </option>
              );
            })}
          </select>
          
          {/* Enhanced Stock Info Display */}
          {selectedItem && (
            <div className={`mt-3 rounded-lg overflow-hidden ${
              selectedItem.available_quantity > 0 
                ? 'bg-gradient-to-r from-green-50 to-emerald-50 border-2 border-green-300' 
                : 'bg-gradient-to-r from-red-50 to-orange-50 border-2 border-red-300'
            }`}>
              <div className="p-4">
                <div className="flex justify-between items-center mb-2">
                  <span className="text-base font-bold text-gray-900">📦 Current Stock Status:</span>
                  <span className={`text-lg font-bold px-3 py-1 rounded ${selectedItem.available_quantity > 0 ? 'bg-green-200 text-green-800' : 'bg-red-200 text-red-800'}`}>
                    {selectedItem.available_quantity} {selectedItem.unit_of_measure || 'units'}
                  </span>
                </div>
                
                {selectedItem.price_variants > 1 ? (
                  <div className="mt-3 p-3 bg-white rounded-lg border-2 border-blue-300">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-xl">💰</span>
                      <span className="text-sm font-bold text-blue-900">Multiple Price Batches Detected</span>
                      <span className="px-2 py-0.5 bg-blue-200 text-blue-800 rounded-full text-xs font-bold">
                        {selectedItem.price_variants} batches
                      </span>
                    </div>
                    <div className="grid grid-cols-3 gap-3 text-xs">
                      <div className="bg-blue-50 p-2 rounded">
                        <div className="text-gray-600 font-medium">Lowest Price</div>
                        <div className="text-blue-700 font-bold text-base">PKR {selectedItem.min_price?.toFixed(2)}</div>
                      </div>
                      <div className="bg-blue-50 p-2 rounded">
                        <div className="text-gray-600 font-medium">Highest Price</div>
                        <div className="text-blue-700 font-bold text-base">PKR {selectedItem.max_price?.toFixed(2)}</div>
                      </div>
                      <div className="bg-blue-50 p-2 rounded">
                        <div className="text-gray-600 font-medium">Average Price</div>
                        <div className="text-blue-700 font-bold text-base">PKR {selectedItem.avg_price?.toFixed(2)}</div>
                      </div>
                    </div>
                    <div className="mt-2 text-xs text-gray-700 bg-amber-50 p-2 rounded border border-amber-200">
                      💡 <strong>Note:</strong> Your current price may create a NEW batch if it differs from existing batches.
                    </div>
                  </div>
                ) : selectedItem.available_quantity > 0 ? (
                  <div className="mt-2 p-2 bg-white rounded border border-green-200">
                    <div className="text-xs text-gray-700">
                      <strong>Current Batch Price:</strong> PKR {selectedItem.min_price?.toFixed(2)} per {selectedItem.unit_of_measure || 'unit'}
                    </div>
                  </div>
                ) : null}
              </div>
            </div>
          )}
        </div>

        {/* Stock Location (for all IN transactions: grain from farmers, products from companies/distributors/returns) */}
        {((transactionData.item_type === 'grain' && transactionType === 'sell') || 
          (transactionData.item_type === 'product' && transactionType === 'delivery') ||
          (isRetail && ['purchase', 'distributor-purchase', 'return-in'].includes(transactionType))) && (
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <label className="block text-sm font-medium text-blue-900 mb-2">
              📦 Storage Location * 
              <span className="text-xs text-blue-600 ml-2">
                (Where will these {transactionData.item_type === 'grain' ? 'grains' : 'products'} be stored?)
              </span>
            </label>
            <select
              value={stockLocation}
              onChange={(e) => setStockLocation(e.target.value)}
              className="w-full px-4 py-2 border border-blue-300 rounded-lg bg-white focus:ring-2 focus:ring-blue-500"
              required
            >
              {stockLocations.map(location => (
                <option key={location} value={location}>{location}</option>
              ))}
            </select>
            <p className="text-xs text-blue-600 mt-2">
              💡 Select the {terminology.warehouse || 'warehouse'} or storage area where items will be stored
            </p>
          </div>
        )}

        {/* Quantity and Price */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Quantity *</label>
            <input
              type="number"
              value={transactionData.quantity || ''}
              onChange={(e) => handleInputChange('quantity', e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'e' || e.key === 'E' || e.key === '+' || e.key === '-') {
                  e.preventDefault();
                }
              }}
              className="w-full px-4 py-2 border rounded-lg"
              required
              min="0"
              step="0.01"
              placeholder="Enter quantity"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Unit Price *</label>
            {selectedItem && selectedItem.price_variants > 1 && (
              <div className="mb-2 p-2 bg-amber-50 border border-amber-200 rounded text-xs text-amber-900">
                💡 <strong>Multi-Price Alert:</strong> Existing batches range from PKR {selectedItem.min_price?.toFixed(2)} to PKR {selectedItem.max_price?.toFixed(2)}.
                {' '}If your price differs, a <strong>new batch</strong> will be created automatically.
              </div>
            )}
            <input
              type="number"
              value={transactionData.unit_price || ''}
              onChange={(e) => handleInputChange('unit_price', e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'e' || e.key === 'E' || e.key === '+' || e.key === '-') {
                  e.preventDefault();
                }
              }}
              className="w-full px-4 py-2 border rounded-lg"
              required
              min="0"
              step="0.01"
              placeholder="Enter price"
            />
            {selectedItem && selectedItem.price_variants === 0 && selectedItem.available_quantity > 0 && (
              <p className="text-xs text-gray-500 mt-1">Current batch price: PKR {selectedItem.min_price?.toFixed(2)}</p>
            )}
          </div>
        </div>

        {/* Total Amount */}
        <div className="bg-gray-50 p-4 rounded-lg">
          <p className="text-lg font-bold">Total Amount: PKR {transactionData.total_amount.toFixed(2)}</p>
        </div>
          </>
        )}

        {/* Payment Type */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Payment Type *</label>
          <select
            value={transactionData.payment_type}
            onChange={(e) => handleInputChange('payment_type', e.target.value)}
            className="w-full px-4 py-2 border rounded-lg"
          >
            <option value="CASH">Cash</option>
            <option value="CREDIT">Credit</option>
            <option value="PARTIAL">Partial Payment</option>
          </select>
        </div>

        {/* Payment Details */}
        {transactionData.payment_type === 'PARTIAL' && (
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Cash Paid *</label>
              <input
                type="number"
                value={transactionData.cash_paid || ''}
                onChange={(e) => {
                  const value = parseFloat(e.target.value) || 0;
                  // Get total from multi-item mode or single-item mode
                  const total = isMultiItemMode 
                    ? (multiItemList?.overallDiscount?.grandTotal || 0)
                    : parseFloat(transactionData.total_amount) || 0;
                  
                  // Only validate if total is greater than 0
                  if (total > 0 && value > total) {
                    toast.warning(`Cash paid cannot exceed total amount (${total.toFixed(2)})`);
                  } else {
                    handleInputChange('cash_paid', e.target.value);
                  }
                }}
                onKeyDown={(e) => {
                  if (e.key === 'e' || e.key === 'E' || e.key === '+' || e.key === '-') {
                    e.preventDefault();
                  }
                }}
                className="w-full px-4 py-2 border rounded-lg"
                placeholder="Enter cash amount"
                min="0"
                step="0.01"
              />
              <p className="text-xs text-gray-500 mt-1">
                Max: {isMultiItemMode 
                  ? (multiItemList?.overallDiscount?.grandTotal || 0).toFixed(2)
                  : parseFloat(transactionData.total_amount || 0).toFixed(2)}
              </p>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Credit Amount (Auto-calculated)
              </label>
              <input
                type="number"
                value={transactionData.credit_amount || ''}
                readOnly
                className="w-full px-4 py-2 border rounded-lg bg-gray-50 cursor-not-allowed"
                placeholder="Auto-calculated from Total - Cash"
                min="0"
                step="0.01"
              />
              <p className="text-xs text-gray-500 mt-1">
                Automatically calculated as: Total Amount - Cash Paid
              </p>
            </div>
          </div>
        )}

        {/* Description */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Description</label>
          <textarea
            value={transactionData.description}
            onChange={(e) => handleInputChange('description', e.target.value)}
            className="w-full px-4 py-2 border rounded-lg"
            rows="3"
          />
        </div>
      </div>

      <div className="flex gap-4 mt-6">
        <button
          onClick={() => setStep(5)}
          className="px-6 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300"
        >
          ← Back
        </button>
        <button
          onClick={handleSubmit}
          className="flex-1 px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 font-bold"
        >
          Submit Transaction
        </button>
      </div>
      
      {/* Quick Product Creation Modal */}
      {showQuickProductForm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl p-6 w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="flex items-center gap-3 mb-6">
              <span className="text-3xl">📦</span>
              <h3 className="text-2xl font-bold text-gray-900">Add New Product</h3>
            </div>
            
            <div className="space-y-4">
              {/* Product Name */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Product Name *
                </label>
                <input
                  type="text"
                  value={newProductData.product_name}
                  onChange={(e) => setNewProductData(prev => ({ ...prev, product_name: e.target.value }))}
                  className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                  placeholder="e.g., Urea Fertilizer, Pesticide XYZ"
                  autoFocus
                />
              </div>
              
              {/* Product Category */}
              <div>
                <div className="flex justify-between items-center mb-2">
                  <label className="block text-sm font-medium text-gray-700">
                    Product Category *
                  </label>
                  <button
                    type="button"
                    onClick={() => setShowQuickCategoryForm(true)}
                    className="px-2 py-1 text-xs bg-purple-600 text-white rounded hover:bg-purple-700 flex items-center gap-1"
                  >
                    <span>➕</span>
                    <span>New Category</span>
                  </button>
                </div>
                <select
                  value={newProductData.category_id}
                  onChange={(e) => setNewProductData(prev => ({ ...prev, category_id: e.target.value }))}
                  className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">-- Select Category --</option>
                  {categories.map(cat => (
                    <option key={cat.category_id} value={cat.category_id}>
                      {cat.category_name} ({cat.category_code})
                    </option>
                  ))}
                </select>
                {categories.length === 0 && (
                  <p className="text-xs text-amber-600 mt-1">⚠️ No categories found. Click "New Category" to create one.</p>
                )}
              </div>
              
              {/* Unit of Measure */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Unit of Measure *
                </label>
                <select
                  value={newProductData.unit_of_measure}
                  onChange={(e) => setNewProductData(prev => ({ ...prev, unit_of_measure: e.target.value }))}
                  className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                >
                  <option value="piece">Piece</option>
                  <option value="kg">Kilogram (kg)</option>
                  <option value="liter">Liter</option>
                  <option value="bag">Bag</option>
                  <option value="box">Box</option>
                  <option value="bottle">Bottle</option>
                  <option value="packet">Packet</option>
                  <option value="ton">Ton</option>
                  <option value="quintal">Quintal</option>
                  <option value="gallon">Gallon</option>
                </select>
              </div>
              
              {/* Reorder Level */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Reorder Level (Optional)
                </label>
                <input
                  type="number"
                  value={newProductData.reorder_level}
                  onChange={(e) => setNewProductData(prev => ({ ...prev, reorder_level: parseFloat(e.target.value) || 0 }))}
                  className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                  placeholder="Minimum stock quantity"
                  min="0"
                  step="1"
                />
                <p className="text-xs text-gray-500 mt-1">Alert when stock falls below this level</p>
              </div>
              
              {/* Description */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Description (Optional)
                </label>
                <textarea
                  value={newProductData.description}
                  onChange={(e) => setNewProductData(prev => ({ ...prev, description: e.target.value }))}
                  className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                  rows="3"
                  placeholder="Additional details about this product"
                />
              </div>

              {/* Initial Stock Delivery Info */}
              <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border-l-4 border-blue-600 rounded-lg p-4 space-y-4">
                <div className="flex items-center gap-2 mb-3">
                  <span className="text-2xl">📦</span>
                  <h4 className="text-lg font-bold text-gray-900">Initial Stock Delivery (Optional)</h4>
                </div>
                <p className="text-sm text-gray-600 mb-3">
                  💡 <strong>Tip:</strong> If the company is delivering this product NOW, enter quantity and price here. 
                  The transaction form will auto-fill with these details.
                </p>
                
                {/* Multi-Price Information */}
                <div className="bg-amber-50 border border-amber-300 rounded-lg p-3 mb-3">
                  <div className="flex items-start gap-2">
                    <span className="text-lg">💰</span>
                    <div className="text-xs text-amber-900">
                      <p className="font-bold mb-1">About Price Tracking:</p>
                      <ul className="space-y-1 ml-2">
                        <li>• This price creates the <strong>first batch</strong> for this product</li>
                        <li>• Future deliveries at <strong>different prices</strong> will create <strong>new batches</strong></li>
                        <li>• Each batch is tracked <strong>independently</strong> with its own price</li>
                        <li>• Different companies can deliver at <strong>different prices</strong></li>
                      </ul>
                    </div>
                  </div>
                </div>
                
                {/* Initial Quantity */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Quantity Being Delivered
                  </label>
                  <input
                    type="number"
                    value={newProductData.initial_quantity}
                    onChange={(e) => setNewProductData(prev => ({ ...prev, initial_quantity: e.target.value }))}
                    className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                    placeholder="e.g., 100"
                    min="0"
                    step="0.01"
                  />
                  <p className="text-xs text-gray-500 mt-1">How many {newProductData.unit_of_measure}s are being delivered?</p>
                </div>
                
                {/* Initial Price */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Unit Price (PKR)
                  </label>
                  <input
                    type="number"
                    value={newProductData.initial_price}
                    onChange={(e) => setNewProductData(prev => ({ ...prev, initial_price: e.target.value }))}
                    className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                    placeholder="e.g., 3000"
                    min="0"
                    step="0.01"
                  />
                  <p className="text-xs text-gray-500 mt-1">Price per {newProductData.unit_of_measure}</p>
                </div>

                {/* Total Amount Preview */}
                {newProductData.initial_quantity && newProductData.initial_price && (
                  <div className="bg-green-100 border border-green-300 rounded-lg p-3">
                    <div className="flex justify-between items-center">
                      <span className="text-sm font-medium text-gray-700">Total Amount:</span>
                      <span className="text-xl font-bold text-green-700">
                        PKR {(parseFloat(newProductData.initial_quantity) * parseFloat(newProductData.initial_price)).toFixed(2)}
                      </span>
                    </div>
                  </div>
                )}
                
                {/* Storage Location */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    📍 Storage Location
                  </label>
                  <select
                    value={newProductData.initial_storage_location}
                    onChange={(e) => setNewProductData(prev => ({ ...prev, initial_storage_location: e.target.value }))}
                    className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                  >
                    {stockLocations.map(location => (
                      <option key={location} value={location}>{location}</option>
                    ))}
                  </select>
                  <p className="text-xs text-gray-500 mt-1">Where will this product be stored?</p>
                </div>
              </div>
            </div>
            
            {/* Action Buttons */}
            <div className="flex gap-3 mt-6">
              <button
                type="button"
                onClick={() => {
                  setShowQuickProductForm(false);
                  setNewProductData({
                    product_name: '',
                    category_id: '',
                    unit_of_measure: 'piece',
                    description: '',
                    reorder_level: 0
                  });
                }}
                className="flex-1 px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 font-medium"
                disabled={isCreatingProduct}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleQuickProductCreate}
                className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-bold disabled:opacity-50"
                disabled={isCreatingProduct || !newProductData.product_name.trim() || !newProductData.category_id}
              >
                {isCreatingProduct ? 'Creating...' : '✅ Create Product'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Quick Category Creation Modal (Nested) */}
      {showQuickCategoryForm && (
        <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-[60]">
          <div className="bg-white rounded-lg shadow-2xl p-6 w-full max-w-md border-4 border-purple-500">
            <div className="flex items-center gap-3 mb-6">
              <span className="text-3xl">🏷️</span>
              <h3 className="text-xl font-bold text-gray-900">Add New Category</h3>
            </div>
            
            <div className="space-y-4">
              {/* Category Name */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Category Name *
                </label>
                <input
                  type="text"
                  value={newCategoryData.category_name}
                  onChange={(e) => setNewCategoryData(prev => ({ ...prev, category_name: e.target.value }))}
                  className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-purple-500"
                  placeholder="e.g., Fertilizers, Seeds, Pesticides"
                  autoFocus
                />
              </div>
              
              {/* Description */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Description (Optional)
                </label>
                <textarea
                  value={newCategoryData.description}
                  onChange={(e) => setNewCategoryData(prev => ({ ...prev, description: e.target.value }))}
                  className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-purple-500"
                  rows="2"
                  placeholder="Brief description of this category"
                />
              </div>
            </div>
            
            {/* Action Buttons */}
            <div className="flex gap-3 mt-6">
              <button
                type="button"
                onClick={() => {
                  setShowQuickCategoryForm(false);
                  setNewCategoryData({ category_name: '', description: '' });
                }}
                className="flex-1 px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 font-medium"
                disabled={isCreatingCategory}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleQuickCategoryCreate}
                className="flex-1 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 font-bold disabled:opacity-50"
                disabled={isCreatingCategory || !newCategoryData.category_name.trim()}
              >
                {isCreatingCategory ? 'Creating...' : '✅ Create Category'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Quick Grain Creation Modal */}
      {showQuickGrainForm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl p-6 w-full max-w-md">
            <h3 className="text-xl font-bold text-gray-900 mb-4">Add New Grain Type</h3>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Grain Name *
                </label>
                <input
                  type="text"
                  value={newGrainData.grain_name}
                  onChange={(e) => setNewGrainData(prev => ({ ...prev, grain_name: e.target.value }))}
                  className="w-full px-4 py-2 border rounded-lg"
                  placeholder="e.g., Wheat, Rice, Corn"
                  autoFocus
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Unit of Measure *
                </label>
                <select
                  value={newGrainData.unit_of_measure}
                  onChange={(e) => setNewGrainData(prev => ({ ...prev, unit_of_measure: e.target.value }))}
                  className="w-full px-4 py-2 border rounded-lg"
                >
                  <option value="kg">Kilogram (kg)</option>
                  <option value="ton">Ton</option>
                  <option value="quintal">Quintal</option>
                  <option value="bag">Bag</option>
                  <option value="maund">Maund (40 kg)</option>
                </select>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Description (Optional)
                </label>
                <textarea
                  value={newGrainData.description}
                  onChange={(e) => setNewGrainData(prev => ({ ...prev, description: e.target.value }))}
                  className="w-full px-4 py-2 border rounded-lg"
                  rows="2"
                  placeholder="Additional details about this grain"
                />
              </div>
            </div>
            
            <div className="flex gap-3 mt-6">
              <button
                type="button"
                onClick={() => {
                  setShowQuickGrainForm(false);
                  setNewGrainData({ grain_name: '', unit_of_measure: 'kg', description: '' });
                }}
                className="flex-1 px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300"
                disabled={isCreatingGrain}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleQuickGrainCreate}
                className="flex-1 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 font-bold disabled:opacity-50"
                disabled={isCreatingGrain || !newGrainData.grain_name.trim()}
              >
                {isCreatingGrain ? 'Creating...' : 'Create Grain'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );

  };

  // Step 7: Success
  const renderStep7 = () => (
    <div className="max-w-2xl mx-auto text-center">
      <CheckCircleIcon className="h-24 w-24 text-green-600 mx-auto mb-6" />
      <h2 className="text-3xl font-bold text-gray-900 mb-4">Transaction Successful!</h2>
      <p className="text-gray-600 mb-2">The transaction has been saved to today's report.</p>
      {lastTransactionNumber && (
        <p className="text-sm text-gray-500 mb-8">Transaction #: <span className="font-mono font-semibold text-gray-700">{lastTransactionNumber}</span></p>
      )}
      
      <div className="flex flex-wrap gap-4 justify-center">
        {lastTransactionId && (
          <>
            <button
              onClick={() => navigate(`/transactions/${lastTransactionId}`)}
              className="px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 font-bold flex items-center gap-2"
            >
              <DocumentTextIcon className="h-5 w-5" />
              View Receipt
            </button>
          </>
        )}
        <button
          onClick={() => {
            setStep(1);
            setSelectedModule('');
            setEntityType('');
            setSelectedEntity(null);
            setLastTransactionId(null);
            setLastTransactionNumber(null);
            setTransactionData({
              entity_name: '', entity_father_name: '', entity_cnic: '', entity_phone: '', entity_address: '',
              item_type: 'product', item_id: '', quantity: '', unit_price: '', total_amount: 0,
              payment_type: 'CASH', cash_paid: '', credit_amount: '', description: '',
            });
          }}
          className="px-8 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-bold"
        >
          Create Another Transaction
        </button>
        <button
          onClick={() => navigate('/transactions')}
          className="px-8 py-3 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 font-bold"
        >
          View All Transactions
        </button>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 to-blue-50">
      <header className="bg-white shadow-md border-b-4 border-purple-600 mb-6">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <button
            onClick={() => navigate('/transactions')}
            className="flex items-center gap-2 text-gray-600 hover:text-gray-900 mb-4 transition-colors"
          >
            <ArrowLeftIcon className="h-5 w-5" />
            Back to Transactions
          </button>
          <h1 className="text-3xl font-bold bg-gradient-to-r from-purple-600 to-blue-600 bg-clip-text text-transparent">
            Create New Transaction
          </h1>
          <p className="text-sm text-gray-600 mt-1">Universal Transaction System - All Business Activities</p>
        </div>
      </header>

      <div className="px-4 sm:px-6 lg:px-8 py-6 w-full">
        {/* Progress Steps */}
        <div className="mb-8">
          <div className="flex items-center justify-center space-x-2 text-sm">
            {['Module', 'Type', 'Entity', 'Transaction', 'Details'].map((label, idx) => (
              <React.Fragment key={idx}>
                <div className={`px-3 py-1 rounded ${step > idx ? 'bg-blue-600 text-white' : 'bg-gray-200'}`}>
                  {label}
                </div>
                {idx < 4 && <div className="w-4 h-0.5 bg-gray-300" />}
              </React.Fragment>
            ))}
          </div>
        </div>

        {/* Step Content */}
        {step === 1 && renderStep1()}
        {step === 2 && renderStep2()}
        {step === 3 && renderStep3()}
        {step === 4 && renderStep4()}
        {step === 5 && renderStep5()}
        {step === 6 && renderStep6()}
        {step === 7 && renderStep7()}
      </div>
    </div>
  );
};

export default UniversalTransactionPage;
