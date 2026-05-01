/**
 * Industry Configuration Files
 * =============================
 * Each config maps generic terms to industry-specific terminology,
 * defines available entity types, item types, and transaction types.
 */

/**
 * Agricultural Industry Configuration (v1.0 backward compatibility)
 */
export const agriculturalConfig = {
  industry: 'AGRICULTURAL',
  displayName: 'Agricultural Business',
  description: 'Agricultural inventory management for farms, grain trading, and agricultural supplies',

  // Entity terminology mapping
  terminology: {
    // Primary entities (customers)
    customer: 'Farmer',
    customers: 'Farmers',
    customerIdPrefix: 'F',
    customerFields: ['name', 'father_name', 'cnic', 'phone', 'address'],

    // Secondary entities (dealers / intermediaries)
    dealer: 'Dealer',
    dealers: 'Dealers',
    dealerIdPrefix: 'D',
    dealerFields: ['name', 'father_name', 'cnic', 'phone', 'address', 'contact_person'],

    // Suppliers
    supplier: 'Company',
    suppliers: 'Companies',
    supplierIdPrefix: 'S',
    supplierFields: ['company_name', 'contact_person', 'phone', 'address', 'certifications'],

    // Inventory items
    item: 'Product',
    items: 'Products',
    itemIdPrefix: 'P',
    secondaryItem: 'Grain',
    secondaryItems: 'Grains',
    secondaryItemIdPrefix: 'G',

    // Stock
    stock: 'Stock',
    warehouse: 'Warehouse',
    
    // Transactions
    purchase: 'Purchase',
    sale: 'Sale',
    delivery: 'Delivery',
    payment: 'Payment',
  },

  // Navigation items
  navigation: [
    { id: 'dashboard', label: 'Dashboard', icon: 'home', path: '/dashboard' },
    { id: 'farmers', label: 'Farmers', icon: 'users', path: '/entities/customers' },
    { id: 'dealers', label: 'Dealers', icon: 'truck', path: '/entities/dealers' },
    { id: 'companies', label: 'Companies', icon: 'building', path: '/entities/suppliers' },
    { id: 'categories', label: 'Categories', icon: 'folder', path: '/product-categories' },
    { id: 'products', label: 'Products', icon: 'package', path: '/products' },
    { id: 'grains', label: 'Grains', icon: 'grain', path: '/grains' },
    { id: 'stock', label: 'Stock', icon: 'warehouse', path: '/stock-movements' },
    { id: 'transactions', label: 'Transactions', icon: 'receipt', path: '/transactions' },
    { id: 'reports', label: 'Reports', icon: 'chart', path: '/reports' },
    { id: 'backup', label: 'Backup', icon: 'shield', path: '/backup' },
    { id: 'history', label: 'Activity Log', icon: 'clock', path: '/history' },
    { id: 'user-management', label: 'Users', icon: 'users', path: '/user-management' },
    { id: 'settings', label: 'Settings', icon: 'settings', path: '/settings' },
  ],

  // Entity-specific features
  features: {
    hasSecondaryItem: true,     // Grains
    hasDealers: true,           // Dealers as intermediaries
    hasBatchTracking: true,
    hasExpiryDates: false,
    hasSerialNumbers: false,
    hasPropertyListings: false,
    hasPrescriptions: false,
    hasCommissions: false,
    hasInstallments: false,
  },

  // Transaction types available
  transactionTypes: [
    { value: 'FARMER_PURCHASE', label: 'Farmer Purchase (Buy from Farmer)', direction: 'IN' },
    { value: 'FARMER_SALE', label: 'Farmer Sale (Sell to Farmer)', direction: 'OUT' },
    { value: 'DEALER_PURCHASE', label: 'Dealer Purchase (Buy from Dealer)', direction: 'IN' },
    { value: 'DEALER_SALE', label: 'Dealer Sale (Sell to Dealer)', direction: 'OUT' },
    { value: 'COMPANY_DELIVERY', label: 'Company Delivery (Receive from Company)', direction: 'IN' },
    { value: 'COMPANY_RETURN', label: 'Company Return (Return to Company)', direction: 'OUT' },
    { value: 'PAYMENT_RECEIVED', label: 'Payment Received', direction: 'PAYMENT' },
    { value: 'PAYMENT_MADE', label: 'Payment Made', direction: 'PAYMENT' },
  ],

  // Dashboard stats to show
  dashboardStats: [
    { id: 'activeFarmers', label: 'Active Farmers', icon: 'users', color: 'blue' },
    { id: 'inventoryItems', label: 'Inventory Items', icon: 'package', color: 'green' },
    { id: 'todayTransactions', label: "Today's Transactions", icon: 'receipt', color: 'purple' },
    { id: 'totalRevenue', label: 'Total Revenue', icon: 'currency', color: 'yellow' },
  ],
};

/**
 * General Store / Retail Configuration
 */
export const retailConfig = {
  industry: 'RETAIL',
  displayName: 'General Store / Retail',
  description: 'Retail inventory for shopping marts, electronics, showrooms, and general stores',

  terminology: {
    customer: 'Customer',
    customers: 'Customers',
    customerIdPrefix: 'C',
    customerFields: ['name', 'father_name', 'cnic', 'phone', 'address', 'customer_group'],

    dealer: 'Distributor',
    dealers: 'Distributors',
    dealerIdPrefix: 'DI',
    dealerFields: ['name', 'father_name', 'cnic', 'phone', 'address', 'contact_person'],

    supplier: 'Supplier',
    suppliers: 'Suppliers',
    supplierIdPrefix: 'S',
    supplierFields: ['company_name', 'contact_person', 'phone', 'address', 'certifications'],

    item: 'Product',
    items: 'Products',
    itemIdPrefix: 'P',
    secondaryItem: null,
    secondaryItems: null,
    secondaryItemIdPrefix: null,

    stock: 'Stock',
    warehouse: 'Warehouse / Showroom',
    
    purchase: 'Purchase',
    sale: 'Sale',
    delivery: 'Delivery',
    payment: 'Payment',
  },

  navigation: [
    { id: 'dashboard', label: 'Dashboard', icon: 'home', path: '/dashboard' },
    { id: 'customers', label: 'Customers', icon: 'users', path: '/entities/customers' },
    { id: 'distributors', label: 'Distributors', icon: 'truck', path: '/entities/dealers' },
    { id: 'suppliers', label: 'Suppliers', icon: 'building', path: '/entities/suppliers' },
    { id: 'categories', label: 'Categories', icon: 'folder', path: '/product-categories' },
    { id: 'products', label: 'Products', icon: 'package', path: '/products' },
    { id: 'stock', label: 'Stock', icon: 'warehouse', path: '/stock-movements' },
    { id: 'transactions', label: 'Transactions', icon: 'receipt', path: '/transactions' },
    { id: 'reports', label: 'Reports', icon: 'chart', path: '/reports' },
    { id: 'backup', label: 'Backup', icon: 'shield', path: '/backup' },
    { id: 'history', label: 'Activity Log', icon: 'clock', path: '/history' },
    { id: 'user-management', label: 'Users', icon: 'users', path: '/user-management' },
    { id: 'settings', label: 'Settings', icon: 'settings', path: '/settings' },
  ],

  features: {
    hasSecondaryItem: false,
    hasDealers: true,
    hasBatchTracking: true,
    hasExpiryDates: false,
    hasSerialNumbers: true,
    hasPropertyListings: false,
    hasPrescriptions: false,
    hasCommissions: false,
    hasInstallments: true,
    hasSKU: true,
    hasBarcode: true,
    hasBrand: true,
    hasWarranty: true,
    hasVariants: true,
  },

  transactionTypes: [
    { value: 'SALE', label: 'Sale to Customer', direction: 'OUT' },
    { value: 'PURCHASE', label: 'Purchase from Supplier', direction: 'IN' },
    { value: 'DISTRIBUTOR_PURCHASE', label: 'Purchase from Distributor', direction: 'IN' },
    { value: 'RETURN_IN', label: 'Customer Return', direction: 'IN' },
    { value: 'RETURN_OUT', label: 'Return to Supplier', direction: 'OUT' },
    { value: 'PAYMENT_RECEIVED', label: 'Payment Received', direction: 'PAYMENT' },
    { value: 'PAYMENT_MADE', label: 'Payment Made', direction: 'PAYMENT' },
  ],

  dashboardStats: [
    { id: 'activeCustomers', label: 'Active Customers', icon: 'users', color: 'blue' },
    { id: 'inventoryItems', label: 'Total Products', icon: 'package', color: 'green' },
    { id: 'todayTransactions', label: "Today's Sales", icon: 'receipt', color: 'purple' },
    { id: 'totalRevenue', label: 'Total Revenue', icon: 'currency', color: 'yellow' },
  ],
};

/**
 * Medical Store / Pharmacy Configuration
 */
export const medicalConfig = {
  industry: 'MEDICAL',
  displayName: 'Medical Store / Pharmacy',
  description: 'Pharmacy inventory management for medicines, prescriptions, and patient tracking',

  terminology: {
    customer: 'Patient',
    customers: 'Patients',
    customerIdPrefix: 'P',
    customerFields: ['name', 'father_name', 'cnic', 'phone', 'address', 'date_of_birth', 'allergies', 'chronic_conditions'],

    dealer: 'Distributor',
    dealers: 'Distributors',
    dealerIdPrefix: 'DI',
    dealerFields: ['name', 'father_name', 'cnic', 'phone', 'address', 'contact_person'],

    supplier: 'Pharmaceutical Company',
    suppliers: 'Pharmaceutical Companies',
    supplierIdPrefix: 'S',
    supplierFields: ['company_name', 'contact_person', 'phone', 'address', 'certifications', 'drug_license_number'],

    item: 'Medicine',
    items: 'Medicines',
    itemIdPrefix: 'M',
    secondaryItem: null,
    secondaryItems: null,
    secondaryItemIdPrefix: null,

    stock: 'Medicine Stock',
    warehouse: 'Store / Dispensary',

    purchase: 'Purchase',
    sale: 'Dispensing',
    delivery: 'Delivery',
    payment: 'Payment',
  },

  navigation: [
    { id: 'dashboard', label: 'Dashboard', icon: 'home', path: '/dashboard' },
    { id: 'patients', label: 'Patients', icon: 'users', path: '/entities/customers' },
    { id: 'distributors', label: 'Distributors', icon: 'truck', path: '/entities/dealers' },
    { id: 'pharmaCompanies', label: 'Pharma Companies', icon: 'building', path: '/entities/suppliers' },
    { id: 'categories', label: 'Categories', icon: 'folder', path: '/product-categories' },
    { id: 'medicines', label: 'Medicines', icon: 'package', path: '/products' },
    { id: 'batches', label: 'Medicine Batches', icon: 'layers', path: '/medicine-batches' },
    { id: 'stock', label: 'Medicine Stock', icon: 'warehouse', path: '/stock-movements' },
    { id: 'prescriptions', label: 'Prescriptions', icon: 'clipboard', path: '/prescriptions' },
    { id: 'transactions', label: 'Transactions', icon: 'receipt', path: '/transactions' },
    { id: 'reports', label: 'Reports', icon: 'chart', path: '/reports' },
    { id: 'backup', label: 'Backup', icon: 'shield', path: '/backup' },
    { id: 'history', label: 'Activity Log', icon: 'clock', path: '/history' },
    { id: 'user-management', label: 'Users', icon: 'users', path: '/user-management' },
    { id: 'settings', label: 'Settings', icon: 'settings', path: '/settings' },
  ],

  features: {
    hasSecondaryItem: false,
    hasDealers: true,
    hasBatchTracking: true,
    hasExpiryDates: true,
    hasSerialNumbers: false,
    hasPropertyListings: false,
    hasPrescriptions: true,
    hasCommissions: false,
    hasInstallments: false,
    hasControlledSubstance: true,
    hasDrugForms: true,
    hasFEFO: true,
    hasGenericName: true,
    hasBrandName: true,
    hasComposition: true,
  },

  transactionTypes: [
    { value: 'DISPENSING', label: 'Medicine Dispensing (Sale to Patient)', direction: 'OUT' },
    { value: 'PURCHASE', label: 'Purchase from Pharma Company', direction: 'IN' },
    { value: 'DISTRIBUTOR_PURCHASE', label: 'Purchase from Distributor', direction: 'IN' },
    { value: 'CONTROLLED_DISPENSING', label: 'Controlled Substance Dispensing', direction: 'OUT' },
    { value: 'RETURN_IN', label: 'Medicine Return (Patient)', direction: 'IN' },
    { value: 'RETURN_OUT', label: 'Return to Supplier', direction: 'OUT' },
    { value: 'PAYMENT_RECEIVED', label: 'Payment Received', direction: 'PAYMENT' },
    { value: 'PAYMENT_MADE', label: 'Payment Made', direction: 'PAYMENT' },
  ],

  dashboardStats: [
    { id: 'activePatients', label: 'Active Patients', icon: 'users', color: 'blue' },
    { id: 'totalMedicines', label: 'Total Medicines', icon: 'package', color: 'green' },
    { id: 'todayDispensing', label: "Today's Dispensing", icon: 'receipt', color: 'purple' },
    { id: 'expiringMedicines', label: 'Expiring Soon', icon: 'alert', color: 'red' },
  ],
};

/**
 * Real Estate Configuration
 */
export const realEstateConfig = {
  industry: 'REAL_ESTATE',
  displayName: 'Real Estate Business',
  description: 'Property management for real estate agencies, property dealers, and developers',

  terminology: {
    customer: 'Client',
    customers: 'Clients',
    customerIdPrefix: 'CL',
    customerFields: ['name', 'father_name', 'cnic', 'phone', 'address', 'client_type', 'budget_min', 'budget_max', 'preferred_locations'],

    dealer: 'Agent',
    dealers: 'Agents',
    dealerIdPrefix: 'AG',
    dealerFields: ['name', 'father_name', 'cnic', 'phone', 'address', 'commission_rate'],

    supplier: 'Property Owner',
    suppliers: 'Property Owners',
    supplierIdPrefix: 'S',
    supplierFields: ['company_name', 'contact_person', 'phone', 'address'],

    item: 'Property',
    items: 'Properties',
    itemIdPrefix: 'PR',
    secondaryItem: null,
    secondaryItems: null,
    secondaryItemIdPrefix: null,

    stock: 'Listings',
    warehouse: 'Office',

    purchase: 'Acquisition',
    sale: 'Sale',
    delivery: 'Handover',
    payment: 'Payment',
  },

  navigation: [
    { id: 'dashboard', label: 'Dashboard', icon: 'home', path: '/dashboard' },
    { id: 'clients', label: 'Clients', icon: 'users', path: '/entities/customers' },
    { id: 'agents', label: 'Agents', icon: 'truck', path: '/entities/dealers' },
    { id: 'owners', label: 'Property Owners', icon: 'building', path: '/entities/suppliers' },
    { id: 'properties', label: 'Properties', icon: 'property', path: '/products' },
    { id: 'listings', label: 'Listings', icon: 'list', path: '/properties' },
    { id: 'deals', label: 'Deals', icon: 'handshake', path: '/transactions' },
    { id: 'commissions', label: 'Commissions', icon: 'percent', path: '/commissions' },
    { id: 'reports', label: 'Reports', icon: 'chart', path: '/reports' },
    { id: 'backup', label: 'Backup', icon: 'shield', path: '/backup' },
    { id: 'history', label: 'Activity Log', icon: 'clock', path: '/history' },
    { id: 'user-management', label: 'Users', icon: 'users', path: '/user-management' },
    { id: 'settings', label: 'Settings', icon: 'settings', path: '/settings' },
  ],

  features: {
    hasSecondaryItem: false,
    hasDealers: true,
    hasBatchTracking: false,
    hasExpiryDates: false,
    hasSerialNumbers: false,
    hasPropertyListings: true,
    hasPrescriptions: false,
    hasCommissions: true,
    hasInstallments: true,
    hasPropertyTypes: true,
    hasPropertyDimensions: true,
    hasPropertyFeatures: true,
    hasPropertyGallery: true,
  },

  transactionTypes: [
    { value: 'PROPERTY_SALE', label: 'Property Sale', direction: 'OUT' },
    { value: 'PROPERTY_RENT', label: 'Property Rental', direction: 'OUT' },
    { value: 'TOKEN_PAYMENT', label: 'Token / Advance Payment', direction: 'PAYMENT' },
    { value: 'INSTALLMENT', label: 'Installment Payment', direction: 'PAYMENT' },
    { value: 'COMMISSION_PAYMENT', label: 'Commission Payment', direction: 'PAYMENT' },
    { value: 'FULL_PAYMENT', label: 'Full Payment', direction: 'PAYMENT' },
    { value: 'REFUND', label: 'Refund', direction: 'PAYMENT' },
  ],

  dashboardStats: [
    { id: 'activeClients', label: 'Active Clients', icon: 'users', color: 'blue' },
    { id: 'availableProperties', label: 'Available Properties', icon: 'property', color: 'green' },
    { id: 'activeDeals', label: 'Active Deals', icon: 'handshake', color: 'purple' },
    { id: 'commissionEarned', label: 'Commission Earned', icon: 'currency', color: 'yellow' },
  ],
};

/**
 * Get configuration by industry type
 * @param {string} industryType - AGRICULTURAL, RETAIL, MEDICAL, or REAL_ESTATE
 * @returns {Object} Industry configuration object
 */
export const getIndustryConfig = (industryType) => {
  const configs = {
    AGRICULTURAL: agriculturalConfig,
    RETAIL: retailConfig,
    MEDICAL: medicalConfig,
    REAL_ESTATE: realEstateConfig,
  };

  return configs[industryType] || retailConfig; // Default to retail
};

/**
 * Get all available industry options for the setup wizard
 */
export const getAvailableIndustries = () => [
  {
    value: 'RETAIL',
    label: 'General Store / Retail',
    description: 'Shopping marts, electronics, showrooms, plazas, clothing, hardware stores',
    icon: '🏪',
  },
  {
    value: 'MEDICAL',
    label: 'Medical Store / Pharmacy',
    description: 'Medicine inventory, prescriptions, patient management, batch & expiry tracking',
    icon: '🏥',
  },
  {
    value: 'REAL_ESTATE',
    label: 'Real Estate Business',
    description: 'Properties, clients, deals, commissions, installment tracking',
    icon: '🏠',
  },
  {
    value: 'AGRICULTURAL',
    label: 'Agricultural Business',
    description: 'Farmers, grain trading, agricultural products, dealer management',
    icon: '🌾',
  },
];
