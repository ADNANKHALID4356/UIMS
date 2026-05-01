import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';

/**
 * Dealer Redux Slice - State management for dealers
 * Sprint 3 - FR-3.2 Dealer Management
 * All operations work completely offline
 */

// Async thunks for dealer operations
export const fetchAllDealers = createAsyncThunk(
  'dealer/fetchAll',
  async (activeOnly = true, { rejectWithValue }) => {
    try {
      const result = await window.electronAPI.dealer.getAll(activeOnly);
      if (result.success) {
        return result.data;
      }
      return rejectWithValue(result.error);
    } catch (error) {
      return rejectWithValue(error.message);
    }
  }
);

export const fetchDealerById = createAsyncThunk(
  'dealer/fetchById',
  async (dealerId, { rejectWithValue }) => {
    try {
      const result = await window.electronAPI.dealer.getById(dealerId);
      if (result.success) {
        return result.data;
      }
      return rejectWithValue(result.error);
    } catch (error) {
      return rejectWithValue(error.message);
    }
  }
);

export const createDealer = createAsyncThunk(
  'dealer/create',
  async ({ dealerData, userId }, { rejectWithValue }) => {
    try {
      const result = await window.electronAPI.dealer.create(dealerData, userId);
      if (result.success) {
        return result.data;
      }
      return rejectWithValue(result.error);
    } catch (error) {
      return rejectWithValue(error.message);
    }
  }
);

export const updateDealer = createAsyncThunk(
  'dealer/update',
  async ({ dealerId, dealerData, userId }, { rejectWithValue }) => {
    try {
      const result = await window.electronAPI.dealer.update(dealerId, dealerData, userId);
      if (result.success) {
        return result.data;
      }
      return rejectWithValue(result.error);
    } catch (error) {
      return rejectWithValue(error.message);
    }
  }
);

export const deleteDealer = createAsyncThunk(
  'dealer/delete',
  async ({ dealerId, userId }, { rejectWithValue }) => {
    try {
      const result = await window.electronAPI.dealer.delete(dealerId, userId);
      if (result.success) {
        return dealerId;
      }
      return rejectWithValue(result.error);
    } catch (error) {
      return rejectWithValue(error.message);
    }
  }
);

export const searchDealers = createAsyncThunk(
  'dealer/search',
  async (searchTerm, { rejectWithValue }) => {
    try {
      const result = await window.electronAPI.dealer.search(searchTerm);
      if (result.success) {
        return result.data;
      }
      return rejectWithValue(result.error);
    } catch (error) {
      return rejectWithValue(error.message);
    }
  }
);

export const fetchDealerStatistics = createAsyncThunk(
  'dealer/fetchStatistics',
  async (_, { rejectWithValue }) => {
    try {
      const result = await window.electronAPI.dealer.getStats();
      if (result.success) {
        return result.data;
      }
      return rejectWithValue(result.error);
    } catch (error) {
      return rejectWithValue(error.message);
    }
  }
);

// Initial state
const initialState = {
  dealers: [],
  selectedDealer: null,
  searchResults: [],
  loading: false,
  error: null,
  statistics: {
    totalDealers: 0,
    activeDealers: 0,
    totalBalance: 0,
    totalCredit: 0
  }
};

// Dealer slice
const dealerSlice = createSlice({
  name: 'dealer',
  initialState,
  reducers: {
    selectDealer: (state, action) => {
      state.selectedDealer = action.payload;
    },
    clearSelectedDealer: (state) => {
      state.selectedDealer = null;
    },
    clearDealerError: (state) => {
      state.error = null;
    },
    clearSearchResults: (state) => {
      state.searchResults = [];
    }
  },
  extraReducers: (builder) => {
    // Fetch all dealers
    builder
      .addCase(fetchAllDealers.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchAllDealers.fulfilled, (state, action) => {
        state.loading = false;
        state.dealers = action.payload;
      })
      .addCase(fetchAllDealers.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      });

    // Fetch dealer by ID
    builder
      .addCase(fetchDealerById.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchDealerById.fulfilled, (state, action) => {
        state.loading = false;
        state.selectedDealer = action.payload;
      })
      .addCase(fetchDealerById.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      });

    // Create dealer
    builder
      .addCase(createDealer.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(createDealer.fulfilled, (state, action) => {
        state.loading = false;
        state.dealers.push(action.payload);
      })
      .addCase(createDealer.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      });

    // Update dealer
    builder
      .addCase(updateDealer.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(updateDealer.fulfilled, (state, action) => {
        state.loading = false;
        const index = state.dealers.findIndex(
          (d) => d.dealer_id === action.payload.dealer_id
        );
        if (index !== -1) {
          state.dealers[index] = action.payload;
        }
        if (state.selectedDealer?.dealer_id === action.payload.dealer_id) {
          state.selectedDealer = action.payload;
        }
      })
      .addCase(updateDealer.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      });

    // Delete dealer
    builder
      .addCase(deleteDealer.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(deleteDealer.fulfilled, (state, action) => {
        state.loading = false;
        state.dealers = state.dealers.filter(
          (d) => d.dealer_id !== action.payload
        );
        if (state.selectedDealer?.dealer_id === action.payload) {
          state.selectedDealer = null;
        }
      })
      .addCase(deleteDealer.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      });

    // Search dealers
    builder
      .addCase(searchDealers.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(searchDealers.fulfilled, (state, action) => {
        state.loading = false;
        state.dealers = action.payload;
      })
      .addCase(searchDealers.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      });

    // Fetch dealer statistics
    builder
      .addCase(fetchDealerStatistics.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchDealerStatistics.fulfilled, (state, action) => {
        state.loading = false;
        state.statistics = action.payload;
      })
      .addCase(fetchDealerStatistics.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      });
  }
});

export const {
  selectDealer,
  clearSelectedDealer,
  clearDealerError,
  clearSearchResults
} = dealerSlice.actions;

export default dealerSlice.reducer;
