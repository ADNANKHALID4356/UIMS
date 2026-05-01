import { ipcMain } from 'electron';
import { AuthService } from '../../../services/auth/AuthService.js';

/**
 * IPC handlers for authentication operations
 */
export class AuthIPCHandler {
  static authService = new AuthService();

  static register() {
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

    // Check if first run
    ipcMain.handle('auth:isFirstRun', async () => {
      try {
        return await this.authService.isFirstRun();
      } catch (error) {
        console.error('Is first run error:', error);
        return true;
      }
    });

    // Create first user
    ipcMain.handle(
      'auth:createFirstUser',
      async (_event, fullName, username, email, password) => {
        try {
          return await this.authService.createFirstUser(fullName, username, email, password);
        } catch (error) {
          console.error('Create first user error:', error);
          throw error;
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
