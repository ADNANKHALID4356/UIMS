import { ipcMain } from 'electron';
import ControlledSubstanceService from '../../../services/medicine/ControlledSubstanceService.js';

const csService = new ControlledSubstanceService();

/**
 * IPC Handlers for Controlled Substance Register (Medical compliance)
 */
export function registerControlledSubstanceHandlers() {
  console.log('[ControlledSubstanceIPC] Registering handlers...');

  // Record a movement (IN / OUT)
  ipcMain.handle('controlledSubstance:record', async (event, data) => {
    try {
      return await csService.recordMovement(data);
    } catch (error) {
      console.error('[ControlledSubstanceIPC] Error:', error);
      return { success: false, message: error.message };
    }
  });

  // Get register entries with filters
  ipcMain.handle('controlledSubstance:getRegister', async (event, filters) => {
    try {
      return await csService.getRegister(filters);
    } catch (error) {
      console.error('[ControlledSubstanceIPC] Error:', error);
      return { success: false, message: error.message };
    }
  });

  // Get balance for a specific medicine
  ipcMain.handle('controlledSubstance:getBalance', async (event, medicineId) => {
    try {
      return await csService.getBalance(medicineId);
    } catch (error) {
      console.error('[ControlledSubstanceIPC] Error:', error);
      return { success: false, message: error.message };
    }
  });

  console.log('[ControlledSubstanceIPC] ✅ Handlers registered');
}
