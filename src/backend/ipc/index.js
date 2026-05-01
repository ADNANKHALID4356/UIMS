import { ipcMain } from 'electron';
import { LicenseIPCHandler } from './handlers/LicenseIPCHandler';
import { AuthIPCHandler } from './handlers/AuthIPCHandler';
import { DatabaseIPCHandler } from './handlers/DatabaseIPCHandler';
import { SystemIPCHandler } from './handlers/SystemIPCHandler';
import { FarmerIPCHandler } from './handlers/FarmerIPCHandler';
import { DealerIPCHandler } from './handlers/DealerIPCHandler.js';
import { CompanyIPCHandler } from './handlers/CompanyIPCHandler.js';
import ProductCategoryIPCHandler from './handlers/ProductCategoryIPCHandler.js';
import ProductIPCHandler from './handlers/ProductIPCHandler.js';
import GrainIPCHandler from './handlers/GrainIPCHandler.js';
import StockIPCHandler from './handlers/StockIPCHandler.js';
import { registerTransactionHandlers } from './handlers/TransactionIPCHandler.js';
import { registerTransactionV2Handlers } from './handlers/TransactionV2IPCHandler.js';
import { registerReportHandlers } from './handlers/ReportIPCHandler.js';
import { registerBackupHandlers } from './handlers/BackupIPCHandler.js';
import { registerLedgerHandlers } from './handlers/LedgerIPCHandler.js';
import { OrganizationIPCHandler } from './handlers/OrganizationIPCHandler.js';
import { HistoryIPCHandler } from './handlers/HistoryIPCHandler.js';
import UserManagementIPCHandler from './handlers/UserManagementIPCHandler.js';
import { registerSyncHandlers } from './handlers/SyncIPCHandler.js';

/**
 * Register all IPC handlers for communication between main and renderer process
 */
export const registerIPCHandlers = () => {
  // Organization handlers (v2.0 - Industry Configuration)
  OrganizationIPCHandler.register();

  // License handlers
  LicenseIPCHandler.register();

  // Auth handlers
  AuthIPCHandler.register();

  // Database handlers
  DatabaseIPCHandler.register();

  // System handlers
  SystemIPCHandler.register();

  // Farmer handlers (Sprint 2)
  FarmerIPCHandler.register();

  // Dealer handlers (Sprint 3)
  const dealerHandler = new DealerIPCHandler();
  dealerHandler.register();

  // Company handlers (Sprint 3)
  const companyHandler = new CompanyIPCHandler();
  companyHandler.register();

  // Product Category handlers (Sprint 4)
  const categoryHandler = new ProductCategoryIPCHandler();
  categoryHandler.register();

  // Product handlers (Sprint 4)
  const productHandler = new ProductIPCHandler();
  productHandler.register();

  // Grain handlers (Sprint 4)
  const grainHandler = new GrainIPCHandler();
  grainHandler.register();

  // Stock handlers (Sprint 4)
  const stockHandler = new StockIPCHandler();
  stockHandler.register();

  // Transaction handlers (Sprint 5)
  registerTransactionHandlers();

  // Transaction V2 handlers (Sprint 6 - Multi-Item Support)
  registerTransactionV2Handlers(ipcMain);

  // Report handlers (Sprint 7 - Reporting & Analytics)
  registerReportHandlers();

  // Backup handlers (Sprint 8 - Data Protection)
  registerBackupHandlers();

  // Cloud Sync handlers (Paid optional feature)
  registerSyncHandlers();

  // Ledger handlers (Professional Ledger System)
  registerLedgerHandlers();

  // History / Audit Log handlers (Sprint 3)
  HistoryIPCHandler.register();

  // User Management handlers (Sprint 6 - RBAC)
  const userMgmtHandler = new UserManagementIPCHandler();
  userMgmtHandler.register();

  console.log('All IPC handlers registered successfully');
};
