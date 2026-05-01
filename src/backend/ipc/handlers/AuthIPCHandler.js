import { ipcMain } from 'electron';
import { AuthService } from '../../../services/auth/AuthService.js';

/**
 * IPC handlers for authentication operations
 */
export class AuthIPCHandler {
  static authService = new AuthService();

  static register() {
    // Check if first-run (no users exist)
    ipcMain.handle('auth:isFirstRun', async (_event) => {
      try {
        return await this.authService.isFirstRun();
      } catch (error) {
        console.error('isFirstRun error:', error);
        return true;
      }
    });

    // Create first user during first-run setup (SRS Sprint 2)
    ipcMain.handle(
      'auth:createFirstUser',
      async (_event, fullName, username, email, password) => {
        try {
          return await this.authService.createFirstUser(fullName, username, email, password);
        } catch (error) {
          console.error('createFirstUser error:', error);
          throw error;
        }
      }
    );

    // User login
    ipcMain.handle(
      'auth:login',
      async (_event, username, password) => {
        try {
          return await this.authService.login(username, password);
        } catch (error) {
          console.error('Login error:', error);
          return null;
        }
      }
    );

    // User logout
    ipcMain.handle('auth:logout', async (_event) => {
      try {
        await this.authService.logout();
        return true;
      } catch (error) {
        console.error('Logout error:', error);
        return false;
      }
    });

    // Get current user
    ipcMain.handle(
      'auth:getCurrentUser',
      async (_event) => {
        try {
          return await this.authService.getCurrentUser();
        } catch (error) {
          console.error('Get current user error:', error);
          return null;
        }
      }
    );

    // Change password
    ipcMain.handle(
      'auth:changePassword',
      async (_event, oldPassword, newPassword) => {
        try {
          return await this.authService.changePassword(oldPassword, newPassword);
        } catch (error) {
          console.error('Change password error:', error);
          return false;
        }
      }
    );
  }
}
