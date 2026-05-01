/**
 * StockService - Sprint 4 (FR-4.4)
 * Manages stock operations including movements, adjustments, and history
 */

import { DatabaseService } from '../database/DatabaseService.js';

class StockService {
  constructor() {
    this.db = DatabaseService.getInstance();
  }

  /**
   * Get stock by item and price (for batch tracking)
   */
  async getStockByItemAndPrice(itemType, itemId, unitPrice) {
    try {
      const stock = this.db.db.prepare(`
        SELECT * FROM Stock 
        WHERE item_type = ? AND item_id = ? AND unit_price = ?
      `).get(itemType, itemId, unitPrice);

      return stock || null;
    } catch (error) {
      console.error('Error fetching stock by price:', error);
      throw error;
    }
  }

  /**
   * Get all stock batches for an item
   */
  async getAllStockBatchesForItem(itemType, itemId) {
    try {
      console.log(`[StockService] getAllStockBatchesForItem called with itemType="${itemType}", itemId="${itemId}"`);
      const batches = this.db.db.prepare(`
        SELECT * FROM Stock 
        WHERE item_type = ? AND item_id = ? AND quantity > 0
        ORDER BY created_at ASC
      `).all(itemType, itemId);

      console.log(`[StockService] Found ${batches.length} batches:`, JSON.stringify(batches, null, 2));
      return batches;
    } catch (error) {
      console.error('Error fetching stock batches:', error);
      throw error;
    }
  }

  /**
   * Get consolidated stock levels (total quantity per item across all prices)
   */
  async getStockLevels(filters = {}) {
    try {
      let query = `
        SELECT 
          s.item_type,
          s.item_id,
          SUM(s.quantity) as total_quantity,
          COUNT(DISTINCT s.unit_price) as price_variants,
          MIN(s.unit_price) as min_price,
          MAX(s.unit_price) as max_price,
          AVG(s.unit_price) as avg_price,
          MAX(s.last_updated) as last_updated
        FROM Stock s
        WHERE s.quantity > 0
      `;

      const params = [];
      
      if (filters.item_type) {
        query += ` AND s.item_type = ?`;
        params.push(filters.item_type);
      }

      query += ` GROUP BY s.item_type, s.item_id ORDER BY s.item_type, s.item_id`;

      const levels = this.db.db.prepare(query).all(...params);
      return levels;
    } catch (error) {
      console.error('Error fetching stock levels:', error);
      throw error;
    }
  }

  /**
   * Get stock batches (detailed view with individual prices)
   */
  async getStockBatches(filters = {}) {
    try {
      let query = `
        SELECT 
          s.*,
          CASE 
            WHEN s.item_type = 'PRODUCT' THEN p.product_name
            WHEN s.item_type = 'GRAIN' THEN g.grain_name
          END as item_name,
          CASE 
            WHEN s.item_type = 'PRODUCT' THEN p.product_code
            WHEN s.item_type = 'GRAIN' THEN g.grain_code
          END as item_code
        FROM Stock s
        LEFT JOIN Products p ON s.item_type = 'PRODUCT' AND s.item_id = p.product_id
        LEFT JOIN GrainTypes g ON s.item_type = 'GRAIN' AND s.item_id = g.grain_id
        WHERE s.quantity > 0
      `;

      const params = [];
      
      if (filters.item_type) {
        query += ` AND s.item_type = ?`;
        params.push(filters.item_type);
      }

      if (filters.item_id) {
        query += ` AND s.item_id = ?`;
        params.push(filters.item_id);
      }

      query += ` ORDER BY s.item_type, s.item_id, s.unit_price`;

      const batches = this.db.db.prepare(query).all(...params);
      return batches;
    } catch (error) {
      console.error('Error fetching stock batches:', error);
      throw error;
    }
  }

  /**
   * Get stock by item (legacy - returns first batch)
   */
  async getStockByItem(itemType, itemId) {
    try {
      const stock = this.db.db.prepare(`
        SELECT * FROM Stock 
        WHERE item_type = ? AND item_id = ?
        ORDER BY created_at ASC
        LIMIT 1
      `).get(itemType, itemId);

      return stock || null;
    } catch (error) {
      console.error('Error fetching stock:', error);
      throw error;
    }
  }

  /**
   * Add stock (IN movement) - Creates new batch if price differs
   */
  async addStock(itemType, itemId, quantity, unitPrice, referenceType, referenceId, notes, userId, stockLocation = null) {
    try {
      console.log(`[StockService] 📥 addStock called:`, {
        itemType,
        itemId,
        quantity,
        unitPrice,
        stockLocation: stockLocation || 'Main Warehouse'
      });
      
      // Check if stock exists with this exact price
      let stock = await this.getStockByItemAndPrice(itemType, itemId, unitPrice);
      
      if (!stock) {
        console.log(`[StockService] 🆕 Creating NEW batch (no existing batch at price ${unitPrice})`);
        
        // Create new stock batch with this price
        const stmt = this.db.db.prepare(`
          INSERT INTO Stock (item_type, item_id, quantity, unit_price, batch_reference, stock_location)
          VALUES (?, ?, ?, ?, ?, ?)
        `);
        const batchRef = `${itemType}-${itemId}-${Date.now()}`;
        const result = stmt.run(itemType, itemId, parseFloat(quantity), unitPrice, batchRef, stockLocation || 'Main Warehouse');
        stock = await this.getStockByItemAndPrice(itemType, itemId, unitPrice);
        
        // Record movement
        const movementStmt = this.db.db.prepare(`
          INSERT INTO StockMovements (
            stock_id, movement_type, movement_reason, quantity,
            unit_price, reference_type, reference_id,
            previous_quantity, new_quantity, notes, created_by
          ) VALUES (?, 'IN', 'PURCHASE', ?, ?, ?, ?, ?, ?, ?, ?)
        `);

        const movementResult = movementStmt.run(
          stock.stock_id,
          quantity,
          unitPrice,
          referenceType || null,
          referenceId || null,
          0,
          parseFloat(quantity),
          notes || null,
          userId
        );

        console.log(`[StockService] ✅ New batch created - Quantity: ${parseFloat(quantity)}`);
        
        return {
          success: true,
          stock_id: stock.stock_id,
          movement_id: movementResult.lastInsertRowid,
          previous_quantity: 0,
          new_quantity: parseFloat(quantity),
          message: 'New stock batch created successfully',
          is_new_batch: true
        };
      } else {
        console.log(`[StockService] ➕ Adding to EXISTING batch (price ${unitPrice})`);
        
        // Update existing batch
        const previousQuantity = parseFloat(stock.quantity);
        const newQuantity = previousQuantity + parseFloat(quantity);

        console.log(`[StockService] 📊 Quantity update: ${previousQuantity} + ${parseFloat(quantity)} = ${newQuantity}`);

        const updateStmt = this.db.db.prepare(`
          UPDATE Stock 
          SET quantity = ?,
              last_updated = CURRENT_TIMESTAMP
          WHERE stock_id = ?
        `);

        updateStmt.run(newQuantity, stock.stock_id);

        // Record movement
        const movementStmt = this.db.db.prepare(`
          INSERT INTO StockMovements (
            stock_id, movement_type, movement_reason, quantity,
            unit_price, reference_type, reference_id,
            previous_quantity, new_quantity, notes, created_by
          ) VALUES (?, 'IN', 'PURCHASE', ?, ?, ?, ?, ?, ?, ?, ?)
        `);

        const movementResult = movementStmt.run(
          stock.stock_id,
          quantity,
          unitPrice,
          referenceType || null,
          referenceId || null,
          previousQuantity,
          newQuantity,
          notes || null,
          userId
        );

        console.log(`[StockService] ✅ Existing batch updated - New total: ${newQuantity}`);

        return {
          success: true,
          stock_id: stock.stock_id,
          movement_id: movementResult.lastInsertRowid,
          previous_quantity: previousQuantity,
          new_quantity: newQuantity,
          message: 'Stock added to existing batch successfully',
          is_new_batch: false
        };
      }
    } catch (error) {
      console.error('[StockService] ❌ Error adding stock:', error);
      throw error;
    }
  }

  /**
   * Remove stock (OUT movement) - Uses FIFO across all batches
   */
  async removeStock(itemType, itemId, quantity, referenceType, referenceId, notes, userId) {
    try {
      console.log(`[StockService.removeStock] Called with:`, {
        itemType,
        itemId,
        itemIdType: typeof itemId,
        quantity,
        referenceType,
        referenceId
      });
      
      // Get all batches for this item (FIFO order)
      const batches = await this.getAllStockBatchesForItem(itemType, itemId);
      
      console.log(`[StockService.removeStock] Query returned ${batches.length} batches`);
      
      if (batches.length === 0) {
        // Let's check what's actually in the database
        const allStock = this.db.db.prepare('SELECT * FROM Stock WHERE item_type = ?').all(itemType);
        console.log(`[StockService.removeStock] ERROR: No batches found!`);
        console.log(`[StockService.removeStock] All stock for item_type="${itemType}":`, JSON.stringify(allStock, null, 2));
        console.log(`[StockService.removeStock] Looking for item_id=${itemId} (type: ${typeof itemId})`);
        throw new Error('Stock not found');
      }

      // Calculate total available
      const totalAvailable = batches.reduce((sum, batch) => sum + parseFloat(batch.quantity), 0);
      const requestedQuantity = parseFloat(quantity);

      if (totalAvailable < requestedQuantity) {
        return {
          success: false,
          message: 'Insufficient stock',
          available: totalAvailable,
          requested: requestedQuantity
        };
      }

      // Remove stock using FIFO
      let remainingToRemove = requestedQuantity;
      const movements = [];

      for (const batch of batches) {
        if (remainingToRemove <= 0) break;

        const batchQuantity = parseFloat(batch.quantity);
        const quantityToRemove = Math.min(remainingToRemove, batchQuantity);
        const newBatchQuantity = batchQuantity - quantityToRemove;

        // Update batch
        const updateStmt = this.db.db.prepare(`
          UPDATE Stock 
          SET quantity = ?,
              last_updated = CURRENT_TIMESTAMP
          WHERE stock_id = ?
        `);
        updateStmt.run(newBatchQuantity, batch.stock_id);

        // Record movement
        const movementStmt = this.db.db.prepare(`
          INSERT INTO StockMovements (
            stock_id, movement_type, movement_reason, quantity,
            unit_price, reference_type, reference_id,
            previous_quantity, new_quantity, notes, created_by
          ) VALUES (?, 'OUT', 'SALE', ?, ?, ?, ?, ?, ?, ?, ?)
        `);

        const movementResult = movementStmt.run(
          batch.stock_id,
          quantityToRemove,
          batch.unit_price,
          referenceType || null,
          referenceId || null,
          batchQuantity,
          newBatchQuantity,
          notes || null,
          userId
        );

        movements.push({
          stock_id: batch.stock_id,
          movement_id: movementResult.lastInsertRowid,
          quantity_removed: quantityToRemove,
          unit_price: batch.unit_price
        });

        remainingToRemove -= quantityToRemove;
      }

      return {
        success: true,
        movements: movements,
        total_removed: requestedQuantity,
        message: 'Stock removed successfully using FIFO'
      };
    } catch (error) {
      console.error('Error removing stock:', error);
      throw error;
    }
  }

  /**
   * Adjust stock (ADJUSTMENT movement) - Sets TOTAL stock to newQuantity
   * When adjusting without stockId, this sets the TOTAL stock across all batches to the new quantity.
   * The oldest batch is adjusted to achieve the desired total, other batches remain unchanged.
   */
  async adjustStock(itemType, itemId, newQuantity, reason, notes, userId, stockId = null) {
    try {
      let stock;
      let previousTotalQuantity;
      let adjustedQuantity = parseFloat(newQuantity);
      
      if (stockId) {
        // Adjust specific batch - use only that batch's quantity
        stock = this.db.db.prepare(`
          SELECT * FROM Stock WHERE stock_id = ?
        `).get(stockId);
        
        if (!stock) {
          throw new Error('Stock not found');
        }
        
        previousTotalQuantity = parseFloat(stock.quantity);
        
        // Update this specific batch to the new quantity
        const updateStmt = this.db.db.prepare(`
          UPDATE Stock 
          SET quantity = ?,
              last_updated = CURRENT_TIMESTAMP
          WHERE stock_id = ?
        `);
        updateStmt.run(adjustedQuantity, stock.stock_id);
        
      } else {
        // Set TOTAL stock across all batches to newQuantity
        // First, get the TOTAL current stock for this item
        const totalResult = this.db.db.prepare(`
          SELECT COALESCE(SUM(quantity), 0) as total_quantity
          FROM Stock 
          WHERE item_type = ? AND item_id = ?
        `).get(itemType, itemId);
        
        previousTotalQuantity = parseFloat(totalResult.total_quantity) || 0;
        
        // Get the oldest batch (first available) to adjust
        stock = await this.getStockByItem(itemType, itemId);
        
        if (!stock && adjustedQuantity > 0) {
          // No stock exists, create a new batch with the requested quantity
          const insertStmt = this.db.db.prepare(`
            INSERT INTO Stock (item_type, item_id, quantity, unit_price, stock_location, created_at, last_updated)
            VALUES (?, ?, ?, 0, 'Main Warehouse', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
          `);
          const insertResult = insertStmt.run(itemType, itemId, adjustedQuantity);
          stock = { stock_id: insertResult.lastInsertRowid, unit_price: 0, quantity: adjustedQuantity };
        } else if (stock) {
          // Calculate how much to adjust the oldest batch
          // newTotal = (currentTotal - oldestBatchQty) + newOldestBatchQty
          // So: newOldestBatchQty = newTotal - (currentTotal - oldestBatchQty)
          // Simplified: newOldestBatchQty = newTotal - currentTotal + oldestBatchQty
          const oldestBatchQty = parseFloat(stock.quantity);
          const otherBatchesTotal = previousTotalQuantity - oldestBatchQty;
          const newOldestBatchQty = adjustedQuantity - otherBatchesTotal;
          
          if (newOldestBatchQty < 0) {
            // Need to remove stock from multiple batches
            // Clear all batches and set the oldest one to the new quantity
            this.db.db.prepare(`
              UPDATE Stock 
              SET quantity = 0,
                  last_updated = CURRENT_TIMESTAMP
              WHERE item_type = ? AND item_id = ? AND stock_id != ?
            `).run(itemType, itemId, stock.stock_id);
            
            // Set the oldest batch to the full new quantity
            this.db.db.prepare(`
              UPDATE Stock 
              SET quantity = ?,
                  last_updated = CURRENT_TIMESTAMP
              WHERE stock_id = ?
            `).run(adjustedQuantity, stock.stock_id);
          } else {
            // Only adjust the oldest batch
            this.db.db.prepare(`
              UPDATE Stock 
              SET quantity = ?,
                  last_updated = CURRENT_TIMESTAMP
              WHERE stock_id = ?
            `).run(newOldestBatchQty, stock.stock_id);
          }
        } else {
          throw new Error('Stock not found and quantity is 0 or negative');
        }
      }

      const difference = adjustedQuantity - previousTotalQuantity;

      // Record movement
      const movementStmt = this.db.db.prepare(`
        INSERT INTO StockMovements (
          stock_id, movement_type, movement_reason, quantity,
          unit_price, previous_quantity, new_quantity, notes, created_by
        ) VALUES (?, 'ADJUSTMENT', ?, ?, ?, ?, ?, ?, ?)
      `);

      const movementResult = movementStmt.run(
        stock.stock_id,
        reason || 'MANUAL_ADJUSTMENT',
        difference,
        stock.unit_price || 0,
        previousTotalQuantity,
        adjustedQuantity,
        notes || null,
        userId
      );

      return {
        success: true,
        movement_id: movementResult.lastInsertRowid,
        previous_quantity: previousTotalQuantity,
        new_quantity: adjustedQuantity,
        difference: difference,
        message: 'Stock adjusted successfully'
      };
    } catch (error) {
      console.error('Error adjusting stock:', error);
      throw error;
    }
  }

  /**
   * Get stock movements for an item
   */
  async getMovementsByItem(itemType, itemId, limit = 50) {
    try {
      const query = `
        SELECT sm.*, 
               u.username as performed_by_username
        FROM StockMovements sm
        INNER JOIN Stock s ON sm.stock_id = s.stock_id
        LEFT JOIN Users u ON sm.created_by = u.user_id
        WHERE s.item_type = ? AND s.item_id = ?
        ORDER BY sm.movement_date DESC
        LIMIT ?
      `;

      const movements = this.db.db.prepare(query).all(itemType, itemId, limit);
      return movements;
    } catch (error) {
      console.error('Error fetching movements:', error);
      throw error;
    }
  }

  /**
   * Get all recent stock movements
   */
  async getAllMovements(filters = {}, limit = 100) {
    try {
      let query = `
        SELECT sm.*, 
               s.item_type,
               s.item_id,
               u.username as performed_by_username,
               CASE 
                 WHEN s.item_type = 'PRODUCT' THEN p.product_name
                 WHEN s.item_type = 'GRAIN' THEN g.grain_name
               END as item_name,
               CASE 
                 WHEN s.item_type = 'PRODUCT' THEN p.product_code
                 WHEN s.item_type = 'GRAIN' THEN g.grain_code
               END as item_code
        FROM StockMovements sm
        INNER JOIN Stock s ON sm.stock_id = s.stock_id
        LEFT JOIN Users u ON sm.created_by = u.user_id
        LEFT JOIN Products p ON s.item_type = 'PRODUCT' AND s.item_id = p.product_id
        LEFT JOIN GrainTypes g ON s.item_type = 'GRAIN' AND s.item_id = g.grain_id
      `;

      const conditions = [];
      const params = [];

      if (filters.movement_type) {
        conditions.push('sm.movement_type = ?');
        params.push(filters.movement_type);
      }

      if (filters.item_type) {
        conditions.push('s.item_type = ?');
        params.push(filters.item_type);
      }

      if (filters.date_from) {
        conditions.push('DATE(sm.movement_date) >= ?');
        params.push(filters.date_from);
      }

      if (filters.date_to) {
        conditions.push('DATE(sm.movement_date) <= ?');
        params.push(filters.date_to);
      }

      if (conditions.length > 0) {
        query += ' WHERE ' + conditions.join(' AND ');
      }

      query += ' ORDER BY sm.movement_date DESC LIMIT ?';
      params.push(limit);

      const movements = this.db.db.prepare(query).all(...params);
      return movements;
    } catch (error) {
      console.error('Error fetching all movements:', error);
      throw error;
    }
  }

  /**
   * Get all stock levels
   */
  async getAllStock(filters = {}) {
    try {
      let query = `
        SELECT s.*,
               CASE 
                 WHEN s.item_type = 'PRODUCT' THEN p.product_name
                 WHEN s.item_type = 'GRAIN' THEN g.grain_name
               END as item_name,
               CASE 
                 WHEN s.item_type = 'PRODUCT' THEN p.product_code
                 WHEN s.item_type = 'GRAIN' THEN g.grain_code
               END as item_code,
               CASE 
                 WHEN s.item_type = 'PRODUCT' THEN p.unit_of_measure
                 WHEN s.item_type = 'GRAIN' THEN g.unit_of_measure
               END as unit_of_measure,
               CASE 
                 WHEN s.item_type = 'PRODUCT' THEN p.reorder_level
                 WHEN s.item_type = 'GRAIN' THEN g.reorder_level
               END as reorder_level,
               (s.quantity * s.unit_price) as stock_value
        FROM Stock s
        LEFT JOIN Products p ON s.item_type = 'PRODUCT' AND s.item_id = p.product_id
        LEFT JOIN GrainTypes g ON s.item_type = 'GRAIN' AND s.item_id = g.grain_id
      `;

      const conditions = [];
      const params = [];

      if (filters.item_type) {
        conditions.push('s.item_type = ?');
        params.push(filters.item_type);
      }

      if (filters.low_stock) {
        conditions.push('s.quantity <= CASE WHEN s.item_type = "PRODUCT" THEN p.reorder_level ELSE g.reorder_level END');
      }

      if (conditions.length > 0) {
        query += ' WHERE ' + conditions.join(' AND ');
      }

      query += ' ORDER BY item_name ASC';

      const stock = this.db.db.prepare(query).all(...params);
      return stock;
    } catch (error) {
      console.error('Error fetching all stock:', error);
      throw error;
    }
  }

  /**
   * Clear all stock batches for an item (set all to 0)
   * Used when preparing to delete a product or for manual stock clearing
   */
  async clearAllBatches(itemType, itemId, reason, notes, userId) {
    try {
      console.log(`[StockService] clearAllBatches called for ${itemType} ${itemId}`);
      
      // Get all batches with stock > 0
      const batches = await this.getAllStockBatchesForItem(itemType, itemId);
      
      if (batches.length === 0) {
        return {
          success: true,
          batches_cleared: 0,
          message: 'No stock batches to clear'
        };
      }

      let batchesCleared = 0;
      const movements = [];

      // Clear each batch
      for (const batch of batches) {
        const previousQuantity = parseFloat(batch.quantity);
        
        if (previousQuantity > 0) {
          // Set batch quantity to 0
          const updateStmt = this.db.db.prepare(`
            UPDATE Stock 
            SET quantity = 0,
                last_updated = CURRENT_TIMESTAMP
            WHERE stock_id = ?
          `);
          updateStmt.run(batch.stock_id);

          // Record movement
          const movementStmt = this.db.db.prepare(`
            INSERT INTO StockMovements (
              stock_id, movement_type, movement_reason, quantity,
              unit_price, previous_quantity, new_quantity, notes, created_by
            ) VALUES (?, 'ADJUSTMENT', ?, ?, ?, ?, ?, ?, ?)
          `);

          const movementResult = movementStmt.run(
            batch.stock_id,
            reason || 'STOCK_CLEARING',
            -previousQuantity, // Negative because we're removing
            batch.unit_price,
            previousQuantity,
            0,
            notes || `Stock batch cleared: ${previousQuantity} units removed`,
            userId
          );

          movements.push({
            movement_id: movementResult.lastInsertRowid,
            stock_id: batch.stock_id,
            previous_quantity: previousQuantity,
            unit_price: batch.unit_price
          });

          batchesCleared++;
        }
      }

      console.log(`[StockService] Cleared ${batchesCleared} batches for ${itemType} ${itemId}`);

      return {
        success: true,
        batches_cleared: batchesCleared,
        movements: movements,
        message: `Successfully cleared ${batchesCleared} stock batch(es)`
      };
    } catch (error) {
      console.error('Error clearing stock batches:', error);
      throw error;
    }
  }

  /**
   * Get stock statistics
   */
  async getStatistics() {
    try {
      const stats = this.db.db.prepare(`
        SELECT 
          COUNT(*) as total_items,
          SUM(CASE WHEN item_type = 'PRODUCT' THEN 1 ELSE 0 END) as total_products,
          SUM(CASE WHEN item_type = 'GRAIN' THEN 1 ELSE 0 END) as total_grains,
          SUM(quantity * unit_price) as total_stock_value,
          SUM(CASE WHEN quantity = 0 THEN 1 ELSE 0 END) as out_of_stock_items
        FROM Stock
      `).get();

      const movementStats = this.db.db.prepare(`
        SELECT 
          SUM(CASE WHEN movement_type = 'IN' THEN 1 ELSE 0 END) as total_in_movements,
          SUM(CASE WHEN movement_type = 'OUT' THEN 1 ELSE 0 END) as total_out_movements,
          SUM(CASE WHEN movement_type = 'ADJUSTMENT' THEN 1 ELSE 0 END) as total_adjustments
        FROM StockMovements
      `).get();

      return { ...stats, ...movementStats };
    } catch (error) {
      console.error('Error fetching stock statistics:', error);
      throw error;
    }
  }

  /**
   * Get items below their reorder level (all industries)
   * Returns products and grains where current stock < reorder_level
   */
  async getReorderAlerts() {
    try {
      const productAlerts = this.db.db.prepare(`
        SELECT 
          p.product_id as item_id,
          'PRODUCT' as item_type,
          p.product_name as item_name,
          p.product_code as item_code,
          p.reorder_level,
          p.unit_of_measure,
          COALESCE(SUM(s.quantity), 0) as current_stock
        FROM Products p
        LEFT JOIN Stock s ON s.item_type = 'PRODUCT' AND s.item_id = p.product_id
        WHERE p.is_active = 1 AND p.reorder_level > 0
        GROUP BY p.product_id
        HAVING current_stock < p.reorder_level
        ORDER BY (current_stock * 1.0 / p.reorder_level) ASC
      `).all();

      const grainAlerts = this.db.db.prepare(`
        SELECT 
          g.grain_id as item_id,
          'GRAIN' as item_type,
          g.grain_name as item_name,
          g.grain_code as item_code,
          g.reorder_level,
          g.unit_of_measure,
          COALESCE(SUM(s.quantity), 0) as current_stock
        FROM GrainTypes g
        LEFT JOIN Stock s ON s.item_type = 'GRAIN' AND s.item_id = g.grain_id
        WHERE g.is_active = 1 AND g.reorder_level > 0
        GROUP BY g.grain_id
        HAVING current_stock < g.reorder_level
        ORDER BY (current_stock * 1.0 / g.reorder_level) ASC
      `).all();

      const allAlerts = [...productAlerts, ...grainAlerts].map(item => ({
        ...item,
        deficit: item.reorder_level - item.current_stock,
        stock_percentage: item.reorder_level > 0 
          ? Math.round((item.current_stock / item.reorder_level) * 100) 
          : 0,
        urgency: item.current_stock === 0 ? 'OUT_OF_STOCK' 
          : item.current_stock <= item.reorder_level * 0.25 ? 'CRITICAL'
          : item.current_stock <= item.reorder_level * 0.5 ? 'LOW'
          : 'WARNING'
      }));

      return {
        success: true,
        total: allAlerts.length,
        out_of_stock: allAlerts.filter(a => a.urgency === 'OUT_OF_STOCK').length,
        critical: allAlerts.filter(a => a.urgency === 'CRITICAL').length,
        low: allAlerts.filter(a => a.urgency === 'LOW').length,
        items: allAlerts
      };
    } catch (error) {
      console.error('Error fetching reorder alerts:', error);
      throw error;
    }
  }

  /**
   * Get medicine expiry alerts for dashboard (Medical industry)
   * Groups by urgency: expired, critical (≤30d), warning (≤60d), notice (≤90d)
   */
  async getExpiryAlerts(daysThreshold = 90) {
    try {
      const alerts = this.db.db.prepare(`
        SELECT 
          mb.batch_id,
          mb.batch_number,
          mb.product_id,
          p.product_name,
          p.product_code,
          p.generic_name,
          mb.expiry_date,
          mb.quantity,
          mb.purchase_price,
          (mb.quantity * mb.purchase_price) as batch_value,
          CAST(julianday(mb.expiry_date) - julianday('now') AS INTEGER) as days_until_expiry
        FROM MedicineBatches mb
        JOIN Products p ON mb.product_id = p.product_id
        WHERE mb.is_active = 1 
          AND mb.quantity > 0
          AND mb.expiry_date <= DATE('now', '+' || ? || ' days')
        ORDER BY mb.expiry_date ASC
      `).all(daysThreshold);

      const grouped = {
        expired: [],
        critical: [],  // ≤ 30 days
        warning: [],   // ≤ 60 days
        notice: [],    // ≤ 90 days
      };

      for (const alert of alerts) {
        const days = alert.days_until_expiry;
        if (days <= 0) grouped.expired.push(alert);
        else if (days <= 30) grouped.critical.push(alert);
        else if (days <= 60) grouped.warning.push(alert);
        else grouped.notice.push(alert);
      }

      return {
        success: true,
        total: alerts.length,
        expired_count: grouped.expired.length,
        critical_count: grouped.critical.length,
        warning_count: grouped.warning.length,
        notice_count: grouped.notice.length,
        total_value_at_risk: alerts.reduce((sum, a) => sum + (a.batch_value || 0), 0),
        groups: grouped,
        items: alerts
      };
    } catch (error) {
      console.error('Error fetching expiry alerts:', error);
      throw error;
    }
  }

  /**
   * Get combined dashboard alert summary
   */
  async getDashboardAlerts(industryType) {
    try {
      const reorder = await this.getReorderAlerts();
      const result = {
        reorder_alerts: reorder,
        expiry_alerts: null
      };

      if (industryType === 'MEDICAL') {
        result.expiry_alerts = await this.getExpiryAlerts(90);
      }

      return { success: true, ...result };
    } catch (error) {
      console.error('Error fetching dashboard alerts:', error);
      return { success: false, message: error.message };
    }
  }
}

export default StockService;
