import { ipcMain } from 'electron';
import { HardwareService } from '../../../services/license/HardwareService.js';

/**
 * IPC handlers for system operations
 */
export class SystemIPCHandler {
  static hardwareService = new HardwareService();

  static register() {
    // Get system information
    ipcMain.handle(
      'system:getInfo',
      async (_event) => {
        try {
          const packageJson = await import('../../../package.json');
          const info = {
            platform: process.platform,
            arch: process.arch,
            nodeVersion: process.version,
            appVersion: packageJson.version,
          };
          return info;
        } catch (error) {
          console.error('Get system info error:', error);
          return {};
        }
      }
    );

    // Get hardware fingerprint
    ipcMain.handle(
      'system:getFingerprint',
      async (_event) => {
        try {
          return await this.hardwareService.generateFingerprint();
        } catch (error) {
          console.error('Get fingerprint error:', error);
          return null;
        }
      }
    );
  }
}
