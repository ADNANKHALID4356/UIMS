import { ipcMain } from 'electron';
import { HistoryService } from '../../../services/history/HistoryService.js';

/**
 * History IPC Handler — Audit trail / activity log
 * Sprint 3 - Entity Management: History logging viewer
 */
export class HistoryIPCHandler {
  static historyService = null;

  static register() {
    this.historyService = HistoryService.getInstance();

    // Get history entries (paginated, filterable)
    ipcMain.handle('history:getAll', async (event, filters) => {
      try {
        const result = await this.historyService.getHistory(filters);
        return { success: true, data: result };
      } catch (error) {
        console.error('IPC history:getAll error:', error);
        return { success: false, error: error.message };
      }
    });

    // Get history for a specific entity record
    ipcMain.handle('history:getByEntity', async (event, tableName, recordId) => {
      try {
        const result = await this.historyService.getEntityHistory(tableName, recordId);
        return { success: true, data: result };
      } catch (error) {
        console.error('IPC history:getByEntity error:', error);
        return { success: false, error: error.message };
      }
    });

    // Get available table names for filter dropdowns
    ipcMain.handle('history:getTableNames', async () => {
      try {
        const result = await this.historyService.getTableNames();
        return { success: true, data: result };
      } catch (error) {
        console.error('IPC history:getTableNames error:', error);
        return { success: false, error: error.message };
      }
    });

    // Get history statistics
    ipcMain.handle('history:getStatistics', async () => {
      try {
        const result = await this.historyService.getStatistics();
        return { success: true, data: result };
      } catch (error) {
        console.error('IPC history:getStatistics error:', error);
        return { success: false, error: error.message };
      }
    });

    // Clear history entries older than a given date (OWNER/ADMIN only)
    ipcMain.handle('history:clearOlder', async (event, beforeDate) => {
      try {
        if (!beforeDate) {
          return { success: false, error: 'beforeDate is required (YYYY-MM-DD)' };
        }
        const result = await this.historyService.clearOlderThan(beforeDate);
        return { success: true, data: result };
      } catch (error) {
        console.error('IPC history:clearOlder error:', error);
        return { success: false, error: error.message };
      }
    });

    console.log('History IPC handlers registered');
  }
}
