import { ipcMain } from 'electron';
import { FarmerService } from '../../../services/farmer/FarmerService.js';

/**
 * Farmer IPC Handler - Handles all farmer-related IPC communication
 * All operations work completely offline with SQLite
 */
export class FarmerIPCHandler {
  static farmerService = null;

  /**
   * Register all farmer IPC handlers
   */
  static register() {
    this.farmerService = FarmerService.getInstance();

    // Create farmer
    ipcMain.handle('farmer:create', async (event, farmerData, userId) => {
      try {
        const result = await this.farmerService.createFarmer(farmerData, userId);
        return { success: true, data: result };
      } catch (error) {
        console.error('IPC farmer:create error:', error);
        return { success: false, error: error.message };
      }
    });

    // Get farmer by ID
    ipcMain.handle('farmer:getById', async (event, farmerId) => {
      try {
        const result = await this.farmerService.getFarmerById(farmerId);
        return { success: true, data: result };
      } catch (error) {
        console.error('IPC farmer:getById error:', error);
        return { success: false, error: error.message };
      }
    });

    // Get farmer by Specific ID
    ipcMain.handle('farmer:getBySpecificId', async (event, specificId) => {
      try {
        const result = await this.farmerService.getFarmerBySpecificId(specificId);
        return { success: true, data: result };
      } catch (error) {
        console.error('IPC farmer:getBySpecificId error:', error);
        return { success: false, error: error.message };
      }
    });

    // Get all farmers
    ipcMain.handle('farmer:getAll', async (event, activeOnly = true) => {
      try {
        const result = await this.farmerService.getAllFarmers(activeOnly);
        return { success: true, data: result };
      } catch (error) {
        console.error('IPC farmer:getAll error:', error);
        return { success: false, error: error.message };
      }
    });

    // Update farmer
    ipcMain.handle('farmer:update', async (event, farmerId, farmerData, userId) => {
      try {
        const result = await this.farmerService.updateFarmer(farmerId, farmerData, userId);
        return { success: true, data: result };
      } catch (error) {
        console.error('IPC farmer:update error:', error);
        return { success: false, error: error.message };
      }
    });

    // Delete/Deactivate farmer
    ipcMain.handle('farmer:delete', async (event, farmerId, userId) => {
      try {
        const result = await this.farmerService.deleteFarmer(farmerId, userId);
        return { success: true, data: result };
      } catch (error) {
        console.error('IPC farmer:delete error:', error);
        return { success: false, error: error.message };
      }
    });

    // Search farmers
    ipcMain.handle('farmer:search', async (event, searchTerm) => {
      try {
        const result = await this.farmerService.searchFarmers(searchTerm);
        return { success: true, data: result };
      } catch (error) {
        console.error('IPC farmer:search error:', error);
        return { success: false, error: error.message };
      }
    });

    // Get farmer ledger
    ipcMain.handle('farmer:getLedger', async (event, farmerId) => {
      try {
        const result = await this.farmerService.getFarmerLedger(farmerId);
        return { success: true, data: result };
      } catch (error) {
        console.error('IPC farmer:getLedger error:', error);
        return { success: false, error: error.message };
      }
    });

    // Get farmer statistics
    ipcMain.handle('farmer:getStatistics', async () => {
      try {
        const result = await this.farmerService.getFarmerStatistics();
        return { success: true, data: result };
      } catch (error) {
        console.error('IPC farmer:getStatistics error:', error);
        return { success: false, error: error.message };
      }
    });

    console.log('Farmer IPC handlers registered');
  }
}
