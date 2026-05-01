/**
 * UserManagementIPCHandler — Sprint 6 RBAC
 * IPC handlers for user CRUD, role management, password reset
 */

import { ipcMain } from 'electron';
import { AuthService } from '../../../services/auth/AuthService.js';

class UserManagementIPCHandler {
  constructor() {
    this.authService = new AuthService();
  }

  /**
   * Register all user management IPC handlers
   */
  register() {
    // List all users
    ipcMain.handle('user:list', async () => {
      try {
        return await this.authService.listUsers();
      } catch (error) {
        console.error('IPC Error - user:list:', error);
        return { success: false, message: error.message };
      }
    });

    // Create user
    ipcMain.handle('user:create', async (event, userData, createdByUserId) => {
      try {
        return await this.authService.createUser(userData, createdByUserId);
      } catch (error) {
        console.error('IPC Error - user:create:', error);
        return { success: false, message: error.message };
      }
    });

    // Update user
    ipcMain.handle('user:update', async (event, userId, updates, updatedByUserId) => {
      try {
        return await this.authService.updateUser(userId, updates, updatedByUserId);
      } catch (error) {
        console.error('IPC Error - user:update:', error);
        return { success: false, message: error.message };
      }
    });

    // Deactivate user
    ipcMain.handle('user:deactivate', async (event, userId, deactivatedByUserId) => {
      try {
        return await this.authService.deactivateUser(userId, deactivatedByUserId);
      } catch (error) {
        console.error('IPC Error - user:deactivate:', error);
        return { success: false, message: error.message };
      }
    });

    // Reactivate user
    ipcMain.handle('user:reactivate', async (event, userId) => {
      try {
        return await this.authService.reactivateUser(userId);
      } catch (error) {
        console.error('IPC Error - user:reactivate:', error);
        return { success: false, message: error.message };
      }
    });

    // Reset user password
    ipcMain.handle('user:reset-password', async (event, userId, newPassword, resetByUserId) => {
      try {
        return await this.authService.resetUserPassword(userId, newPassword, resetByUserId);
      } catch (error) {
        console.error('IPC Error - user:reset-password:', error);
        return { success: false, message: error.message };
      }
    });

    // Unlock user account
    ipcMain.handle('user:unlock', async (event, userId) => {
      try {
        return await this.authService.unlockUser(userId);
      } catch (error) {
        console.error('IPC Error - user:unlock:', error);
        return { success: false, message: error.message };
      }
    });
  }
}

export default UserManagementIPCHandler;
