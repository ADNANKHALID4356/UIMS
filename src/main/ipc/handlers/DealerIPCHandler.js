const { ipcMain } = require('electron');
const DealerService = require('../../services/dealer/DealerService');

/**
 * DealerIPCHandler - IPC bridge for DealerService
 * Follows the same pattern as FarmerIPCHandler for consistency.
 */
class DealerIPCHandler {
  static register() {
    const dealerService = DealerService.getInstance();

    ipcMain.handle('dealer:create', async (event, dealerData, userId) => {
      try {
        const dealer = await dealerService.createDealer(dealerData, userId);
        return { success: true, data: dealer };
      } catch (error) {
        console.error('[DealerIPC] Create error:', error.message);
        return { success: false, error: error.message };
      }
    });

    ipcMain.handle('dealer:getById', async (event, dealerId) => {
      try {
        const dealer = await dealerService.getDealerById(dealerId);
        return { success: true, data: dealer };
      } catch (error) {
        console.error('[DealerIPC] GetById error:', error.message);
        return { success: false, error: error.message };
      }
    });

    ipcMain.handle('dealer:getBySpecificId', async (event, specificId) => {
      try {
        const dealer = await dealerService.getDealerBySpecificId(specificId);
        return { success: true, data: dealer };
      } catch (error) {
        console.error('[DealerIPC] GetBySpecificId error:', error.message);
        return { success: false, error: error.message };
      }
    });

    ipcMain.handle('dealer:getAll', async (event, activeOnly = true) => {
      try {
        const dealers = await dealerService.getAllDealers(activeOnly);
        return { success: true, data: dealers };
      } catch (error) {
        console.error('[DealerIPC] GetAll error:', error.message);
        return { success: false, error: error.message };
      }
    });

    ipcMain.handle('dealer:update', async (event, dealerId, dealerData, userId) => {
      try {
        const dealer = await dealerService.updateDealer(dealerId, dealerData, userId);
        return { success: true, data: dealer };
      } catch (error) {
        console.error('[DealerIPC] Update error:', error.message);
        return { success: false, error: error.message };
      }
    });

    ipcMain.handle('dealer:delete', async (event, dealerId, userId) => {
      try {
        const result = await dealerService.deleteDealer(dealerId, userId);
        return { success: true, data: result };
      } catch (error) {
        console.error('[DealerIPC] Delete error:', error.message);
        return { success: false, error: error.message };
      }
    });

    ipcMain.handle('dealer:search', async (event, searchTerm) => {
      try {
        const dealers = await dealerService.searchDealers(searchTerm);
        return { success: true, data: dealers };
      } catch (error) {
        console.error('[DealerIPC] Search error:', error.message);
        return { success: false, error: error.message };
      }
    });

    ipcMain.handle('dealer:getLedger', async (event, dealerId) => {
      try {
        const ledger = await dealerService.getDealerLedger(dealerId);
        return { success: true, data: ledger };
      } catch (error) {
        console.error('[DealerIPC] GetLedger error:', error.message);
        return { success: false, error: error.message };
      }
    });

    ipcMain.handle('dealer:getStatistics', async (event) => {
      try {
        const stats = await dealerService.getDealerStatistics();
        return { success: true, data: stats };
      } catch (error) {
        console.error('[DealerIPC] GetStatistics error:', error.message);
        return { success: false, error: error.message };
      }
    });

    console.log('[DealerIPCHandler] All dealer IPC handlers registered');
  }
}

module.exports = DealerIPCHandler;
