import { DatabaseService } from '../database/DatabaseService.js';
import { app } from 'electron';
import path from 'path';
import fs from 'fs';

/**
 * BackupService - Sprint 8: Data Protection
 * Handles database backup and restoration
 */
class BackupService {
  constructor() {
    this.db = DatabaseService.getInstance();
    this.backupDir = path.join(app.getPath('userData'), 'backups');
    
    // Ensure backup directory exists
    if (!fs.existsSync(this.backupDir)) {
      fs.mkdirSync(this.backupDir, { recursive: true });
    }
  }

  /**
   * Create a database backup
   * @param {string} description - Optional description for the backup
   * @param {number} userId - User creating the backup
   */
  async createBackup(description = '', userId = null) {
    try {
      console.log('[BackupService] Creating database backup...');

      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const backupFileName = `backup_${timestamp}.db`;
      const backupPath = path.join(this.backupDir, backupFileName);

      // Get source database path
      const sourcePath = this.db.dbPath;

      // Create backup using SQLite backup command
      await this.db.execute(`VACUUM INTO '${backupPath}'`);

      // Get backup file size
      const stats = fs.statSync(backupPath);
      const sizeMB = (stats.size / (1024 * 1024)).toFixed(2);

      // Log backup to database
      await this.db.execute(
        `INSERT INTO Backups (backup_name, backup_path, backup_size_mb, created_by, notes)
         VALUES (?, ?, ?, ?, ?)`,
        [backupFileName, backupPath, sizeMB, userId, description]
      );

      // Log to history
      await this.db.execute(
        `INSERT INTO History (action_type, table_name, record_id, performed_by, description)
         VALUES ('BACKUP', 'System', 0, ?, ?)`,
        [userId, `Database backup created: ${backupFileName}`]
      );

      console.log('[BackupService] ✅ Backup created:', backupPath);

      return {
        success: true,
        message: 'Backup created successfully',
        data: {
          backup_name: backupFileName,
          backup_path: backupPath,
          size_mb: sizeMB,
          created_at: new Date().toISOString()
        }
      };

    } catch (error) {
      console.error('[BackupService] Error creating backup:', error);
      return { success: false, message: error.message };
    }
  }

  /**
   * Get list of all backups
   */
  async getBackupList() {
    try {
      console.log('[BackupService] Getting backup list...');

      // Get backups from database
      const dbBackups = await this.db.query(
        `SELECT b.*, u.username as created_by_name
         FROM Backups b
         LEFT JOIN Users u ON b.created_by = u.user_id
         ORDER BY b.backup_date DESC`
      );

      // Verify files exist and get current sizes
      const backups = dbBackups.map(backup => {
        const exists = fs.existsSync(backup.backup_path);
        let currentSize = null;
        
        if (exists) {
          try {
            const stats = fs.statSync(backup.backup_path);
            currentSize = (stats.size / (1024 * 1024)).toFixed(2);
          } catch (e) {
            currentSize = backup.backup_size_mb;
          }
        }

        return {
          ...backup,
          file_exists: exists,
          current_size_mb: currentSize
        };
      });

      return {
        success: true,
        data: backups
      };

    } catch (error) {
      console.error('[BackupService] Error getting backup list:', error);
      return { success: false, message: error.message };
    }
  }

  /**
   * Restore database from backup
   * @param {number} backupId - The backup ID to restore
   * @param {number} userId - User performing the restore
   */
  async restoreBackup(backupId, userId = null) {
    try {
      console.log('[BackupService] Restoring backup ID:', backupId);

      // Get backup info
      const backups = await this.db.query(
        'SELECT * FROM Backups WHERE backup_id = ?',
        [backupId]
      );

      if (backups.length === 0) {
        return { success: false, message: 'Backup not found' };
      }

      const backup = backups[0];

      // Check if backup file exists
      if (!fs.existsSync(backup.backup_path)) {
        return { success: false, message: 'Backup file not found on disk' };
      }

      // Create a backup of current database before restore
      const preRestoreBackup = await this.createBackup('Auto-backup before restore', userId);
      if (!preRestoreBackup.success) {
        console.warn('[BackupService] Warning: Could not create pre-restore backup');
      }

      // Get current database path
      const currentDbPath = this.db.dbPath;
      
      // Log restore attempt to history before closing
      await this.db.execute(
        `INSERT INTO History (action_type, table_name, record_id, performed_by, description)
         VALUES ('RESTORE', 'System', ?, ?, ?)`,
        [backupId, userId, `Database restore initiated from: ${backup.backup_name}`]
      );

      // CRITICAL: Close database connection BEFORE overwriting the file
      console.log('[BackupService] Closing database connection before restore...');
      this.db.close();

      // Copy backup file over current database (now safe since connection is closed)
      fs.copyFileSync(backup.backup_path, currentDbPath);
      console.log('[BackupService] Backup file copied successfully');

      // Reinitialize database connection
      await this.db.initialize();

      console.log('[BackupService] ✅ Database restored from:', backup.backup_name);

      return {
        success: true,
        message: 'Database restored successfully. Please restart the application for full effect.',
        data: {
          restored_from: backup.backup_name,
          backup_date: backup.backup_date,
          pre_restore_backup: preRestoreBackup.success ? preRestoreBackup.data.backup_name : null
        }
      };

    } catch (error) {
      console.error('[BackupService] Error restoring backup:', error);
      
      // Try to reinitialize database if it was closed but copy failed
      try {
        if (!this.db.db || !this.db.db.open) {
          await this.db.initialize();
        }
      } catch (reinitError) {
        console.error('[BackupService] Failed to reinitialize after error:', reinitError);
      }
      
      return { success: false, message: error.message };
    }
  }

  /**
   * Delete a backup
   * @param {number} backupId - The backup ID to delete
   * @param {number} userId - User performing the deletion
   */
  async deleteBackup(backupId, userId = null) {
    try {
      console.log('[BackupService] Deleting backup ID:', backupId);

      // Get backup info
      const backups = await this.db.query(
        'SELECT * FROM Backups WHERE backup_id = ?',
        [backupId]
      );

      if (backups.length === 0) {
        return { success: false, message: 'Backup not found' };
      }

      const backup = backups[0];

      // Delete file if exists
      if (fs.existsSync(backup.backup_path)) {
        fs.unlinkSync(backup.backup_path);
      }

      // Delete from database
      await this.db.execute(
        'DELETE FROM Backups WHERE backup_id = ?',
        [backupId]
      );

      // Log to history
      await this.db.execute(
        `INSERT INTO History (action_type, table_name, record_id, performed_by, description)
         VALUES ('DELETE', 'Backups', ?, ?, ?)`,
        [backupId, userId, `Backup deleted: ${backup.backup_name}`]
      );

      console.log('[BackupService] ✅ Backup deleted:', backup.backup_name);

      return {
        success: true,
        message: 'Backup deleted successfully'
      };

    } catch (error) {
      console.error('[BackupService] Error deleting backup:', error);
      return { success: false, message: error.message };
    }
  }

  /**
   * Export backup to external location
   * @param {number} backupId - The backup ID to export
   * @param {string} exportPath - Destination path
   */
  async exportBackup(backupId, exportPath) {
    try {
      console.log('[BackupService] Exporting backup ID:', backupId, 'to', exportPath);

      // Get backup info
      const backups = await this.db.query(
        'SELECT * FROM Backups WHERE backup_id = ?',
        [backupId]
      );

      if (backups.length === 0) {
        return { success: false, message: 'Backup not found' };
      }

      const backup = backups[0];

      if (!fs.existsSync(backup.backup_path)) {
        return { success: false, message: 'Backup file not found on disk' };
      }

      // Copy to export location
      fs.copyFileSync(backup.backup_path, exportPath);

      console.log('[BackupService] ✅ Backup exported to:', exportPath);

      return {
        success: true,
        message: 'Backup exported successfully',
        data: {
          exported_to: exportPath
        }
      };

    } catch (error) {
      console.error('[BackupService] Error exporting backup:', error);
      return { success: false, message: error.message };
    }
  }

  /**
   * Import backup from external location
   * @param {string} importPath - Source backup file path
   * @param {number} userId - User performing the import
   */
  async importBackup(importPath, userId = null) {
    try {
      console.log('[BackupService] Importing backup from:', importPath);

      if (!fs.existsSync(importPath)) {
        return { success: false, message: 'Source file not found' };
      }

      // Generate new backup name
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const backupFileName = `imported_${timestamp}.db`;
      const backupPath = path.join(this.backupDir, backupFileName);

      // Copy file to backup directory
      fs.copyFileSync(importPath, backupPath);

      // Get file size
      const stats = fs.statSync(backupPath);
      const sizeMB = (stats.size / (1024 * 1024)).toFixed(2);

      // Log to database
      await this.db.execute(
        `INSERT INTO Backups (backup_name, backup_path, backup_size_mb, created_by, notes)
         VALUES (?, ?, ?, ?, ?)`,
        [backupFileName, backupPath, sizeMB, userId, `Imported from: ${path.basename(importPath)}`]
      );

      console.log('[BackupService] ✅ Backup imported:', backupFileName);

      return {
        success: true,
        message: 'Backup imported successfully',
        data: {
          backup_name: backupFileName,
          size_mb: sizeMB
        }
      };

    } catch (error) {
      console.error('[BackupService] Error importing backup:', error);
      return { success: false, message: error.message };
    }
  }

  /**
   * Get backup directory path
   */
  getBackupDirectory() {
    return this.backupDir;
  }

  /**
   * Start automatic daily backup schedule
   * @param {string} timeOfDay - HH:MM format (24h), e.g. "02:00"
   * @param {number} retainDays - Number of days of auto-backups to keep (default 30)
   */
  startAutoBackup(timeOfDay = '02:00', retainDays = 30) {
    this.stopAutoBackup(); // Clear any existing interval

    const [targetH, targetM] = timeOfDay.split(':').map(Number);

    // Check every 60 seconds whether it's time to run
    this._autoBackupInterval = setInterval(async () => {
      const now = new Date();
      if (now.getHours() === targetH && now.getMinutes() === targetM) {
        // Avoid running multiple times in the same minute
        if (this._lastAutoBackup && (now - this._lastAutoBackup) < 120000) return;
        this._lastAutoBackup = now;

        console.log('[BackupService] Running scheduled auto-backup...');
        try {
          await this.createBackup(`Auto backup (${now.toISOString().split('T')[0]})`, null);
          await this.pruneOldAutoBackups(retainDays);
          console.log('[BackupService] ✅ Auto-backup completed');
        } catch (err) {
          console.error('[BackupService] Auto-backup failed:', err);
        }
      }
    }, 60000);

    console.log(`[BackupService] Auto-backup scheduled daily at ${timeOfDay}, retention: ${retainDays} days`);
    return { success: true, message: `Auto-backup scheduled at ${timeOfDay}` };
  }

  /**
   * Stop automatic backup schedule
   */
  stopAutoBackup() {
    if (this._autoBackupInterval) {
      clearInterval(this._autoBackupInterval);
      this._autoBackupInterval = null;
      console.log('[BackupService] Auto-backup schedule stopped');
    }
    return { success: true };
  }

  /**
   * Get current auto backup status
   */
  getAutoBackupStatus() {
    return {
      success: true,
      data: {
        active: !!this._autoBackupInterval,
        last_auto_backup: this._lastAutoBackup ? this._lastAutoBackup.toISOString() : null,
      },
    };
  }

  /**
   * Delete auto-created backups older than retainDays
   */
  async pruneOldAutoBackups(retainDays = 30) {
    try {
      const cutoff = new Date();
      cutoff.setDate(cutoff.getDate() - retainDays);

      const backups = await this.db.query(
        `SELECT * FROM Backups
         WHERE description LIKE 'Auto backup%'
           AND created_at < ?
         ORDER BY created_at ASC`,
        [cutoff.toISOString()]
      );

      for (const b of backups) {
        if (b.file_path && fs.existsSync(b.file_path)) {
          fs.unlinkSync(b.file_path);
        }
        await this.db.run('DELETE FROM Backups WHERE backup_id = ?', [b.backup_id]);
      }

      if (backups.length > 0) {
        console.log(`[BackupService] Pruned ${backups.length} old auto-backups`);
      }
    } catch (error) {
      console.error('[BackupService] Error pruning backups:', error);
    }
  }
}

export default BackupService;
