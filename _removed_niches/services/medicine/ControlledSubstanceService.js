import { DatabaseService } from '../database/DatabaseService.js';

/**
 * ControlledSubstanceService — Tracks controlled substance movements
 * SRS v2.0 Medical Industry compliance: maintains a legal register
 * of all controlled substance stock-ins and dispensing events.
 */
class ControlledSubstanceService {
  constructor() {
    this.db = DatabaseService.getInstance();
  }

  /**
   * Record a controlled substance movement (IN or OUT)
   */
  async recordMovement({ medicineId, batchId, transactionType, quantity, patientId, patientName, prescriptionId, performedBy, notes }) {
    try {
      if (!medicineId || !transactionType || !quantity || !performedBy) {
        return { success: false, message: 'Missing required fields: medicineId, transactionType, quantity, performedBy' };
      }

      if (!['IN', 'OUT'].includes(transactionType)) {
        return { success: false, message: 'transactionType must be IN or OUT' };
      }

      const result = await this.db.run(
        `INSERT INTO ControlledSubstanceRegister
          (medicine_id, batch_id, transaction_type, quantity, patient_id, patient_name, prescription_id, performed_by, notes)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [medicineId, batchId || null, transactionType, quantity, patientId || null, patientName || null, prescriptionId || null, performedBy, notes || null]
      );

      console.log('[ControlledSubstanceService] Recorded movement:', transactionType, 'qty:', quantity, 'medicine:', medicineId);

      return {
        success: true,
        data: { register_id: result.lastInsertRowid },
        message: `Controlled substance ${transactionType} recorded`,
      };
    } catch (error) {
      console.error('[ControlledSubstanceService] Error recording movement:', error);
      return { success: false, message: error.message };
    }
  }

  /**
   * Get all register entries with optional filters
   */
  async getRegister({ medicineId, startDate, endDate, transactionType, limit = 500 } = {}) {
    try {
      let query = `
        SELECT csr.*,
          p.product_name, p.product_code,
          mb.batch_number,
          u.username as performed_by_name
        FROM ControlledSubstanceRegister csr
        LEFT JOIN Products p ON csr.medicine_id = p.product_id
        LEFT JOIN MedicineBatches mb ON csr.batch_id = mb.batch_id
        LEFT JOIN Users u ON csr.performed_by = u.user_id
        WHERE 1=1
      `;
      const params = [];

      if (medicineId) {
        query += ' AND csr.medicine_id = ?';
        params.push(medicineId);
      }
      if (startDate) {
        query += ' AND DATE(csr.created_at) >= ?';
        params.push(startDate);
      }
      if (endDate) {
        query += ' AND DATE(csr.created_at) <= ?';
        params.push(endDate);
      }
      if (transactionType) {
        query += ' AND csr.transaction_type = ?';
        params.push(transactionType);
      }

      query += ' ORDER BY csr.created_at DESC LIMIT ?';
      params.push(limit);

      const entries = await this.db.query(query, params);

      return { success: true, data: entries };
    } catch (error) {
      console.error('[ControlledSubstanceService] Error fetching register:', error);
      return { success: false, message: error.message };
    }
  }

  /**
   * Get current balance for a controlled substance
   */
  async getBalance(medicineId) {
    try {
      const result = await this.db.query(
        `SELECT
          SUM(CASE WHEN transaction_type = 'IN' THEN quantity ELSE 0 END) as total_in,
          SUM(CASE WHEN transaction_type = 'OUT' THEN quantity ELSE 0 END) as total_out
        FROM ControlledSubstanceRegister
        WHERE medicine_id = ?`,
        [medicineId]
      );

      const row = result[0] || { total_in: 0, total_out: 0 };
      return {
        success: true,
        data: {
          medicine_id: medicineId,
          total_in: parseFloat(row.total_in) || 0,
          total_out: parseFloat(row.total_out) || 0,
          balance: (parseFloat(row.total_in) || 0) - (parseFloat(row.total_out) || 0),
        },
      };
    } catch (error) {
      console.error('[ControlledSubstanceService] Error getting balance:', error);
      return { success: false, message: error.message };
    }
  }
}

export default ControlledSubstanceService;
