import { DatabaseService } from '../database/DatabaseService.js';

/**
 * CommissionService — Real Estate Commission Tracking
 * SRS v2.0 Sprint 5: Commission Management
 * 
 * Features:
 * - Commission tracking per agent/deal
 * - Configurable commission rate per agent
 * - Commission payment recording
 * - Commission reporting and analytics
 */
class CommissionService {
  constructor() {
    this.db = DatabaseService.getInstance();
  }

  /**
   * Create a new commission record
   */
  async createCommission(data, userId) {
    try {
      const {
        transaction_id,
        deal_description,
        agent_id,
        agent_name,
        client_id,
        client_name,
        deal_amount,
        commission_rate,
        commission_amount,
        notes
      } = data;

      const calculatedAmount = commission_amount || (deal_amount * commission_rate / 100);

      const result = this.db.execute(
        `INSERT INTO Commissions (
          transaction_id, deal_description, agent_id, agent_name,
          client_id, client_name, deal_amount, commission_rate,
          commission_amount, status, notes, created_by
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'PENDING', ?, ?)`,
        [
          transaction_id || null,
          deal_description || '',
          agent_id || null,
          agent_name || '',
          client_id || null,
          client_name || '',
          deal_amount || 0,
          commission_rate || 0,
          calculatedAmount,
          notes || '',
          userId
        ]
      );

      // Log history
      await this.db.createHistoryEntry(
        'CREATE', 'Commissions', result.lastInsertRowid,
        null,
        { agent_name, deal_amount, commission_amount: calculatedAmount, deal_description },
        userId,
        `Commission created: ${agent_name} - ${deal_description || 'Deal'} - Rs.${calculatedAmount}`
      );

      return {
        success: true,
        commission_id: result.lastInsertRowid,
        commission_amount: calculatedAmount,
        message: 'Commission recorded successfully'
      };
    } catch (error) {
      console.error('[CommissionService] Error creating commission:', error);
      return { success: false, message: error.message };
    }
  }

  /**
   * Get all commissions with optional filters
   */
  async getAll(filters = {}) {
    try {
      let query = 'SELECT * FROM Commissions WHERE 1=1';
      const params = [];

      if (filters.agent_id) {
        query += ' AND agent_id = ?';
        params.push(filters.agent_id);
      }
      if (filters.status) {
        query += ' AND status = ?';
        params.push(filters.status);
      }
      if (filters.start_date) {
        query += ' AND DATE(created_at) >= ?';
        params.push(filters.start_date);
      }
      if (filters.end_date) {
        query += ' AND DATE(created_at) <= ?';
        params.push(filters.end_date);
      }

      query += ' ORDER BY created_at DESC';

      const commissions = await this.db.query(query, params);
      return { success: true, data: commissions };
    } catch (error) {
      console.error('[CommissionService] Error fetching commissions:', error);
      return { success: false, message: error.message };
    }
  }

  /**
   * Get commission by ID
   */
  async getById(commissionId) {
    try {
      const results = await this.db.query(
        'SELECT * FROM Commissions WHERE commission_id = ?',
        [commissionId]
      );
      if (results.length === 0) {
        return { success: false, message: 'Commission not found' };
      }
      return { success: true, data: results[0] };
    } catch (error) {
      console.error('[CommissionService] Error fetching commission:', error);
      return { success: false, message: error.message };
    }
  }

  /**
   * Update commission (edit deal details)
   */
  async update(commissionId, data, userId) {
    try {
      const existing = await this.getById(commissionId);
      if (!existing.success) return existing;

      const {
        deal_description,
        agent_id,
        agent_name,
        client_id,
        client_name,
        deal_amount,
        commission_rate,
        commission_amount,
        notes
      } = data;

      const calculatedAmount = commission_amount || (deal_amount * commission_rate / 100);

      this.db.execute(
        `UPDATE Commissions SET
          deal_description = ?, agent_id = ?, agent_name = ?,
          client_id = ?, client_name = ?,
          deal_amount = ?, commission_rate = ?, commission_amount = ?,
          notes = ?, updated_at = CURRENT_TIMESTAMP
        WHERE commission_id = ?`,
        [
          deal_description || existing.data.deal_description,
          agent_id || existing.data.agent_id,
          agent_name || existing.data.agent_name,
          client_id || existing.data.client_id,
          client_name || existing.data.client_name,
          deal_amount != null ? deal_amount : existing.data.deal_amount,
          commission_rate != null ? commission_rate : existing.data.commission_rate,
          calculatedAmount,
          notes != null ? notes : existing.data.notes,
          commissionId
        ]
      );

      await this.db.createHistoryEntry(
        'UPDATE', 'Commissions', commissionId,
        existing.data,
        { ...data, commission_amount: calculatedAmount },
        userId,
        `Commission updated: ID ${commissionId}`
      );

      return { success: true, message: 'Commission updated successfully' };
    } catch (error) {
      console.error('[CommissionService] Error updating commission:', error);
      return { success: false, message: error.message };
    }
  }

  /**
   * Record commission payment
   */
  async recordPayment(commissionId, paymentData, userId) {
    try {
      const existing = await this.getById(commissionId);
      if (!existing.success) return existing;

      if (existing.data.status === 'PAID') {
        return { success: false, message: 'Commission has already been paid' };
      }

      const { payment_method, payment_reference } = paymentData;

      this.db.execute(
        `UPDATE Commissions SET
          status = 'PAID',
          payment_date = CURRENT_TIMESTAMP,
          payment_method = ?,
          payment_reference = ?,
          updated_at = CURRENT_TIMESTAMP
        WHERE commission_id = ?`,
        [payment_method || 'CASH', payment_reference || '', commissionId]
      );

      await this.db.createHistoryEntry(
        'UPDATE', 'Commissions', commissionId,
        { status: existing.data.status },
        { status: 'PAID', payment_method, payment_reference },
        userId,
        `Commission paid: ${existing.data.agent_name} - Rs.${existing.data.commission_amount}`
      );

      return { success: true, message: 'Commission payment recorded successfully' };
    } catch (error) {
      console.error('[CommissionService] Error recording payment:', error);
      return { success: false, message: error.message };
    }
  }

  /**
   * Cancel a commission
   */
  async cancel(commissionId, reason, userId) {
    try {
      const existing = await this.getById(commissionId);
      if (!existing.success) return existing;

      this.db.execute(
        `UPDATE Commissions SET
          status = 'CANCELLED',
          notes = COALESCE(notes, '') || ' [Cancelled: ' || ? || ']',
          updated_at = CURRENT_TIMESTAMP
        WHERE commission_id = ?`,
        [reason || 'No reason', commissionId]
      );

      await this.db.createHistoryEntry(
        'UPDATE', 'Commissions', commissionId,
        { status: existing.data.status },
        { status: 'CANCELLED', reason },
        userId,
        `Commission cancelled: ID ${commissionId} - ${reason}`
      );

      return { success: true, message: 'Commission cancelled' };
    } catch (error) {
      console.error('[CommissionService] Error cancelling commission:', error);
      return { success: false, message: error.message };
    }
  }

  /**
   * Get statistics / summary
   */
  async getStatistics(filters = {}) {
    try {
      let dateFilter = '';
      const params = [];

      if (filters.start_date) {
        dateFilter += ' AND DATE(created_at) >= ?';
        params.push(filters.start_date);
      }
      if (filters.end_date) {
        dateFilter += ' AND DATE(created_at) <= ?';
        params.push(filters.end_date);
      }

      const stats = await this.db.query(`
        SELECT
          COUNT(*) as total_commissions,
          SUM(CASE WHEN status = 'PENDING' THEN 1 ELSE 0 END) as pending_count,
          SUM(CASE WHEN status = 'PAID' THEN 1 ELSE 0 END) as paid_count,
          SUM(CASE WHEN status = 'CANCELLED' THEN 1 ELSE 0 END) as cancelled_count,
          SUM(CASE WHEN status != 'CANCELLED' THEN deal_amount ELSE 0 END) as total_deal_value,
          SUM(CASE WHEN status != 'CANCELLED' THEN commission_amount ELSE 0 END) as total_commission,
          SUM(CASE WHEN status = 'PENDING' THEN commission_amount ELSE 0 END) as pending_amount,
          SUM(CASE WHEN status = 'PAID' THEN commission_amount ELSE 0 END) as paid_amount
        FROM Commissions
        WHERE 1=1 ${dateFilter}
      `, params);

      // Top agents
      const topAgents = await this.db.query(`
        SELECT
          agent_id, agent_name,
          COUNT(*) as deal_count,
          SUM(deal_amount) as total_deals,
          SUM(commission_amount) as total_earned,
          SUM(CASE WHEN status = 'PENDING' THEN commission_amount ELSE 0 END) as pending,
          SUM(CASE WHEN status = 'PAID' THEN commission_amount ELSE 0 END) as paid
        FROM Commissions
        WHERE status != 'CANCELLED' ${dateFilter}
        GROUP BY agent_id, agent_name
        ORDER BY total_earned DESC
        LIMIT 10
      `, params);

      return {
        success: true,
        data: {
          summary: stats[0] || {},
          top_agents: topAgents,
          generated_at: new Date().toISOString()
        }
      };
    } catch (error) {
      console.error('[CommissionService] Error getting statistics:', error);
      return { success: false, message: error.message };
    }
  }

  /**
   * Get commissions by agent
   */
  async getByAgent(agentId) {
    try {
      const commissions = await this.db.query(
        'SELECT * FROM Commissions WHERE agent_id = ? ORDER BY created_at DESC',
        [agentId]
      );
      return { success: true, data: commissions };
    } catch (error) {
      console.error('[CommissionService] Error fetching agent commissions:', error);
      return { success: false, message: error.message };
    }
  }
}

export default CommissionService;
