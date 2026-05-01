import { DatabaseService } from '../database/DatabaseService.js';

/**
 * History Service - Provides read access to the audit trail / activity log
 * Sprint 3 - Entity Management: History logging for all CRUD operations
 */
export class HistoryService {
  static instance = null;
  databaseService = null;

  constructor() {
    this.databaseService = DatabaseService.getInstance();
  }

  static getInstance() {
    if (!HistoryService.instance) {
      HistoryService.instance = new HistoryService();
    }
    return HistoryService.instance;
  }

  /**
   * Get all history entries with optional filters
   * @param {Object} filters - { tableName, actionType, recordId, limit, offset, startDate, endDate }
   * @returns {Promise<Object>} { entries, total }
   */
  async getHistory(filters = {}) {
    try {
      const conditions = [];
      const params = [];

      if (filters.tableName) {
        conditions.push('h.table_name = ?');
        params.push(filters.tableName);
      }
      if (filters.actionType) {
        conditions.push('h.action_type = ?');
        params.push(filters.actionType);
      }
      if (filters.recordId) {
        conditions.push('h.record_id = ?');
        params.push(filters.recordId);
      }
      if (filters.startDate) {
        conditions.push('h.performed_at >= ?');
        params.push(filters.startDate);
      }
      if (filters.endDate) {
        conditions.push('h.performed_at <= ?');
        params.push(filters.endDate + ' 23:59:59');
      }
      if (filters.searchTerm) {
        conditions.push('(h.description LIKE ? OR h.table_name LIKE ?)');
        const pattern = `%${filters.searchTerm}%`;
        params.push(pattern, pattern);
      }

      const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

      // Get total count
      const countResult = await this.databaseService.query(
        `SELECT COUNT(*) as total FROM History h ${whereClause}`,
        params
      );
      const total = countResult[0]?.total || 0;

      // Get paginated entries
      const limit = filters.limit || 50;
      const offset = filters.offset || 0;

      const entries = await this.databaseService.query(
        `SELECT h.*, u.username as performed_by_name
         FROM History h 
         LEFT JOIN Users u ON h.performed_by = u.user_id
         ${whereClause}
         ORDER BY h.performed_at DESC
         LIMIT ? OFFSET ?`,
        [...params, limit, offset]
      );

      return { entries, total };
    } catch (error) {
      console.error('HistoryService.getHistory error:', error);
      throw error;
    }
  }

  /**
   * Get history for a specific entity record
   * @param {string} tableName - e.g. 'Farmers', 'Dealers', 'Companies'
   * @param {number} recordId - The entity's primary key ID
   * @returns {Promise<Array>}
   */
  async getEntityHistory(tableName, recordId) {
    try {
      return await this.databaseService.query(
        `SELECT h.*, u.username as performed_by_name
         FROM History h
         LEFT JOIN Users u ON h.performed_by = u.user_id
         WHERE h.table_name = ? AND h.record_id = ?
         ORDER BY h.performed_at DESC`,
        [tableName, recordId]
      );
    } catch (error) {
      console.error('HistoryService.getEntityHistory error:', error);
      throw error;
    }
  }

  /**
   * Get available table names for filtering
   * @returns {Promise<Array<string>>}
   */
  async getTableNames() {
    try {
      const result = await this.databaseService.query(
        'SELECT DISTINCT table_name FROM History ORDER BY table_name'
      );
      return result.map(r => r.table_name);
    } catch (error) {
      console.error('HistoryService.getTableNames error:', error);
      throw error;
    }
  }

  /**
   * Get history statistics
   * @returns {Promise<Object>}
   */
  async getStatistics() {
    try {
      const stats = await this.databaseService.query(`
        SELECT 
          COUNT(*) as total_entries,
          SUM(CASE WHEN action_type = 'CREATE' THEN 1 ELSE 0 END) as creates,
          SUM(CASE WHEN action_type = 'UPDATE' THEN 1 ELSE 0 END) as updates,
          SUM(CASE WHEN action_type = 'DELETE' THEN 1 ELSE 0 END) as deletes,
          COUNT(DISTINCT table_name) as tables_affected,
          MIN(performed_at) as earliest_entry,
          MAX(performed_at) as latest_entry
        FROM History
      `);
      return stats[0] || {};
    } catch (error) {
      console.error('HistoryService.getStatistics error:', error);
      throw error;
    }
  }

  /**
   * Delete history entries older than the specified date
   * @param {string} beforeDate - ISO date string (YYYY-MM-DD). Entries strictly before this date are removed.
   * @returns {Promise<Object>} { deleted: number }
   */
  async clearOlderThan(beforeDate) {
    try {
      const countResult = await this.databaseService.query(
        'SELECT COUNT(*) as cnt FROM History WHERE performed_at < ?',
        [beforeDate]
      );
      const toDelete = countResult[0]?.cnt || 0;

      if (toDelete > 0) {
        await this.databaseService.execute(
          'DELETE FROM History WHERE performed_at < ?',
          [beforeDate]
        );
      }

      console.log(`[HistoryService] Cleared ${toDelete} log entries older than ${beforeDate}`);
      return { deleted: toDelete };
    } catch (error) {
      console.error('HistoryService.clearOlderThan error:', error);
      throw error;
    }
  }
}
