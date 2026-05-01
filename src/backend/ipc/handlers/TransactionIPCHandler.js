import { ipcMain } from 'electron';
import TransactionService from '../../../services/transaction/TransactionService.js';

const transactionService = new TransactionService();

export function registerTransactionHandlers() {
  // Create universal transaction (Sprint 5 - Universal Transaction System)
  ipcMain.handle('transaction:createUniversal', async (event, payload) => {
    try {
      return await transactionService.createUniversalTransaction(payload);
    } catch (error) {
      console.error('Error creating universal transaction:', error);
      return { success: false, message: error.message };
    }
  });

  // Process farmer purchases product
  ipcMain.handle('transaction:processFarmerPurchase', async (event, data, userId) => {
    try {
      return await transactionService.processFarmerPurchase(data, userId);
    } catch (error) {
      console.error('Error processing farmer purchase:', error);
      throw error;
    }
  });

  // Process farmer sells grain
  ipcMain.handle('transaction:processFarmerSaleGrain', async (event, data, userId) => {
    try {
      return await transactionService.processFarmerSaleGrain(data, userId);
    } catch (error) {
      console.error('Error processing farmer grain sale:', error);
      throw error;
    }
  });

  // Get all transactions
  ipcMain.handle('transaction:getAll', async (event, filters) => {
    try {
      return await transactionService.getTransactions(filters);
    } catch (error) {
      console.error('Error getting transactions:', error);
      throw error;
    }
  });

  // Get transaction by ID
  ipcMain.handle('transaction:getById', async (event, transactionId) => {
    try {
      console.log('[TransactionIPCHandler] ==================== getById REQUEST ====================');
      console.log('[TransactionIPCHandler] Transaction ID requested:', transactionId);
      console.log('[TransactionIPCHandler] Transaction ID type:', typeof transactionId);
      
      const transaction = await transactionService.getById(transactionId);
      
      console.log('[TransactionIPCHandler] Transaction result:', transaction ? 'FOUND' : 'NOT FOUND');
      if (transaction) {
        console.log('[TransactionIPCHandler] Transaction number:', transaction.transaction_number);
        console.log('[TransactionIPCHandler] Total amount:', transaction.total_amount);
        console.log('[TransactionIPCHandler] Returning wrapped transaction data');
        console.log('[TransactionIPCHandler] ====================================================================');
        return { success: true, data: transaction };
      } else {
        console.error('[TransactionIPCHandler] Transaction not found for ID:', transactionId);
        console.log('[TransactionIPCHandler] ====================================================================');
        return { success: false, message: 'Transaction not found' };
      }
    } catch (error) {
      console.error('[TransactionIPCHandler] ==================== ERROR ====================');
      console.error('[TransactionIPCHandler] Error getting transaction:', error);
      console.error('[TransactionIPCHandler] Error message:', error.message);
      console.error('[TransactionIPCHandler] Error stack:', error.stack);
      console.error('[TransactionIPCHandler] ==========================================================');
      return { success: false, message: error.message };
    }
  });

  // Get daily summary
  ipcMain.handle('transaction:getDailySummary', async (event, date) => {
    try {
      return await transactionService.getDailySummary(date);
    } catch (error) {
      console.error('Error getting daily summary:', error);
      throw error;
    }
  });

  // Get daily summaries (date range)
  ipcMain.handle('transaction:getDailySummaries', async (event, dateFrom, dateTo) => {
    try {
      return await transactionService.getDailySummaries(dateFrom, dateTo);
    } catch (error) {
      console.error('Error getting daily summaries:', error);
      throw error;
    }
  });

  // Get transaction statistics
  ipcMain.handle('transaction:getStatistics', async (event, filters) => {
    try {
      return await transactionService.getStatistics(filters);
    } catch (error) {
      console.error('Error getting statistics:', error);
      throw error;
    }
  });

  // Validate transaction
  ipcMain.handle('transaction:validate', async (event, data) => {
    try {
      return transactionService.validateTransaction(data);
    } catch (error) {
      console.error('Error validating transaction:', error);
      throw error;
    }
  });

  // Delete transaction (Sprint 6)
  ipcMain.handle('transaction:delete', async (event, transactionId, userId, reason) => {
    try {
      console.log('[TransactionIPCHandler] Delete transaction request:', transactionId);
      return await transactionService.deleteTransaction(transactionId, userId, reason);
    } catch (error) {
      console.error('Error deleting transaction:', error);
      return { success: false, message: error.message };
    }
  });

  // Edit transaction (Sprint 6)
  ipcMain.handle('transaction:edit', async (event, transactionId, newData, userId) => {
    try {
      console.log('[TransactionIPCHandler] Edit transaction request:', transactionId);
      return await transactionService.editTransaction(transactionId, newData, userId);
    } catch (error) {
      console.error('Error editing transaction:', error);
      return { success: false, message: error.message };
    }
  });

  // Check if transaction can be modified (Sprint 6)
  ipcMain.handle('transaction:canModify', async (event, transactionId) => {
    try {
      return await transactionService.canModifyTransactionById(transactionId);
    } catch (error) {
      console.error('Error checking if transaction can be modified:', error);
      return { canModify: false, reason: error.message };
    }
  });

  // Void transaction (Sprint 5 - soft delete with audit trail)
  ipcMain.handle('transaction:void', async (event, transactionId, userId, reason) => {
    try {
      console.log('[TransactionIPCHandler] Void transaction request:', transactionId);
      return await transactionService.voidTransaction(transactionId, userId, reason);
    } catch (error) {
      console.error('Error voiding transaction:', error);
      return { success: false, message: error.message };
    }
  });

  console.log('Transaction IPC handlers registered');
}
