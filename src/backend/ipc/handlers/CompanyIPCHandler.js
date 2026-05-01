import { ipcMain } from 'electron';
import { CompanyService } from '../../../services/company/CompanyService.js';

/**
 * Company IPC Handler - Handles IPC communication for company operations
 * Sprint 3 - FR-3.3 Company Management
 */
export class CompanyIPCHandler {
  companyService = null;

  constructor() {
    this.companyService = CompanyService.getInstance();
  }

  /**
   * Register all company IPC handlers
   */
  register() {
    // Create company
    ipcMain.handle('company:create', async (event, companyData, userId) => {
      try {
        const company = await this.companyService.createCompany(companyData, userId);
        return { success: true, data: company };
      } catch (error) {
        console.error('IPC company:create error:', error);
        return { success: false, error: error.message };
      }
    });

    // Get company by ID
    ipcMain.handle('company:getById', async (event, companyId) => {
      try {
        const company = await this.companyService.getCompanyById(companyId);
        return { success: true, data: company };
      } catch (error) {
        console.error('IPC company:getById error:', error);
        return { success: false, error: error.message };
      }
    });

    // Get company by specific ID
    ipcMain.handle('company:getBySpecificId', async (event, specificId) => {
      try {
        const company = await this.companyService.getCompanyBySpecificId(specificId);
        return { success: true, data: company };
      } catch (error) {
        console.error('IPC company:getBySpecificId error:', error);
        return { success: false, error: error.message };
      }
    });

    // Get all companies
    ipcMain.handle('company:getAll', async (event, activeOnly = true) => {
      try {
        const companies = await this.companyService.getAllCompanies(activeOnly);
        return { success: true, data: companies };
      } catch (error) {
        console.error('IPC company:getAll error:', error);
        return { success: false, error: error.message };
      }
    });

    // Update company
    ipcMain.handle('company:update', async (event, companyId, companyData, userId) => {
      try {
        const company = await this.companyService.updateCompany(companyId, companyData, userId);
        return { success: true, data: company };
      } catch (error) {
        console.error('IPC company:update error:', error);
        return { success: false, error: error.message };
      }
    });

    // Delete company
    ipcMain.handle('company:delete', async (event, companyId, userId) => {
      try {
        const result = await this.companyService.deleteCompany(companyId, userId);
        return { success: true, data: result };
      } catch (error) {
        console.error('IPC company:delete error:', error);
        return { success: false, error: error.message };
      }
    });

    // Search companies
    ipcMain.handle('company:search', async (event, searchTerm) => {
      try {
        console.log('[CompanyIPCHandler] Search request received:', searchTerm);
        const companies = await this.companyService.searchCompanies(searchTerm);
        console.log('[CompanyIPCHandler] Search results count:', companies.length);
        return { success: true, data: companies };
      } catch (error) {
        console.error('IPC company:search error:', error);
        return { success: false, error: error.message };
      }
    });

    // Get company ledger
    ipcMain.handle('company:getLedger', async (event, companyId) => {
      try {
        const ledger = await this.companyService.getCompanyLedger(companyId);
        return { success: true, data: ledger };
      } catch (error) {
        console.error('IPC company:getLedger error:', error);
        return { success: false, error: error.message };
      }
    });

    // Get company statistics
    ipcMain.handle('company:getStats', async () => {
      try {
        const stats = await this.companyService.getCompanyStatistics();
        return { success: true, data: stats };
      } catch (error) {
        console.error('IPC company:getStats error:', error);
        return { success: false, error: error.message };
      }
    });

    console.log('Company IPC handlers registered');
  }
}
