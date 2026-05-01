import { ipcMain, dialog } from 'electron';
import BackupService from '../../../services/backup/BackupService.js';
import DataArchiveService from '../../../services/backup/DataArchiveService.js';

const backupService = new BackupService();
const archiveService = new DataArchiveService();

/**
 * Sprint 8 IPC Handlers - Backup & Data Protection
 */
export function registerBackupHandlers() {
  console.log('[BackupIPCHandler] Registering Sprint 8 backup handlers...');

  // Create backup
  ipcMain.handle('backup:create', async (event, description, userId) => {
    try {
      console.log('[BackupIPCHandler] Create backup');
      return await backupService.createBackup(description, userId);
    } catch (error) {
      console.error('[BackupIPCHandler] Error:', error);
      return { success: false, message: error.message };
    }
  });

  // Get backup list
  ipcMain.handle('backup:list', async (event) => {
    try {
      console.log('[BackupIPCHandler] Get backup list');
      return await backupService.getBackupList();
    } catch (error) {
      console.error('[BackupIPCHandler] Error:', error);
      return { success: false, message: error.message };
    }
  });

  // Restore backup
  ipcMain.handle('backup:restore', async (event, backupId, userId) => {
    try {
      console.log('[BackupIPCHandler] Restore backup:', backupId);
      return await backupService.restoreBackup(backupId, userId);
    } catch (error) {
      console.error('[BackupIPCHandler] Error:', error);
      return { success: false, message: error.message };
    }
  });

  // Delete backup
  ipcMain.handle('backup:delete', async (event, backupId, userId) => {
    try {
      console.log('[BackupIPCHandler] Delete backup:', backupId);
      return await backupService.deleteBackup(backupId, userId);
    } catch (error) {
      console.error('[BackupIPCHandler] Error:', error);
      return { success: false, message: error.message };
    }
  });

  // Export backup (with file dialog)
  ipcMain.handle('backup:export', async (event, backupId) => {
    try {
      console.log('[BackupIPCHandler] Export backup:', backupId);
      
      // Show save dialog
      const result = await dialog.showSaveDialog({
        title: 'Export Backup',
        defaultPath: `backup_export_${new Date().toISOString().split('T')[0]}.db`,
        filters: [
          { name: 'Database Files', extensions: ['db'] },
          { name: 'All Files', extensions: ['*'] }
        ]
      });

      if (result.canceled || !result.filePath) {
        return { success: false, message: 'Export cancelled' };
      }

      return await backupService.exportBackup(backupId, result.filePath);
    } catch (error) {
      console.error('[BackupIPCHandler] Error:', error);
      return { success: false, message: error.message };
    }
  });

  // Import backup (with file dialog)
  ipcMain.handle('backup:import', async (event, userId) => {
    try {
      console.log('[BackupIPCHandler] Import backup');
      
      // Show open dialog
      const result = await dialog.showOpenDialog({
        title: 'Import Backup',
        filters: [
          { name: 'Database Files', extensions: ['db'] },
          { name: 'All Files', extensions: ['*'] }
        ],
        properties: ['openFile']
      });

      if (result.canceled || result.filePaths.length === 0) {
        return { success: false, message: 'Import cancelled' };
      }

      return await backupService.importBackup(result.filePaths[0], userId);
    } catch (error) {
      console.error('[BackupIPCHandler] Error:', error);
      return { success: false, message: error.message };
    }
  });

  // Get backup directory
  ipcMain.handle('backup:getDirectory', async (event) => {
    try {
      return { 
        success: true, 
        data: backupService.getBackupDirectory() 
      };
    } catch (error) {
      console.error('[BackupIPCHandler] Error:', error);
      return { success: false, message: error.message };
    }
  });

  // ========== DATA ARCHIVE HANDLERS ==========

  // Get archive summary (counts of exportable data)
  ipcMain.handle('archive:getSummary', async (event) => {
    try {
      console.log('[BackupIPCHandler] Get archive summary');
      return await archiveService.getArchiveSummary();
    } catch (error) {
      console.error('[BackupIPCHandler] Error:', error);
      return { success: false, message: error.message };
    }
  });

  // Export data to CSV with file dialog
  ipcMain.handle('archive:exportCSV', async (event, options = {}) => {
    try {
      console.log('[BackupIPCHandler] Export data to CSV');
      
      // Show save dialog
      const result = await dialog.showSaveDialog({
        title: 'Export Data Archive to CSV',
        defaultPath: `data_archive_${new Date().toISOString().split('T')[0]}.csv`,
        filters: [
          { name: 'CSV Files', extensions: ['csv'] },
          { name: 'All Files', extensions: ['*'] }
        ]
      });

      if (result.canceled || !result.filePath) {
        return { success: false, message: 'Export cancelled' };
      }

      return await archiveService.exportToCSV(result.filePath, options);
    } catch (error) {
      console.error('[BackupIPCHandler] Error:', error);
      return { success: false, message: error.message };
    }
  });

  // Delete archived data by IDs
  ipcMain.handle('archive:deleteData', async (event, options) => {
    try {
      console.log('[BackupIPCHandler] Delete archived data');
      return await archiveService.deleteArchivedData(options);
    } catch (error) {
      console.error('[BackupIPCHandler] Error:', error);
      return { success: false, message: error.message };
    }
  });

  // Delete data by date range
  ipcMain.handle('archive:deleteByDateRange', async (event, dateFrom, dateTo, options) => {
    try {
      console.log('[BackupIPCHandler] Delete data by date range:', dateFrom, 'to', dateTo);
      return await archiveService.deleteDataByDateRange(dateFrom, dateTo, options);
    } catch (error) {
      console.error('[BackupIPCHandler] Error:', error);
      return { success: false, message: error.message };
    }
  });

  // Start auto-backup schedule
  ipcMain.handle('backup:startAutoBackup', async (event, timeOfDay, retainDays) => {
    try {
      return backupService.startAutoBackup(timeOfDay, retainDays);
    } catch (error) {
      console.error('[BackupIPCHandler] Error:', error);
      return { success: false, message: error.message };
    }
  });

  // Stop auto-backup schedule
  ipcMain.handle('backup:stopAutoBackup', async (event) => {
    try {
      return backupService.stopAutoBackup();
    } catch (error) {
      console.error('[BackupIPCHandler] Error:', error);
      return { success: false, message: error.message };
    }
  });

  // Get auto-backup status
  ipcMain.handle('backup:autoBackupStatus', async (event) => {
    try {
      return backupService.getAutoBackupStatus();
    } catch (error) {
      console.error('[BackupIPCHandler] Error:', error);
      return { success: false, message: error.message };
    }
  });

  console.log('[BackupIPCHandler] ✅ Sprint 8 backup handlers registered');
}
