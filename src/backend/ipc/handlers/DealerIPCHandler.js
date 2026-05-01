import { ipcMain } from 'electron';
import { DealerService } from '../../../services/dealer/DealerService.js';

/**
 * Dealer IPC Handler - Handles IPC communication for dealer operations
 * Sprint 3 - FR-3.2 Dealer Management
 */
export class DealerIPCHandler {
  dealerService = null;

  constructor() {
    this.dealerService = DealerService.getInstance();
  }

  /**
   * Register all dealer IPC handlers
   */
  register() {
    // Create dealer
    ipcMain.handle('dealer:create', async (event, dealerData, userId) => {
      try {
        const dealer = await this.dealerService.createDealer(dealerData, userId);
        return { success: true, data: dealer };
      } catch (error) {
        console.error('IPC dealer:create error:', error);
        return { success: false, error: error.message };
      }
    });

    // Get dealer by ID
    ipcMain.handle('dealer:getById', async (event, dealerId) => {
      try {
        const dealer = await this.dealerService.getDealerById(dealerId);
        return { success: true, data: dealer };
      } catch (error) {
        console.error('IPC dealer:getById error:', error);
        return { success: false, error: error.message };
      }
    });

    // Get dealer by specific ID
    ipcMain.handle('dealer:getBySpecificId', async (event, specificId) => {
      try {
        const dealer = await this.dealerService.getDealerBySpecificId(specificId);
        return { success: true, data: dealer };
      } catch (error) {
        console.error('IPC dealer:getBySpecificId error:', error);
        return { success: false, error: error.message };
      }
    });

    // Get all dealers
    ipcMain.handle('dealer:getAll', async (event, activeOnly = true) => {
      try {
        const dealers = await this.dealerService.getAllDealers(activeOnly);
        return { success: true, data: dealers };
      } catch (error) {
        console.error('IPC dealer:getAll error:', error);
        return { success: false, error: error.message };
      }
    });

    // Update dealer
    ipcMain.handle('dealer:update', async (event, dealerId, dealerData, userId) => {
      try {
        const dealer = await this.dealerService.updateDealer(dealerId, dealerData, userId);
        return { success: true, data: dealer };
      } catch (error) {
        console.error('IPC dealer:update error:', error);
        return { success: false, error: error.message };
      }
    });

    // Delete dealer
    ipcMain.handle('dealer:delete', async (event, dealerId, userId) => {
      try {
        const result = await this.dealerService.deleteDealer(dealerId, userId);
        return { success: true, data: result };
      } catch (error) {
        console.error('IPC dealer:delete error:', error);
        return { success: false, error: error.message };
      }
    });

    // Search dealers
    ipcMain.handle('dealer:search', async (event, searchTerm) => {
      try {
        console.log('[DealerIPCHandler] Search request received:', searchTerm);
        const dealers = await this.dealerService.searchDealers(searchTerm);
        console.log('[DealerIPCHandler] Search results count:', dealers.length);
        return { success: true, data: dealers };
      } catch (error) {
        console.error('IPC dealer:search error:', error);
        return { success: false, error: error.message };
      }
    });

    // Get dealer ledger
    ipcMain.handle('dealer:getLedger', async (event, dealerId) => {
      try {
        const ledger = await this.dealerService.getDealerLedger(dealerId);
        return { success: true, data: ledger };
      } catch (error) {
        console.error('IPC dealer:getLedger error:', error);
        return { success: false, error: error.message };
      }
    });

    // Get dealer statistics
    ipcMain.handle('dealer:getStats', async () => {
      try {
        const stats = await this.dealerService.getDealerStatistics();
        return { success: true, data: stats };
      } catch (error) {
        console.error('IPC dealer:getStats error:', error);
        return { success: false, error: error.message };
      }
    });

    console.log('Dealer IPC handlers registered');
  }
}
