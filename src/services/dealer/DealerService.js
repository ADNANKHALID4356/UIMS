import { DatabaseService } from '../database/DatabaseService.js';
import LedgerService from '../ledger/LedgerService.js';
import { getIndustryConfig } from '../organization/industryConfigs.js';

/**
 * Dealer Service - Handles all dealer-related business logic
 * Sprint 3 - FR-3.2 Dealer Management
 */
export class DealerService {
  static instance = null;
  databaseService = null;

  constructor() {
    this.databaseService = DatabaseService.getInstance();
  }

  /**
   * Get singleton instance
   */
  static getInstance() {
    if (!DealerService.instance) {
      DealerService.instance = new DealerService();
    }
    return DealerService.instance;
  }

  /**
   * Get the ID prefix for dealers based on current industry configuration.
   * Falls back to 'D' (agricultural) if no organization is configured.
   * @returns {Promise<string>}
   */
  async getIdPrefix() {
    try {
      const orgRow = await this.databaseService.query(
        'SELECT industry_type FROM OrganizationSettings WHERE is_active = 1 ORDER BY setting_id DESC LIMIT 1'
      );
      if (orgRow.length > 0 && orgRow[0].industry_type) {
        const config = getIndustryConfig(orgRow[0].industry_type);
        return config.terminology.dealerIdPrefix || 'D';
      }
      return 'D';
    } catch {
      return 'D';
    }
  }

  /**
   * Generate next specific dealer ID using the industry-appropriate prefix.
   * Examples: D001 (Agricultural), DI001 (Retail/Medical), AG001 (Real Estate)
   */
  async generateSpecificId() {
    try {
      const prefix = await this.getIdPrefix();

      const result = await this.databaseService.query(
        `SELECT specific_id FROM Dealers ORDER BY dealer_id DESC LIMIT 1`
      );

      if (result.length === 0) {
        return `${prefix}001`;
      }

      const lastId = result[0].specific_id;
      const numericPart = parseInt(lastId.replace(/^[A-Za-z]+/, ''));
      const nextNumber = numericPart + 1;
      return `${prefix}${String(nextNumber).padStart(3, '0')}`;
    } catch (error) {
      console.error('Generate specific ID error:', error);
      throw new Error('Failed to generate dealer ID');
    }
  }

  /**
   * Validate CNIC format (13 digits)
   */
  validateCNIC(cnic) {
    if (!cnic) {
      throw new Error('CNIC is required');
    }
    const cnicPattern = /^\d{13}$/;
    if (!cnicPattern.test(cnic.replace(/[-\s]/g, ''))) {
      throw new Error('CNIC must be exactly 13 digits');
    }
    return cnic.replace(/[-\s]/g, '');
  }

  /**
   * Validate phone number format (supports Pakistani + international formats)
   */
  validatePhone(phone) {
    if (!phone) return null;
    const cleaned = phone.replace(/[\s\-\(\)]/g, '');
    const phonePattern = /^\+?\d{10,15}$/;
    if (!phonePattern.test(cleaned)) {
      throw new Error('Invalid phone number format. Must be 10-15 digits.');
    }
    return phone;
  }

  /**
   * Create a new dealer
   * @param {Object} dealerData - Dealer information
   * @param {number} userId - ID of the user creating the dealer
   * @returns {Object} Created dealer object
   */
  async createDealer(dealerData, userId) {
    try {
      // Validate required fields
      if (!dealerData.name || dealerData.name.trim() === '') {
        throw new Error('Dealer name is required');
      }
      if (!dealerData.cnic) {
        throw new Error('CNIC is required');
      }

      // Validate and clean CNIC
      const cleanedCNIC = this.validateCNIC(dealerData.cnic);

      // Check if CNIC already exists
      const existingDealer = await this.databaseService.query(
        'SELECT dealer_id FROM Dealers WHERE cnic = ?',
        [cleanedCNIC]
      );
      if (existingDealer.length > 0) {
        throw new Error('A dealer with this CNIC already exists');
      }

      // Validate phone if provided
      const validatedPhone = this.validatePhone(dealerData.phone);

      // Generate specific ID
      const specificId = await this.generateSpecificId();

      // Insert dealer
      const result = await this.databaseService.execute(
        `INSERT INTO Dealers (
          specific_id, name, contact_person, father_name, cnic, phone, address,
          commission_rate, is_permanent,
          balance, credit, created_by
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 0.00, 0.00, ?)`,
        [
          specificId,
          dealerData.name.trim(),
          dealerData.contact_person ? dealerData.contact_person.trim() : null,
          dealerData.father_name ? dealerData.father_name.trim() : null,
          cleanedCNIC,
          validatedPhone,
          dealerData.address ? dealerData.address.trim() : null,
          dealerData.commission_rate || null,
          dealerData.is_permanent !== undefined ? (dealerData.is_permanent ? 1 : 0) : 1,
          userId
        ]
      );

      const dealerId = result.lastInsertRowid;

      // Create initial ledger entry
      await this.databaseService.execute(
        `INSERT INTO LedgerEntries (
          entity_type, entity_id, transaction_type, description, 
          debit, credit, balance, created_by
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          'Dealer',
          dealerId,
          'Account Created',
          `Initial account creation for dealer ${specificId} - ${dealerData.name}`,
          0.00,
          0.00,
          0.00,
          userId
        ]
      );

      // Log history
      await this.databaseService.execute(
        `INSERT INTO History (
          action_type, table_name, record_id, new_values, performed_by, description
        ) VALUES (?, ?, ?, ?, ?, ?)`,
        [
          'CREATE',
          'Dealers',
          dealerId,
          JSON.stringify({ ...dealerData, specific_id: specificId }),
          userId,
          `Created dealer: ${dealerData.name} (${specificId})`
        ]
      );

      // Fetch and return the created dealer
      const dealers = await this.databaseService.query(
        'SELECT * FROM Dealers WHERE dealer_id = ?',
        [dealerId]
      );

      console.log(`Dealer created successfully: ${specificId} - ${dealerData.name}`);
      return dealers[0];
    } catch (error) {
      console.error('Create dealer error:', error);
      throw error;
    }
  }

  /**
   * Get dealer by internal ID
   * @param {number} dealerId - Internal dealer ID
   * @returns {Object|null} Dealer object or null
   */
  async getDealerById(dealerId) {
    try {
      const dealers = await this.databaseService.query(
        'SELECT * FROM Dealers WHERE dealer_id = ?',
        [dealerId]
      );
      return dealers.length > 0 ? dealers[0] : null;
    } catch (error) {
      console.error('Get dealer by ID error:', error);
      throw error;
    }
  }

  /**
   * Get dealer by specific ID (D001, D002...)
   * @param {string} specificId - Specific dealer ID
   * @returns {Object|null} Dealer object or null
   */
  async getDealerBySpecificId(specificId) {
    try {
      const dealers = await this.databaseService.query(
        'SELECT * FROM Dealers WHERE specific_id = ?',
        [specificId]
      );
      return dealers.length > 0 ? dealers[0] : null;
    } catch (error) {
      console.error('Get dealer by specific ID error:', error);
      throw error;
    }
  }

  /**
   * Get all dealers
   * @param {boolean} activeOnly - Filter for active dealers only
   * @returns {Array} Array of dealer objects
   */
  async getAllDealers(activeOnly = true) {
    try {
      const query = activeOnly
        ? 'SELECT * FROM Dealers WHERE is_active = 1 ORDER BY specific_id'
        : 'SELECT * FROM Dealers ORDER BY specific_id';
      const dealers = await this.databaseService.query(query);
      
      // Calculate real-time balance and credit from ledger for each dealer
      const ledgerService = new LedgerService();
      const dealersWithLedger = await Promise.all(
        dealers.map(async (dealer) => {
          try {
            const ledger = await ledgerService.getEntityLedger('dealer', dealer.dealer_id, {});
            if (ledger.success && ledger.data && ledger.data.statistics) {
              return {
                ...dealer,
                balance: ledger.data.statistics.current_entity_balance || ledger.data.statistics.current_advance || 0,
                credit: ledger.data.statistics.current_entity_credit || ledger.data.statistics.total_outstanding_credit || 0
              };
            }
            return dealer;
          } catch (err) {
            console.error(`Error calculating ledger for dealer ${dealer.dealer_id}:`, err);
            return dealer;
          }
        })
      );
      
      return dealersWithLedger;
    } catch (error) {
      console.error('Get all dealers error:', error);
      throw error;
    }
  }

  /**
   * Update dealer information
   * @param {number} dealerId - Internal dealer ID
   * @param {Object} dealerData - Updated dealer information
   * @param {number} userId - ID of the user performing the update
   * @returns {Object} Updated dealer object
   */
  async updateDealer(dealerId, dealerData, userId) {
    try {
      // Get existing dealer for history
      const existingDealer = await this.getDealerById(dealerId);
      if (!existingDealer) {
        throw new Error('Dealer not found');
      }

      // Validate name if provided
      if (dealerData.name !== undefined && dealerData.name.trim() === '') {
        throw new Error('Dealer name cannot be empty');
      }

      // Validate and clean CNIC if provided
      let cleanedCNIC = existingDealer.cnic;
      if (dealerData.cnic && dealerData.cnic !== existingDealer.cnic) {
        cleanedCNIC = this.validateCNIC(dealerData.cnic);

        // Check if new CNIC already exists
        const existingCNIC = await this.databaseService.query(
          'SELECT dealer_id FROM Dealers WHERE cnic = ? AND dealer_id != ?',
          [cleanedCNIC, dealerId]
        );
        if (existingCNIC.length > 0) {
          throw new Error('A dealer with this CNIC already exists');
        }
      }

      // Validate phone if provided
      const validatedPhone = dealerData.phone
        ? this.validatePhone(dealerData.phone)
        : existingDealer.phone;

      // Update dealer
      await this.databaseService.execute(
        `UPDATE Dealers SET
          name = ?,
          contact_person = ?,
          father_name = ?,
          cnic = ?,
          phone = ?,
          address = ?,
          commission_rate = ?,
          is_permanent = ?,
          updated_at = CURRENT_TIMESTAMP
        WHERE dealer_id = ?`,
        [
          dealerData.name !== undefined ? dealerData.name.trim() : existingDealer.name,
          dealerData.contact_person !== undefined ? dealerData.contact_person : existingDealer.contact_person,
          dealerData.father_name !== undefined ? dealerData.father_name : existingDealer.father_name,
          cleanedCNIC,
          validatedPhone,
          dealerData.address !== undefined ? dealerData.address : existingDealer.address,
          dealerData.commission_rate !== undefined ? (dealerData.commission_rate || null) : existingDealer.commission_rate,
          dealerData.is_permanent !== undefined ? (dealerData.is_permanent ? 1 : 0) : existingDealer.is_permanent,
          dealerId
        ]
      );

      // Log history
      await this.databaseService.execute(
        `INSERT INTO History (
          action_type, table_name, record_id, old_values, new_values, performed_by, description
        ) VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [
          'UPDATE',
          'Dealers',
          dealerId,
          JSON.stringify(existingDealer),
          JSON.stringify(dealerData),
          userId,
          `Updated dealer: ${existingDealer.specific_id}`
        ]
      );

      // Return updated dealer
      const updatedDealer = await this.getDealerById(dealerId);
      console.log(`Dealer updated successfully: ${updatedDealer.specific_id}`);
      return updatedDealer;
    } catch (error) {
      console.error('Update dealer error:', error);
      throw error;
    }
  }

  /**
   * Delete dealer (soft delete)
   * @param {number} dealerId - Internal dealer ID
   * @param {number} userId - ID of the user performing the deletion
   * @returns {boolean} Success status
   */
  async deleteDealer(dealerId, userId) {
    try {
      // Get dealer information
      const dealer = await this.getDealerById(dealerId);
      if (!dealer) {
        throw new Error('Dealer not found');
      }

      // Get real-time balance and credit from ledger
      const ledgerService = new LedgerService();
      const ledger = await ledgerService.getEntityLedger('dealer', dealerId, {});
      const realBalance = ledger.success && ledger.data && ledger.data.statistics 
        ? (ledger.data.statistics.current_entity_balance || ledger.data.statistics.current_advance || 0)
        : dealer.balance;
      const realCredit = ledger.success && ledger.data && ledger.data.statistics
        ? (ledger.data.statistics.current_entity_credit || ledger.data.statistics.total_outstanding_credit || 0)
        : dealer.credit;

      // Check if dealer has outstanding balance or credit
      console.log(`[DealerService] Delete validation: ${dealer.name} - Balance: ${realBalance} (${typeof realBalance}), Credit: ${realCredit} (${typeof realCredit})`);
      if (realBalance !== 0 || realCredit !== 0) {
        throw new Error(
          'Cannot delete dealer with outstanding balance or credit. Please settle all accounts first.'
        );
      }

      // Soft delete (set is_active = 0)
      await this.databaseService.execute(
        'UPDATE Dealers SET is_active = 0, updated_at = CURRENT_TIMESTAMP WHERE dealer_id = ?',
        [dealerId]
      );

      // Log history
      await this.databaseService.execute(
        `INSERT INTO History (
          action_type, table_name, record_id, old_values, performed_by, description
        ) VALUES (?, ?, ?, ?, ?, ?)`,
        [
          'DELETE',
          'Dealers',
          dealerId,
          JSON.stringify(dealer),
          userId,
          `Deleted dealer: ${dealer.specific_id} - ${dealer.name}`
        ]
      );

      console.log(`Dealer deleted successfully: ${dealer.specific_id}`);
      return true;
    } catch (error) {
      console.error('Delete dealer error:', error);
      throw error;
    }
  }

  /**
   * Search dealers by various criteria
   * @param {string} searchTerm - Search term
   * @returns {Array} Array of matching dealers
   */
  async searchDealers(searchTerm) {
    try {
      console.log('[DealerService] searchDealers called with term:', searchTerm);
      
      if (!searchTerm || searchTerm.trim() === '') {
        console.log('[DealerService] Empty search term, returning all dealers');
        return await this.getAllDealers();
      }

      const term = `%${searchTerm.trim()}%`;
      console.log('[DealerService] Executing search query with pattern:', term);
      
      const dealers = await this.databaseService.query(
        `SELECT * FROM Dealers 
         WHERE is_active = 1 AND (
           specific_id LIKE ? OR
           name LIKE ? OR
           contact_person LIKE ? OR
           father_name LIKE ? OR
           cnic LIKE ? OR
           phone LIKE ?
         )
         ORDER BY specific_id`,
        [term, term, term, term, term, term]
      );

      console.log('[DealerService] Search returned', dealers.length, 'dealers');
      return dealers;
    } catch (error) {
      console.error('Search dealers error:', error);
      throw error;
    }
  }

  /**
   * Get dealer ledger entries
   * @param {number} dealerId - Internal dealer ID
   * @returns {Array} Array of ledger entries
   */
  async getDealerLedger(dealerId) {
    try {
      const ledger = await this.databaseService.query(
        `SELECT * FROM LedgerEntries 
         WHERE entity_type = 'Dealer' AND entity_id = ?
         ORDER BY entry_date DESC`,
        [dealerId]
      );
      return ledger;
    } catch (error) {
      console.error('Get dealer ledger error:', error);
      throw error;
    }
  }

  /**
   * Get dealer statistics
   * @returns {Object} Statistics object
   */
  async getDealerStatistics() {
    try {
      const stats = await this.databaseService.query(
        `SELECT 
           COUNT(*) as totalDealers,
           SUM(CASE WHEN is_active = 1 THEN 1 ELSE 0 END) as activeDealers,
           SUM(balance) as totalBalance,
           SUM(credit) as totalCredit
         FROM Dealers
         WHERE is_active = 1`
      );

      return {
        totalDealers: stats[0].totalDealers || 0,
        activeDealers: stats[0].activeDealers || 0,
        totalBalance: parseFloat(stats[0].totalBalance) || 0,
        totalCredit: parseFloat(stats[0].totalCredit) || 0
      };
    } catch (error) {
      console.error('Get dealer statistics error:', error);
      throw error;
    }
  }
}
