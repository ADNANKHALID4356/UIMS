import { ipcMain } from 'electron';
import TransactionService from '../../services/transaction/TransactionService.js';

const transactionService = new TransactionService();

export function registerTransactionHandlers() {
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
      return await transactionService.getById(transactionId);
    } catch (error) {
      console.error('Error getting transaction:', error);
      throw error;
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

  console.log('Transaction IPC handlers registered');
}
