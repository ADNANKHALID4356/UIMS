/**
 * ProductIPCHandler - Sprint 4 IPC Layer
 * Handles IPC communication for product operations
 */

import { ipcMain } from 'electron';
import ProductService from '../../../services/product/ProductService.js';

class ProductIPCHandler {
  constructor() {
    this.service = new ProductService();
  }

  /**
   * Register all product IPC handlers
   */
  register() {
    // Create product
    ipcMain.handle('product:create', async (event, productData, userId) => {
      try {
        return await this.service.create(productData, userId);
      } catch (error) {
        console.error('IPC Error - product:create:', error);
        return { success: false, message: error.message };
      }
    });

    // Get product by ID
    ipcMain.handle('product:get-by-id', async (event, productId) => {
      try {
        return await this.service.getById(productId);
      } catch (error) {
        console.error('IPC Error - product:get-by-id:', error);
        return null;
      }
    });

    // Get product by code
    ipcMain.handle('product:get-by-code', async (event, productCode) => {
      try {
        return await this.service.getByCode(productCode);
      } catch (error) {
        console.error('IPC Error - product:get-by-code:', error);
        return null;
      }
    });

    // Get all products
    ipcMain.handle('product:get-all', async (event, filters = {}) => {
      try {
        return await this.service.getAll(filters);
      } catch (error) {
        console.error('IPC Error - product:get-all:', error);
        return [];
      }
    });

    // Update product
    ipcMain.handle('product:update', async (event, productId, updateData, userId) => {
      try {
        return await this.service.update(productId, updateData, userId);
      } catch (error) {
        console.error('IPC Error - product:update:', error);
        return { success: false, message: error.message };
      }
    });

    // Delete product
    ipcMain.handle('product:delete', async (event, productId, userId) => {
      try {
        return await this.service.delete(productId, userId);
      } catch (error) {
        console.error('IPC Error - product:delete:', error);
        return { success: false, message: error.message };
      }
    });

    // Search products
    ipcMain.handle('product:search', async (event, searchTerm) => {
      try {
        return await this.service.search(searchTerm);
      } catch (error) {
        console.error('IPC Error - product:search:', error);
        return [];
      }
    });

    // Get low stock products
    ipcMain.handle('product:get-low-stock', async () => {
      try {
        return await this.service.getLowStockProducts();
      } catch (error) {
        console.error('IPC Error - product:get-low-stock:', error);
        return [];
      }
    });

    // Get product statistics
    ipcMain.handle('product:get-statistics', async () => {
      try {
        return await this.service.getStatistics();
      } catch (error) {
        console.error('IPC Error - product:get-statistics:', error);
        return { total_products: 0, active_products: 0, low_stock_products: 0, total_stock_value: 0 };
      }
    });

    // ── Product Variants (Retail) ──────────────────────

    ipcMain.handle('product:get-variants', async (event, productId) => {
      try {
        return await this.service.getVariants(productId);
      } catch (error) {
        console.error('IPC Error - product:get-variants:', error);
        return [];
      }
    });

    ipcMain.handle('product:add-variant', async (event, productId, variantData) => {
      try {
        return await this.service.addVariant(productId, variantData);
      } catch (error) {
        console.error('IPC Error - product:add-variant:', error);
        return { success: false, message: error.message };
      }
    });

    ipcMain.handle('product:update-variant', async (event, variantId, variantData) => {
      try {
        return await this.service.updateVariant(variantId, variantData);
      } catch (error) {
        console.error('IPC Error - product:update-variant:', error);
        return { success: false, message: error.message };
      }
    });

    ipcMain.handle('product:delete-variant', async (event, variantId) => {
      try {
        return await this.service.deleteVariant(variantId);
      } catch (error) {
        console.error('IPC Error - product:delete-variant:', error);
        return { success: false, message: error.message };
      }
    });

    // ── Serial Numbers (Retail) ────────────────────────

    ipcMain.handle('product:get-serial-numbers', async (event, productId, filters) => {
      try {
        return await this.service.getSerialNumbers(productId, filters);
      } catch (error) {
        console.error('IPC Error - product:get-serial-numbers:', error);
        return [];
      }
    });

    ipcMain.handle('product:add-serial-number', async (event, productId, serialData) => {
      try {
        return await this.service.addSerialNumber(productId, serialData);
      } catch (error) {
        console.error('IPC Error - product:add-serial-number:', error);
        return { success: false, message: error.message };
      }
    });

    ipcMain.handle('product:mark-serial-sold', async (event, serialId, entityType, entityId, transactionId) => {
      try {
        return await this.service.markSerialSold(serialId, entityType, entityId, transactionId);
      } catch (error) {
        console.error('IPC Error - product:mark-serial-sold:', error);
        return { success: false, message: error.message };
      }
    });

    ipcMain.handle('product:mark-serial-returned', async (event, serialId) => {
      try {
        return await this.service.markSerialReturned(serialId);
      } catch (error) {
        console.error('IPC Error - product:mark-serial-returned:', error);
        return { success: false, message: error.message };
      }
    });

    console.log('Product IPC handlers registered (with variants & serial numbers)');
  }
}

export default ProductIPCHandler;
