import { ipcMain } from 'electron';
import ReportService from '../../../services/report/ReportService.js';

const reportService = new ReportService();

/**
 * Sprint 7 IPC Handlers - Reporting & Analytics
 */
export function registerReportHandlers() {
  console.log('[ReportIPCHandler] Registering Sprint 7 report handlers...');

  // Get Daily Sales Report
  ipcMain.handle('report:dailySales', async (event, startDate, endDate) => {
    try {
      console.log('[ReportIPCHandler] Daily Sales Report:', startDate, 'to', endDate);
      return await reportService.getDailySalesReport(startDate, endDate);
    } catch (error) {
      console.error('[ReportIPCHandler] Error:', error);
      return { success: false, message: error.message };
    }
  });

  // Get Outstanding Balance Report
  ipcMain.handle('report:outstandingBalance', async (event) => {
    try {
      console.log('[ReportIPCHandler] Outstanding Balance Report');
      return await reportService.getOutstandingBalanceReport();
    } catch (error) {
      console.error('[ReportIPCHandler] Error:', error);
      return { success: false, message: error.message };
    }
  });

  // Get Stock Report
  ipcMain.handle('report:stock', async (event) => {
    try {
      console.log('[ReportIPCHandler] Stock Report');
      return await reportService.getStockReport();
    } catch (error) {
      console.error('[ReportIPCHandler] Error:', error);
      return { success: false, message: error.message };
    }
  });

  // Get Customer Ledger Report
  ipcMain.handle('report:customerLedger', async (event, entityType, entityId, startDate, endDate) => {
    try {
      console.log('[ReportIPCHandler] Customer Ledger Report:', entityType, entityId);
      return await reportService.getCustomerLedgerReport(entityType, entityId, startDate, endDate);
    } catch (error) {
      console.error('[ReportIPCHandler] Error:', error);
      return { success: false, message: error.message };
    }
  });

  // Get Cash Flow Report
  ipcMain.handle('report:cashFlow', async (event, startDate, endDate) => {
    try {
      console.log('[ReportIPCHandler] Cash Flow Report:', startDate, 'to', endDate);
      return await reportService.getCashFlowReport(startDate, endDate);
    } catch (error) {
      console.error('[ReportIPCHandler] Error:', error);
      return { success: false, message: error.message };
    }
  });

  // Get Transaction for Receipt
  ipcMain.handle('report:transactionReceipt', async (event, transactionId) => {
    try {
      console.log('[ReportIPCHandler] Transaction Receipt:', transactionId);
      return await reportService.getTransactionForReceipt(transactionId);
    } catch (error) {
      console.error('[ReportIPCHandler] Error:', error);
      return { success: false, message: error.message };
    }
  });

  // Profit & Loss Report
  ipcMain.handle('report:profitAndLoss', async (event, startDate, endDate) => {
    try {
      return await reportService.getProfitAndLossReport(startDate, endDate);
    } catch (error) {
      console.error('[ReportIPCHandler] Error:', error);
      return { success: false, message: error.message };
    }
  });

  // Expiry Report (Medical)
  ipcMain.handle('report:expiry', async (event, daysThreshold) => {
    try {
      return await reportService.getExpiryReport(daysThreshold);
    } catch (error) {
      console.error('[ReportIPCHandler] Error:', error);
      return { success: false, message: error.message };
    }
  });

  // Property Portfolio Report (Real Estate)
  ipcMain.handle('report:propertyPortfolio', async (event) => {
    try {
      return await reportService.getPropertyPortfolioReport();
    } catch (error) {
      console.error('[ReportIPCHandler] Error:', error);
      return { success: false, message: error.message };
    }
  });

  // Stock Movement Report
  ipcMain.handle('report:stockMovement', async (event, startDate, endDate) => {
    try {
      return await reportService.getStockMovementReport(startDate, endDate);
    } catch (error) {
      console.error('[ReportIPCHandler] Error:', error);
      return { success: false, message: error.message };
    }
  });

  // Top-Selling Products Report
  ipcMain.handle('report:topSelling', async (event, startDate, endDate, limit) => {
    try {
      return await reportService.getTopSellingReport(startDate, endDate, limit);
    } catch (error) {
      console.error('[ReportIPCHandler] Error:', error);
      return { success: false, message: error.message };
    }
  });

  // Dead Stock Report
  ipcMain.handle('report:deadStock', async (event, daysSinceLastMovement) => {
    try {
      return await reportService.getDeadStockReport(daysSinceLastMovement);
    } catch (error) {
      console.error('[ReportIPCHandler] Error:', error);
      return { success: false, message: error.message };
    }
  });

  // Batch-wise Stock Report (Medical)
  ipcMain.handle('report:batchWiseStock', async (event) => {
    try {
      return await reportService.getBatchWiseStockReport();
    } catch (error) {
      console.error('[ReportIPCHandler] Error:', error);
      return { success: false, message: error.message };
    }
  });

  // Patient Purchase History (Medical)
  ipcMain.handle('report:patientHistory', async (event, patientId) => {
    try {
      return await reportService.getPatientHistoryReport(patientId);
    } catch (error) {
      console.error('[ReportIPCHandler] Error:', error);
      return { success: false, message: error.message };
    }
  });

  // Commission Earned Report
  ipcMain.handle('report:commissionEarned', async (event, startDate, endDate) => {
    try {
      return await reportService.getCommissionEarnedReport(startDate, endDate);
    } catch (error) {
      console.error('[ReportIPCHandler] Error:', error);
      return { success: false, message: error.message };
    }
  });

  // Credit/Balance Aging Analysis
  ipcMain.handle('report:creditAging', async (event) => {
    try {
      return await reportService.getCreditAgingReport();
    } catch (error) {
      console.error('[ReportIPCHandler] Error:', error);
      return { success: false, message: error.message };
    }
  });

  // Controlled Substance Register (Medical)
  ipcMain.handle('report:controlledSubstance', async (event, startDate, endDate) => {
    try {
      return await reportService.getControlledSubstanceReport(startDate, endDate);
    } catch (error) {
      console.error('[ReportIPCHandler] Error:', error);
      return { success: false, message: error.message };
    }
  });

  console.log('[ReportIPCHandler] ✅ Sprint 7 report handlers registered');
}
