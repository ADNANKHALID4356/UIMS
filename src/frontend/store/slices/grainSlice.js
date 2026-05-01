/**
 * grainSlice - Sprint 4 Redux State Management
 * Manages grain state for the application
 */

import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';

// Async thunks for grain operations
export const fetchAllGrains = createAsyncThunk(
  'grain/fetchAll',
  async (filters = {}, { rejectWithValue }) => {
    try {
      const grains = await window.electronAPI.grain.getAll(filters);
      return grains;
    } catch (error) {
      return rejectWithValue(error.message);
    }
  }
);

export const createGrain = createAsyncThunk(
  'grain/create',
  async ({ grainData, userId }, { rejectWithValue }) => {
    try {
      const result = await window.electronAPI.grain.create(grainData, userId);
      if (!result.success) {
        return rejectWithValue(result.message);
      }
      return result;
    } catch (error) {
      return rejectWithValue(error.message);
    }
  }
);

export const updateGrain = createAsyncThunk(
  'grain/update',
  async ({ grainId, updateData, userId }, { rejectWithValue }) => {
    try {
      const result = await window.electronAPI.grain.update(grainId, updateData, userId);
      if (!result.success) {
        return rejectWithValue(result.message);
      }
      return { grainId, updateData };
    } catch (error) {
      return rejectWithValue(error.message);
    }
  }
);

export const deleteGrain = createAsyncThunk(
  'grain/delete',
  async ({ grainId, userId }, { rejectWithValue }) => {
    try {
      const result = await window.electronAPI.grain.delete(grainId, userId);
      if (!result.success) {
        return rejectWithValue(result.message);
      }
      return grainId;
    } catch (error) {
      return rejectWithValue(error.message);
    }
  }
);

export const searchGrains = createAsyncThunk(
  'grain/search',
  async (searchTerm, { rejectWithValue }) => {
    try {
      const grains = await window.electronAPI.grain.search(searchTerm);
      return grains;
    } catch (error) {
      return rejectWithValue(error.message);
    }
  }
);

export const fetchLowStockGrains = createAsyncThunk(
  'grain/fetchLowStock',
  async (_, { rejectWithValue }) => {
    try {
      const grains = await window.electronAPI.grain.getLowStock();
      return grains;
    } catch (error) {
      return rejectWithValue(error.message);
    }
  }
);

export const fetchGrainStatistics = createAsyncThunk(
  'grain/fetchStatistics',
  async (_, { rejectWithValue }) => {
    try {
      const statistics = await window.electronAPI.grain.getStatistics();
      return statistics;
    } catch (error) {
      return rejectWithValue(error.message);
    }
  }
);

const grainSlice = createSlice({
  name: 'grain',
  initialState: {
    grains: [],
    lowStockGrains: [],
    statistics: {
      total_grains: 0,
      active_grains: 0,
      low_stock_grains: 0,
      total_grain_value: 0,
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
    // Fetch all grains
    builder.addCase(fetchAllGrains.pending, (state) => {
      state.loading = true;
      state.error = null;
    });
    builder.addCase(fetchAllGrains.fulfilled, (state, action) => {
      state.loading = false;
      state.grains = action.payload;
    });
    builder.addCase(fetchAllGrains.rejected, (state, action) => {
      state.loading = false;
      state.error = action.payload;
    });

    // Create grain
    builder.addCase(createGrain.pending, (state) => {
      state.loading = true;
      state.error = null;
      state.operationSuccess = null;
    });
    builder.addCase(createGrain.fulfilled, (state, action) => {
      state.loading = false;
      state.operationSuccess = 'Grain created successfully';
    });
    builder.addCase(createGrain.rejected, (state, action) => {
      state.loading = false;
      state.error = action.payload;
    });

    // Update grain
    builder.addCase(updateGrain.pending, (state) => {
      state.loading = true;
      state.error = null;
      state.operationSuccess = null;
    });
    builder.addCase(updateGrain.fulfilled, (state, action) => {
      state.loading = false;
      state.operationSuccess = 'Grain updated successfully';
      const index = state.grains.findIndex(g => g.grain_id === action.payload.grainId);
      if (index !== -1) {
        state.grains[index] = { ...state.grains[index], ...action.payload.updateData };
      }
    });
    builder.addCase(updateGrain.rejected, (state, action) => {
      state.loading = false;
      state.error = action.payload;
    });

    // Delete grain
    builder.addCase(deleteGrain.pending, (state) => {
      state.loading = true;
      state.error = null;
      state.operationSuccess = null;
    });
    builder.addCase(deleteGrain.fulfilled, (state, action) => {
      state.loading = false;
      state.operationSuccess = 'Grain deleted successfully';
      state.grains = state.grains.filter(g => g.grain_id !== action.payload);
    });
    builder.addCase(deleteGrain.rejected, (state, action) => {
      state.loading = false;
      state.error = action.payload;
    });

    // Search grains
    builder.addCase(searchGrains.pending, (state) => {
      state.loading = true;
      state.error = null;
    });
    builder.addCase(searchGrains.fulfilled, (state, action) => {
      state.loading = false;
      state.grains = action.payload;
    });
    builder.addCase(searchGrains.rejected, (state, action) => {
      state.loading = false;
      state.error = action.payload;
    });

    // Fetch low stock grains
    builder.addCase(fetchLowStockGrains.fulfilled, (state, action) => {
      state.lowStockGrains = action.payload;
    });

    // Fetch statistics
    builder.addCase(fetchGrainStatistics.fulfilled, (state, action) => {
      state.statistics = action.payload;
    });
  },
});

export const { clearError, clearOperationSuccess } = grainSlice.actions;
export default grainSlice.reducer;
