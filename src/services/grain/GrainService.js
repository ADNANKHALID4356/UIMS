/**
 * GrainService - Sprint 4 (FR-4.3)
 * Manages grain operations including CRUD, search, price management
 */

import { DatabaseService } from '../database/DatabaseService.js';

class GrainService {
  constructor() {
    this.db = DatabaseService.getInstance();
  }

  /**
   * Generate next grain code (G001, G002, etc.)
   */
  async generateGrainCode() {
    try {
      const result = this.db.db.prepare(`
        SELECT grain_code FROM GrainTypes 
        ORDER BY grain_id DESC LIMIT 1
      `).get();

      if (!result) {
        return 'G001';
      }

      const lastNumber = parseInt(result.grain_code.substring(1));
      const nextNumber = lastNumber + 1;
      return `G${nextNumber.toString().padStart(3, '0')}`;
    } catch (error) {
      console.error('Error generating grain code:', error);
      throw error;
    }
  }

  /**
   * Create a new grain type
   */
  async create(grainData, userId) {
    try {
      const grainCode = await this.generateGrainCode();

      const stmt = this.db.db.prepare(`
        INSERT INTO GrainTypes (
          grain_code, grain_name, description, unit_of_measure,
          reorder_level, is_active, created_by
        ) VALUES (?, ?, ?, ?, ?, ?, ?)
      `);

      const result = stmt.run(
        grainCode,
        grainData.grain_name,
        grainData.description || null,
        grainData.unit_type || grainData.unit_of_measure || 'kg',
        grainData.reorder_level || 0,
        grainData.is_active !== undefined ? (grainData.is_active ? 1 : 0) : 1,
        userId
      );

      // Initialize stock entry
      await this.initializeStock(result.lastInsertRowid, 'GRAIN');

      // Create history entry
      const grain = await this.getById(result.lastInsertRowid);
      await this.db.createHistoryEntry(
        'GrainTypes',
        result.lastInsertRowid,
        'CREATE',
        null,
        grain,
        userId
      );

      return {
        success: true,
        grain_id: result.lastInsertRowid,
        grain_code: grainCode,
        message: 'Grain created successfully'
      };
    } catch (error) {
      console.error('Error creating grain:', error);
      throw error;
    }
  }

  /**
   * Initialize stock entry for new grain
   */
  async initializeStock(itemId, itemType) {
    try {
      const stmt = this.db.db.prepare(`
        INSERT INTO Stock (item_type, item_id, quantity, unit_price)
        VALUES (?, ?, 0.00, 0.00)
      `);

      stmt.run(itemType, itemId);
    } catch (error) {
      console.error('Error initializing stock:', error);
      throw error;
    }
  }

  /**
   * Get grain by ID with stock information
   * Aggregates stock quantities from multiple batches
   */
  async getById(grainId) {
    try {
      const grain = this.db.db.prepare(`
        SELECT g.*, 
               COALESCE(SUM(CASE WHEN s.quantity > 0 THEN s.quantity ELSE 0 END), 0) as current_stock,
               COALESCE(AVG(CASE WHEN s.quantity > 0 THEN s.unit_price ELSE NULL END), 0) as current_price
        FROM GrainTypes g
        LEFT JOIN Stock s ON s.item_type = 'GRAIN' AND s.item_id = g.grain_id
        WHERE g.grain_id = ?
        GROUP BY g.grain_id
      `).get(grainId);

      return grain || null;
    } catch (error) {
      console.error('Error fetching grain by ID:', error);
      throw error;
    }
  }

  /**
   * Get grain by code
   * Aggregates stock quantities from multiple batches
   */
  async getByCode(grainCode) {
    try {
      const grain = this.db.db.prepare(`
        SELECT g.*, 
               COALESCE(SUM(CASE WHEN s.quantity > 0 THEN s.quantity ELSE 0 END), 0) as current_stock,
               COALESCE(AVG(CASE WHEN s.quantity > 0 THEN s.unit_price ELSE NULL END), 0) as current_price
        FROM GrainTypes g
        LEFT JOIN Stock s ON s.item_type = 'GRAIN' AND s.item_id = g.grain_id
        WHERE g.grain_code = ?
        GROUP BY g.grain_id
      `).get(grainCode);

      return grain || null;
    } catch (error) {
      console.error('Error fetching grain by code:', error);
      throw error;
    }
  }

  /**
   * Get all grains with optional filters
   * Aggregates stock quantities from multiple batches
   */
  async getAll(filters = {}) {
    try {
      let query = `
        SELECT g.*, 
               u.username as created_by_username,
               COALESCE(SUM(CASE WHEN s.quantity > 0 THEN s.quantity ELSE 0 END), 0) as current_stock,
               COALESCE(AVG(CASE WHEN s.quantity > 0 THEN s.unit_price ELSE NULL END), 0) as current_price,
               CASE 
                 WHEN COALESCE(SUM(CASE WHEN s.quantity > 0 THEN s.quantity ELSE 0 END), 0) <= g.reorder_level THEN 1 
                 ELSE 0 
               END as needs_reorder
        FROM GrainTypes g
        LEFT JOIN Users u ON g.created_by = u.user_id
        LEFT JOIN Stock s ON s.item_type = 'GRAIN' AND s.item_id = g.grain_id
      `;

      const conditions = [];
      const params = [];

      if (filters.is_active !== undefined) {
        conditions.push('g.is_active = ?');
        params.push(filters.is_active);
      }

      if (conditions.length > 0) {
        query += ' WHERE ' + conditions.join(' AND ');
      }

      // Group by grain to aggregate stock from multiple batches
      query += ' GROUP BY g.grain_id';

      // Apply low stock filter after aggregation
      if (filters.low_stock) {
        query += ' HAVING COALESCE(SUM(s.quantity), 0) <= g.reorder_level';
      }

      query += ' ORDER BY g.grain_name ASC';

      const grains = this.db.db.prepare(query).all(...params);
      return grains;
    } catch (error) {
      console.error('Error fetching all grains:', error);
      throw error;
    }
  }

  /**
   * Update grain
   */
  async update(grainId, updateData, userId) {
    try {
      const oldGrain = await this.getById(grainId);
      if (!oldGrain) {
        throw new Error('Grain not found');
      }

      const stmt = this.db.db.prepare(`
        UPDATE GrainTypes 
        SET grain_name = ?,
            description = ?,
            unit_of_measure = ?,
            reorder_level = ?,
            is_active = ?,
            updated_at = CURRENT_TIMESTAMP
        WHERE grain_id = ?
      `);

      stmt.run(
        updateData.grain_name,
        updateData.description || null,
        updateData.unit_type || updateData.unit_of_measure || 'kg',
        updateData.reorder_level || 0,
        updateData.is_active !== undefined ? (updateData.is_active ? 1 : 0) : oldGrain.is_active,
        grainId
      );

      // Create history entry
      const newGrain = await this.getById(grainId);
      await this.db.createHistoryEntry(
        'GrainTypes',
        grainId,
        'UPDATE',
        oldGrain,
        newGrain,
        userId
      );

      return {
        success: true,
        message: 'Grain updated successfully'
      };
    } catch (error) {
      console.error('Error updating grain:', error);
      throw error;
    }
  }

  /**
   * Delete grain (soft delete)
   */
  async delete(grainId, userId) {
    try {
      const grain = await this.getById(grainId);
      if (!grain) {
        throw new Error('Grain not found');
      }

      // Check if grain has stock
      if (grain.current_stock > 0) {
        return {
          success: false,
          message: 'Cannot delete grain with existing stock'
        };
      }

      // Create history entry before deletion
      await this.db.createHistoryEntry(
        'GrainTypes',
        grainId,
        'DELETE',
        grain,
        null,
        userId
      );

      // Hard delete - permanently remove from database
      const stmt = this.db.db.prepare(`
        DELETE FROM GrainTypes 
        WHERE grain_id = ?
      `);

      stmt.run(grainId);

      return {
        success: true,
        message: 'Grain deleted permanently'
      };
    } catch (error) {
      console.error('Error deleting grain:', error);
      throw error;
    }
  }

  /**
   * Search grains by name or code
   */
  async search(searchTerm) {
    try {
      const query = `
        SELECT g.*, 
               u.username as created_by_username,
               COALESCE(SUM(CASE WHEN s.quantity > 0 THEN s.quantity ELSE 0 END), 0) as current_stock,
               COALESCE(AVG(CASE WHEN s.quantity > 0 THEN s.unit_price ELSE NULL END), 0) as current_price
        FROM GrainTypes g
        LEFT JOIN Users u ON g.created_by = u.user_id
        LEFT JOIN Stock s ON s.item_type = 'GRAIN' AND s.item_id = g.grain_id
        WHERE g.grain_name LIKE ? OR g.grain_code LIKE ?
        GROUP BY g.grain_id
        ORDER BY g.grain_name ASC
      `;

      const searchPattern = `%${searchTerm}%`;
      const grains = this.db.db.prepare(query).all(searchPattern, searchPattern);
      return grains;
    } catch (error) {
      console.error('Error searching grains:', error);
      throw error;
    }
  }

  /**
   * Get grains that need reordering
   */
  async getLowStockGrains() {
    try {
      const query = `
        SELECT g.*, 
               COALESCE(SUM(s.quantity), 0) as current_stock,
               COALESCE(AVG(s.unit_price), 0) as current_price
        FROM GrainTypes g
        LEFT JOIN Stock s ON s.item_type = 'GRAIN' AND s.item_id = g.grain_id
        WHERE g.is_active = 1
        GROUP BY g.grain_id
        HAVING COALESCE(SUM(s.quantity), 0) <= g.reorder_level
        ORDER BY COALESCE(SUM(s.quantity), 0) ASC
      `;

      const grains = this.db.db.prepare(query).all();
      return grains;
    } catch (error) {
      console.error('Error fetching low stock grains:', error);
      throw error;
    }
  }

  /**
   * Get grain statistics
   */
  async getStatistics() {
    try {
      const stats = this.db.db.prepare(`
        SELECT 
          COUNT(DISTINCT g.grain_id) as total_grains,
          SUM(CASE WHEN g.is_active = 1 THEN 1 ELSE 0 END) as active_grains,
          SUM(CASE WHEN s.quantity <= g.reorder_level THEN 1 ELSE 0 END) as low_stock_grains,
          SUM(s.quantity * s.unit_price) as total_grain_value
        FROM GrainTypes g
        LEFT JOIN Stock s ON s.item_type = 'GRAIN' AND s.item_id = g.grain_id
        WHERE g.is_active = 1
      `).get();

      return stats;
    } catch (error) {
      console.error('Error fetching grain statistics:', error);
      throw error;
    }
  }
}

export default GrainService;
