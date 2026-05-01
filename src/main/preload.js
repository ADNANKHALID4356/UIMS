import { contextBridge, ipcRenderer } from 'electron';

/**
 * Preload script for secure IPC communication
 * Exposes safe API to renderer process
 */
contextBridge.exposeInMainWorld('electronAPI', {
  // Organization API (v2.0 - Industry Configuration)
  organization: {
    isConfigured: () => ipcRenderer.invoke('organization:isConfigured'),
    getSettings: () => ipcRenderer.invoke('organization:getSettings'),
    setup: (data) => ipcRenderer.invoke('organization:setup', data),
    updateSettings: (data) => ipcRenderer.invoke('organization:updateSettings', data),
    getIndustryConfig: () => ipcRenderer.invoke('organization:getIndustryConfig'),
    getAvailableIndustries: () => ipcRenderer.invoke('organization:getAvailableIndustries'),
    changeIndustry: (newType) => ipcRenderer.invoke('organization:changeIndustry', newType),
  },

  // License API
  validateLicense: () => ipcRenderer.invoke('license:validate'),
  activateLicense: (data) =>
    ipcRenderer.invoke('license:activate', data),
  deactivateLicense: () => ipcRenderer.invoke('license:deactivate'),
  getLicenseInfo: () => ipcRenderer.invoke('license:getInfo'),

  // Auth API
  login: (username, password) =>
    ipcRenderer.invoke('auth:login', username, password),
  logout: () => ipcRenderer.invoke('auth:logout'),
  getCurrentUser: () => ipcRenderer.invoke('auth:getCurrentUser'),
  changePassword: (oldPassword, newPassword) =>
    ipcRenderer.invoke('auth:changePassword', oldPassword, newPassword),

  // Database API
  query: (sql, params) =>
    ipcRenderer.invoke('db:query', sql, params),
  execute: (sql, params) =>
    ipcRenderer.invoke('db:execute', sql, params),

  // Farmer API (Sprint 2 - Complete offline functionality)
  farmer: {
    create: (farmerData, userId) => ipcRenderer.invoke('farmer:create', farmerData, userId),
    getById: (farmerId) => ipcRenderer.invoke('farmer:getById', farmerId),
    getBySpecificId: (specificId) => ipcRenderer.invoke('farmer:getBySpecificId', specificId),
    getAll: (activeOnly) => ipcRenderer.invoke('farmer:getAll', activeOnly),
    update: (farmerId, farmerData, userId) => ipcRenderer.invoke('farmer:update', farmerId, farmerData, userId),
    delete: (farmerId, userId) => ipcRenderer.invoke('farmer:delete', farmerId, userId),
    search: (searchTerm) => ipcRenderer.invoke('farmer:search', searchTerm),
    getLedger: (farmerId) => ipcRenderer.invoke('farmer:getLedger', farmerId),
    getStatistics: () => ipcRenderer.invoke('farmer:getStatistics'),
  },

  // Transaction API (Sprint 5 - Transaction Processing)
  transaction: {
    processFarmerPurchase: (data, userId) => ipcRenderer.invoke('transaction:processFarmerPurchase', data, userId),
    processFarmerSaleGrain: (data, userId) => ipcRenderer.invoke('transaction:processFarmerSaleGrain', data, userId),
    getAll: (filters) => ipcRenderer.invoke('transaction:getAll', filters),
    getById: (transactionId) => ipcRenderer.invoke('transaction:getById', transactionId),
    getDailySummary: (date) => ipcRenderer.invoke('transaction:getDailySummary', date),
    getDailySummaries: (dateFrom, dateTo) => ipcRenderer.invoke('transaction:getDailySummaries', dateFrom, dateTo),
    getStatistics: (filters) => ipcRenderer.invoke('transaction:getStatistics', filters),
    validate: (data) => ipcRenderer.invoke('transaction:validate', data),
    
    // Sprint 6 - Multi-Item Transaction Support
    createFarmerPurchaseMulti: (transactionData, items, userId) => 
      ipcRenderer.invoke('transaction:createFarmerPurchaseMulti', { transactionData, items, userId }),
    createFarmerSaleMulti: (transactionData, items, userId) => 
      ipcRenderer.invoke('transaction:createFarmerSaleMulti', { transactionData, items, userId }),
    createDealerPurchaseMulti: (transactionData, items, userId) => 
      ipcRenderer.invoke('transaction:createDealerPurchaseMulti', { transactionData, items, userId }),
    createCompanyDeliveryMulti: (transactionData, items, userId) => 
      ipcRenderer.invoke('transaction:createCompanyDeliveryMulti', { transactionData, items, userId }),
    createPaymentReceived: (transactionData, userId) => 
      ipcRenderer.invoke('transaction:createPaymentReceived', { transactionData, userId }),
    createPaymentMade: (transactionData, userId) => 
      ipcRenderer.invoke('transaction:createPaymentMade', { transactionData, userId }),
    getByIdWithItems: (transactionId) => 
      ipcRenderer.invoke('transaction:getByIdWithItems', transactionId),
    getAllWithItemsCount: (filters) => 
      ipcRenderer.invoke('transaction:getAllWithItemsCount', filters),
    editMultiItem: (payload) => 
      ipcRenderer.invoke('transaction:editMultiItem', payload),

    // Retail Industry Transaction Methods
    createRetailSaleMulti: (transactionData, items, userId) =>
      ipcRenderer.invoke('transaction:createRetailSaleMulti', { transactionData, items, userId }),
    createRetailPurchaseMulti: (transactionData, items, userId) =>
      ipcRenderer.invoke('transaction:createRetailPurchaseMulti', { transactionData, items, userId }),
    createRetailDistributorPurchaseMulti: (transactionData, items, userId) =>
      ipcRenderer.invoke('transaction:createRetailDistributorPurchaseMulti', { transactionData, items, userId }),
    createRetailReturnInMulti: (transactionData, items, userId) =>
      ipcRenderer.invoke('transaction:createRetailReturnInMulti', { transactionData, items, userId }),
    createRetailReturnOutMulti: (transactionData, items, userId) =>
      ipcRenderer.invoke('transaction:createRetailReturnOutMulti', { transactionData, items, userId }),
  },

  // Dealer API (v2.0 Sprint 2 - Entity Management)
  dealer: {
    create: (dealerData, userId) => ipcRenderer.invoke('dealer:create', dealerData, userId),
    getById: (dealerId) => ipcRenderer.invoke('dealer:getById', dealerId),
    getBySpecificId: (specificId) => ipcRenderer.invoke('dealer:getBySpecificId', specificId),
    getAll: (activeOnly) => ipcRenderer.invoke('dealer:getAll', activeOnly),
    update: (dealerId, dealerData, userId) => ipcRenderer.invoke('dealer:update', dealerId, dealerData, userId),
    delete: (dealerId, userId) => ipcRenderer.invoke('dealer:delete', dealerId, userId),
    search: (searchTerm) => ipcRenderer.invoke('dealer:search', searchTerm),
    getLedger: (dealerId) => ipcRenderer.invoke('dealer:getLedger', dealerId),
    getStatistics: () => ipcRenderer.invoke('dealer:getStatistics'),
  },

  // Company/Supplier API (v2.0 Sprint 2 - Entity Management)
  company: {
    create: (companyData, userId) => ipcRenderer.invoke('company:create', companyData, userId),
    getById: (companyId) => ipcRenderer.invoke('company:getById', companyId),
    getBySpecificId: (specificId) => ipcRenderer.invoke('company:getBySpecificId', specificId),
    getAll: (activeOnly) => ipcRenderer.invoke('company:getAll', activeOnly),
    update: (companyId, companyData, userId) => ipcRenderer.invoke('company:update', companyId, companyData, userId),
    delete: (companyId, userId) => ipcRenderer.invoke('company:delete', companyId, userId),
    search: (searchTerm) => ipcRenderer.invoke('company:search', searchTerm),
    getLedger: (companyId) => ipcRenderer.invoke('company:getLedger', companyId),
    getStatistics: () => ipcRenderer.invoke('company:getStatistics'),
  },

  // System API
  getSystemInfo: () => ipcRenderer.invoke('system:getInfo'),
  getSystemFingerprint: () => ipcRenderer.invoke('system:getFingerprint'),

  // Listen for events
  onLicenseExpired: (callback) => {
    ipcRenderer.on('license:expired', callback);
  },
  onAuthRequired: (callback) => {
    ipcRenderer.on('auth:required', callback);
  },
});
