/**
 * ProductCategoryService - Sprint 4 (FR-4.1)
 * Manages product category operations including CRUD, search, and statistics
 */

import { DatabaseService } from '../database/DatabaseService.js';

class ProductCategoryService {
  constructor() {
    this.db = DatabaseService.getInstance();
  }

  /**
   * Generate next category code (CAT001, CAT002, etc.)
   */
  async generateCategoryCode() {
    try {
      const result = this.db.db.prepare(`
        SELECT category_code FROM ProductCategories 
        ORDER BY category_id DESC LIMIT 1
      `).get();

      if (!result) {
        return 'CAT001';
      }

      const lastNumber = parseInt(result.category_code.substring(3));
      const nextNumber = lastNumber + 1;
      return `CAT${nextNumber.toString().padStart(3, '0')}`;
    } catch (error) {
      console.error('Error generating category code:', error);
      throw error;
    }
  }

  /**
   * Create a new product category
   */
  async create(categoryData, userId) {
    try {
      const categoryCode = await this.generateCategoryCode();

      const stmt = this.db.db.prepare(`
        INSERT INTO ProductCategories (
          category_code, category_name, description, 
          is_active, created_by
        ) VALUES (?, ?, ?, ?, ?)
      `);

      const result = stmt.run(
        categoryCode,
        categoryData.category_name,
        categoryData.description || null,
        categoryData.is_active !== undefined ? (categoryData.is_active ? 1 : 0) : 1,
        userId
      );

      // Create history entry
      const category = await this.getById(result.lastInsertRowid);
      await this.db.createHistoryEntry(
        'ProductCategories',
        result.lastInsertRowid,
        'CREATE',
        null,
        category,
        userId
      );

      return {
        success: true,
        category_id: result.lastInsertRowid,
        category_code: categoryCode,
        message: 'Category created successfully'
      };
    } catch (error) {
      console.error('Error creating category:', error);
      throw error;
    }
  }

  /**
   * Get category by ID
   */
  async getById(categoryId) {
    try {
      const category = this.db.db.prepare(`
        SELECT * FROM ProductCategories WHERE category_id = ?
      `).get(categoryId);

      return category || null;
    } catch (error) {
      console.error('Error fetching category by ID:', error);
      throw error;
    }
  }

  /**
   * Get category by specific code (CAT001, CAT002, etc.)
   */
  async getByCode(categoryCode) {
    try {
      const category = this.db.db.prepare(`
        SELECT * FROM ProductCategories WHERE category_code = ?
      `).get(categoryCode);

      return category || null;
    } catch (error) {
      console.error('Error fetching category by code:', error);
      throw error;
    }
  }

  /**
   * Get all categories with optional filters
   */
  async getAll(filters = {}) {
    try {
      let query = `
        SELECT pc.*, 
               u.username as created_by_username,
               COUNT(p.product_id) as product_count
        FROM ProductCategories pc
        LEFT JOIN Users u ON pc.created_by = u.user_id
        LEFT JOIN Products p ON p.category_id = pc.category_id
      `;

      const conditions = [];
      const params = [];

      if (filters.is_active !== undefined) {
        conditions.push('pc.is_active = ?');
        params.push(filters.is_active);
      }

      if (conditions.length > 0) {
        query += ' WHERE ' + conditions.join(' AND ');
      }

      query += ' GROUP BY pc.category_id ORDER BY pc.category_name ASC';

      const categories = this.db.db.prepare(query).all(...params);
      return categories;
    } catch (error) {
      console.error('Error fetching all categories:', error);
      throw error;
    }
  }

  /**
   * Update category
   */
  async update(categoryId, updateData, userId) {
    try {
      const oldCategory = await this.getById(categoryId);
      if (!oldCategory) {
        throw new Error('Category not found');
      }

      const stmt = this.db.db.prepare(`
        UPDATE ProductCategories 
        SET category_name = ?,
            description = ?,
            is_active = ?,
            updated_at = CURRENT_TIMESTAMP
        WHERE category_id = ?
      `);

      stmt.run(
        updateData.category_name,
        updateData.description || null,
        updateData.is_active !== undefined ? (updateData.is_active ? 1 : 0) : oldCategory.is_active,
        categoryId
      );

      // Create history entry
      const newCategory = await this.getById(categoryId);
      await this.db.createHistoryEntry(
        'ProductCategories',
        categoryId,
        'UPDATE',
        oldCategory,
        newCategory,
        userId
      );

      return {
        success: true,
        message: 'Category updated successfully'
      };
    } catch (error) {
      console.error('Error updating category:', error);
      throw error;
    }
  }

  /**
   * Clear all products from a category (set category_id to NULL)
   */
  async clearProducts(categoryId, reason, notes, userId) {
    try {
      const category = await this.getById(categoryId);
      if (!category) {
        throw new Error('Category not found');
      }

      // Get all products in this category
      const products = this.db.db.prepare(`
        SELECT product_id, product_name, product_code 
        FROM Products 
        WHERE category_id = ?
      `).all(categoryId);

      if (products.length === 0) {
        return {
          success: true,
          message: 'No products to clear',
          productsCleared: 0
        };
      }

      console.log(`[ProductCategoryService] Clearing ${products.length} products from category ${categoryId}`);
      console.log(`[ProductCategoryService] Reason: ${reason}, Notes: ${notes || 'None'}`);

      // Remove category from all products (set to NULL)
      const clearStmt = this.db.db.prepare(`
        UPDATE Products 
        SET category_id = NULL, updated_at = CURRENT_TIMESTAMP
        WHERE category_id = ?
      `);
      clearStmt.run(categoryId);

      // Create detailed history notes
      const historyNotes = `Product removed from category "${category.category_name}" (${category.category_code}). Reason: ${reason}${notes ? '. Notes: ' + notes : ''}. Product now has no category assigned.`;

      // Create history entries for each product
      for (const product of products) {
        await this.db.createHistoryEntry(
          'Products',
          product.product_id,
          'UPDATE',
          { ...product, category_id: categoryId },
          { ...product, category_id: null },
          userId,
          historyNotes
        );
      }

      console.log(`[ProductCategoryService] Successfully cleared ${products.length} products`);

      return {
        success: true,
        message: `Successfully removed ${products.length} product(s) from category`,
        productsCleared: products.length
      };
    } catch (error) {
      console.error('Error clearing products from category:', error);
      throw error;
    }
  }

  /**
   * Delete category with optional product reassignment
   * @param {number} categoryId - The category to delete
   * @param {number} userId - User performing the action
   * @param {number|null} targetCategoryId - Optional category to reassign products to
   */
  async delete(categoryId, userId, targetCategoryId = null) {
    try {
      const category = await this.getById(categoryId);
      if (!category) {
        throw new Error('Category not found');
      }

      // Check if category has products
      const productCount = this.db.db.prepare(`
        SELECT COUNT(*) as count FROM Products WHERE category_id = ?
      `).get(categoryId);

      // If category has products and no target specified, reject
      if (productCount.count > 0 && !targetCategoryId) {
        return {
          success: false,
          hasProducts: true,
          productCount: productCount.count,
          message: `Category has ${productCount.count} product(s). Please choose a category to reassign them to.`
        };
      }

      // If category has products and target specified, reassign
      if (productCount.count > 0 && targetCategoryId) {
        console.log(`[ProductCategoryService] Reassigning ${productCount.count} products to category ${targetCategoryId}`);
        
        const targetCategory = await this.getById(targetCategoryId);
        if (!targetCategory) {
          return {
            success: false,
            message: 'Target category not found'
          };
        }

        // Reassign products
        const reassignStmt = this.db.db.prepare(`
          UPDATE Products SET category_id = ?, updated_at = CURRENT_TIMESTAMP WHERE category_id = ?
        `);
        reassignStmt.run(targetCategoryId, categoryId);

        console.log(`[ProductCategoryService] Reassigned ${productCount.count} products to ${targetCategory.category_name}`);
      }

      // Soft delete the category
      const stmt = this.db.db.prepare(`
        UPDATE ProductCategories 
        SET is_active = 0, updated_at = CURRENT_TIMESTAMP
        WHERE category_id = ?
      `);

      stmt.run(categoryId);

      // Create history entry for category deletion
      await this.db.createHistoryEntry(
        'ProductCategories',
        categoryId,
        'DELETE',
        category,
        null,
        userId,
        productCount.count > 0 ? `Category deleted, ${productCount.count} products reassigned` : 'Category deleted (no products)'
      );

      return {
        success: true,
        message: productCount.count > 0 
          ? `Category deleted. ${productCount.count} product(s) reassigned.` 
          : 'Category deleted successfully',
        productsReassigned: productCount.count
      };
    } catch (error) {
      console.error('Error deleting category:', error);
      throw error;
    }
  }

  /**
   * Search categories by name or code
   */
  async search(searchTerm) {
    try {
      const query = `
        SELECT pc.*, 
               u.username as created_by_username,
               COUNT(p.product_id) as product_count
        FROM ProductCategories pc
        LEFT JOIN Users u ON pc.created_by = u.user_id
        LEFT JOIN Products p ON p.category_id = pc.category_id
        WHERE (pc.category_name LIKE ? OR pc.category_code LIKE ?)
          AND pc.is_active = 1
        GROUP BY pc.category_id
        ORDER BY pc.category_name ASC
      `;

      const searchPattern = `%${searchTerm}%`;
      const categories = this.db.db.prepare(query).all(searchPattern, searchPattern);
      return categories;
    } catch (error) {
      console.error('Error searching categories:', error);
      throw error;
    }
  }

  /**
   * Get category statistics
   */
  async getStatistics() {
    try {
      const stats = this.db.db.prepare(`
        SELECT 
          COUNT(*) as total_categories,
          SUM(CASE WHEN is_active = 1 THEN 1 ELSE 0 END) as active_categories,
          (SELECT COUNT(*) FROM Products) as total_products
        FROM ProductCategories
      `).get();

      return stats;
    } catch (error) {
      console.error('Error fetching category statistics:', error);
      throw error;
    }
  }
}

export default ProductCategoryService;
