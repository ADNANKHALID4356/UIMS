import crypto from 'crypto';
import os from 'os';
import { execSync } from 'child_process';

/**
 * Hardware Service - Generates and manages hardware fingerprints
 */
export class HardwareService {
  /**
   * Generate unique hardware fingerprint from multiple hardware identifiers
   */
  async generateFingerprint() {
    try {
      const components = {
        motherboard: this.getMotherboardSerial(),
        cpu: this.getCPUId(),
        disk: this.getDiskSerial(),
        mac: this.getMACAddress(),
      };

      const fingerprintString = JSON.stringify(components);
      const hash = crypto.createHash('sha256').update(fingerprintString).digest('hex');
      return hash;
    } catch (error) {
      console.error('Error generating fingerprint:', error);
      throw error;
    }
  }

  /**
   * Get motherboard serial number (Windows)
   */
  getMotherboardSerial() {
    try {
      if (process.platform === 'win32') {
        const output = execSync('wmic baseboard get serialnumber', { encoding: 'utf-8' });
        const lines = output.split('\n');
        return lines[1]?.trim() || 'UNKNOWN';
      }
      return 'UNKNOWN';
    } catch (error) {
      console.error('Error getting motherboard serial:', error);
      return 'UNKNOWN';
    }
  }

  /**
   * Get CPU ID
   */
  getCPUId() {
    try {
      if (process.platform === 'win32') {
        const output = execSync('wmic cpu get processorid', { encoding: 'utf-8' });
        const lines = output.split('\n');
        return lines[1]?.trim() || 'UNKNOWN';
      }
      return 'UNKNOWN';
    } catch (error) {
      console.error('Error getting CPU ID:', error);
      return 'UNKNOWN';
    }
  }

  /**
   * Get disk serial number
   */
  getDiskSerial() {
    try {
      if (process.platform === 'win32') {
        const output = execSync('wmic logicaldisk where name="C:" get volumeserialnumber', {
          encoding: 'utf-8',
        });
        const lines = output.split('\n');
        return lines[1]?.trim() || 'UNKNOWN';
      }
      return 'UNKNOWN';
    } catch (error) {
      console.error('Error getting disk serial:', error);
      return 'UNKNOWN';
    }
  }

  /**
   * Get MAC address
   */
  getMACAddress() {
    try {
      const interfaces = os.networkInterfaces();
      for (const name of Object.keys(interfaces)) {
        const iface = interfaces[name];
        if (iface) {
          for (const addr of iface) {
            if (addr.family === 'IPv4' && !addr.internal) {
              return addr.mac;
            }
          }
        }
      }
      return 'UNKNOWN';
    } catch (error) {
      console.error('Error getting MAC address:', error);
      return 'UNKNOWN';
    }
  }
}
