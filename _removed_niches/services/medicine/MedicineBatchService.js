/**
 * MedicineBatchService - Sprint 4 (FR-4.6)
 * Manages medicine batch operations: batch tracking, expiry dates, FEFO,
 * controlled substance logging, and expiry alerts for Medical industry.
 */

import { DatabaseService } from '../database/DatabaseService.js';

class MedicineBatchService {
  constructor() {
    this.db = DatabaseService.getInstance();
  }

  // ══════════════════════════════════════════════
  // CRUD Operations
  // ══════════════════════════════════════════════

  /**
   * Create a new medicine batch
   */
  async create(batchData, userId) {
    try {
      const stmt = this.db.db.prepare(`
        INSERT INTO MedicineBatches (
          product_id, batch_number, manufacture_date, expiry_date,
          quantity, unit_price, supplier_id, notes
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `);

      const result = stmt.run(
        batchData.product_id,
        batchData.batch_number,
        batchData.manufacture_date || null,
        batchData.expiry_date,
        batchData.quantity || 0,
        batchData.unit_price || 0,
        batchData.supplier_id || null,
        batchData.notes || null
      );

      // History
      const batch = await this.getById(result.lastInsertRowid);
      await this.db.createHistoryEntry(
        'MedicineBatches',
        result.lastInsertRowid,
        'CREATE',
        null,
        batch,
        userId
      );

      return {
        success: true,
        batch_id: result.lastInsertRowid,
        message: 'Medicine batch created successfully'
      };
    } catch (error) {
      console.error('Error creating medicine batch:', error);
      throw error;
    }
  }

  /**
   * Get a batch by ID
   */
  async getById(batchId) {
    try {
      return this.db.db.prepare(`
        SELECT mb.*,
               p.product_name, p.product_code, p.generic_name,
               p.drug_form, p.strength, p.controlled_substance,
               c.company_name as supplier_name
        FROM MedicineBatches mb
        JOIN Products p ON mb.product_id = p.product_id
        LEFT JOIN Companies c ON mb.supplier_id = c.company_id
        WHERE mb.batch_id = ?
      `).get(batchId);
    } catch (error) {
      console.error('Error fetching batch by ID:', error);
      throw error;
    }
  }

  /**
   * Get all batches with filters
   */
  async getAll(filters = {}) {
    try {
      let query = `
        SELECT mb.*,
               p.product_name, p.product_code, p.generic_name,
               p.drug_form, p.strength, p.controlled_substance,
               c.company_name as supplier_name,
               CASE
                 WHEN mb.expiry_date < DATE('now') THEN 'expired'
                 WHEN mb.expiry_date < DATE('now', '+30 days') THEN 'critical'
                 WHEN mb.expiry_date < DATE('now', '+60 days') THEN 'warning'
                 WHEN mb.expiry_date < DATE('now', '+90 days') THEN 'notice'
                 ELSE 'ok'
               END as expiry_status,
               CAST(julianday(mb.expiry_date) - julianday('now') AS INTEGER) as days_until_expiry
        FROM MedicineBatches mb
        JOIN Products p ON mb.product_id = p.product_id
        LEFT JOIN Companies c ON mb.supplier_id = c.company_id
      `;

      const conditions = [];
      const params = [];

      if (filters.product_id) {
        conditions.push('mb.product_id = ?');
        params.push(filters.product_id);
      }

      if (filters.is_active !== undefined) {
        conditions.push('mb.is_active = ?');
        params.push(filters.is_active ? 1 : 0);
      }

      if (filters.supplier_id) {
        conditions.push('mb.supplier_id = ?');
        params.push(filters.supplier_id);
      }

      if (filters.expired_only) {
        conditions.push("mb.expiry_date < DATE('now')");
      }

      if (filters.expiring_within_days) {
        conditions.push(`mb.expiry_date BETWEEN DATE('now') AND DATE('now', '+${parseInt(filters.expiring_within_days)} days')`);
      }

      if (filters.controlled_only) {
        conditions.push('p.controlled_substance = 1');
      }

      if (conditions.length > 0) {
        query += ' WHERE ' + conditions.join(' AND ');
      }

      query += ' ORDER BY mb.expiry_date ASC'; // FEFO — First Expiry, First Out

      return this.db.db.prepare(query).all(...params);
    } catch (error) {
      console.error('Error fetching batches:', error);
      throw error;
    }
  }

  /**
   * Update a batch
   */
  async update(batchId, updateData, userId) {
    try {
      const oldBatch = await this.getById(batchId);
      if (!oldBatch) throw new Error('Batch not found');

      const stmt = this.db.db.prepare(`
        UPDATE MedicineBatches
        SET batch_number = ?,
            manufacture_date = ?,
            expiry_date = ?,
            quantity = ?,
            unit_price = ?,
            supplier_id = ?,
            notes = ?,
            is_active = ?,
            updated_at = CURRENT_TIMESTAMP
        WHERE batch_id = ?
      `);

      stmt.run(
        updateData.batch_number,
        updateData.manufacture_date || null,
        updateData.expiry_date,
        updateData.quantity,
        updateData.unit_price || 0,
        updateData.supplier_id || null,
        updateData.notes || null,
        updateData.is_active !== undefined ? (updateData.is_active ? 1 : 0) : 1,
        batchId
      );

      const newBatch = await this.getById(batchId);
      await this.db.createHistoryEntry('MedicineBatches', batchId, 'UPDATE', oldBatch, newBatch, userId);

      return { success: true, message: 'Batch updated successfully' };
    } catch (error) {
      console.error('Error updating batch:', error);
      throw error;
    }
  }

  /**
   * Soft-delete a batch
   */
  async delete(batchId, userId) {
    try {
      const batch = await this.getById(batchId);
      if (!batch) throw new Error('Batch not found');

      this.db.db.prepare('UPDATE MedicineBatches SET is_active = 0, updated_at = CURRENT_TIMESTAMP WHERE batch_id = ?').run(batchId);
      await this.db.createHistoryEntry('MedicineBatches', batchId, 'DELETE', batch, null, userId);

      return { success: true, message: 'Batch deactivated' };
    } catch (error) {
      console.error('Error deleting batch:', error);
      throw error;
    }
  }

  // ══════════════════════════════════════════════
  // Expiry Alerts (FR-4.6.3)
  // ══════════════════════════════════════════════

  /**
   * Get expiry alerts — batches expiring within N days
   * Returns batches grouped by urgency: expired, critical (30d), warning (60d), notice (90d)
   */
  async getExpiryAlerts(days = 90) {
    try {
      const batches = this.db.db.prepare(`
        SELECT mb.*,
               p.product_name, p.product_code, p.generic_name,
               p.drug_form, p.strength, p.controlled_substance,
               c.company_name as supplier_name,
               CAST(julianday(mb.expiry_date) - julianday('now') AS INTEGER) as days_until_expiry
        FROM MedicineBatches mb
        JOIN Products p ON mb.product_id = p.product_id
        LEFT JOIN Companies c ON mb.supplier_id = c.company_id
        WHERE mb.is_active = 1
          AND mb.quantity > 0
          AND mb.expiry_date <= DATE('now', '+' || ? || ' days')
        ORDER BY mb.expiry_date ASC
      `).all(days);

      // Group by urgency
      const alerts = {
        expired: batches.filter(b => b.days_until_expiry < 0),
        critical: batches.filter(b => b.days_until_expiry >= 0 && b.days_until_expiry <= 30),
        warning: batches.filter(b => b.days_until_expiry > 30 && b.days_until_expiry <= 60),
        notice: batches.filter(b => b.days_until_expiry > 60 && b.days_until_expiry <= 90),
        total_alert_count: batches.length
      };

      return alerts;
    } catch (error) {
      console.error('Error fetching expiry alerts:', error);
      throw error;
    }
  }

  /**
   * Get dashboard expiry summary (for widget)
   */
  async getExpirySummary() {
    try {
      const summary = this.db.db.prepare(`
        SELECT
          COALESCE(SUM(CASE WHEN mb.expiry_date < DATE('now') THEN 1 ELSE 0 END), 0) as expired_count,
          COALESCE(SUM(CASE WHEN mb.expiry_date >= DATE('now') AND mb.expiry_date < DATE('now', '+30 days') THEN 1 ELSE 0 END), 0) as expiring_30d,
          COALESCE(SUM(CASE WHEN mb.expiry_date >= DATE('now', '+30 days') AND mb.expiry_date < DATE('now', '+60 days') THEN 1 ELSE 0 END), 0) as expiring_60d,
          COALESCE(SUM(CASE WHEN mb.expiry_date >= DATE('now', '+60 days') AND mb.expiry_date < DATE('now', '+90 days') THEN 1 ELSE 0 END), 0) as expiring_90d
        FROM MedicineBatches mb
        WHERE mb.is_active = 1 AND mb.quantity > 0
      `).get();

      return summary;
    } catch (error) {
      console.error('Error fetching expiry summary:', error);
      throw error;
    }
  }

  // ══════════════════════════════════════════════
  // FEFO — First Expiry, First Out (FR-4.6.2)
  // ══════════════════════════════════════════════

  /**
   * Get best batch to dispense from (FEFO — earliest-expiring, not expired, with stock)
   */
  async getFEFOBatch(productId) {
    try {
      return this.db.db.prepare(`
        SELECT * FROM MedicineBatches
        WHERE product_id = ?
          AND is_active = 1
          AND quantity > 0
          AND expiry_date >= DATE('now')
        ORDER BY expiry_date ASC
        LIMIT 1
      `).get(productId);
    } catch (error) {
      console.error('Error fetching FEFO batch:', error);
      throw error;
    }
  }

  /**
   * Deduct quantity from batch (used during dispensing)
   */
  async deductFromBatch(batchId, quantity) {
    try {
      const batch = this.db.db.prepare('SELECT * FROM MedicineBatches WHERE batch_id = ?').get(batchId);
      if (!batch) throw new Error('Batch not found');
      if (batch.quantity < quantity) throw new Error('Insufficient batch quantity');

      this.db.db.prepare(`
        UPDATE MedicineBatches 
        SET quantity = quantity - ?, updated_at = CURRENT_TIMESTAMP 
        WHERE batch_id = ?
      `).run(quantity, batchId);

      return { success: true, remaining: batch.quantity - quantity };
    } catch (error) {
      console.error('Error deducting from batch:', error);
      throw error;
    }
  }

  /**
   * Add quantity to a batch (used during purchase/return)
   */
  async addToBatch(batchId, quantity) {
    try {
      this.db.db.prepare(`
        UPDATE MedicineBatches 
        SET quantity = quantity + ?, updated_at = CURRENT_TIMESTAMP 
        WHERE batch_id = ?
      `).run(quantity, batchId);

      return { success: true };
    } catch (error) {
      console.error('Error adding to batch:', error);
      throw error;
    }
  }

  // ══════════════════════════════════════════════
  // Controlled Substance Register (FR-4.6.4)
  // ══════════════════════════════════════════════

  /**
   * Get all batches of controlled substances
   */
  async getControlledSubstanceBatches() {
    try {
      return this.db.db.prepare(`
        SELECT mb.*,
               p.product_name, p.product_code, p.generic_name,
               p.drug_form, p.strength,
               c.company_name as supplier_name,
               CAST(julianday(mb.expiry_date) - julianday('now') AS INTEGER) as days_until_expiry
        FROM MedicineBatches mb
        JOIN Products p ON mb.product_id = p.product_id
        LEFT JOIN Companies c ON mb.supplier_id = c.company_id
        WHERE p.controlled_substance = 1
          AND mb.is_active = 1
        ORDER BY p.product_name, mb.expiry_date ASC
      `).all();
    } catch (error) {
      console.error('Error fetching controlled substance batches:', error);
      throw error;
    }
  }

  /**
   * Search batches
   */
  async search(searchTerm) {
    try {
      const pattern = `%${searchTerm}%`;
      return this.db.db.prepare(`
        SELECT mb.*,
               p.product_name, p.product_code, p.generic_name,
               p.drug_form, p.strength,
               c.company_name as supplier_name,
               CAST(julianday(mb.expiry_date) - julianday('now') AS INTEGER) as days_until_expiry
        FROM MedicineBatches mb
        JOIN Products p ON mb.product_id = p.product_id
        LEFT JOIN Companies c ON mb.supplier_id = c.company_id
        WHERE mb.batch_number LIKE ?
           OR p.product_name LIKE ?
           OR p.generic_name LIKE ?
        ORDER BY mb.expiry_date ASC
      `).all(pattern, pattern, pattern);
    } catch (error) {
      console.error('Error searching batches:', error);
      throw error;
    }
  }

  /**
   * Get batch statistics
   */
  async getStatistics() {
    try {
      return this.db.db.prepare(`
        SELECT
          COUNT(*) as total_batches,
          SUM(CASE WHEN is_active = 1 THEN 1 ELSE 0 END) as active_batches,
          SUM(CASE WHEN expiry_date < DATE('now') AND is_active = 1 THEN 1 ELSE 0 END) as expired_batches,
          SUM(CASE WHEN expiry_date BETWEEN DATE('now') AND DATE('now', '+30 days') AND is_active = 1 THEN 1 ELSE 0 END) as expiring_soon,
          SUM(quantity * unit_price) as total_batch_value
        FROM MedicineBatches
      `).get();
    } catch (error) {
      console.error('Error fetching batch statistics:', error);
      throw error;
    }
  }
}

export default MedicineBatchService;
