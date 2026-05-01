import { ipcMain } from 'electron';
import CommissionService from '../../../services/commission/CommissionService.js';

/**
 * Commission IPC Handler — Real Estate Commission Management
 */
class CommissionIPCHandler {
  constructor() {
    this.service = new CommissionService();
  }

  register() {
    // Get all commissions
    ipcMain.handle('commission:getAll', async (event, filters) => {
      try {
        return await this.service.getAll(filters);
      } catch (error) {
        console.error('[CommissionIPC] Error:', error);
        return { success: false, message: error.message };
      }
    });

    // Get commission by ID
    ipcMain.handle('commission:getById', async (event, commissionId) => {
      try {
        return await this.service.getById(commissionId);
      } catch (error) {
        console.error('[CommissionIPC] Error:', error);
        return { success: false, message: error.message };
      }
    });

    // Create commission
    ipcMain.handle('commission:create', async (event, data, userId) => {
      try {
        return await this.service.createCommission(data, userId);
      } catch (error) {
        console.error('[CommissionIPC] Error:', error);
        return { success: false, message: error.message };
      }
    });

    // Update commission
    ipcMain.handle('commission:update', async (event, commissionId, data, userId) => {
      try {
        return await this.service.update(commissionId, data, userId);
      } catch (error) {
        console.error('[CommissionIPC] Error:', error);
        return { success: false, message: error.message };
      }
    });

    // Record payment
    ipcMain.handle('commission:recordPayment', async (event, commissionId, paymentData, userId) => {
      try {
        return await this.service.recordPayment(commissionId, paymentData, userId);
      } catch (error) {
        console.error('[CommissionIPC] Error:', error);
        return { success: false, message: error.message };
      }
    });

    // Cancel commission
    ipcMain.handle('commission:cancel', async (event, commissionId, reason, userId) => {
      try {
        return await this.service.cancel(commissionId, reason, userId);
      } catch (error) {
        console.error('[CommissionIPC] Error:', error);
        return { success: false, message: error.message };
      }
    });

    // Get statistics
    ipcMain.handle('commission:getStatistics', async (event, filters) => {
      try {
        return await this.service.getStatistics(filters);
      } catch (error) {
        console.error('[CommissionIPC] Error:', error);
        return { success: false, message: error.message };
      }
    });

    // Get commissions by agent
    ipcMain.handle('commission:getByAgent', async (event, agentId) => {
      try {
        return await this.service.getByAgent(agentId);
      } catch (error) {
        console.error('[CommissionIPC] Error:', error);
        return { success: false, message: error.message };
      }
    });

    console.log('[CommissionIPCHandler] All commission IPC handlers registered');
  }
}

export default CommissionIPCHandler;
