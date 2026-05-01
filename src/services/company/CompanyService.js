import { DatabaseService } from '../database/DatabaseService.js';
import LedgerService from '../ledger/LedgerService.js';
import { getIndustryConfig } from '../organization/industryConfigs.js';

/**
 * Company Service - Handles all company-related business logic
 * Sprint 3 - FR-3.3 Company Management
 */
export class CompanyService {
  static instance = null;
  databaseService = null;

  constructor() {
    this.databaseService = DatabaseService.getInstance();
  }

  /**
   * Get singleton instance
   */
  static getInstance() {
    if (!CompanyService.instance) {
      CompanyService.instance = new CompanyService();
    }
    return CompanyService.instance;
  }

  /**
   * Get the ID prefix for suppliers/companies based on current industry configuration.
   * Falls back to 'C' (agricultural) if no organization is configured.
   * @returns {Promise<string>}
   */
  async getIdPrefix() {
    try {
      const orgRow = await this.databaseService.query(
        'SELECT industry_type FROM OrganizationSettings WHERE is_active = 1 ORDER BY setting_id DESC LIMIT 1'
      );
      if (orgRow.length > 0 && orgRow[0].industry_type) {
        const config = getIndustryConfig(orgRow[0].industry_type);
        return config.terminology.supplierIdPrefix || 'C';
      }
      return 'C';
    } catch {
      return 'C';
    }
  }

  /**
   * Generate next specific company ID using the industry-appropriate prefix.
   * Examples: C001 (Agricultural), S001 (Retail), PH001 (Medical), OW001 (Real Estate)
   */
  async generateSpecificId() {
    try {
      const prefix = await this.getIdPrefix();

      const result = await this.databaseService.query(
        `SELECT specific_id FROM Companies ORDER BY company_id DESC LIMIT 1`
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
      throw new Error('Failed to generate company ID');
    }
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
   * Create a new company
   * @param {Object} companyData - Company information
   * @param {number} userId - ID of the user creating the company
   * @returns {Object} Created company object
   */
  async createCompany(companyData, userId) {
    try {
      // Validate required fields
      if (!companyData.company_name || companyData.company_name.trim() === '') {
        throw new Error('Company name is required');
      }

      // Check if company name already exists
      const existingCompany = await this.databaseService.query(
        'SELECT company_id FROM Companies WHERE company_name = ? AND is_active = 1',
        [companyData.company_name.trim()]
      );
      if (existingCompany.length > 0) {
        throw new Error('A company with this name already exists');
      }

      // Validate phone if provided
      const validatedPhone = this.validatePhone(companyData.phone);

      // Generate specific ID
      const specificId = await this.generateSpecificId();

      // Insert company
      const result = await this.databaseService.execute(
        `INSERT INTO Companies (
          specific_id, company_name, contact_person, father_name, address, phone, certifications,
          drug_license_number, is_permanent,
          balance, credit, created_by
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 0.00, 0.00, ?)`,
        [
          specificId,
          companyData.company_name.trim(),
          companyData.contact_person ? companyData.contact_person.trim() : null,
          companyData.father_name ? companyData.father_name.trim() : null,
          companyData.address ? companyData.address.trim() : null,
          validatedPhone,
          companyData.certifications ? companyData.certifications.trim() : null,
          companyData.drug_license_number ? companyData.drug_license_number.trim() : null,
          companyData.is_permanent !== undefined ? (companyData.is_permanent ? 1 : 0) : 1,
          userId
        ]
      );

      const companyId = result.lastInsertRowid;

      // Create initial ledger entry
      await this.databaseService.execute(
        `INSERT INTO LedgerEntries (
          entity_type, entity_id, transaction_type, description, 
          debit, credit, balance, created_by
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          'Company',
          companyId,
          'Account Created',
          `Initial account creation for company ${specificId} - ${companyData.company_name}`,
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
          'Companies',
          companyId,
          JSON.stringify({ ...companyData, specific_id: specificId }),
          userId,
          `Created company: ${companyData.company_name} (${specificId})`
        ]
      );

      // Fetch and return the created company
      const companies = await this.databaseService.query(
        'SELECT * FROM Companies WHERE company_id = ?',
        [companyId]
      );

      console.log(`Company created successfully: ${specificId} - ${companyData.company_name}`);
      return companies[0];
    } catch (error) {
      console.error('Create company error:', error);
      throw error;
    }
  }

  /**
   * Get company by internal ID
   * @param {number} companyId - Internal company ID
   * @returns {Object|null} Company object or null
   */
  async getCompanyById(companyId) {
    try {
      const companies = await this.databaseService.query(
        'SELECT * FROM Companies WHERE company_id = ?',
        [companyId]
      );
      return companies.length > 0 ? companies[0] : null;
    } catch (error) {
      console.error('Get company by ID error:', error);
      throw error;
    }
  }

  /**
   * Get company by specific ID (C001, C002...)
   * @param {string} specificId - Specific company ID
   * @returns {Object|null} Company object or null
   */
  async getCompanyBySpecificId(specificId) {
    try {
      const companies = await this.databaseService.query(
        'SELECT * FROM Companies WHERE specific_id = ?',
        [specificId]
      );
      return companies.length > 0 ? companies[0] : null;
    } catch (error) {
      console.error('Get company by specific ID error:', error);
      throw error;
    }
  }

  /**
   * Get all companies
   * @param {boolean} activeOnly - Filter for active companies only
   * @returns {Array} Array of company objects
   */
  async getAllCompanies(activeOnly = true) {
    try {
      const query = activeOnly
        ? 'SELECT * FROM Companies WHERE is_active = 1 ORDER BY specific_id'
        : 'SELECT * FROM Companies ORDER BY specific_id';
      const companies = await this.databaseService.query(query);
      
      // Calculate real-time balance and credit from ledger for each company
      const ledgerService = new LedgerService();
      const companiesWithLedger = await Promise.all(
        companies.map(async (company) => {
          try {
            const ledger = await ledgerService.getEntityLedger('company', company.company_id, {});
            if (ledger.success && ledger.data && ledger.data.statistics) {
              return {
                ...company,
                balance: ledger.data.statistics.current_entity_balance || ledger.data.statistics.current_advance || 0,
                credit: ledger.data.statistics.current_entity_credit || ledger.data.statistics.total_outstanding_credit || 0
              };
            }
            return company;
          } catch (err) {
            console.error(`Error calculating ledger for company ${company.company_id}:`, err);
            return company;
          }
        })
      );
      
      return companiesWithLedger;
    } catch (error) {
      console.error('Get all companies error:', error);
      throw error;
    }
  }

  /**
   * Update company information
   * @param {number} companyId - Internal company ID
   * @param {Object} companyData - Updated company information
   * @param {number} userId - ID of the user performing the update
   * @returns {Object} Updated company object
   */
  async updateCompany(companyId, companyData, userId) {
    try {
      // Get existing company for history
      const existingCompany = await this.getCompanyById(companyId);
      if (!existingCompany) {
        throw new Error('Company not found');
      }

      // Validate company name if provided
      if (companyData.company_name !== undefined && companyData.company_name.trim() === '') {
        throw new Error('Company name cannot be empty');
      }

      // Check if new company name already exists
      if (companyData.company_name && companyData.company_name !== existingCompany.company_name) {
        const existingName = await this.databaseService.query(
          'SELECT company_id FROM Companies WHERE company_name = ? AND company_id != ? AND is_active = 1',
          [companyData.company_name.trim(), companyId]
        );
        if (existingName.length > 0) {
          throw new Error('A company with this name already exists');
        }
      }

      // Validate phone if provided
      const validatedPhone = companyData.phone
        ? this.validatePhone(companyData.phone)
        : existingCompany.phone;

      // Update company
      await this.databaseService.execute(
        `UPDATE Companies SET
          company_name = ?,
          contact_person = ?,
          father_name = ?,
          address = ?,
          phone = ?,
          certifications = ?,
          drug_license_number = ?,
          is_permanent = ?,
          updated_at = CURRENT_TIMESTAMP
        WHERE company_id = ?`,
        [
          companyData.company_name !== undefined ? companyData.company_name.trim() : existingCompany.company_name,
          companyData.contact_person !== undefined ? companyData.contact_person : existingCompany.contact_person,
          companyData.father_name !== undefined ? companyData.father_name : existingCompany.father_name,
          companyData.address !== undefined ? companyData.address : existingCompany.address,
          validatedPhone,
          companyData.certifications !== undefined ? companyData.certifications : existingCompany.certifications,
          companyData.drug_license_number !== undefined ? (companyData.drug_license_number || null) : existingCompany.drug_license_number,
          companyData.is_permanent !== undefined ? (companyData.is_permanent ? 1 : 0) : existingCompany.is_permanent,
          companyId
        ]
      );

      // Log history
      await this.databaseService.execute(
        `INSERT INTO History (
          action_type, table_name, record_id, old_values, new_values, performed_by, description
        ) VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [
          'UPDATE',
          'Companies',
          companyId,
          JSON.stringify(existingCompany),
          JSON.stringify(companyData),
          userId,
          `Updated company: ${existingCompany.specific_id}`
        ]
      );

      // Return updated company
      const updatedCompany = await this.getCompanyById(companyId);
      console.log(`Company updated successfully: ${updatedCompany.specific_id}`);
      return updatedCompany;
    } catch (error) {
      console.error('Update company error:', error);
      throw error;
    }
  }

  /**
   * Delete company (soft delete)
   * @param {number} companyId - Internal company ID
   * @param {number} userId - ID of the user performing the deletion
   * @returns {boolean} Success status
   */
  async deleteCompany(companyId, userId) {
    try {
      // Get company information
      const company = await this.getCompanyById(companyId);
      if (!company) {
        throw new Error('Company not found');
      }

      // Get real-time balance and credit from ledger
      const ledgerService = new LedgerService();
      const ledger = await ledgerService.getEntityLedger('company', companyId, {});
      const realBalance = ledger.success && ledger.data && ledger.data.statistics 
        ? (ledger.data.statistics.current_entity_balance || ledger.data.statistics.current_advance || 0)
        : company.balance;
      const realCredit = ledger.success && ledger.data && ledger.data.statistics
        ? (ledger.data.statistics.current_entity_credit || ledger.data.statistics.total_outstanding_credit || 0)
        : company.credit;

      // Check if company has outstanding balance or credit
      console.log(`[CompanyService] Delete validation: ${company.company_name} - Balance: ${realBalance} (${typeof realBalance}), Credit: ${realCredit} (${typeof realCredit})`);
      if (realBalance !== 0 || realCredit !== 0) {
        throw new Error(
          'Cannot delete company with outstanding balance or credit. Please settle all accounts first.'
        );
      }

      // Soft delete (set is_active = 0)
      await this.databaseService.execute(
        'UPDATE Companies SET is_active = 0, updated_at = CURRENT_TIMESTAMP WHERE company_id = ?',
        [companyId]
      );

      // Log history
      await this.databaseService.execute(
        `INSERT INTO History (
          action_type, table_name, record_id, old_values, performed_by, description
        ) VALUES (?, ?, ?, ?, ?, ?)`,
        [
          'DELETE',
          'Companies',
          companyId,
          JSON.stringify(company),
          userId,
          `Deleted company: ${company.specific_id} - ${company.company_name}`
        ]
      );

      console.log(`Company deleted successfully: ${company.specific_id}`);
      return true;
    } catch (error) {
      console.error('Delete company error:', error);
      throw error;
    }
  }

  /**
   * Search companies by various criteria
   * @param {string} searchTerm - Search term
   * @returns {Array} Array of matching companies
   */
  async searchCompanies(searchTerm) {
    try {
      console.log('[CompanyService] searchCompanies called with term:', searchTerm);
      
      if (!searchTerm || searchTerm.trim() === '') {
        console.log('[CompanyService] Empty search term, returning all companies');
        return await this.getAllCompanies();
      }

      const term = `%${searchTerm.trim()}%`;
      console.log('[CompanyService] Executing search query with pattern:', term);
      
      const companies = await this.databaseService.query(
        `SELECT * FROM Companies 
         WHERE is_active = 1 AND (
           specific_id LIKE ? OR
           company_name LIKE ? OR
           contact_person LIKE ? OR
           father_name LIKE ? OR
           phone LIKE ? OR
           certifications LIKE ?
         )
         ORDER BY specific_id`,
        [term, term, term, term, term, term]
      );

      console.log('[CompanyService] Search returned', companies.length, 'companies');
      return companies;
    } catch (error) {
      console.error('Search companies error:', error);
      throw error;
    }
  }

  /**
   * Get company ledger entries
   * @param {number} companyId - Internal company ID
   * @returns {Array} Array of ledger entries
   */
  async getCompanyLedger(companyId) {
    try {
      const ledger = await this.databaseService.query(
        `SELECT * FROM LedgerEntries 
         WHERE entity_type = 'Company' AND entity_id = ?
         ORDER BY entry_date DESC`,
        [companyId]
      );
      return ledger;
    } catch (error) {
      console.error('Get company ledger error:', error);
      throw error;
    }
  }

  /**
   * Get company statistics
   * @returns {Object} Statistics object
   */
  async getCompanyStatistics() {
    try {
      const stats = await this.databaseService.query(
        `SELECT 
           COUNT(*) as totalCompanies,
           SUM(CASE WHEN is_active = 1 THEN 1 ELSE 0 END) as activeCompanies,
           SUM(balance) as totalBalance,
           SUM(credit) as totalCredit
         FROM Companies
         WHERE is_active = 1`
      );

      return {
        totalCompanies: stats[0].totalCompanies || 0,
        activeCompanies: stats[0].activeCompanies || 0,
        totalBalance: parseFloat(stats[0].totalBalance) || 0,
        totalCredit: parseFloat(stats[0].totalCredit) || 0
      };
    } catch (error) {
      console.error('Get company statistics error:', error);
      throw error;
    }
  }
}
