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
  isFirstRun: () => ipcRenderer.invoke('auth:isFirstRun'),
  createFirstUser: (fullName, username, email, password) =>
    ipcRenderer.invoke('auth:createFirstUser', fullName, username, email, password),
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

  // Dealer API (Sprint 3 - FR-3.2 Dealer Management)
  dealer: {
    create: (dealerData, userId) => ipcRenderer.invoke('dealer:create', dealerData, userId),
    getById: (dealerId) => ipcRenderer.invoke('dealer:getById', dealerId),
    getBySpecificId: (specificId) => ipcRenderer.invoke('dealer:getBySpecificId', specificId),
    getAll: (activeOnly) => ipcRenderer.invoke('dealer:getAll', activeOnly),
    update: (dealerId, dealerData, userId) => ipcRenderer.invoke('dealer:update', dealerId, dealerData, userId),
    delete: (dealerId, userId) => ipcRenderer.invoke('dealer:delete', dealerId, userId),
    search: (searchTerm) => ipcRenderer.invoke('dealer:search', searchTerm),
    getLedger: (dealerId) => ipcRenderer.invoke('dealer:getLedger', dealerId),
    getStats: () => ipcRenderer.invoke('dealer:getStats'),
  },

  // Company API (Sprint 3 - FR-3.3 Company Management)
  company: {
    create: (companyData, userId) => ipcRenderer.invoke('company:create', companyData, userId),
    getById: (companyId) => ipcRenderer.invoke('company:getById', companyId),
    getBySpecificId: (specificId) => ipcRenderer.invoke('company:getBySpecificId', specificId),
    getAll: (activeOnly) => ipcRenderer.invoke('company:getAll', activeOnly),
    update: (companyId, companyData, userId) => ipcRenderer.invoke('company:update', companyId, companyData, userId),
    delete: (companyId, userId) => ipcRenderer.invoke('company:delete', companyId, userId),
    search: (searchTerm) => ipcRenderer.invoke('company:search', searchTerm),
    getLedger: (companyId) => ipcRenderer.invoke('company:getLedger', companyId),
    getStats: () => ipcRenderer.invoke('company:getStats'),
  },

  // Product Category API (Sprint 4 - FR-4.1 Category Management)
  productCategory: {
  create: (categoryData, userId) => ipcRenderer.invoke('product-category:create', categoryData, userId),
  getById: (categoryId) => ipcRenderer.invoke('product-category:get-by-id', categoryId),
  getByCode: (categoryCode) => ipcRenderer.invoke('product-category:get-by-code', categoryCode),
  getAll: (filters) => ipcRenderer.invoke('product-category:get-all', filters),
  update: (categoryId, updateData, userId) => ipcRenderer.invoke('product-category:update', categoryId, updateData, userId),
  clearProducts: (categoryId, reason, notes, userId) => ipcRenderer.invoke('product-category:clear-products', categoryId, reason, notes, userId),
  delete: (categoryId, userId, targetCategoryId = null) => ipcRenderer.invoke('product-category:delete', categoryId, userId, targetCategoryId),
  search: (searchTerm) => ipcRenderer.invoke('product-category:search', searchTerm),
  getStatistics: () => ipcRenderer.invoke('product-category:get-statistics'),
},  // Product API (Sprint 4 - FR-4.2 Product Management)
  product: {
    create: (productData, userId) => ipcRenderer.invoke('product:create', productData, userId),
    getById: (productId) => ipcRenderer.invoke('product:get-by-id', productId),
    getByCode: (productCode) => ipcRenderer.invoke('product:get-by-code', productCode),
    getAll: (filters) => ipcRenderer.invoke('product:get-all', filters),
    update: (productId, updateData, userId) => ipcRenderer.invoke('product:update', productId, updateData, userId),
    delete: (productId, userId) => ipcRenderer.invoke('product:delete', productId, userId),
    search: (searchTerm) => ipcRenderer.invoke('product:search', searchTerm),
    getLowStock: () => ipcRenderer.invoke('product:get-low-stock'),
    getStatistics: () => ipcRenderer.invoke('product:get-statistics'),
    // Variants (Retail)
    getVariants: (productId) => ipcRenderer.invoke('product:get-variants', productId),
    addVariant: (productId, variantData) => ipcRenderer.invoke('product:add-variant', productId, variantData),
    updateVariant: (variantId, variantData) => ipcRenderer.invoke('product:update-variant', variantId, variantData),
    deleteVariant: (variantId) => ipcRenderer.invoke('product:delete-variant', variantId),
    // Serial Numbers (Retail)
    getSerialNumbers: (productId, filters) => ipcRenderer.invoke('product:get-serial-numbers', productId, filters),
    addSerialNumber: (productId, serialData) => ipcRenderer.invoke('product:add-serial-number', productId, serialData),
    markSerialSold: (serialId, entityType, entityId, transactionId) => ipcRenderer.invoke('product:mark-serial-sold', serialId, entityType, entityId, transactionId),
    markSerialReturned: (serialId) => ipcRenderer.invoke('product:mark-serial-returned', serialId),
  },

  // Grain API (Sprint 4 - FR-4.3 Grain Management)
  grain: {
    create: (grainData, userId) => ipcRenderer.invoke('grain:create', grainData, userId),
    getById: (grainId) => ipcRenderer.invoke('grain:get-by-id', grainId),
    getByCode: (grainCode) => ipcRenderer.invoke('grain:get-by-code', grainCode),
    getAll: (filters) => ipcRenderer.invoke('grain:get-all', filters),
    update: (grainId, updateData, userId) => ipcRenderer.invoke('grain:update', grainId, updateData, userId),
    delete: (grainId, userId) => ipcRenderer.invoke('grain:delete', grainId, userId),
    search: (searchTerm) => ipcRenderer.invoke('grain:search', searchTerm),
    getLowStock: () => ipcRenderer.invoke('grain:get-low-stock'),
    getStatistics: () => ipcRenderer.invoke('grain:get-statistics'),
  },

  // Stock API (Sprint 4 - FR-4.4 Stock Management)
  stock: {
    add: (itemType, itemId, quantity, unitPrice, referenceType, referenceId, notes, userId) => 
      ipcRenderer.invoke('stock:add', itemType, itemId, quantity, unitPrice, referenceType, referenceId, notes, userId),
    remove: (itemType, itemId, quantity, referenceType, referenceId, notes, userId) => 
      ipcRenderer.invoke('stock:remove', itemType, itemId, quantity, referenceType, referenceId, notes, userId),
    adjust: (itemType, itemId, newQuantity, reason, notes, userId) => 
      ipcRenderer.invoke('stock:adjust', itemType, itemId, newQuantity, reason, notes, userId),
    getByItem: (itemType, itemId) => ipcRenderer.invoke('stock:get-by-item', itemType, itemId),
    getMovements: (itemType, itemId, limit) => ipcRenderer.invoke('stock:get-movements', itemType, itemId, limit),
    getAllMovements: (filters, limit) => ipcRenderer.invoke('stock:get-all-movements', filters, limit),
    getAllStock: (filters) => ipcRenderer.invoke('stock:get-all-stock', filters),
    getStatistics: () => ipcRenderer.invoke('stock:get-statistics'),
    getLevels: (filters) => ipcRenderer.invoke('stock:get-levels', filters),
    getBatches: (filters) => ipcRenderer.invoke('stock:get-batches', filters),
    clearAllBatches: (data) => ipcRenderer.invoke('stock:clear-all-batches', data),
    getReorderAlerts: () => ipcRenderer.invoke('stock:get-reorder-alerts'),
    getExpiryAlerts: (daysThreshold) => ipcRenderer.invoke('stock:get-expiry-alerts', daysThreshold),
    getDashboardAlerts: (industryType) => ipcRenderer.invoke('stock:get-dashboard-alerts', industryType),
  },

  // Transaction API (Sprint 5 - Transaction Processing)
  transaction: {
    createUniversal: (payload) => ipcRenderer.invoke('transaction:createUniversal', payload),
    processFarmerPurchase: (data, userId) => ipcRenderer.invoke('transaction:processFarmerPurchase', data, userId),
    processFarmerSaleGrain: (data, userId) => ipcRenderer.invoke('transaction:processFarmerSaleGrain', data, userId),
    getAll: (filters) => ipcRenderer.invoke('transaction:getAll', filters),
    getById: (transactionId) => ipcRenderer.invoke('transaction:getById', transactionId),
    getDailySummary: (date) => ipcRenderer.invoke('transaction:getDailySummary', date),
    getDailySummaries: (dateFrom, dateTo) => ipcRenderer.invoke('transaction:getDailySummaries', dateFrom, dateTo),
    getStatistics: (filters) => ipcRenderer.invoke('transaction:getStatistics', filters),
    validate: (data) => ipcRenderer.invoke('transaction:validate', data),
    
    // Sprint 6 - Transaction Edit/Delete/Void
    delete: (transactionId, userId, reason) => 
      ipcRenderer.invoke('transaction:delete', transactionId, userId, reason),
    edit: (transactionId, newData, userId) => 
      ipcRenderer.invoke('transaction:edit', transactionId, newData, userId),
    editMultiItem: (payload) => 
      ipcRenderer.invoke('transaction:editMultiItem', payload),
    canModify: (transactionId) => 
      ipcRenderer.invoke('transaction:canModify', transactionId),
    void: (transactionId, userId, reason) =>
      ipcRenderer.invoke('transaction:void', transactionId, userId, reason),
    
    // Sprint 6 - Multi-Item Transaction Support 🚀
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
    migrateToMultiItem: () => 
      ipcRenderer.invoke('transaction:migrateToMultiItem'),

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

  // Report API (Sprint 7 - Reporting & Analytics)
  report: {
    dailySales: (startDate, endDate) => 
      ipcRenderer.invoke('report:dailySales', startDate, endDate),
    outstandingBalance: () => 
      ipcRenderer.invoke('report:outstandingBalance'),
    stock: () => 
      ipcRenderer.invoke('report:stock'),
    customerLedger: (entityType, entityId, startDate, endDate) => 
      ipcRenderer.invoke('report:customerLedger', entityType, entityId, startDate, endDate),
    cashFlow: (startDate, endDate) => 
      ipcRenderer.invoke('report:cashFlow', startDate, endDate),
    transactionReceipt: (transactionId) => 
      ipcRenderer.invoke('report:transactionReceipt', transactionId),
    profitAndLoss: (startDate, endDate) =>
      ipcRenderer.invoke('report:profitAndLoss', startDate, endDate),
    stockMovement: (startDate, endDate) =>
      ipcRenderer.invoke('report:stockMovement', startDate, endDate),
    topSelling: (startDate, endDate, limit) =>
      ipcRenderer.invoke('report:topSelling', startDate, endDate, limit),
    deadStock: (daysSinceLastMovement) =>
      ipcRenderer.invoke('report:deadStock', daysSinceLastMovement),
    creditAging: () =>
      ipcRenderer.invoke('report:creditAging'),
  },

  // Backup API (Sprint 8 - Data Protection)
  backup: {
    create: (description, userId) => 
      ipcRenderer.invoke('backup:create', description, userId),
    list: () => 
      ipcRenderer.invoke('backup:list'),
    restore: (backupId, userId) => 
      ipcRenderer.invoke('backup:restore', backupId, userId),
    delete: (backupId, userId) => 
      ipcRenderer.invoke('backup:delete', backupId, userId),
    export: (backupId) => 
      ipcRenderer.invoke('backup:export', backupId),
    import: (userId) => 
      ipcRenderer.invoke('backup:import', userId),
    startAutoBackup: (timeOfDay, retainDays) =>
      ipcRenderer.invoke('backup:startAutoBackup', timeOfDay, retainDays),
    stopAutoBackup: () =>
      ipcRenderer.invoke('backup:stopAutoBackup'),
    autoBackupStatus: () =>
      ipcRenderer.invoke('backup:autoBackupStatus'),
    getDirectory: () => 
      ipcRenderer.invoke('backup:getDirectory'),
  },

  // Cloud Sync API (Paid optional feature)
  sync: {
    getConfig: () => ipcRenderer.invoke('sync:getConfig'),
    setConfig: (partial) => ipcRenderer.invoke('sync:setConfig', partial),
    getStatus: () => ipcRenderer.invoke('sync:getStatus'),
    verify: () => ipcRenderer.invoke('sync:verify'),
    estimate: () => ipcRenderer.invoke('sync:estimate'),
    push: () => ipcRenderer.invoke('sync:push'),
    pull: (options) => ipcRenderer.invoke('sync:pull', options),
  },

  // Data Archive API (Export & Cleanup)
  archive: {
    getSummary: () => 
      ipcRenderer.invoke('archive:getSummary'),
    exportCSV: (options) => 
      ipcRenderer.invoke('archive:exportCSV', options),
    deleteData: (options) => 
      ipcRenderer.invoke('archive:deleteData', options),
    deleteByDateRange: (dateFrom, dateTo, options) => 
      ipcRenderer.invoke('archive:deleteByDateRange', dateFrom, dateTo, options),
  },

  // Ledger API (Professional Ledger System)
  ledger: {
    getEntityDetails: (entityType, entityId) => 
      ipcRenderer.invoke('ledger:getEntityDetails', entityType, entityId),
    getEntityLedger: (entityType, entityId, options) => 
      ipcRenderer.invoke('ledger:getEntityLedger', entityType, entityId, options),
    addEntry: (data) => 
      ipcRenderer.invoke('ledger:addEntry', data),
    recordPayment: (data) => 
      ipcRenderer.invoke('ledger:recordPayment', data),
    updateBalance: (entityType, entityId, newBalance) => 
      ipcRenderer.invoke('ledger:updateBalance', entityType, entityId, newBalance),
    updateBalanceAndCredit: (entityType, entityId, balanceChange, creditChange, description) => 
      ipcRenderer.invoke('ledger:updateBalanceAndCredit', entityType, entityId, balanceChange, creditChange, description),
    getTypeSummary: (entityType) => 
      ipcRenderer.invoke('ledger:getTypeSummary', entityType),
    getStatistics: (entityType, entityId, options) => 
      ipcRenderer.invoke('ledger:getStatistics', entityType, entityId, options),
    export: (entityType, entityId, options) => 
      ipcRenderer.invoke('ledger:export', entityType, entityId, options),
    getOutstandingBalances: (entityType) => 
      ipcRenderer.invoke('ledger:getOutstandingBalances', entityType),
    getAllEntitiesWithBalances: (entityType, activeOnly) => 
      ipcRenderer.invoke('ledger:getAllEntitiesWithBalances', entityType, activeOnly),
    getSettlementPreview: (entityType, entityId) => 
      ipcRenderer.invoke('ledger:getSettlementPreview', entityType, entityId),
    settleBalance: (entityType, entityId, userId) => 
      ipcRenderer.invoke('ledger:settleBalance', entityType, entityId, userId),
  },

  // History / Audit Log API (Sprint 3 - Activity Logging)
  history: {
    getAll: (filters) => ipcRenderer.invoke('history:getAll', filters),
    getByEntity: (tableName, recordId) => ipcRenderer.invoke('history:getByEntity', tableName, recordId),
    getTableNames: () => ipcRenderer.invoke('history:getTableNames'),
    getStatistics: () => ipcRenderer.invoke('history:getStatistics'),
    clearOlder: (beforeDate) => ipcRenderer.invoke('history:clearOlder', beforeDate),
  },

  // User Management API (Sprint 6 - RBAC)
  userManagement: {
    list: () => ipcRenderer.invoke('user:list'),
    create: (userData, createdByUserId) => ipcRenderer.invoke('user:create', userData, createdByUserId),
    update: (userId, updates, updatedByUserId) => ipcRenderer.invoke('user:update', userId, updates, updatedByUserId),
    deactivate: (userId, deactivatedByUserId) => ipcRenderer.invoke('user:deactivate', userId, deactivatedByUserId),
    reactivate: (userId) => ipcRenderer.invoke('user:reactivate', userId),
    resetPassword: (userId, newPassword, resetByUserId) => ipcRenderer.invoke('user:reset-password', userId, newPassword, resetByUserId),
    unlock: (userId) => ipcRenderer.invoke('user:unlock', userId),
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
