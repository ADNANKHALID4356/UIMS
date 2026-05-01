import { ipcMain, app } from 'electron';
import { HardwareService } from '../../../services/license/HardwareService.js';
import fs from 'fs';
import path from 'path';

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
          // Use app.getAppPath() which works in both dev and production
          const appPath = app.getAppPath();
          const packageJsonPath = path.join(appPath, 'package.json');
          const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf-8'));
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
