/**
 * stockSlice - Sprint 4 Redux State Management
 * Manages stock and stock movement state for the application
 */

import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';

// Async thunks for stock operations
export const addStock = createAsyncThunk(
  'stock/add',
  async ({ itemType, itemId, quantity, unitPrice, referenceType, referenceId, notes, userId }, { rejectWithValue }) => {
    try {
      console.log('[stockSlice] Adding stock:', { itemType, itemId, quantity, unitPrice });
      const result = await window.electronAPI.stock.add(itemType, itemId, quantity, unitPrice, referenceType, referenceId, notes, userId);
      console.log('[stockSlice] Add stock result:', result);
      if (!result.success) {
        return rejectWithValue(result.message);
      }
      return result;
    } catch (error) {
      console.error('[stockSlice] Add stock error:', error);
      return rejectWithValue(error.message);
    }
  }
);

export const removeStock = createAsyncThunk(
  'stock/remove',
  async ({ itemType, itemId, quantity, referenceType, referenceId, notes, userId }, { rejectWithValue }) => {
    try {
      const result = await window.electronAPI.stock.remove(itemType, itemId, quantity, referenceType, referenceId, notes, userId);
      if (!result.success) {
        return rejectWithValue(result.message);
      }
      return result;
    } catch (error) {
      return rejectWithValue(error.message);
    }
  }
);

export const adjustStock = createAsyncThunk(
  'stock/adjust',
  async ({ itemType, itemId, newQuantity, reason, notes, userId }, { rejectWithValue }) => {
    try {
      const result = await window.electronAPI.stock.adjust(itemType, itemId, newQuantity, reason, notes, userId);
      if (!result.success) {
        return rejectWithValue(result.message);
      }
      return result;
    } catch (error) {
      return rejectWithValue(error.message);
    }
  }
);

export const fetchAllStock = createAsyncThunk(
  'stock/fetchAll',
  async (filters = {}, { rejectWithValue }) => {
    try {
      const stock = await window.electronAPI.stock.getAllStock(filters);
      return stock;
    } catch (error) {
      return rejectWithValue(error.message);
    }
  }
);

export const fetchAllMovements = createAsyncThunk(
  'stock/fetchAllMovements',
  async ({ filters = {}, limit = 100 }, { rejectWithValue }) => {
    try {
      const movements = await window.electronAPI.stock.getAllMovements(filters, limit);
      return movements;
    } catch (error) {
      return rejectWithValue(error.message);
    }
  }
);

export const fetchStockLevels = createAsyncThunk(
  'stock/fetchLevels',
  async (filters = {}, { rejectWithValue }) => {
    try {
      const levels = await window.electronAPI.stock.getLevels(filters);
      return levels;
    } catch (error) {
      return rejectWithValue(error.message);
    }
  }
);

export const fetchStockBatches = createAsyncThunk(
  'stock/fetchBatches',
  async (filters = {}, { rejectWithValue }) => {
    try {
      const batches = await window.electronAPI.stock.getBatches(filters);
      return batches;
    } catch (error) {
      return rejectWithValue(error.message);
    }
  }
);

export const fetchItemMovements = createAsyncThunk(
  'stock/fetchItemMovements',
  async ({ itemType, itemId, limit = 50 }, { rejectWithValue }) => {
    try {
      const movements = await window.electronAPI.stock.getMovements(itemType, itemId, limit);
      return movements;
    } catch (error) {
      return rejectWithValue(error.message);
    }
  }
);

export const fetchStockStatistics = createAsyncThunk(
  'stock/fetchStatistics',
  async (_, { rejectWithValue }) => {
    try {
      const statistics = await window.electronAPI.stock.getStatistics();
      return statistics;
    } catch (error) {
      return rejectWithValue(error.message);
    }
  }
);

const stockSlice = createSlice({
  name: 'stock',
  initialState: {
    stock: [],
    movements: [],
    levels: [],
    batches: [],
    itemMovements: [],
    statistics: {
      total_items: 0,
      total_products: 0,
      total_grains: 0,
      total_stock_value: 0,
      out_of_stock_items: 0,
      total_in_movements: 0,
      total_out_movements: 0,
      total_adjustments: 0,
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
    // Add stock
    builder.addCase(addStock.pending, (state) => {
      state.loading = true;
      state.error = null;
      state.operationSuccess = null;
    });
    builder.addCase(addStock.fulfilled, (state, action) => {
      state.loading = false;
      state.operationSuccess = 'Stock added successfully';
    });
    builder.addCase(addStock.rejected, (state, action) => {
      state.loading = false;
      state.error = action.payload;
    });

    // Remove stock
    builder.addCase(removeStock.pending, (state) => {
      state.loading = true;
      state.error = null;
      state.operationSuccess = null;
    });
    builder.addCase(removeStock.fulfilled, (state, action) => {
      state.loading = false;
      state.operationSuccess = 'Stock removed successfully';
    });
    builder.addCase(removeStock.rejected, (state, action) => {
      state.loading = false;
      state.error = action.payload;
    });

    // Adjust stock
    builder.addCase(adjustStock.pending, (state) => {
      state.loading = true;
      state.error = null;
      state.operationSuccess = null;
    });
    builder.addCase(adjustStock.fulfilled, (state, action) => {
      state.loading = false;
      state.operationSuccess = 'Stock adjusted successfully';
    });
    builder.addCase(adjustStock.rejected, (state, action) => {
      state.loading = false;
      state.error = action.payload;
    });

    // Fetch all stock
    builder.addCase(fetchAllStock.pending, (state) => {
      state.loading = true;
      state.error = null;
    });
    builder.addCase(fetchAllStock.fulfilled, (state, action) => {
      state.loading = false;
      state.stock = action.payload;
    });
    builder.addCase(fetchAllStock.rejected, (state, action) => {
      state.loading = false;
      state.error = action.payload;
    });

    // Fetch all movements
    builder.addCase(fetchAllMovements.pending, (state) => {
      state.loading = true;
      state.error = null;
    });
    builder.addCase(fetchAllMovements.fulfilled, (state, action) => {
      state.loading = false;
      state.movements = action.payload;
    });
    builder.addCase(fetchAllMovements.rejected, (state, action) => {
      state.loading = false;
      state.error = action.payload;
    });

    // Fetch stock levels
    builder.addCase(fetchStockLevels.pending, (state) => {
      state.loading = true;
      state.error = null;
    });
    builder.addCase(fetchStockLevels.fulfilled, (state, action) => {
      state.loading = false;
      state.levels = action.payload;
    });
    builder.addCase(fetchStockLevels.rejected, (state, action) => {
      state.loading = false;
      state.error = action.payload;
    });

    // Fetch stock batches
    builder.addCase(fetchStockBatches.pending, (state) => {
      state.loading = true;
      state.error = null;
    });
    builder.addCase(fetchStockBatches.fulfilled, (state, action) => {
      state.loading = false;
      state.batches = action.payload;
    });
    builder.addCase(fetchStockBatches.rejected, (state, action) => {
      state.loading = false;
      state.error = action.payload;
    });

    // Fetch item movements
    builder.addCase(fetchItemMovements.fulfilled, (state, action) => {
      state.itemMovements = action.payload;
    });

    // Fetch statistics
    builder.addCase(fetchStockStatistics.fulfilled, (state, action) => {
      state.statistics = action.payload;
    });
  },
});

export const { clearError, clearOperationSuccess } = stockSlice.actions;
export default stockSlice.reducer;
