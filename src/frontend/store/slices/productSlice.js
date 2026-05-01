/**
 * productSlice - Sprint 4 Redux State Management
 * Manages product state for the application
 */

import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';

// Async thunks for product operations
export const fetchAllProducts = createAsyncThunk(
  'product/fetchAll',
  async (filters = {}, { rejectWithValue }) => {
    try {
      const products = await window.electronAPI.product.getAll(filters);
      return products;
    } catch (error) {
      return rejectWithValue(error.message);
    }
  }
);

export const createProduct = createAsyncThunk(
  'product/create',
  async ({ productData, userId }, { rejectWithValue }) => {
    try {
      const result = await window.electronAPI.product.create(productData, userId);
      if (!result.success) {
        return rejectWithValue(result.message);
      }
      return result;
    } catch (error) {
      return rejectWithValue(error.message);
    }
  }
);

export const updateProduct = createAsyncThunk(
  'product/update',
  async ({ productId, updateData, userId }, { rejectWithValue }) => {
    try {
      const result = await window.electronAPI.product.update(productId, updateData, userId);
      if (!result.success) {
        return rejectWithValue(result.message);
      }
      return { productId, updateData };
    } catch (error) {
      return rejectWithValue(error.message);
    }
  }
);

export const deleteProduct = createAsyncThunk(
  'product/delete',
  async ({ productId, userId }, { rejectWithValue }) => {
    try {
      const result = await window.electronAPI.product.delete(productId, userId);
      if (!result.success) {
        return rejectWithValue(result.message);
      }
      return productId;
    } catch (error) {
      return rejectWithValue(error.message);
    }
  }
);

export const searchProducts = createAsyncThunk(
  'product/search',
  async (searchTerm, { rejectWithValue }) => {
    try {
      const products = await window.electronAPI.product.search(searchTerm);
      return products;
    } catch (error) {
      return rejectWithValue(error.message);
    }
  }
);

export const fetchLowStockProducts = createAsyncThunk(
  'product/fetchLowStock',
  async (_, { rejectWithValue }) => {
    try {
      const products = await window.electronAPI.product.getLowStock();
      return products;
    } catch (error) {
      return rejectWithValue(error.message);
    }
  }
);

export const fetchProductStatistics = createAsyncThunk(
  'product/fetchStatistics',
  async (_, { rejectWithValue }) => {
    try {
      const statistics = await window.electronAPI.product.getStatistics();
      return statistics;
    } catch (error) {
      return rejectWithValue(error.message);
    }
  }
);

const productSlice = createSlice({
  name: 'product',
  initialState: {
    products: [],
    lowStockProducts: [],
    statistics: {
      total_products: 0,
      active_products: 0,
      low_stock_products: 0,
      total_stock_value: 0,
    },
    loading: false,
    error: null,
    operationSuccess: null,
  },
  reducers: {
    clearError: (state) => {
      state.error = null;
    },
    clearOperationSuccess: (state) => {
      state.operationSuccess = null;
    },
  },
  extraReducers: (builder) => {
    // Fetch all products
    builder.addCase(fetchAllProducts.pending, (state) => {
      state.loading = true;
      state.error = null;
    });
    builder.addCase(fetchAllProducts.fulfilled, (state, action) => {
      state.loading = false;
      state.products = action.payload;
    });
    builder.addCase(fetchAllProducts.rejected, (state, action) => {
      state.loading = false;
      state.error = action.payload;
    });

    // Create product
    builder.addCase(createProduct.pending, (state) => {
      state.loading = true;
      state.error = null;
      state.operationSuccess = null;
    });
    builder.addCase(createProduct.fulfilled, (state, action) => {
      state.loading = false;
      state.operationSuccess = 'Product created successfully';
    });
    builder.addCase(createProduct.rejected, (state, action) => {
      state.loading = false;
      state.error = action.payload;
    });

    // Update product
    builder.addCase(updateProduct.pending, (state) => {
      state.loading = true;
      state.error = null;
      state.operationSuccess = null;
    });
    builder.addCase(updateProduct.fulfilled, (state, action) => {
      state.loading = false;
      state.operationSuccess = 'Product updated successfully';
      const index = state.products.findIndex(p => p.product_id === action.payload.productId);
      if (index !== -1) {
        state.products[index] = { ...state.products[index], ...action.payload.updateData };
      }
    });
    builder.addCase(updateProduct.rejected, (state, action) => {
      state.loading = false;
      state.error = action.payload;
    });

    // Delete product
    builder.addCase(deleteProduct.pending, (state) => {
      state.loading = true;
      state.error = null;
      state.operationSuccess = null;
    });
    builder.addCase(deleteProduct.fulfilled, (state, action) => {
      state.loading = false;
      state.operationSuccess = 'Product deleted successfully';
      state.products = state.products.filter(p => p.product_id !== action.payload);
    });
    builder.addCase(deleteProduct.rejected, (state, action) => {
      state.loading = false;
      state.error = action.payload;
    });

    // Search products
    builder.addCase(searchProducts.pending, (state) => {
      state.loading = true;
      state.error = null;
    });
    builder.addCase(searchProducts.fulfilled, (state, action) => {
      state.loading = false;
      state.products = action.payload;
    });
    builder.addCase(searchProducts.rejected, (state, action) => {
      state.loading = false;
      state.error = action.payload;
    });

    // Fetch low stock products
    builder.addCase(fetchLowStockProducts.fulfilled, (state, action) => {
      state.lowStockProducts = action.payload;
    });

    // Fetch statistics
    builder.addCase(fetchProductStatistics.fulfilled, (state, action) => {
      state.statistics = action.payload;
    });
  },
});

export const { clearError, clearOperationSuccess } = productSlice.actions;
export default productSlice.reducer;
