import { ipcMain } from 'electron';
import { DatabaseService } from '../../../services/database/DatabaseService.js';

/**
 * IPC handlers for database operations
 */
export class DatabaseIPCHandler {
  static dbService = DatabaseService.getInstance();

  static register() {
    // Execute query (SELECT)
    ipcMain.handle(
      'db:query',
      async (_event, sql, params) => {
        try {
          return await this.dbService.query(sql, params);
        } catch (error) {
          console.error('Database query error:', error);
          throw error;
        }
      }
    );

    // Execute command (INSERT, UPDATE, DELETE)
    ipcMain.handle(
      'db:execute',
      async (_event, sql, params) => {
        try {
          return await this.dbService.execute(sql, params);
        } catch (error) {
          console.error('Database execute error:', error);
          throw error;
        }
      }
    );
  }
}
