import { ipcMain } from 'electron';
import { LedgerService } from '../../../services/ledger/LedgerService.js';

/**
 * Ledger IPC Handler - Professional Ledger Management System
 * Handles all ledger-related IPC communication for Farmers, Dealers, and Companies
 */
class LedgerIPCHandler {
  constructor() {
    this.ledgerService = new LedgerService();
  }

  /**
   * Register all ledger IPC handlers
   */
  register() {
    // Get entity details with balance
    ipcMain.handle('ledger:getEntityDetails', async (event, entityType, entityId) => {
      try {
        const result = await this.ledgerService.getEntityDetails(entityType, entityId);
        return result;
      } catch (error) {
        console.error('IPC ledger:getEntityDetails error:', error);
        return { success: false, error: error.message };
      }
    });

    // Get complete ledger for an entity
    ipcMain.handle('ledger:getEntityLedger', async (event, entityType, entityId, options) => {
      try {
        const result = await this.ledgerService.getEntityLedger(entityType, entityId, options);
        return result;
      } catch (error) {
        console.error('IPC ledger:getEntityLedger error:', error);
        return { success: false, error: error.message };
      }
    });

    // Add manual ledger entry
    ipcMain.handle('ledger:addEntry', async (event, data) => {
      try {
        const result = await this.ledgerService.addLedgerEntry(data);
        return result;
      } catch (error) {
        console.error('IPC ledger:addEntry error:', error);
        return { success: false, error: error.message };
      }
    });

    // Record payment received
    ipcMain.handle('ledger:recordPayment', async (event, data) => {
      try {
        const result = await this.ledgerService.recordPayment(data);
        return result;
      } catch (error) {
        console.error('IPC ledger:recordPayment error:', error);
        return { success: false, error: error.message };
      }
    });

    // Update entity balance
    ipcMain.handle('ledger:updateBalance', async (event, entityType, entityId, newBalance) => {
      try {
        const result = await this.ledgerService.updateEntityBalance(entityType, entityId, newBalance);
        return result;
      } catch (error) {
        console.error('IPC ledger:updateBalance error:', error);
        return { success: false, error: error.message };
      }
    });

    // Update entity balance and credit together
    ipcMain.handle('ledger:updateBalanceAndCredit', async (event, entityType, entityId, balanceChange, creditChange, description) => {
      try {
        const result = await this.ledgerService.updateEntityBalanceAndCredit(
          entityType, entityId, balanceChange, creditChange, description
        );
        return result;
      } catch (error) {
        console.error('IPC ledger:updateBalanceAndCredit error:', error);
        return { success: false, error: error.message };
      }
    });

    // Get summary for all entities of a type
    ipcMain.handle('ledger:getTypeSummary', async (event, entityType) => {
      try {
        const result = await this.ledgerService.getEntityTypeSummary(entityType);
        return result;
      } catch (error) {
        console.error('IPC ledger:getTypeSummary error:', error);
        return { success: false, error: error.message };
      }
    });

    // Get ledger statistics for an entity
    ipcMain.handle('ledger:getStatistics', async (event, entityType, entityId, options) => {
      try {
        const result = await this.ledgerService.getLedgerStatistics(entityType, entityId, options);
        return result;
      } catch (error) {
        console.error('IPC ledger:getStatistics error:', error);
        return { success: false, error: error.message };
      }
    });

    // Export ledger data for an entity
    ipcMain.handle('ledger:export', async (event, entityType, entityId, options) => {
      try {
        const result = await this.ledgerService.exportLedgerData(entityType, entityId, options);
        return result;
      } catch (error) {
        console.error('IPC ledger:export error:', error);
        return { success: false, error: error.message };
      }
    });

    // Get outstanding balances summary
    ipcMain.handle('ledger:getOutstandingBalances', async (event, entityType) => {
      try {
        const result = await this.ledgerService.getOutstandingBalances(entityType);
        return result;
      } catch (error) {
        console.error('IPC ledger:getOutstandingBalances error:', error);
        return { success: false, error: error.message };
      }
    });

    // Get all entities with their balances
    ipcMain.handle('ledger:getAllEntitiesWithBalances', async (event, entityType, activeOnly) => {
      try {
        const result = await this.ledgerService.getAllEntitiesWithBalances(entityType, activeOnly);
        return result;
      } catch (error) {
        console.error('IPC ledger:getAllEntitiesWithBalances error:', error);
        return { success: false, error: error.message };
      }
    });

    // Get settlement preview - shows what will happen without committing
    ipcMain.handle('ledger:getSettlementPreview', async (event, entityType, entityId) => {
      try {
        const result = await this.ledgerService.getSettlementPreview(entityType, entityId);
        return result;
      } catch (error) {
        console.error('IPC ledger:getSettlementPreview error:', error);
        return { success: false, error: error.message };
      }
    });

    // Calculate and settle balance - performs the actual settlement
    ipcMain.handle('ledger:settleBalance', async (event, entityType, entityId, userId) => {
      try {
        const result = await this.ledgerService.calculateAndSettleBalance(entityType, entityId, userId);
        return result;
      } catch (error) {
        console.error('IPC ledger:settleBalance error:', error);
        return { success: false, error: error.message };
      }
    });

    console.log('Ledger IPC handlers registered successfully');
  }
}

// Export function for registration
export const registerLedgerHandlers = () => {
  const handler = new LedgerIPCHandler();
  handler.register();
};

export { LedgerIPCHandler };
