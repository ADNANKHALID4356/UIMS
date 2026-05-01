import { DatabaseService } from '../database/DatabaseService.js';
import LedgerService from '../ledger/LedgerService.js';
import { getIndustryConfig } from '../organization/industryConfigs.js';

/**
 * Farmer Service - Complete offline business logic for farmer management
 * Implements SRS FR-3.1 requirements (Sprint 2)
 */
export class FarmerService {
  static instance = null;
  dbService = null;

  constructor() {
    this.dbService = DatabaseService.getInstance();
  }

  /**
   * Get singleton instance
   */
  static getInstance() {
    if (!FarmerService.instance) {
      FarmerService.instance = new FarmerService();
    }
    return FarmerService.instance;
  }

  /**
   * Validate CNIC format (13 digits)
   * @param {string} cnic - CNIC to validate
   * @returns {boolean}
   */
  validateCNIC(cnic) {
    if (!cnic) return false;
    const cnicPattern = /^\d{13}$/;
    return cnicPattern.test(cnic.replace(/-/g, ''));
  }

  /**
   * Validate phone number format (supports Pakistani + international formats)
   * @param {string} phone - Phone number to validate
   * @returns {boolean}
   */
  validatePhone(phone) {
    if (!phone) return true; // Phone is optional
    const cleaned = phone.replace(/[\s\-\(\)]/g, '');
    // Accept Pakistani format (+92/0 prefix) or generic 10-15 digit international
    const phonePattern = /^(\+?\d{10,15})$/;
    return phonePattern.test(cleaned);
  }

  /**
   * Check if CNIC already exists (for uniqueness)
   * @param {string} cnic - CNIC to check
   * @param {number} excludeFarmerId - Farmer ID to exclude from check (for updates)
   * @returns {Promise<boolean>}
   */
  async isCNICUnique(cnic, excludeFarmerId = null) {
    try {
      const cleanCNIC = cnic.replace(/-/g, '');
      let sql = 'SELECT COUNT(*) as count FROM Farmers WHERE cnic = ?';
      const params = [cleanCNIC];

      if (excludeFarmerId) {
        sql += ' AND farmer_id != ?';
        params.push(excludeFarmerId);
      }

      const result = await this.dbService.query(sql, params);
      return result[0].count === 0;
    } catch (error) {
      console.error('Error checking CNIC uniqueness:', error);
      throw error;
    }
  }

  /**
   * Get the ID prefix for customers based on the current industry configuration.
   * Falls back to 'F' (agricultural) if no organization is configured.
   * @returns {Promise<string>}
   */
  async getIdPrefix() {
    try {
      const orgRow = await this.dbService.query(
        'SELECT industry_type FROM OrganizationSettings WHERE is_active = 1 ORDER BY setting_id DESC LIMIT 1'
      );
      if (orgRow.length > 0 && orgRow[0].industry_type) {
        const config = getIndustryConfig(orgRow[0].industry_type);
        return config.terminology.customerIdPrefix || 'F';
      }
      return 'F';
    } catch {
      return 'F';
    }
  }

  /**
   * Generate next Specific ID using the industry-appropriate prefix.
   * Examples: F001 (Agricultural), CU001 (Retail), PT001 (Medical), CL001 (Real Estate)
   * @returns {Promise<string>}
   */
  async generateSpecificID() {
    try {
      const prefix = await this.getIdPrefix();

      const result = await this.dbService.query(
        'SELECT specific_id FROM Farmers ORDER BY farmer_id DESC LIMIT 1'
      );

      if (result.length === 0) {
        return `${prefix}001`;
      }

      const lastID = result[0].specific_id;
      // Extract numeric part by stripping all leading alpha characters
      const numericPart = parseInt(lastID.replace(/^[A-Za-z]+/, '')) + 1;
      return `${prefix}${String(numericPart).padStart(3, '0')}`;
    } catch (error) {
      console.error('Error generating specific ID:', error);
      throw error;
    }
  }

  /**
   * Create new farmer (FR-3.1.1)
   * @param {Object} farmerData - Farmer details
   * @param {number} userId - ID of user creating the farmer
   * @returns {Promise<Object>} - Created farmer with ID
   */
  async createFarmer(farmerData, userId) {
    try {
      // Validate required fields
      if (!farmerData.name || !farmerData.cnic) {
        throw new Error('Name and CNIC are required');
      }

      // Validate CNIC format
      if (!this.validateCNIC(farmerData.cnic)) {
        throw new Error('Invalid CNIC format. Must be 13 digits');
      }

      // Validate phone if provided
      if (farmerData.phone && !this.validatePhone(farmerData.phone)) {
        throw new Error('Invalid phone number format');
      }

      // Check CNIC uniqueness
      const isUnique = await this.isCNICUnique(farmerData.cnic);
      if (!isUnique) {
        throw new Error('CNIC already exists');
      }

      // Generate Specific ID
      const specificID = await this.generateSpecificID();

      // Clean CNIC (remove dashes)
      const cleanCNIC = farmerData.cnic.replace(/-/g, '');

      // Begin transaction
      this.dbService.beginTransaction();

      try {
        // Insert farmer
        const result = await this.dbService.execute(
          `INSERT INTO Farmers (
            specific_id, name, father_name, cnic, phone, address, 
            date_of_birth, allergies, chronic_conditions,
            client_type, budget_min, budget_max, preferred_locations,
            customer_group, is_permanent,
            balance, credit, is_active, created_by, created_at, updated_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0.00, 0.00, 1, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
          [
            specificID,
            farmerData.name,
            farmerData.father_name || null,
            cleanCNIC,
            farmerData.phone || null,
            farmerData.address || null,
            farmerData.date_of_birth || null,
            farmerData.allergies || null,
            farmerData.chronic_conditions || null,
            farmerData.client_type || null,
            farmerData.budget_min || null,
            farmerData.budget_max || null,
            farmerData.preferred_locations || null,
            farmerData.customer_group || null,
            farmerData.is_permanent !== undefined ? (farmerData.is_permanent ? 1 : 0) : 1,
            userId
          ]
        );

        const farmerId = result.lastInsertRowid;

        // Create initial ledger entry
        await this.dbService.execute(
          `INSERT INTO LedgerEntries (
            entity_type, entity_id, transaction_type, 
            debit, credit, balance, description, entry_date, created_by
          ) VALUES (?, ?, ?, 0.00, 0.00, 0.00, ?, CURRENT_TIMESTAMP, ?)`,
          ['FARMER', farmerId, 'ACCOUNT_OPENED', 'Account Opened', userId]
        );

        // Log in history
        await this.dbService.execute(
          `INSERT INTO History (
            action_type, table_name, record_id, 
            new_values, performed_by, performed_at, description
          ) VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP, ?)`,
          [
            'CREATE',
            'Farmers',
            farmerId,
            JSON.stringify(farmerData),
            userId,
            `Farmer ${specificID} created`
          ]
        );

        // Commit transaction
        this.dbService.commit();

        // Return created farmer
        return {
          farmer_id: farmerId,
          specific_id: specificID,
          ...farmerData,
          balance: 0.00,
          credit: 0.00,
          is_active: 1
        };
      } catch (error) {
        this.dbService.rollback();
        throw error;
      }
    } catch (error) {
      console.error('Error creating farmer:', error);
      throw error;
    }
  }

  /**
   * Get farmer by ID (FR-3.1.2)
   * @param {number} farmerId - Farmer ID
   * @returns {Promise<Object|null>}
   */
  async getFarmerById(farmerId) {
    try {
      const result = await this.dbService.query(
        'SELECT * FROM Farmers WHERE farmer_id = ?',
        [farmerId]
      );
      return result.length > 0 ? result[0] : null;
    } catch (error) {
      console.error('Error getting farmer:', error);
      throw error;
    }
  }

  /**
   * Get farmer by Specific ID (F01, F02...)
   * @param {string} specificId - Specific ID
   * @returns {Promise<Object|null>}
   */
  async getFarmerBySpecificId(specificId) {
    try {
      const result = await this.dbService.query(
        'SELECT * FROM Farmers WHERE specific_id = ?',
        [specificId]
      );
      return result.length > 0 ? result[0] : null;
    } catch (error) {
      console.error('Error getting farmer by specific ID:', error);
      throw error;
    }
  }

  /**
   * Get all farmers (FR-3.1.2)
   * @param {boolean} activeOnly - Return only active farmers
   * @returns {Promise<Array>}
   */
  async getAllFarmers(activeOnly = false) {
    try {
      let sql = 'SELECT * FROM Farmers';
      if (activeOnly) {
        sql += ' WHERE is_active = 1';
      }
      sql += ' ORDER BY farmer_id DESC';

      const farmers = await this.dbService.query(sql);
      
      // Calculate real-time balance and credit from ledger for each farmer
      const ledgerService = new LedgerService();
      const farmersWithLedger = await Promise.all(
        farmers.map(async (farmer) => {
          try {
            const ledger = await ledgerService.getEntityLedger('farmer', farmer.farmer_id, {});
            if (ledger.success && ledger.data && ledger.data.statistics) {
              return {
                ...farmer,
                balance: ledger.data.statistics.current_entity_balance || ledger.data.statistics.current_advance || 0,
                credit: ledger.data.statistics.current_entity_credit || ledger.data.statistics.total_outstanding_credit || 0
              };
            }
            return farmer;
          } catch (err) {
            console.error(`Error calculating ledger for farmer ${farmer.farmer_id}:`, err);
            return farmer;
          }
        })
      );
      
      return farmersWithLedger;
    } catch (error) {
      console.error('Error getting all farmers:', error);
      throw error;
    }
  }

  /**
   * Update farmer (FR-3.1.3)
   * @param {number} farmerId - Farmer ID
   * @param {Object} farmerData - Updated farmer details
   * @param {number} userId - ID of user updating the farmer
   * @returns {Promise<Object>}
   */
  async updateFarmer(farmerId, farmerData, userId) {
    try {
      // Get existing farmer
      const existingFarmer = await this.getFarmerById(farmerId);
      if (!existingFarmer) {
        throw new Error('Farmer not found');
      }

      // Validate CNIC format if changed
      if (farmerData.cnic && !this.validateCNIC(farmerData.cnic)) {
        throw new Error('Invalid CNIC format. Must be 13 digits');
      }

      // Validate phone if provided
      if (farmerData.phone && !this.validatePhone(farmerData.phone)) {
        throw new Error('Invalid phone number format');
      }

      // Check CNIC uniqueness if changed
      if (farmerData.cnic && farmerData.cnic !== existingFarmer.cnic) {
        const isUnique = await this.isCNICUnique(farmerData.cnic, farmerId);
        if (!isUnique) {
          throw new Error('CNIC already exists');
        }
      }

      // Clean CNIC if provided
      const cleanCNIC = farmerData.cnic ? farmerData.cnic.replace(/-/g, '') : existingFarmer.cnic;

      // Begin transaction
      this.dbService.beginTransaction();

      try {
        // Update farmer
        await this.dbService.execute(
          `UPDATE Farmers SET 
            name = ?, father_name = ?, cnic = ?, phone = ?, address = ?,
            date_of_birth = ?, allergies = ?, chronic_conditions = ?,
            client_type = ?, budget_min = ?, budget_max = ?, preferred_locations = ?,
            customer_group = ?, is_permanent = ?,
            updated_at = CURRENT_TIMESTAMP
          WHERE farmer_id = ?`,
          [
            farmerData.name || existingFarmer.name,
            farmerData.father_name !== undefined ? farmerData.father_name : existingFarmer.father_name,
            cleanCNIC,
            farmerData.phone !== undefined ? farmerData.phone : existingFarmer.phone,
            farmerData.address !== undefined ? farmerData.address : existingFarmer.address,
            farmerData.date_of_birth !== undefined ? (farmerData.date_of_birth || null) : existingFarmer.date_of_birth,
            farmerData.allergies !== undefined ? (farmerData.allergies || null) : existingFarmer.allergies,
            farmerData.chronic_conditions !== undefined ? (farmerData.chronic_conditions || null) : existingFarmer.chronic_conditions,
            farmerData.client_type !== undefined ? (farmerData.client_type || null) : existingFarmer.client_type,
            farmerData.budget_min !== undefined ? (farmerData.budget_min || null) : existingFarmer.budget_min,
            farmerData.budget_max !== undefined ? (farmerData.budget_max || null) : existingFarmer.budget_max,
            farmerData.preferred_locations !== undefined ? (farmerData.preferred_locations || null) : existingFarmer.preferred_locations,
            farmerData.customer_group !== undefined ? (farmerData.customer_group || null) : existingFarmer.customer_group,
            farmerData.is_permanent !== undefined ? (farmerData.is_permanent ? 1 : 0) : existingFarmer.is_permanent,
            farmerId
          ]
        );

        // Log in history
        await this.dbService.execute(
          `INSERT INTO History (
            action_type, table_name, record_id, 
            old_values, new_values, performed_by, performed_at, description
          ) VALUES (?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, ?)`,
          [
            'UPDATE',
            'Farmers',
            farmerId,
            JSON.stringify(existingFarmer),
            JSON.stringify(farmerData),
            userId,
            `Farmer ${existingFarmer.specific_id} updated`
          ]
        );

        // Commit transaction
        this.dbService.commit();

        // Return updated farmer
        return await this.getFarmerById(farmerId);
      } catch (error) {
        this.dbService.rollback();
        throw error;
      }
    } catch (error) {
      console.error('Error updating farmer:', error);
      throw error;
    }
  }

  /**
   * Delete/Deactivate farmer (FR-3.1.4)
   * Soft delete - marks as inactive instead of hard delete
   * @param {number} farmerId - Farmer ID
   * @param {number} userId - ID of user deleting the farmer
   * @returns {Promise<boolean>}
   */
  async deleteFarmer(farmerId, userId) {
    try {
      // Get existing farmer
      const farmer = await this.getFarmerById(farmerId);
      if (!farmer) {
        throw new Error('Farmer not found');
      }

      // Get real-time balance and credit from ledger
      const ledgerService = new LedgerService();
      const ledger = await ledgerService.getEntityLedger('farmer', farmerId, {});
      const realBalance = ledger.success && ledger.data && ledger.data.statistics 
        ? (ledger.data.statistics.current_entity_balance || ledger.data.statistics.current_advance || 0)
        : farmer.balance;
      const realCredit = ledger.success && ledger.data && ledger.data.statistics
        ? (ledger.data.statistics.current_entity_credit || ledger.data.statistics.total_outstanding_credit || 0)
        : farmer.credit;

      // Check if farmer has outstanding balance or credit
      console.log(`[FarmerService] Delete validation: ${farmer.name} - Balance: ${realBalance} (${typeof realBalance}), Credit: ${realCredit} (${typeof realCredit})`);
      if (realBalance !== 0 || realCredit !== 0) {
        throw new Error('Cannot delete farmer with outstanding balance or credit');
      }

      // Begin transaction
      this.dbService.beginTransaction();

      try {
        // Soft delete - mark as inactive
        await this.dbService.execute(
          'UPDATE Farmers SET is_active = 0, updated_at = CURRENT_TIMESTAMP WHERE farmer_id = ?',
          [farmerId]
        );

        // Log in history
        await this.dbService.execute(
          `INSERT INTO History (
            action_type, table_name, record_id, 
            old_values, performed_by, performed_at, description
          ) VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP, ?)`,
          [
            'DELETE',
            'Farmers',
            farmerId,
            JSON.stringify(farmer),
            userId,
            `Farmer ${farmer.specific_id} deactivated`
          ]
        );

        // Commit transaction
        this.dbService.commit();

        return true;
      } catch (error) {
        this.dbService.rollback();
        throw error;
      }
    } catch (error) {
      console.error('Error deleting farmer:', error);
      throw error;
    }
  }

  /**
   * Search farmers (FR-3.1.5)
   * Supports search by: Specific ID, Name, CNIC, Phone
   * @param {string} searchTerm - Search term
   * @returns {Promise<Array>}
   */
  async searchFarmers(searchTerm) {
    try {
      if (!searchTerm || searchTerm.trim() === '') {
        return await this.getAllFarmers(true);
      }

      const cleanSearchTerm = searchTerm.trim();
      const searchPattern = `%${cleanSearchTerm}%`;

      // Search by specific_id, name, father_name, cnic, or phone
      const sql = `
        SELECT * FROM Farmers 
        WHERE is_active = 1 
        AND (
          specific_id LIKE ? OR
          name LIKE ? OR
          father_name LIKE ? OR
          cnic LIKE ? OR
          phone LIKE ?
        )
        ORDER BY farmer_id DESC
      `;

      return await this.dbService.query(sql, [
        searchPattern,
        searchPattern,
        searchPattern,
        searchPattern,
        searchPattern
      ]);
    } catch (error) {
      console.error('Error searching farmers:', error);
      throw error;
    }
  }

  /**
   * Get farmer ledger entries
   * @param {number} farmerId - Farmer ID
   * @returns {Promise<Array>}
   */
  async getFarmerLedger(farmerId) {
    try {
      return await this.dbService.query(
        `SELECT * FROM LedgerEntries 
         WHERE entity_type = 'FARMER' AND entity_id = ? 
         ORDER BY entry_date DESC`,
        [farmerId]
      );
    } catch (error) {
      console.error('Error getting farmer ledger:', error);
      throw error;
    }
  }

  /**
   * Get farmer statistics
   * @returns {Promise<Object>}
   */
  async getFarmerStatistics() {
    try {
      const stats = await this.dbService.query(`
        SELECT 
          COUNT(*) as total_farmers,
          SUM(CASE WHEN is_active = 1 THEN 1 ELSE 0 END) as active_farmers,
          SUM(balance) as total_balance,
          SUM(credit) as total_credit
        FROM Farmers
        WHERE is_active = 1
      `);

      return stats[0] || {
        total_farmers: 0,
        active_farmers: 0,
        total_balance: 0,
        total_credit: 0
      };
    } catch (error) {
      console.error('Error getting farmer statistics:', error);
      throw error;
    }
  }
}
