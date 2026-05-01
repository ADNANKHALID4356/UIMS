import { DatabaseService } from '../database/DatabaseService.js';

/**
 * PrescriptionService — Medical Industry Prescription Management
 * SRS v2.0 Sprint 5: Prescription Tracking & Dispensing
 *
 * Features:
 * - Prescription creation (patient, doctor, items)
 * - Dispensing workflow with FEFO batch selection
 * - Partial dispensing support
 * - Controlled substance flagging
 * - Status tracking (PENDING → PARTIALLY_DISPENSED → DISPENSED / CANCELLED)
 * - Prescription history & statistics
 */
class PrescriptionService {
  constructor() {
    this.db = DatabaseService.getInstance();
  }

  // ─── Helpers ─────────────────────────────────────────────

  /**
   * Generate a unique prescription number: RX-YYYYMMDD-XXXX
   */
  _generatePrescriptionNumber() {
    const date = new Date();
    const ymd =
      date.getFullYear().toString() +
      String(date.getMonth() + 1).padStart(2, '0') +
      String(date.getDate()).padStart(2, '0');
    const seq = Math.floor(1000 + Math.random() * 9000);
    return `RX-${ymd}-${seq}`;
  }

  // ─── CRUD ────────────────────────────────────────────────

  /**
   * Create a new prescription with items
   * @param {Object} data - prescription header + items array
   * @param {number} userId - creating user
   */
  async createPrescription(data, userId) {
    try {
      const {
        patient_id,
        patient_name,
        doctor_name,
        doctor_reg_number,
        prescription_date,
        diagnosis,
        notes,
        items = [],
      } = data;

      const prescription_number = this._generatePrescriptionNumber();

      // Insert header
      const result = this.db.execute(
        `INSERT INTO Prescriptions (
          prescription_number, patient_id, patient_name,
          doctor_name, doctor_reg_number, prescription_date,
          diagnosis, status, notes, created_by
        ) VALUES (?, ?, ?, ?, ?, ?, ?, 'PENDING', ?, ?)`,
        [
          prescription_number,
          patient_id || null,
          patient_name || '',
          doctor_name || '',
          doctor_reg_number || '',
          prescription_date || new Date().toISOString().split('T')[0],
          diagnosis || '',
          notes || '',
          userId,
        ]
      );

      const prescription_id = result.lastInsertRowid;

      // Insert items
      const insertItem = this.db.prepare(
        `INSERT INTO PrescriptionItems (
          prescription_id, product_id, product_name,
          dosage, frequency, duration,
          quantity_prescribed, status, notes
        ) VALUES (?, ?, ?, ?, ?, ?, ?, 'PENDING', ?)`
      );

      for (const item of items) {
        insertItem.run(
          prescription_id,
          item.product_id,
          item.product_name || '',
          item.dosage || '',
          item.frequency || '',
          item.duration || '',
          item.quantity_prescribed || 0,
          item.notes || ''
        );
      }

      // History entry
      this.db.execute(
        `INSERT INTO History (entity_type, entity_id, action, details, performed_by)
         VALUES ('PRESCRIPTION', ?, 'CREATE', ?, ?)`,
        [
          prescription_id,
          JSON.stringify({
            prescription_number,
            patient_name: patient_name || '',
            item_count: items.length,
          }),
          userId,
        ]
      );

      return {
        success: true,
        data: {
          prescription_id,
          prescription_number,
        },
        message: 'Prescription created successfully',
      };
    } catch (error) {
      console.error('[PrescriptionService] createPrescription error:', error);
      return { success: false, message: error.message };
    }
  }

  /**
   * Get all prescriptions with optional filters
   */
  async getAll(filters = {}) {
    try {
      const { status, patient_id, search, limit = 100, offset = 0 } = filters;

      let where = ['1=1'];
      let params = [];

      if (status) {
        where.push('p.status = ?');
        params.push(status);
      }

      if (patient_id) {
        where.push('p.patient_id = ?');
        params.push(patient_id);
      }

      if (search) {
        where.push(
          `(p.prescription_number LIKE ? OR p.patient_name LIKE ? OR p.doctor_name LIKE ? OR p.diagnosis LIKE ?)`
        );
        const term = `%${search}%`;
        params.push(term, term, term, term);
      }

      const total = this.db.get(
        `SELECT COUNT(*) as count FROM Prescriptions p WHERE ${where.join(' AND ')}`,
        params
      );

      params.push(limit, offset);
      const rows = this.db.getAll(
        `SELECT p.*,
           (SELECT COUNT(*) FROM PrescriptionItems pi WHERE pi.prescription_id = p.prescription_id) as item_count,
           (SELECT SUM(pi.quantity_prescribed) FROM PrescriptionItems pi WHERE pi.prescription_id = p.prescription_id) as total_qty_prescribed,
           (SELECT SUM(pi.quantity_dispensed) FROM PrescriptionItems pi WHERE pi.prescription_id = p.prescription_id) as total_qty_dispensed
         FROM Prescriptions p
         WHERE ${where.join(' AND ')}
         ORDER BY p.created_at DESC
         LIMIT ? OFFSET ?`,
        params
      );

      return {
        success: true,
        data: rows,
        total: total?.count || 0,
      };
    } catch (error) {
      console.error('[PrescriptionService] getAll error:', error);
      return { success: false, message: error.message };
    }
  }

  /**
   * Get a single prescription by ID with its items
   */
  async getById(prescriptionId) {
    try {
      const prescription = this.db.get(
        `SELECT * FROM Prescriptions WHERE prescription_id = ?`,
        [prescriptionId]
      );

      if (!prescription) {
        return { success: false, message: 'Prescription not found' };
      }

      const items = this.db.getAll(
        `SELECT pi.*, 
           mb.batch_number, mb.expiry_date
         FROM PrescriptionItems pi
         LEFT JOIN MedicineBatches mb ON pi.batch_id = mb.batch_id
         WHERE pi.prescription_id = ?
         ORDER BY pi.item_id`,
        [prescriptionId]
      );

      return {
        success: true,
        data: {
          ...prescription,
          items: items || [],
        },
      };
    } catch (error) {
      console.error('[PrescriptionService] getById error:', error);
      return { success: false, message: error.message };
    }
  }

  /**
   * Update prescription header (only when PENDING)
   */
  async updatePrescription(prescriptionId, data, userId) {
    try {
      const existing = this.db.get(
        `SELECT * FROM Prescriptions WHERE prescription_id = ?`,
        [prescriptionId]
      );

      if (!existing) {
        return { success: false, message: 'Prescription not found' };
      }

      if (existing.status !== 'PENDING') {
        return {
          success: false,
          message: 'Can only edit prescriptions with PENDING status',
        };
      }

      const {
        patient_id,
        patient_name,
        doctor_name,
        doctor_reg_number,
        prescription_date,
        diagnosis,
        notes,
      } = data;

      this.db.execute(
        `UPDATE Prescriptions SET
          patient_id = COALESCE(?, patient_id),
          patient_name = COALESCE(?, patient_name),
          doctor_name = COALESCE(?, doctor_name),
          doctor_reg_number = COALESCE(?, doctor_reg_number),
          prescription_date = COALESCE(?, prescription_date),
          diagnosis = COALESCE(?, diagnosis),
          notes = COALESCE(?, notes),
          updated_at = CURRENT_TIMESTAMP
        WHERE prescription_id = ?`,
        [
          patient_id ?? null,
          patient_name ?? null,
          doctor_name ?? null,
          doctor_reg_number ?? null,
          prescription_date ?? null,
          diagnosis ?? null,
          notes ?? null,
          prescriptionId,
        ]
      );

      // History
      this.db.execute(
        `INSERT INTO History (entity_type, entity_id, action, details, performed_by)
         VALUES ('PRESCRIPTION', ?, 'UPDATE', ?, ?)`,
        [
          prescriptionId,
          JSON.stringify({ updated_fields: Object.keys(data).filter((k) => data[k] != null) }),
          userId,
        ]
      );

      return { success: true, message: 'Prescription updated' };
    } catch (error) {
      console.error('[PrescriptionService] updatePrescription error:', error);
      return { success: false, message: error.message };
    }
  }

  // ─── Item Management ─────────────────────────────────────

  /**
   * Add item to an existing PENDING prescription
   */
  async addItem(prescriptionId, item, userId) {
    try {
      const rx = this.db.get(
        `SELECT status FROM Prescriptions WHERE prescription_id = ?`,
        [prescriptionId]
      );
      if (!rx) return { success: false, message: 'Prescription not found' };
      if (rx.status !== 'PENDING') {
        return { success: false, message: 'Can only add items to PENDING prescriptions' };
      }

      const result = this.db.execute(
        `INSERT INTO PrescriptionItems (
          prescription_id, product_id, product_name,
          dosage, frequency, duration,
          quantity_prescribed, status, notes
        ) VALUES (?, ?, ?, ?, ?, ?, ?, 'PENDING', ?)`,
        [
          prescriptionId,
          item.product_id,
          item.product_name || '',
          item.dosage || '',
          item.frequency || '',
          item.duration || '',
          item.quantity_prescribed || 0,
          item.notes || '',
        ]
      );

      return {
        success: true,
        data: { item_id: result.lastInsertRowid },
        message: 'Item added',
      };
    } catch (error) {
      console.error('[PrescriptionService] addItem error:', error);
      return { success: false, message: error.message };
    }
  }

  /**
   * Remove item from a PENDING prescription
   */
  async removeItem(itemId, userId) {
    try {
      const item = this.db.get(
        `SELECT pi.*, p.status as rx_status
         FROM PrescriptionItems pi
         JOIN Prescriptions p ON pi.prescription_id = p.prescription_id
         WHERE pi.item_id = ?`,
        [itemId]
      );
      if (!item) return { success: false, message: 'Item not found' };
      if (item.rx_status !== 'PENDING') {
        return { success: false, message: 'Can only remove items from PENDING prescriptions' };
      }

      this.db.execute(`DELETE FROM PrescriptionItems WHERE item_id = ?`, [itemId]);

      return { success: true, message: 'Item removed' };
    } catch (error) {
      console.error('[PrescriptionService] removeItem error:', error);
      return { success: false, message: error.message };
    }
  }

  // ─── Dispensing ──────────────────────────────────────────

  /**
   * Dispense items from a prescription using FEFO batch selection.
   * Supports partial dispensing (some items dispensed, others still pending).
   *
   * @param {number} prescriptionId
   * @param {Array} dispenseItems - [{ item_id, quantity_to_dispense, batch_id? }]
   * @param {number} userId - pharmacist / dispensing user
   */
  async dispenseItems(prescriptionId, dispenseItems = [], userId) {
    try {
      const rx = this.db.get(`SELECT * FROM Prescriptions WHERE prescription_id = ?`, [
        prescriptionId,
      ]);
      if (!rx) return { success: false, message: 'Prescription not found' };
      if (rx.status === 'CANCELLED') {
        return { success: false, message: 'Cannot dispense a cancelled prescription' };
      }
      if (rx.status === 'DISPENSED') {
        return { success: false, message: 'Prescription already fully dispensed' };
      }

      const dispensed = [];
      const errors = [];

      for (const di of dispenseItems) {
        const { item_id, quantity_to_dispense, batch_id } = di;
        if (!quantity_to_dispense || quantity_to_dispense <= 0) continue;

        const item = this.db.get(
          `SELECT * FROM PrescriptionItems WHERE item_id = ? AND prescription_id = ?`,
          [item_id, prescriptionId]
        );
        if (!item) {
          errors.push({ item_id, error: 'Item not found' });
          continue;
        }

        const remaining = (item.quantity_prescribed || 0) - (item.quantity_dispensed || 0);
        const qtyToDispense = Math.min(quantity_to_dispense, remaining);
        if (qtyToDispense <= 0) {
          errors.push({ item_id, error: 'Already fully dispensed' });
          continue;
        }

        // FEFO batch selection: use provided batch_id or pick earliest-expiring batch with stock
        let selectedBatchId = batch_id;
        if (!selectedBatchId) {
          const batch = this.db.get(
            `SELECT batch_id FROM MedicineBatches
             WHERE product_id = ? AND quantity >= ? AND is_active = 1
             ORDER BY expiry_date ASC
             LIMIT 1`,
            [item.product_id, qtyToDispense]
          );
          if (batch) {
            selectedBatchId = batch.batch_id;
          }
        }

        // Deduct from batch if available
        if (selectedBatchId) {
          this.db.execute(
            `UPDATE MedicineBatches SET quantity = quantity - ?, updated_at = CURRENT_TIMESTAMP
             WHERE batch_id = ? AND quantity >= ?`,
            [qtyToDispense, selectedBatchId, qtyToDispense]
          );
        }

        // Update item
        const newDispensed = (item.quantity_dispensed || 0) + qtyToDispense;
        const itemStatus = newDispensed >= item.quantity_prescribed ? 'DISPENSED' : 'PARTIALLY_DISPENSED';

        this.db.execute(
          `UPDATE PrescriptionItems SET
            quantity_dispensed = ?,
            batch_id = COALESCE(?, batch_id),
            status = ?,
            dispensed_by = ?,
            dispensed_at = CURRENT_TIMESTAMP
          WHERE item_id = ?`,
          [newDispensed, selectedBatchId, itemStatus, userId, item_id]
        );

        dispensed.push({
          item_id,
          product_name: item.product_name,
          qty_dispensed: qtyToDispense,
          batch_id: selectedBatchId,
          status: itemStatus,
        });
      }

      // Recalculate prescription-level status
      const allItems = this.db.getAll(
        `SELECT status FROM PrescriptionItems WHERE prescription_id = ?`,
        [prescriptionId]
      );
      const allDispensed = allItems.every((i) => i.status === 'DISPENSED');
      const someDispensed = allItems.some(
        (i) => i.status === 'DISPENSED' || i.status === 'PARTIALLY_DISPENSED'
      );

      let rxStatus = rx.status;
      if (allDispensed) {
        rxStatus = 'DISPENSED';
      } else if (someDispensed) {
        rxStatus = 'PARTIALLY_DISPENSED';
      }

      this.db.execute(
        `UPDATE Prescriptions SET
          status = ?,
          dispensed_by = ?,
          dispensed_at = CASE WHEN ? = 'DISPENSED' THEN CURRENT_TIMESTAMP ELSE dispensed_at END,
          updated_at = CURRENT_TIMESTAMP
        WHERE prescription_id = ?`,
        [rxStatus, userId, rxStatus, prescriptionId]
      );

      // History
      this.db.execute(
        `INSERT INTO History (entity_type, entity_id, action, details, performed_by)
         VALUES ('PRESCRIPTION', ?, 'DISPENSE', ?, ?)`,
        [
          prescriptionId,
          JSON.stringify({
            items_dispensed: dispensed.length,
            status: rxStatus,
            items: dispensed,
          }),
          userId,
        ]
      );

      return {
        success: true,
        data: {
          prescription_id: prescriptionId,
          status: rxStatus,
          dispensed,
          errors,
        },
        message:
          errors.length > 0
            ? `Dispensed ${dispensed.length} items with ${errors.length} errors`
            : `Successfully dispensed ${dispensed.length} items`,
      };
    } catch (error) {
      console.error('[PrescriptionService] dispenseItems error:', error);
      return { success: false, message: error.message };
    }
  }

  // ─── Cancel ──────────────────────────────────────────────

  /**
   * Cancel a prescription
   */
  async cancelPrescription(prescriptionId, reason, userId) {
    try {
      const rx = this.db.get(`SELECT * FROM Prescriptions WHERE prescription_id = ?`, [
        prescriptionId,
      ]);
      if (!rx) return { success: false, message: 'Prescription not found' };
      if (rx.status === 'DISPENSED') {
        return { success: false, message: 'Cannot cancel a fully dispensed prescription' };
      }

      this.db.execute(
        `UPDATE Prescriptions SET status = 'CANCELLED', notes = COALESCE(notes, '') || ? , updated_at = CURRENT_TIMESTAMP
         WHERE prescription_id = ?`,
        [reason ? `\n[CANCELLED] ${reason}` : '', prescriptionId]
      );

      // Also set all pending items to cancelled
      this.db.execute(
        `UPDATE PrescriptionItems SET status = 'CANCELLED'
         WHERE prescription_id = ? AND status = 'PENDING'`,
        [prescriptionId]
      );

      // History
      this.db.execute(
        `INSERT INTO History (entity_type, entity_id, action, details, performed_by)
         VALUES ('PRESCRIPTION', ?, 'CANCEL', ?, ?)`,
        [prescriptionId, JSON.stringify({ reason: reason || '' }), userId]
      );

      return { success: true, message: 'Prescription cancelled' };
    } catch (error) {
      console.error('[PrescriptionService] cancelPrescription error:', error);
      return { success: false, message: error.message };
    }
  }

  // ─── Statistics ──────────────────────────────────────────

  /**
   * Get prescription statistics / dashboard data
   */
  async getStatistics(filters = {}) {
    try {
      const { start_date, end_date } = filters;
      let dateFilter = '';
      let params = [];

      if (start_date && end_date) {
        dateFilter = 'AND p.prescription_date BETWEEN ? AND ?';
        params = [start_date, end_date];
      }

      const summary = this.db.get(
        `SELECT
          COUNT(*) as total_prescriptions,
          SUM(CASE WHEN p.status = 'PENDING' THEN 1 ELSE 0 END) as pending,
          SUM(CASE WHEN p.status = 'PARTIALLY_DISPENSED' THEN 1 ELSE 0 END) as partially_dispensed,
          SUM(CASE WHEN p.status = 'DISPENSED' THEN 1 ELSE 0 END) as dispensed,
          SUM(CASE WHEN p.status = 'CANCELLED' THEN 1 ELSE 0 END) as cancelled
        FROM Prescriptions p
        WHERE 1=1 ${dateFilter}`,
        params
      );

      const itemStats = this.db.get(
        `SELECT
          COUNT(*) as total_items,
          SUM(pi.quantity_prescribed) as total_prescribed,
          SUM(pi.quantity_dispensed) as total_dispensed
        FROM PrescriptionItems pi
        JOIN Prescriptions p ON pi.prescription_id = p.prescription_id
        WHERE 1=1 ${dateFilter}`,
        params
      );

      const topProducts = this.db.getAll(
        `SELECT
          pi.product_name,
          pi.product_id,
          SUM(pi.quantity_prescribed) as total_prescribed,
          SUM(pi.quantity_dispensed) as total_dispensed,
          COUNT(DISTINCT pi.prescription_id) as prescription_count
        FROM PrescriptionItems pi
        JOIN Prescriptions p ON pi.prescription_id = p.prescription_id
        WHERE 1=1 ${dateFilter}
        GROUP BY pi.product_id
        ORDER BY total_prescribed DESC
        LIMIT 10`,
        params
      );

      return {
        success: true,
        data: {
          summary: summary || {},
          items: itemStats || {},
          top_products: topProducts || [],
        },
      };
    } catch (error) {
      console.error('[PrescriptionService] getStatistics error:', error);
      return { success: false, message: error.message };
    }
  }
}

export default PrescriptionService;
