import { ipcMain } from 'electron';
import PrescriptionService from '../../../services/prescription/PrescriptionService.js';

/**
 * Prescription IPC Handler — Medical Industry Prescription Management
 */
class PrescriptionIPCHandler {
  constructor() {
    this.service = new PrescriptionService();
  }

  register() {
    // Get all prescriptions
    ipcMain.handle('prescription:getAll', async (event, filters) => {
      try {
        return await this.service.getAll(filters);
      } catch (error) {
        console.error('[PrescriptionIPC] Error:', error);
        return { success: false, message: error.message };
      }
    });

    // Get prescription by ID (with items)
    ipcMain.handle('prescription:getById', async (event, prescriptionId) => {
      try {
        return await this.service.getById(prescriptionId);
      } catch (error) {
        console.error('[PrescriptionIPC] Error:', error);
        return { success: false, message: error.message };
      }
    });

    // Create prescription
    ipcMain.handle('prescription:create', async (event, data, userId) => {
      try {
        return await this.service.createPrescription(data, userId);
      } catch (error) {
        console.error('[PrescriptionIPC] Error:', error);
        return { success: false, message: error.message };
      }
    });

    // Update prescription
    ipcMain.handle('prescription:update', async (event, prescriptionId, data, userId) => {
      try {
        return await this.service.updatePrescription(prescriptionId, data, userId);
      } catch (error) {
        console.error('[PrescriptionIPC] Error:', error);
        return { success: false, message: error.message };
      }
    });

    // Add item to prescription
    ipcMain.handle('prescription:addItem', async (event, prescriptionId, item, userId) => {
      try {
        return await this.service.addItem(prescriptionId, item, userId);
      } catch (error) {
        console.error('[PrescriptionIPC] Error:', error);
        return { success: false, message: error.message };
      }
    });

    // Remove item from prescription
    ipcMain.handle('prescription:removeItem', async (event, itemId, userId) => {
      try {
        return await this.service.removeItem(itemId, userId);
      } catch (error) {
        console.error('[PrescriptionIPC] Error:', error);
        return { success: false, message: error.message };
      }
    });

    // Dispense items
    ipcMain.handle('prescription:dispense', async (event, prescriptionId, items, userId) => {
      try {
        return await this.service.dispenseItems(prescriptionId, items, userId);
      } catch (error) {
        console.error('[PrescriptionIPC] Error:', error);
        return { success: false, message: error.message };
      }
    });

    // Cancel prescription
    ipcMain.handle('prescription:cancel', async (event, prescriptionId, reason, userId) => {
      try {
        return await this.service.cancelPrescription(prescriptionId, reason, userId);
      } catch (error) {
        console.error('[PrescriptionIPC] Error:', error);
        return { success: false, message: error.message };
      }
    });

    // Get statistics
    ipcMain.handle('prescription:getStatistics', async (event, filters) => {
      try {
        return await this.service.getStatistics(filters);
      } catch (error) {
        console.error('[PrescriptionIPC] Error:', error);
        return { success: false, message: error.message };
      }
    });

    console.log('[PrescriptionIPC] All handlers registered');
  }
}

export default PrescriptionIPCHandler;
