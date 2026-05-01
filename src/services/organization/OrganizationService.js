import { DatabaseService } from '../database/DatabaseService.js';
import { getIndustryConfig, getAvailableIndustries } from './industryConfigs.js';

/**
 * Organization Service
 * ====================
 * Manages organization settings, industry configuration, and business details.
 * This is the core v2.0 service that transforms the app from agricultural-only
 * to a multi-industry platform.
 * 
 * SRS v2.0 Sprint 1 — Foundation & Industry Configuration
 */
export class OrganizationService {
  static instance = null;

  /**
   * Get singleton instance
   */
  static getInstance() {
    if (!OrganizationService.instance) {
      OrganizationService.instance = new OrganizationService();
    }
    return OrganizationService.instance;
  }

  /**
   * Get database service
   */
  getDB() {
    return DatabaseService.getInstance();
  }

  /**
   * Check if organization has been set up (first-time wizard completed)
   * @returns {Promise<boolean>}
   */
  async isOrganizationConfigured() {
    try {
      const db = this.getDB();
      const result = await db.query(
        'SELECT COUNT(*) as count FROM OrganizationSettings WHERE is_active = 1'
      );
      return result[0].count > 0;
    } catch (error) {
      // Table might not exist yet (pre-migration)
      console.error('isOrganizationConfigured check failed:', error.message);
      return false;
    }
  }

  /**
   * Get current organization settings
   * @returns {Promise<Object|null>}
   */
  async getOrganizationSettings() {
    try {
      const db = this.getDB();
      const result = await db.query(
        `SELECT * FROM OrganizationSettings WHERE is_active = 1 ORDER BY setting_id DESC LIMIT 1`
      );

      if (result.length === 0) {
        return null;
      }

      const settings = result[0];
      
      // Parse the config_json
      try {
        settings.config = settings.config_json ? JSON.parse(settings.config_json) : {};
      } catch (e) {
        settings.config = {};
      }

      return settings;
    } catch (error) {
      console.error('getOrganizationSettings error:', error);
      return null;
    }
  }

  /**
   * Set up organization for the first time (Setup Wizard)
   * @param {Object} data - Organization setup data
   * @param {string} data.industryType - RETAIL, MEDICAL, REAL_ESTATE, or AGRICULTURAL
   * @param {string} data.businessName - Name of the business
   * @param {string} data.ownerName - Name of the business owner
   * @param {string} [data.address] - Business address
   * @param {string} [data.phone] - Business phone
   * @param {string} [data.email] - Business email
   * @param {string} [data.currency] - Currency symbol (default: PKR)
   * @param {string} [data.dateFormat] - Date format (default: DD/MM/YYYY)
   * @returns {Promise<Object>}
   */
  async setupOrganization(data) {
    const db = this.getDB();

    try {
      // Validate required fields
      if (!data.industryType) {
        throw new Error('Industry type is required');
      }
      if (!data.businessName || data.businessName.trim().length === 0) {
        throw new Error('Business name is required');
      }
      if (!data.ownerName || data.ownerName.trim().length === 0) {
        throw new Error('Owner name is required');
      }

      // Validate industry type
      const validIndustries = ['RETAIL', 'MEDICAL', 'REAL_ESTATE', 'AGRICULTURAL'];
      if (!validIndustries.includes(data.industryType)) {
        throw new Error(`Invalid industry type: ${data.industryType}. Must be one of: ${validIndustries.join(', ')}`);
      }

      // Get industry configuration
      const industryConfig = getIndustryConfig(data.industryType);

      // Build config JSON
      const configJson = JSON.stringify({
        industry: data.industryType,
        terminology: industryConfig.terminology,
        features: industryConfig.features,
        navigation: industryConfig.navigation,
        transactionTypes: industryConfig.transactionTypes,
        dashboardStats: industryConfig.dashboardStats,
        customSettings: data.customSettings || {},
      });

      // Deactivate any existing organization settings
      await db.execute(
        'UPDATE OrganizationSettings SET is_active = 0 WHERE is_active = 1'
      );

      // Insert new organization settings
      const result = await db.execute(
        `INSERT INTO OrganizationSettings (
          industry_type, business_name, owner_name, address, phone, email,
          currency_symbol, date_format, config_json, is_active
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1)`,
        [
          data.industryType,
          data.businessName.trim(),
          data.ownerName.trim(),
          data.address?.trim() || null,
          data.phone?.trim() || null,
          data.email?.trim() || null,
          data.currency || 'PKR',
          data.dateFormat || 'DD/MM/YYYY',
          configJson,
        ]
      );

      // Log to history
      await db.createHistoryEntry(
        'OrganizationSettings',
        result.lastInsertRowid,
        'CREATE',
        null,
        { industryType: data.industryType, businessName: data.businessName },
        null
      );

      console.log(`Organization setup completed: ${data.businessName} (${data.industryType})`);

      return {
        settingId: result.lastInsertRowid,
        industryType: data.industryType,
        businessName: data.businessName,
        industryConfig,
      };
    } catch (error) {
      console.error('setupOrganization error:', error);
      throw error;
    }
  }

  /**
   * Update organization settings
   * @param {Object} data - Settings to update
   * @returns {Promise<Object>}
   */
  async updateOrganizationSettings(data) {
    const db = this.getDB();

    try {
      const current = await this.getOrganizationSettings();
      if (!current) {
        throw new Error('No organization configured. Run setup first.');
      }

      // Build update fields
      const updates = {};
      const params = [];
      const setClauses = [];

      if (data.businessName !== undefined) {
        setClauses.push('business_name = ?');
        params.push(data.businessName.trim());
        updates.businessName = data.businessName;
      }
      if (data.ownerName !== undefined) {
        setClauses.push('owner_name = ?');
        params.push(data.ownerName.trim());
        updates.ownerName = data.ownerName;
      }
      if (data.address !== undefined) {
        setClauses.push('address = ?');
        params.push(data.address?.trim() || null);
      }
      if (data.phone !== undefined) {
        setClauses.push('phone = ?');
        params.push(data.phone?.trim() || null);
      }
      if (data.email !== undefined) {
        setClauses.push('email = ?');
        params.push(data.email?.trim() || null);
      }
      if (data.currency !== undefined) {
        setClauses.push('currency_symbol = ?');
        params.push(data.currency);
      }
      if (data.dateFormat !== undefined) {
        setClauses.push('date_format = ?');
        params.push(data.dateFormat);
      }
      if (data.theme !== undefined) {
        setClauses.push('theme = ?');
        params.push(data.theme);
      }
      if (data.autoLogoutMinutes !== undefined) {
        setClauses.push('auto_logout_minutes = ?');
        params.push(data.autoLogoutMinutes);
      }
      if (data.backupSchedule !== undefined) {
        setClauses.push('backup_schedule = ?');
        params.push(data.backupSchedule);
      }

      if (setClauses.length === 0) {
        return { success: true, message: 'Nothing to update' };
      }

      setClauses.push('updated_at = CURRENT_TIMESTAMP');
      params.push(current.setting_id);

      await db.execute(
        `UPDATE OrganizationSettings SET ${setClauses.join(', ')} WHERE setting_id = ?`,
        params
      );

      // Log to history
      await db.createHistoryEntry(
        'OrganizationSettings',
        current.setting_id,
        'UPDATE',
        current,
        updates,
        null
      );

      return { success: true };
    } catch (error) {
      console.error('updateOrganizationSettings error:', error);
      throw error;
    }
  }

  /**
   * Get the current industry configuration (terminology, features, navigation)
   * @returns {Promise<Object>}
   */
  async getIndustryConfiguration() {
    try {
      const settings = await this.getOrganizationSettings();
      if (!settings) {
        return null;
      }

      const industryConfig = getIndustryConfig(settings.industry_type);
      
      return {
        industry: settings.industry_type,
        industryType: settings.industry_type,
        displayName: industryConfig.displayName,
        terminology: industryConfig.terminology,
        features: industryConfig.features,
        navigation: industryConfig.navigation,
        transactionTypes: industryConfig.transactionTypes,
        dashboardStats: industryConfig.dashboardStats,
        businessName: settings.business_name,
        ownerName: settings.owner_name,
        currency: settings.currency_symbol || 'PKR',
        dateFormat: settings.date_format || 'DD/MM/YYYY',
        theme: settings.theme || 'light',
        autoLogoutMinutes: settings.auto_logout_minutes || 30,
      };
    } catch (error) {
      console.error('getIndustryConfiguration error:', error);
      return null;
    }
  }

  /**
   * Get available industry options for setup wizard
   * @returns {Array}
   */
  getAvailableIndustries() {
    return getAvailableIndustries();
  }

  /**
   * Change industry type (WARNING: This is a major operation)
   * Only available from Settings, requires confirmation
   * @param {string} newIndustryType
   * @returns {Promise<Object>}
   */
  async changeIndustryType(newIndustryType) {
    const db = this.getDB();

    try {
      const current = await this.getOrganizationSettings();
      if (!current) {
        throw new Error('No organization configured');
      }

      const validIndustries = ['RETAIL', 'MEDICAL', 'REAL_ESTATE', 'AGRICULTURAL'];
      if (!validIndustries.includes(newIndustryType)) {
        throw new Error(`Invalid industry type: ${newIndustryType}`);
      }

      if (current.industry_type === newIndustryType) {
        return { success: true, message: 'Industry type unchanged' };
      }

      const newConfig = getIndustryConfig(newIndustryType);
      const configJson = JSON.stringify({
        industry: newIndustryType,
        terminology: newConfig.terminology,
        features: newConfig.features,
        navigation: newConfig.navigation,
        transactionTypes: newConfig.transactionTypes,
        dashboardStats: newConfig.dashboardStats,
      });

      await db.execute(
        `UPDATE OrganizationSettings 
         SET industry_type = ?, config_json = ?, updated_at = CURRENT_TIMESTAMP 
         WHERE setting_id = ?`,
        [newIndustryType, configJson, current.setting_id]
      );

      // Log to history
      await db.createHistoryEntry(
        'OrganizationSettings',
        current.setting_id,
        'INDUSTRY_CHANGE',
        { industry_type: current.industry_type },
        { industry_type: newIndustryType },
        null
      );

      console.log(`Industry type changed: ${current.industry_type} → ${newIndustryType}`);

      return {
        success: true,
        previousIndustry: current.industry_type,
        newIndustry: newIndustryType,
        newConfig,
      };
    } catch (error) {
      console.error('changeIndustryType error:', error);
      throw error;
    }
  }
}
