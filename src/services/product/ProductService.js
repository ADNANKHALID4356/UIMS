/**
 * ProductService - Sprint 4 (FR-4.2)
 * Manages product operations including CRUD, search, stock management
 * Supports industry-specific fields: Retail (SKU, barcode, brand, warranty, serial, variants),
 * Medical (generic_name, brand_name, composition, drug_form, strength, prescription, controlled),
 * Real Estate uses PropertyService separately.
 */

import { DatabaseService } from '../database/DatabaseService.js';

// Industry-specific columns on the Products table
const RETAIL_COLUMNS = ['sku', 'barcode', 'brand', 'warranty_months', 'serial_tracking', 'has_variants', 'min_price', 'max_price'];
const MEDICAL_COLUMNS = ['generic_name', 'brand_name', 'composition', 'drug_form', 'strength', 'requires_prescription', 'controlled_substance', 'storage_conditions'];
const ALL_EXTRA_COLUMNS = [...RETAIL_COLUMNS, ...MEDICAL_COLUMNS];

class ProductService {
  constructor() {
    this.db = DatabaseService.getInstance();
  }

  /**
   * Generate next product code using configurable prefix (P, M, PR, etc.)
   */
  async generateProductCode(prefix = 'P') {
    try {
      const result = this.db.db.prepare(`
        SELECT product_code FROM Products 
        ORDER BY product_id DESC LIMIT 1
      `).get();

      if (!result) {
        return `${prefix}001`;
      }

      // Extract numeric part regardless of prefix length
      const match = result.product_code.match(/(\d+)$/);
      const lastNumber = match ? parseInt(match[1]) : 0;
      const nextNumber = lastNumber + 1;
      return `${prefix}${nextNumber.toString().padStart(3, '0')}`;
    } catch (error) {
      console.error('Error generating product code:', error);
      throw error;
    }
  }

  /**
   * Build dynamic INSERT column list based on provided data
   * @private
   */
  _buildInsertQuery(productData) {
    const baseColumns = ['product_code', 'product_name', 'category_id', 'unit_of_measure', 'description', 'reorder_level', 'is_active', 'created_by'];
    const columns = [...baseColumns];
    const placeholders = baseColumns.map(() => '?');
    const values = [];

    // Check which extra columns have values
    for (const col of ALL_EXTRA_COLUMNS) {
      if (productData[col] !== undefined && productData[col] !== null && productData[col] !== '') {
        columns.push(col);
        placeholders.push('?');
      }
    }

    return { columns, placeholders };
  }

  /**
   * Create a new product (supports industry-specific fields)
   */
  async create(productData, userId) {
    try {
      const prefix = productData._codePrefix || 'P';
      const productCode = await this.generateProductCode(prefix);

      // Base columns & values
      const columns = ['product_code', 'product_name', 'category_id', 'unit_of_measure', 'description', 'reorder_level', 'is_active', 'created_by'];
      const values = [
        productCode,
        productData.product_name,
        productData.category_id,
        productData.unit_of_measure,
        productData.description || null,
        productData.reorder_level || 0,
        productData.is_active !== undefined ? (productData.is_active ? 1 : 0) : 1,
        userId
      ];

      // Dynamically add industry-specific columns
      for (const col of ALL_EXTRA_COLUMNS) {
        if (productData[col] !== undefined && productData[col] !== null && productData[col] !== '') {
          columns.push(col);
          // Boolean fields → 0/1
          if (['serial_tracking', 'has_variants', 'requires_prescription', 'controlled_substance'].includes(col)) {
            values.push(productData[col] ? 1 : 0);
          } else {
            values.push(productData[col]);
          }
        }
      }

      const placeholders = columns.map(() => '?').join(', ');
      const stmt = this.db.db.prepare(`
        INSERT INTO Products (${columns.join(', ')})
        VALUES (${placeholders})
      `);

      const result = stmt.run(...values);

      // Initialize stock entry
      await this.initializeStock(result.lastInsertRowid, 'PRODUCT');

      // Create history entry
      const product = await this.getById(result.lastInsertRowid);
      await this.db.createHistoryEntry(
        'Products',
        result.lastInsertRowid,
        'CREATE',
        null,
        product,
        userId
      );

      return {
        success: true,
        product_id: result.lastInsertRowid,
        product_code: productCode,
        message: 'Product created successfully'
      };
    } catch (error) {
      console.error('Error creating product:', error);
      throw error;
    }
  }

  /**
   * Initialize stock entry for new product
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
   * Get product by ID with stock information
   * Aggregates stock quantities from multiple batches
   */
  async getById(productId) {
    try {
      const product = this.db.db.prepare(`
        SELECT p.*, 
               pc.category_name,
               COALESCE(SUM(CASE WHEN s.quantity > 0 THEN s.quantity ELSE 0 END), 0) as current_stock,
               COALESCE(AVG(CASE WHEN s.quantity > 0 THEN s.unit_price ELSE NULL END), 0) as stock_price
        FROM Products p
        LEFT JOIN ProductCategories pc ON p.category_id = pc.category_id
        LEFT JOIN Stock s ON s.item_type = 'PRODUCT' AND s.item_id = p.product_id
        WHERE p.product_id = ?
        GROUP BY p.product_id
      `).get(productId);

      return product || null;
    } catch (error) {
      console.error('Error fetching product by ID:', error);
      throw error;;
    }
  }

  /**
   * Get product by code
   * Aggregates stock quantities from multiple batches
   */
  async getByCode(productCode) {
    try {
      const product = this.db.db.prepare(`
        SELECT p.*, 
               pc.category_name,
               COALESCE(SUM(CASE WHEN s.quantity > 0 THEN s.quantity ELSE 0 END), 0) as current_stock,
               COALESCE(AVG(CASE WHEN s.quantity > 0 THEN s.unit_price ELSE NULL END), 0) as stock_price
        FROM Products p
        LEFT JOIN ProductCategories pc ON p.category_id = pc.category_id
        LEFT JOIN Stock s ON s.item_type = 'PRODUCT' AND s.item_id = p.product_id
        WHERE p.product_code = ?
        GROUP BY p.product_id
      `).get(productCode);

      return product || null;
    } catch (error) {
      console.error('Error fetching product by code:', error);
      throw error;
    }
  }

  /**
   * Get all products with optional filters
   * Aggregates stock quantities from multiple batches
   */
  async getAll(filters = {}) {
    try {
      let query = `
        SELECT p.*, 
               pc.category_name,
               u.username as created_by_username,
               COALESCE(SUM(CASE WHEN s.quantity > 0 THEN s.quantity ELSE 0 END), 0) as current_stock,
               COALESCE(AVG(CASE WHEN s.quantity > 0 THEN s.unit_price ELSE NULL END), 0) as stock_price,
               CASE 
                 WHEN COALESCE(SUM(CASE WHEN s.quantity > 0 THEN s.quantity ELSE 0 END), 0) <= p.reorder_level THEN 1 
                 ELSE 0 
               END as needs_reorder
        FROM Products p
        LEFT JOIN ProductCategories pc ON p.category_id = pc.category_id
        LEFT JOIN Users u ON p.created_by = u.user_id
        LEFT JOIN Stock s ON s.item_type = 'PRODUCT' AND s.item_id = p.product_id
      `;

      const conditions = [];
      const params = [];

      if (filters.is_active !== undefined) {
        conditions.push('p.is_active = ?');
        params.push(filters.is_active);
      }

      if (filters.category_id) {
        conditions.push('p.category_id = ?');
        params.push(filters.category_id);
      }

      if (conditions.length > 0) {
        query += ' WHERE ' + conditions.join(' AND ');
      }

      // Group by product to aggregate stock from multiple batches
      query += ' GROUP BY p.product_id';

      // Apply low stock filter after aggregation
      if (filters.low_stock) {
        query += ' HAVING COALESCE(SUM(s.quantity), 0) <= p.reorder_level';
      }

      query += ' ORDER BY p.product_name ASC';

      const products = this.db.db.prepare(query).all(...params);
      return products;
    } catch (error) {
      console.error('Error fetching all products:', error);
      throw error;
    }
  }

  /**
   * Update product (supports industry-specific fields)
   */
  async update(productId, updateData, userId) {
    try {
      const oldProduct = await this.getById(productId);
      if (!oldProduct) {
        throw new Error('Product not found');
      }

      // Build dynamic SET clause
      const setClauses = [
        'product_name = ?',
        'category_id = ?',
        'unit_of_measure = ?',
        'description = ?',
        'reorder_level = ?',
        'is_active = ?',
        'updated_at = CURRENT_TIMESTAMP'
      ];
      const values = [
        updateData.product_name,
        updateData.category_id,
        updateData.unit_of_measure,
        updateData.description || null,
        updateData.reorder_level || 0,
        updateData.is_active !== undefined ? (updateData.is_active ? 1 : 0) : oldProduct.is_active
      ];

      // Dynamically add industry-specific columns
      for (const col of ALL_EXTRA_COLUMNS) {
        if (updateData[col] !== undefined) {
          setClauses.push(`${col} = ?`);
          if (['serial_tracking', 'has_variants', 'requires_prescription', 'controlled_substance'].includes(col)) {
            values.push(updateData[col] ? 1 : 0);
          } else {
            values.push(updateData[col] === '' ? null : updateData[col]);
          }
        }
      }

      values.push(productId);

      const stmt = this.db.db.prepare(`
        UPDATE Products 
        SET ${setClauses.join(', ')}
        WHERE product_id = ?
      `);

      stmt.run(...values);

      // Create history entry
      const newProduct = await this.getById(productId);
      await this.db.createHistoryEntry(
        'Products',
        productId,
        'UPDATE',
        oldProduct,
        newProduct,
        userId
      );

      return {
        success: true,
        message: 'Product updated successfully'
      };
    } catch (error) {
      console.error('Error updating product:', error);
      throw error;
    }
  }

  /**
   * Delete product (soft delete)
   */
  async delete(productId, userId) {
    try {
      const product = await this.getById(productId);
      if (!product) {
        throw new Error('Product not found');
      }

      // Check if product has stock
      if (product.current_stock > 0) {
        return {
          success: false,
          message: 'Cannot delete product with existing stock'
        };
      }

      // Soft delete
      const stmt = this.db.db.prepare(`
        UPDATE Products 
        SET is_active = 0, updated_at = CURRENT_TIMESTAMP
        WHERE product_id = ?
      `);

      stmt.run(productId);

      // Create history entry
      await this.db.createHistoryEntry(
        'Products',
        productId,
        'DELETE',
        product,
        null,
        userId
      );

      return {
        success: true,
        message: 'Product deleted successfully'
      };
    } catch (error) {
      console.error('Error deleting product:', error);
      throw error;
    }
  }

  /**
   * Search products by name, code, category, SKU, barcode, brand, or generic name
   * Aggregates stock quantities from multiple batches
   */
  async search(searchTerm) {
    try {
      const query = `
        SELECT p.*, 
               pc.category_name,
               u.username as created_by_username,
               COALESCE(SUM(s.quantity), 0) as current_stock,
               COALESCE(AVG(s.unit_price), 0) as stock_price
        FROM Products p
        LEFT JOIN ProductCategories pc ON p.category_id = pc.category_id
        LEFT JOIN Users u ON p.created_by = u.user_id
        LEFT JOIN Stock s ON s.item_type = 'PRODUCT' AND s.item_id = p.product_id
        WHERE p.product_name LIKE ? 
           OR p.product_code LIKE ?
           OR pc.category_name LIKE ?
           OR p.sku LIKE ?
           OR p.barcode LIKE ?
           OR p.brand LIKE ?
           OR p.generic_name LIKE ?
           OR p.brand_name LIKE ?
        GROUP BY p.product_id
        ORDER BY p.product_name ASC
      `;

      const searchPattern = `%${searchTerm}%`;
      const products = this.db.db.prepare(query).all(
        searchPattern, searchPattern, searchPattern,
        searchPattern, searchPattern, searchPattern,
        searchPattern, searchPattern
      );
      return products;
    } catch (error) {
      console.error('Error searching products:', error);
      throw error;
    }
  }

  /**
   * Get products that need reordering
   * Aggregates stock quantities from multiple batches
   */
  async getLowStockProducts() {
    try {
      const query = `
        SELECT p.*, 
               pc.category_name,
               COALESCE(SUM(s.quantity), 0) as current_stock,
               COALESCE(AVG(s.unit_price), 0) as stock_price
        FROM Products p
        LEFT JOIN ProductCategories pc ON p.category_id = pc.category_id
        LEFT JOIN Stock s ON s.item_type = 'PRODUCT' AND s.item_id = p.product_id
        WHERE p.is_active = 1
        GROUP BY p.product_id
        HAVING COALESCE(SUM(s.quantity), 0) <= p.reorder_level
        ORDER BY COALESCE(SUM(s.quantity), 0) ASC
      `;

      const products = this.db.db.prepare(query).all();
      return products;
    } catch (error) {
      console.error('Error fetching low stock products:', error);
      throw error;
    }
  }

  /**
   * Get product statistics
   */
  async getStatistics() {
    try {
      const stats = this.db.db.prepare(`
        SELECT 
          COUNT(DISTINCT p.product_id) as total_products,
          SUM(CASE WHEN p.is_active = 1 THEN 1 ELSE 0 END) as active_products,
          SUM(CASE WHEN s.quantity <= p.reorder_level THEN 1 ELSE 0 END) as low_stock_products,
          SUM(s.quantity * s.unit_price) as total_stock_value
        FROM Products p
        LEFT JOIN Stock s ON s.item_type = 'PRODUCT' AND s.item_id = p.product_id
        WHERE p.is_active = 1
      `).get();

      return stats;
    } catch (error) {
      console.error('Error fetching product statistics:', error);
      throw error;
    }
  }

  // ═══════════════════════════════════════════════
  // Product Variants (Retail: size, color, model)
  // ═══════════════════════════════════════════════

  /**
   * Get all variants for a product
   */
  async getVariants(productId) {
    try {
      return this.db.db.prepare(`
        SELECT * FROM ProductVariants
        WHERE product_id = ? AND is_active = 1
        ORDER BY variant_name ASC
      `).all(productId);
    } catch (error) {
      console.error('Error fetching variants:', error);
      throw error;
    }
  }

  /**
   * Add a variant to a product
   */
  async addVariant(productId, variantData) {
    try {
      const stmt = this.db.db.prepare(`
        INSERT INTO ProductVariants (product_id, variant_name, variant_type, sku, barcode, additional_price)
        VALUES (?, ?, ?, ?, ?, ?)
      `);
      const result = stmt.run(
        productId,
        variantData.variant_name,
        variantData.variant_type || null,
        variantData.sku || null,
        variantData.barcode || null,
        variantData.additional_price || 0
      );

      // Mark parent product as having variants
      this.db.db.prepare('UPDATE Products SET has_variants = 1 WHERE product_id = ?').run(productId);

      return { success: true, variant_id: result.lastInsertRowid, message: 'Variant added' };
    } catch (error) {
      console.error('Error adding variant:', error);
      throw error;
    }
  }

  /**
   * Update a product variant
   */
  async updateVariant(variantId, variantData) {
    try {
      const stmt = this.db.db.prepare(`
        UPDATE ProductVariants
        SET variant_name = ?, variant_type = ?, sku = ?, barcode = ?, additional_price = ?
        WHERE variant_id = ?
      `);
      stmt.run(
        variantData.variant_name,
        variantData.variant_type || null,
        variantData.sku || null,
        variantData.barcode || null,
        variantData.additional_price || 0,
        variantId
      );
      return { success: true, message: 'Variant updated' };
    } catch (error) {
      console.error('Error updating variant:', error);
      throw error;
    }
  }

  /**
   * Soft-delete a variant
   */
  async deleteVariant(variantId) {
    try {
      this.db.db.prepare('UPDATE ProductVariants SET is_active = 0 WHERE variant_id = ?').run(variantId);
      return { success: true, message: 'Variant removed' };
    } catch (error) {
      console.error('Error deleting variant:', error);
      throw error;
    }
  }

  // ═══════════════════════════════════════════════
  // Serial Numbers (Retail: per-unit serial tracking)
  // ═══════════════════════════════════════════════

  /**
   * Get serial numbers for a product
   */
  async getSerialNumbers(productId, filters = {}) {
    try {
      let query = 'SELECT * FROM SerialNumbers WHERE product_id = ?';
      const params = [productId];

      if (filters.status) {
        query += ' AND status = ?';
        params.push(filters.status);
      }

      query += ' ORDER BY created_at DESC';

      return this.db.db.prepare(query).all(...params);
    } catch (error) {
      console.error('Error fetching serial numbers:', error);
      throw error;
    }
  }

  /**
   * Add a serial number for a product
   */
  async addSerialNumber(productId, serialData) {
    try {
      const stmt = this.db.db.prepare(`
        INSERT INTO SerialNumbers (product_id, serial_number, status, warranty_expiry, notes)
        VALUES (?, ?, 'in_stock', ?, ?)
      `);
      const result = stmt.run(
        productId,
        serialData.serial_number,
        serialData.warranty_expiry || null,
        serialData.notes || null
      );
      return { success: true, serial_id: result.lastInsertRowid, message: 'Serial number added' };
    } catch (error) {
      if (error.message.includes('UNIQUE')) {
        throw new Error('This serial number already exists');
      }
      console.error('Error adding serial number:', error);
      throw error;
    }
  }

  /**
   * Mark serial number as sold
   */
  async markSerialSold(serialId, entityType, entityId, transactionId) {
    try {
      this.db.db.prepare(`
        UPDATE SerialNumbers 
        SET status = 'sold', sold_to_entity_type = ?, sold_to_entity_id = ?, transaction_id = ?
        WHERE serial_id = ?
      `).run(entityType, entityId, transactionId, serialId);
      return { success: true, message: 'Serial marked as sold' };
    } catch (error) {
      console.error('Error marking serial sold:', error);
      throw error;
    }
  }

  /**
   * Mark serial number as returned
   */
  async markSerialReturned(serialId) {
    try {
      this.db.db.prepare(`
        UPDATE SerialNumbers SET status = 'returned' WHERE serial_id = ?
      `).run(serialId);
      return { success: true, message: 'Serial returned' };
    } catch (error) {
      console.error('Error marking serial returned:', error);
      throw error;
    }
  }
}

export default ProductService;
