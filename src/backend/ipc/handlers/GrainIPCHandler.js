/**
 * GrainIPCHandler - Sprint 4 IPC Layer
 * Handles IPC communication for grain operations
 */

import { ipcMain } from 'electron';
import GrainService from '../../../services/grain/GrainService.js';

class GrainIPCHandler {
  constructor() {
    this.service = new GrainService();
  }

  /**
   * Register all grain IPC handlers
   */
  register() {
    // Create grain
    ipcMain.handle('grain:create', async (event, grainData, userId) => {
      try {
        return await this.service.create(grainData, userId);
      } catch (error) {
        console.error('IPC Error - grain:create:', error);
        return { success: false, message: error.message };
      }
    });

    // Get grain by ID
    ipcMain.handle('grain:get-by-id', async (event, grainId) => {
      try {
        return await this.service.getById(grainId);
      } catch (error) {
        console.error('IPC Error - grain:get-by-id:', error);
        return null;
      }
    });

    // Get grain by code
    ipcMain.handle('grain:get-by-code', async (event, grainCode) => {
      try {
        return await this.service.getByCode(grainCode);
      } catch (error) {
        console.error('IPC Error - grain:get-by-code:', error);
        return null;
      }
    });

    // Get all grains
    ipcMain.handle('grain:get-all', async (event, filters = {}) => {
      try {
        return await this.service.getAll(filters);
      } catch (error) {
        console.error('IPC Error - grain:get-all:', error);
        return [];
      }
    });

    // Update grain
    ipcMain.handle('grain:update', async (event, grainId, updateData, userId) => {
      try {
        return await this.service.update(grainId, updateData, userId);
      } catch (error) {
        console.error('IPC Error - grain:update:', error);
        return { success: false, message: error.message };
      }
    });

    // Delete grain
    ipcMain.handle('grain:delete', async (event, grainId, userId) => {
      try {
        return await this.service.delete(grainId, userId);
      } catch (error) {
        console.error('IPC Error - grain:delete:', error);
        return { success: false, message: error.message };
      }
    });

    // Search grains
    ipcMain.handle('grain:search', async (event, searchTerm) => {
      try {
        return await this.service.search(searchTerm);
      } catch (error) {
        console.error('IPC Error - grain:search:', error);
        return [];
      }
    });

    // Get low stock grains
    ipcMain.handle('grain:get-low-stock', async () => {
      try {
        return await this.service.getLowStockGrains();
      } catch (error) {
        console.error('IPC Error - grain:get-low-stock:', error);
        return [];
      }
    });

    // Get grain statistics
    ipcMain.handle('grain:get-statistics', async () => {
      try {
        return await this.service.getStatistics();
      } catch (error) {
        console.error('IPC Error - grain:get-statistics:', error);
        return { total_grains: 0, active_grains: 0, low_stock_grains: 0, total_grain_value: 0 };
      }
    });

    console.log('Grain IPC handlers registered');
  }
}

export default GrainIPCHandler;
