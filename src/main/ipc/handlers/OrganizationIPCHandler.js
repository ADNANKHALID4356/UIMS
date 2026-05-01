import { ipcMain } from 'electron';
import { OrganizationService } from '../../../services/organization/OrganizationService.js';

/**
 * Organization IPC Handler
 * ========================
 * Handles all organization/industry configuration IPC communication.
 * SRS v2.0 Sprint 1 — Foundation & Industry Configuration
 */
export class OrganizationIPCHandler {
  static orgService = null;

  /**
   * Register all organization IPC handlers
   */
  static register() {
    this.orgService = OrganizationService.getInstance();

    // Check if organization is configured (for setup wizard flow)
    ipcMain.handle('organization:isConfigured', async () => {
      try {
        const isConfigured = await this.orgService.isOrganizationConfigured();
        return { success: true, data: isConfigured };
      } catch (error) {
        console.error('IPC organization:isConfigured error:', error);
        return { success: false, error: error.message };
      }
    });

    // Get organization settings
    ipcMain.handle('organization:getSettings', async () => {
      try {
        const settings = await this.orgService.getOrganizationSettings();
        return { success: true, data: settings };
      } catch (error) {
        console.error('IPC organization:getSettings error:', error);
        return { success: false, error: error.message };
      }
    });

    // Setup organization (first-time wizard)
    ipcMain.handle('organization:setup', async (event, data) => {
      try {
        const result = await this.orgService.setupOrganization(data);
        return { success: true, data: result };
      } catch (error) {
        console.error('IPC organization:setup error:', error);
        return { success: false, error: error.message };
      }
    });

    // Update organization settings
    ipcMain.handle('organization:updateSettings', async (event, data) => {
      try {
        const result = await this.orgService.updateOrganizationSettings(data);
        return { success: true, data: result };
      } catch (error) {
        console.error('IPC organization:updateSettings error:', error);
        return { success: false, error: error.message };
      }
    });

    // Get industry configuration (terminology, features, navigation)
    ipcMain.handle('organization:getIndustryConfig', async () => {
      try {
        const config = await this.orgService.getIndustryConfiguration();
        return { success: true, data: config };
      } catch (error) {
        console.error('IPC organization:getIndustryConfig error:', error);
        return { success: false, error: error.message };
      }
    });

    // Get available industries (for setup wizard)
    ipcMain.handle('organization:getAvailableIndustries', async () => {
      try {
        const industries = this.orgService.getAvailableIndustries();
        return { success: true, data: industries };
      } catch (error) {
        console.error('IPC organization:getAvailableIndustries error:', error);
        return { success: false, error: error.message };
      }
    });

    // Change industry type
    ipcMain.handle('organization:changeIndustry', async (event, newIndustryType) => {
      try {
        const result = await this.orgService.changeIndustryType(newIndustryType);
        return { success: true, data: result };
      } catch (error) {
        console.error('IPC organization:changeIndustry error:', error);
        return { success: false, error: error.message };
      }
    });

    console.log('Organization IPC handlers registered');
  }
}
