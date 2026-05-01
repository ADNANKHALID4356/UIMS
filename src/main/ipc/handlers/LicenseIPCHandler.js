import { ipcMain } from 'electron';
import { LicenseService } from '../../../services/license/LicenseService.js';

/**
 * IPC handlers for license operations
 */
export class LicenseIPCHandler {
  static licenseService = new LicenseService();

  static register() {
    // Validate current license
    ipcMain.handle(
      'license:validate',
      async (_event) => {
        try {
          return await this.licenseService.validateLicense();
        } catch (error) {
          console.error('License validation error:', error);
          return false;
        }
      }
    );

    // Activate license with shop data
    ipcMain.handle(
      'license:activate',
      async (_event, data) => {
        try {
          const success = await this.licenseService.activateLicense(
            data.shopName,
            data.shopOwnerName,
            data.licenseKey
          );
          return { success };
        } catch (error) {
          console.error('License activation error:', error);
          return {
            success: false,
            error: error instanceof Error ? error.message : 'Activation failed'
          };
        }
      }
    );

    // Deactivate license
    ipcMain.handle(
      'license:deactivate',
      async (_event) => {
        try {
          return await this.licenseService.deactivateLicense();
        } catch (error) {
          console.error('License deactivation error:', error);
          return false;
        }
      }
    );

    // Get license information
    ipcMain.handle(
      'license:getInfo',
      async (_event) => {
        try {
          const info = await this.licenseService.getLicenseInfo();
          if (!info) {
            return { isValid: false };
          }
          return {
            isValid: true,
            shop_name: info.shop_name,
            shop_owner_name: info.shop_owner_name,
            activation_date: info.activation_date,
            expiry_date: info.expiry_date,
            hardware_fingerprint: info.hardware_fingerprint,
          };
        } catch (error) {
          console.error('Get license info error:', error);
          return { isValid: false };
        }
      }
    );
  }
}
