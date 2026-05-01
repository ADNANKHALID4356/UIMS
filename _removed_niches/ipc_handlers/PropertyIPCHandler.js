/**
 * PropertyIPCHandler - Sprint 4 (FR-4.7)
 * IPC handlers for property listing operations (Real Estate industry)
 */

import { ipcMain } from 'electron';
import PropertyService from '../../../services/property/PropertyService.js';

class PropertyIPCHandler {
  constructor() {
    this.service = new PropertyService();
  }

  register() {
    // Create property
    ipcMain.handle('property:create', async (event, propertyData, userId) => {
      try {
        return await this.service.create(propertyData, userId);
      } catch (error) {
        console.error('IPC Error - property:create:', error);
        return { success: false, message: error.message };
      }
    });

    // Get property by ID
    ipcMain.handle('property:get-by-id', async (event, propertyId) => {
      try {
        return await this.service.getById(propertyId);
      } catch (error) {
        console.error('IPC Error - property:get-by-id:', error);
        return null;
      }
    });

    // Get property by code
    ipcMain.handle('property:get-by-code', async (event, propertyCode) => {
      try {
        return await this.service.getByCode(propertyCode);
      } catch (error) {
        console.error('IPC Error - property:get-by-code:', error);
        return null;
      }
    });

    // Get all properties
    ipcMain.handle('property:get-all', async (event, filters = {}) => {
      try {
        return await this.service.getAll(filters);
      } catch (error) {
        console.error('IPC Error - property:get-all:', error);
        return [];
      }
    });

    // Update property
    ipcMain.handle('property:update', async (event, propertyId, updateData, userId) => {
      try {
        return await this.service.update(propertyId, updateData, userId);
      } catch (error) {
        console.error('IPC Error - property:update:', error);
        return { success: false, message: error.message };
      }
    });

    // Update property status
    ipcMain.handle('property:update-status', async (event, propertyId, newStatus, userId) => {
      try {
        return await this.service.updateStatus(propertyId, newStatus, userId);
      } catch (error) {
        console.error('IPC Error - property:update-status:', error);
        return { success: false, message: error.message };
      }
    });

    // Delete property
    ipcMain.handle('property:delete', async (event, propertyId, userId) => {
      try {
        return await this.service.delete(propertyId, userId);
      } catch (error) {
        console.error('IPC Error - property:delete:', error);
        return { success: false, message: error.message };
      }
    });

    // Search properties
    ipcMain.handle('property:search', async (event, searchTerm) => {
      try {
        return await this.service.search(searchTerm);
      } catch (error) {
        console.error('IPC Error - property:search:', error);
        return [];
      }
    });

    // Get statistics
    ipcMain.handle('property:get-statistics', async () => {
      try {
        return await this.service.getStatistics();
      } catch (error) {
        console.error('IPC Error - property:get-statistics:', error);
        return { total_properties: 0, active_listings: 0, available: 0, sold: 0, rented: 0 };
      }
    });

    console.log('Property IPC handlers registered');
  }
}

export default PropertyIPCHandler;
