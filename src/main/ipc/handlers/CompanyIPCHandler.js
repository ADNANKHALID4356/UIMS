const { ipcMain } = require('electron');
const CompanyService = require('../../services/company/CompanyService');

/**
 * CompanyIPCHandler - IPC bridge for CompanyService (Suppliers)
 * Maps to "Companies" in agricultural, "Suppliers" in retail,
 * "Pharmaceutical Companies" in medical, "Property Owners" in real estate.
 */
class CompanyIPCHandler {
  static register() {
    const companyService = CompanyService.getInstance();

    ipcMain.handle('company:create', async (event, companyData, userId) => {
      try {
        const company = await companyService.createCompany(companyData, userId);
        return { success: true, data: company };
      } catch (error) {
        console.error('[CompanyIPC] Create error:', error.message);
        return { success: false, error: error.message };
      }
    });

    ipcMain.handle('company:getById', async (event, companyId) => {
      try {
        const company = await companyService.getCompanyById(companyId);
        return { success: true, data: company };
      } catch (error) {
        console.error('[CompanyIPC] GetById error:', error.message);
        return { success: false, error: error.message };
      }
    });

    ipcMain.handle('company:getBySpecificId', async (event, specificId) => {
      try {
        const company = await companyService.getCompanyBySpecificId(specificId);
        return { success: true, data: company };
      } catch (error) {
        console.error('[CompanyIPC] GetBySpecificId error:', error.message);
        return { success: false, error: error.message };
      }
    });

    ipcMain.handle('company:getAll', async (event, activeOnly = true) => {
      try {
        const companies = await companyService.getAllCompanies(activeOnly);
        return { success: true, data: companies };
      } catch (error) {
        console.error('[CompanyIPC] GetAll error:', error.message);
        return { success: false, error: error.message };
      }
    });

    ipcMain.handle('company:update', async (event, companyId, companyData, userId) => {
      try {
        const company = await companyService.updateCompany(companyId, companyData, userId);
        return { success: true, data: company };
      } catch (error) {
        console.error('[CompanyIPC] Update error:', error.message);
        return { success: false, error: error.message };
      }
    });

    ipcMain.handle('company:delete', async (event, companyId, userId) => {
      try {
        const result = await companyService.deleteCompany(companyId, userId);
        return { success: true, data: result };
      } catch (error) {
        console.error('[CompanyIPC] Delete error:', error.message);
        return { success: false, error: error.message };
      }
    });

    ipcMain.handle('company:search', async (event, searchTerm) => {
      try {
        const companies = await companyService.searchCompanies(searchTerm);
        return { success: true, data: companies };
      } catch (error) {
        console.error('[CompanyIPC] Search error:', error.message);
        return { success: false, error: error.message };
      }
    });

    ipcMain.handle('company:getLedger', async (event, companyId) => {
      try {
        const ledger = await companyService.getCompanyLedger(companyId);
        return { success: true, data: ledger };
      } catch (error) {
        console.error('[CompanyIPC] GetLedger error:', error.message);
        return { success: false, error: error.message };
      }
    });

    ipcMain.handle('company:getStatistics', async (event) => {
      try {
        const stats = await companyService.getCompanyStatistics();
        return { success: true, data: stats };
      } catch (error) {
        console.error('[CompanyIPC] GetStatistics error:', error.message);
        return { success: false, error: error.message };
      }
    });

    console.log('[CompanyIPCHandler] All company IPC handlers registered');
  }
}

module.exports = CompanyIPCHandler;
