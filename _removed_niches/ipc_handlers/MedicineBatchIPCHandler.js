/**
 * MedicineBatchIPCHandler - Sprint 4 (FR-4.6)
 * IPC handlers for medicine batch operations (Medical industry)
 */

import { ipcMain } from 'electron';
import MedicineBatchService from '../../../services/medicine/MedicineBatchService.js';

class MedicineBatchIPCHandler {
  constructor() {
    this.service = new MedicineBatchService();
  }

  register() {
    // Create batch
    ipcMain.handle('medicine-batch:create', async (event, batchData, userId) => {
      try {
        return await this.service.create(batchData, userId);
      } catch (error) {
        console.error('IPC Error - medicine-batch:create:', error);
        return { success: false, message: error.message };
      }
    });

    // Get batch by ID
    ipcMain.handle('medicine-batch:get-by-id', async (event, batchId) => {
      try {
        return await this.service.getById(batchId);
      } catch (error) {
        console.error('IPC Error - medicine-batch:get-by-id:', error);
        return null;
      }
    });

    // Get all batches
    ipcMain.handle('medicine-batch:get-all', async (event, filters = {}) => {
      try {
        return await this.service.getAll(filters);
      } catch (error) {
        console.error('IPC Error - medicine-batch:get-all:', error);
        return [];
      }
    });

    // Update batch
    ipcMain.handle('medicine-batch:update', async (event, batchId, updateData, userId) => {
      try {
        return await this.service.update(batchId, updateData, userId);
      } catch (error) {
        console.error('IPC Error - medicine-batch:update:', error);
        return { success: false, message: error.message };
      }
    });

    // Delete batch
    ipcMain.handle('medicine-batch:delete', async (event, batchId, userId) => {
      try {
        return await this.service.delete(batchId, userId);
      } catch (error) {
        console.error('IPC Error - medicine-batch:delete:', error);
        return { success: false, message: error.message };
      }
    });

    // Search batches
    ipcMain.handle('medicine-batch:search', async (event, searchTerm) => {
      try {
        return await this.service.search(searchTerm);
      } catch (error) {
        console.error('IPC Error - medicine-batch:search:', error);
        return [];
      }
    });

    // Get expiry alerts
    ipcMain.handle('medicine-batch:get-expiry-alerts', async (event, days = 90) => {
      try {
        return await this.service.getExpiryAlerts(days);
      } catch (error) {
        console.error('IPC Error - medicine-batch:get-expiry-alerts:', error);
        return { expired: [], critical: [], warning: [], notice: [], total_alert_count: 0 };
      }
    });

    // Get expiry summary (for dashboard widget)
    ipcMain.handle('medicine-batch:get-expiry-summary', async () => {
      try {
        return await this.service.getExpirySummary();
      } catch (error) {
        console.error('IPC Error - medicine-batch:get-expiry-summary:', error);
        return { expired_count: 0, expiring_30d: 0, expiring_60d: 0, expiring_90d: 0 };
      }
    });

    // Get FEFO batch for a product
    ipcMain.handle('medicine-batch:get-fefo', async (event, productId) => {
      try {
        return await this.service.getFEFOBatch(productId);
      } catch (error) {
        console.error('IPC Error - medicine-batch:get-fefo:', error);
        return null;
      }
    });

    // Deduct from batch
    ipcMain.handle('medicine-batch:deduct', async (event, batchId, quantity) => {
      try {
        return await this.service.deductFromBatch(batchId, quantity);
      } catch (error) {
        console.error('IPC Error - medicine-batch:deduct:', error);
        return { success: false, message: error.message };
      }
    });

    // Add to batch
    ipcMain.handle('medicine-batch:add-quantity', async (event, batchId, quantity) => {
      try {
        return await this.service.addToBatch(batchId, quantity);
      } catch (error) {
        console.error('IPC Error - medicine-batch:add-quantity:', error);
        return { success: false, message: error.message };
      }
    });

    // Get controlled substance batches
    ipcMain.handle('medicine-batch:get-controlled', async () => {
      try {
        return await this.service.getControlledSubstanceBatches();
      } catch (error) {
        console.error('IPC Error - medicine-batch:get-controlled:', error);
        return [];
      }
    });

    // Get batch statistics
    ipcMain.handle('medicine-batch:get-statistics', async () => {
      try {
        return await this.service.getStatistics();
      } catch (error) {
        console.error('IPC Error - medicine-batch:get-statistics:', error);
        return { total_batches: 0, active_batches: 0, expired_batches: 0, expiring_soon: 0, total_batch_value: 0 };
      }
    });

    console.log('Medicine Batch IPC handlers registered');
  }
}

export default MedicineBatchIPCHandler;
