import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { app } from 'electron';
import { HardwareService } from './HardwareService';
import { DatabaseService } from '../database/DatabaseService';

const ENCRYPTION_KEY = Buffer.from('44c8f58d24597d39a3f93c0429406085e33d9c1598f805a5e3178c18258b4561', 'hex'); // 32-byte key
const LICENSE_FILE_NAME = 'license.v2.encrypted';

/**
 * License Service - Manages hardware-based licensing
 */
export class LicenseService {
  hardwareService = null;
  licensePath = '';

  constructor() {
    this.hardwareService = new HardwareService();
    this.licensePath = path.join(app.getPath('userData'), LICENSE_FILE_NAME);
  }

  /**
   * Validate current license against hardware
   */
  async validateLicense() {
    try {
      const info = await this.getLicenseInfo();
      if (!info || !info.is_active) return false;

      const currentFingerprint = await this.hardwareService.generateFingerprint();
      return info.hardware_fingerprint === currentFingerprint;
    } catch (error) {
      console.error('License validation error:', error);
      return false;
    }
  }

  /**
   * Activate license with shop information
   */
  async activateLicense(shopName, shopOwner, licenseKey) {
    try {
      const hardwareFingerprint = await this.hardwareService.generateFingerprint();
      const finalLicenseKey = licenseKey || `LOCAL_${Date.now()}`;

      const licenseData = {
        hardwareFingerprint,
        licenseKey: finalLicenseKey,
        shopName,
        shopOwner,
        activationDate: new Date().toISOString(),
        isActive: true,
      };

      // Save license file (redundant safety)
      this.writeLicenseFile(licenseData);

      // Save to database (primary source of truth for v2.0)
      const dbService = DatabaseService.getInstance();
      await dbService.execute(
        `INSERT OR REPLACE INTO SystemLicense 
        (hardware_fingerprint, license_key, shop_name, shop_owner_name, activation_date, is_active, last_validated)
        VALUES (?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)`,
        [
          licenseData.hardwareFingerprint,
          finalLicenseKey,
          licenseData.shopName,
          licenseData.shopOwner,
          licenseData.activationDate,
          1,
        ]
      );

      console.log('License activated locally for:', hardwareFingerprint);
      return true;
    } catch (error) {
      console.error('License activation error:', error);
      throw error;
    }
  }

  /**
   * Deactivate license
   */
  async deactivateLicense() {
    try {
      const dbService = DatabaseService.getInstance();
      await dbService.execute('UPDATE SystemLicense SET is_active = 0');
      if (fs.existsSync(this.licensePath)) fs.unlinkSync(this.licensePath);
      return true;
    } catch (error) {
      console.error('License deactivation error:', error);
      return false;
    }
  }

  /**
   * Get license information
   */
  async getLicenseInfo() {
    try {
      const dbService = DatabaseService.getInstance();
      const result = await dbService.query(
        `SELECT hardware_fingerprint, shop_name, shop_owner_name, activation_date, expiry_date, is_active
         FROM SystemLicense 
         WHERE is_active = 1 
         ORDER BY activation_date DESC LIMIT 1`
      );

      if (result.length > 0) {
        const info = result[0];
        // Cross-verify with hardware
        const currentFp = await this.hardwareService.generateFingerprint();
        if (info.hardware_fingerprint !== currentFp) {
          console.warn('[License] Hardware mismatch detected');
          return { ...info, isValid: false, reason: 'HARDWARE_MISMATCH' };
        }
        return { ...info, isValid: true };
      }

      // Fallback to legacy license file if exists
      const licenseData = this.readLicenseFile();
      if (licenseData) {
        const currentFp = await this.hardwareService.generateFingerprint();
        const isValid = licenseData.hardwareFingerprint === currentFp && licenseData.isActive;
        return {
          hardware_fingerprint: licenseData.hardwareFingerprint,
          shop_name: licenseData.shopName,
          shop_owner_name: licenseData.shopOwner,
          activation_date: licenseData.activationDate,
          is_active: licenseData.isActive,
          isValid
        };
      }

      return { isValid: false };
    } catch (error) {
      console.error('Get license info error:', error);
      return { isValid: false };
    }
  }

  /**
   * Encrypt and write license file
   */
  writeLicenseFile(data) {
    try {
      const jsonString = JSON.stringify(data);
      const iv = crypto.randomBytes(16);
      const cipher = crypto.createCipheriv('aes-256-cbc', ENCRYPTION_KEY, iv);
      let encrypted = cipher.update(jsonString, 'utf8', 'hex');
      encrypted += cipher.final('hex');
      fs.writeFileSync(this.licensePath, iv.toString('hex') + ':' + encrypted);
    } catch (e) {
      console.error('Error writing license file:', e);
    }
  }

  /**
   * Read and decrypt license file
   */
  readLicenseFile() {
    try {
      if (!fs.existsSync(this.licensePath)) return null;
      const content = fs.readFileSync(this.licensePath, 'utf8');
      const [ivHex, encrypted] = content.split(':');
      if (!ivHex || !encrypted) return null;
      
      const iv = Buffer.from(ivHex, 'hex');
      const decipher = crypto.createDecipheriv('aes-256-cbc', ENCRYPTION_KEY, iv);
      let decrypted = decipher.update(encrypted, 'hex', 'utf8');
      decrypted += decipher.final('utf8');
      return JSON.parse(decrypted);
    } catch (error) {
      console.error('Error reading license file:', error);
      return null;
    }
  }
}
