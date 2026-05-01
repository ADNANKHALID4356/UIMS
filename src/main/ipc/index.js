import { ipcMain } from 'electron';
import { LicenseIPCHandler } from './handlers/LicenseIPCHandler';
import { AuthIPCHandler } from './handlers/AuthIPCHandler';
import { DatabaseIPCHandler } from './handlers/DatabaseIPCHandler';
import { SystemIPCHandler } from './handlers/SystemIPCHandler';
import { FarmerIPCHandler } from './handlers/FarmerIPCHandler';
import { DealerIPCHandler } from './handlers/DealerIPCHandler';
import { CompanyIPCHandler } from './handlers/CompanyIPCHandler';
import { registerTransactionHandlers } from './handlers/TransactionIPCHandler.js';
import { OrganizationIPCHandler } from './handlers/OrganizationIPCHandler.js';

/**
 * Register all IPC handlers for communication between main and renderer process
 */
export const registerIPCHandlers = () => {
  // Organization handlers (v2.0 Sprint 1 - Industry Configuration)
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

  // Dealer handlers (v2.0 Sprint 2 - Entity Management)
  DealerIPCHandler.register();

  // Company/Supplier handlers (v2.0 Sprint 2 - Entity Management)
  CompanyIPCHandler.register();

  // Transaction handlers (Sprint 5)
  registerTransactionHandlers();

  console.log('All IPC handlers registered successfully');
};
