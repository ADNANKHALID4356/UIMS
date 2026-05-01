/**
 * StockIPCHandler - Sprint 4 IPC Layer
 * Handles IPC communication for stock operations
 */

import { ipcMain } from 'electron';
import StockService from '../../../services/stock/StockService.js';

class StockIPCHandler {
  constructor() {
    this.service = new StockService();
  }

  /**
   * Register all stock IPC handlers
   */
  register() {
    // Add stock (IN movement)
    ipcMain.handle('stock:add', async (event, itemType, itemId, quantity, unitPrice, referenceType, referenceId, notes, userId) => {
      try {
        return await this.service.addStock(itemType, itemId, quantity, unitPrice, referenceType, referenceId, notes, userId);
      } catch (error) {
        console.error('IPC Error - stock:add:', error);
        return { success: false, message: error.message };
      }
    });

    // Remove stock (OUT movement)
    ipcMain.handle('stock:remove', async (event, itemType, itemId, quantity, referenceType, referenceId, notes, userId) => {
      try {
        return await this.service.removeStock(itemType, itemId, quantity, referenceType, referenceId, notes, userId);
      } catch (error) {
        console.error('IPC Error - stock:remove:', error);
        return { success: false, message: error.message };
      }
    });

    // Adjust stock (ADJUSTMENT movement)
    ipcMain.handle('stock:adjust', async (event, itemType, itemId, newQuantity, reason, notes, userId) => {
      try {
        return await this.service.adjustStock(itemType, itemId, newQuantity, reason, notes, userId);
      } catch (error) {
        console.error('IPC Error - stock:adjust:', error);
        return { success: false, message: error.message };
      }
    });

    // Get stock by item
    ipcMain.handle('stock:get-by-item', async (event, itemType, itemId) => {
      try {
        return await this.service.getStockByItem(itemType, itemId);
      } catch (error) {
        console.error('IPC Error - stock:get-by-item:', error);
        return null;
      }
    });

    // Get movements by item
    ipcMain.handle('stock:get-movements', async (event, itemType, itemId, limit = 50) => {
      try {
        return await this.service.getMovementsByItem(itemType, itemId, limit);
      } catch (error) {
        console.error('IPC Error - stock:get-movements:', error);
        return [];
      }
    });

    // Get all movements
    ipcMain.handle('stock:get-all-movements', async (event, filters = {}, limit = 100) => {
      try {
        return await this.service.getAllMovements(filters, limit);
      } catch (error) {
        console.error('IPC Error - stock:get-all-movements:', error);
        return [];
      }
    });

    // Get all stock
    ipcMain.handle('stock:get-all-stock', async (event, filters = {}) => {
      try {
        return await this.service.getAllStock(filters);
      } catch (error) {
        console.error('IPC Error - stock:get-all-stock:', error);
        return [];
      }
    });

    // Get stock statistics
    ipcMain.handle('stock:get-statistics', async () => {
      try {
        return await this.service.getStatistics();
      } catch (error) {
        console.error('IPC Error - stock:get-statistics:', error);
        return { 
          total_items: 0, 
          total_products: 0, 
          total_grains: 0, 
          total_stock_value: 0,
          out_of_stock_items: 0,
          total_in_movements: 0,
          total_out_movements: 0,
          total_adjustments: 0
        };
      }
    });

    // Get stock levels (consolidated view)
    ipcMain.handle('stock:get-levels', async (event, filters = {}) => {
      try {
        return await this.service.getStockLevels(filters);
      } catch (error) {
        console.error('IPC Error - stock:get-levels:', error);
        return [];
      }
    });

    // Get stock batches (detailed view with prices)
    ipcMain.handle('stock:get-batches', async (event, filters = {}) => {
      try {
        return await this.service.getStockBatches(filters);
      } catch (error) {
        console.error('IPC Error - stock:get-batches:', error);
        return [];
      }
    });

    // Clear all stock batches (set all to 0)
    ipcMain.handle('stock:clear-all-batches', async (event, { itemType, itemId, reason, notes, userId }) => {
      try {
        return await this.service.clearAllBatches(itemType, itemId, reason, notes, userId);
      } catch (error) {
        console.error('IPC Error - stock:clear-all-batches:', error);
        return { success: false, message: error.message };
      }
    });

    // Get reorder alerts (items below reorder level)
    ipcMain.handle('stock:get-reorder-alerts', async () => {
      try {
        return await this.service.getReorderAlerts();
      } catch (error) {
        console.error('IPC Error - stock:get-reorder-alerts:', error);
        return { success: false, total: 0, items: [] };
      }
    });

    // Get expiry alerts (medicine batches expiring within threshold)
    ipcMain.handle('stock:get-expiry-alerts', async (event, daysThreshold = 90) => {
      try {
        return await this.service.getExpiryAlerts(daysThreshold);
      } catch (error) {
        console.error('IPC Error - stock:get-expiry-alerts:', error);
        return { success: false, total: 0, items: [] };
      }
    });

    // Get combined dashboard alerts
    ipcMain.handle('stock:get-dashboard-alerts', async (event, industryType) => {
      try {
        return await this.service.getDashboardAlerts(industryType);
      } catch (error) {
        console.error('IPC Error - stock:get-dashboard-alerts:', error);
        return { success: false, message: error.message };
      }
    });

    console.log('Stock IPC handlers registered');
  }
}

export default StockIPCHandler;
