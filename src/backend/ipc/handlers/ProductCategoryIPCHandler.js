/**
 * ProductCategoryIPCHandler - Sprint 4 IPC Layer
 * Handles IPC communication for product category operations
 */

import { ipcMain } from 'electron';
import ProductCategoryService from '../../../services/product/ProductCategoryService.js';

class ProductCategoryIPCHandler {
  constructor() {
    this.service = new ProductCategoryService();
  }

  /**
   * Register all product category IPC handlers
   */
  register() {
    // Create category
    ipcMain.handle('product-category:create', async (event, categoryData, userId) => {
      try {
        return await this.service.create(categoryData, userId);
      } catch (error) {
        console.error('IPC Error - product-category:create:', error);
        return { success: false, message: error.message };
      }
    });

    // Get category by ID
    ipcMain.handle('product-category:get-by-id', async (event, categoryId) => {
      try {
        return await this.service.getById(categoryId);
      } catch (error) {
        console.error('IPC Error - product-category:get-by-id:', error);
        return null;
      }
    });

    // Get category by code
    ipcMain.handle('product-category:get-by-code', async (event, categoryCode) => {
      try {
        return await this.service.getByCode(categoryCode);
      } catch (error) {
        console.error('IPC Error - product-category:get-by-code:', error);
        return null;
      }
    });

    // Get all categories
    ipcMain.handle('product-category:get-all', async (event, filters = {}) => {
      try {
        return await this.service.getAll(filters);
      } catch (error) {
        console.error('IPC Error - product-category:get-all:', error);
        return [];
      }
    });

    // Update category
    ipcMain.handle('product-category:update', async (event, categoryId, updateData, userId) => {
      try {
        return await this.service.update(categoryId, updateData, userId);
      } catch (error) {
        console.error('IPC Error - product-category:update:', error);
        return { success: false, message: error.message };
      }
    });

    // Clear products from category
    ipcMain.handle('product-category:clear-products', async (event, categoryId, reason, notes, userId) => {
      try {
        console.log(`[ProductCategoryIPCHandler] Clearing products from category ${categoryId}, reason: ${reason}`);
        return await this.service.clearProducts(categoryId, reason, notes, userId);
      } catch (error) {
        console.error('IPC Error - product-category:clear-products:', error);
        return { success: false, message: error.message };
      }
    });

    // Delete category (with optional product reassignment)
    ipcMain.handle('product-category:delete', async (event, categoryId, userId, targetCategoryId = null) => {
      try {
        console.log(`[ProductCategoryIPCHandler] Deleting category ${categoryId}, target: ${targetCategoryId}`);
        return await this.service.delete(categoryId, userId, targetCategoryId);
      } catch (error) {
        console.error('IPC Error - product-category:delete:', error);
        return { success: false, message: error.message };
      }
    });

    // Search categories
    ipcMain.handle('product-category:search', async (event, searchTerm) => {
      try {
        return await this.service.search(searchTerm);
      } catch (error) {
        console.error('IPC Error - product-category:search:', error);
        return [];
      }
    });

    // Get category statistics
    ipcMain.handle('product-category:get-statistics', async () => {
      try {
        const stats = await this.service.getStatistics();
        return { success: true, data: stats };
      } catch (error) {
        console.error('IPC Error - product-category:get-statistics:', error);
        return { success: false, data: { total_categories: 0, active_categories: 0, total_products: 0 } };
      }
    });

    console.log('Product Category IPC handlers registered');
  }
}

export default ProductCategoryIPCHandler;
