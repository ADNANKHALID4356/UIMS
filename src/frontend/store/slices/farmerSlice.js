import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';

/**
 * Farmer Redux Slice - State management for farmers
 * All operations work completely offline
 */

// Async thunks for farmer operations
export const fetchAllFarmers = createAsyncThunk(
  'farmer/fetchAll',
  async (activeOnly = true, { rejectWithValue }) => {
    try {
      const result = await window.electronAPI.farmer.getAll(activeOnly);
      if (result.success) {
        return result.data;
      }
      return rejectWithValue(result.error);
    } catch (error) {
      return rejectWithValue(error.message);
    }
  }
);

export const fetchFarmerById = createAsyncThunk(
  'farmer/fetchById',
  async (farmerId, { rejectWithValue }) => {
    try {
      const result = await window.electronAPI.farmer.getById(farmerId);
      if (result.success) {
        return result.data;
      }
      return rejectWithValue(result.error);
    } catch (error) {
      return rejectWithValue(error.message);
    }
  }
);

export const createFarmer = createAsyncThunk(
  'farmer/create',
  async ({ farmerData, userId }, { rejectWithValue }) => {
    try {
      const result = await window.electronAPI.farmer.create(farmerData, userId);
      if (result.success) {
        return result.data;
      }
      return rejectWithValue(result.error);
    } catch (error) {
      return rejectWithValue(error.message);
    }
  }
);

export const updateFarmer = createAsyncThunk(
  'farmer/update',
  async ({ farmerId, farmerData, userId }, { rejectWithValue }) => {
    try {
      const result = await window.electronAPI.farmer.update(farmerId, farmerData, userId);
      if (result.success) {
        return result.data;
      }
      return rejectWithValue(result.error);
    } catch (error) {
      return rejectWithValue(error.message);
    }
  }
);

export const deleteFarmer = createAsyncThunk(
  'farmer/delete',
  async ({ farmerId, userId }, { rejectWithValue }) => {
    try {
      const result = await window.electronAPI.farmer.delete(farmerId, userId);
      if (result.success) {
        return farmerId;
      }
      return rejectWithValue(result.error);
    } catch (error) {
      return rejectWithValue(error.message);
    }
  }
);

export const searchFarmers = createAsyncThunk(
  'farmer/search',
  async (searchTerm, { rejectWithValue }) => {
    try {
      const result = await window.electronAPI.farmer.search(searchTerm);
      if (result.success) {
        return result.data;
      }
      return rejectWithValue(result.error);
    } catch (error) {
      return rejectWithValue(error.message);
    }
  }
);

export const fetchFarmerStatistics = createAsyncThunk(
  'farmer/fetchStatistics',
  async (_, { rejectWithValue }) => {
    try {
      const result = await window.electronAPI.farmer.getStatistics();
      if (result.success) {
        return result.data;
      }
      return rejectWithValue(result.error);
    } catch (error) {
      return rejectWithValue(error.message);
    }
  }
);

const initialState = {
  farmers: [],
  selectedFarmer: null,
  statistics: {
    total_farmers: 0,
    active_farmers: 0,
    total_balance: 0,
    total_credit: 0,
  },
  loading: false,
  error: null,
  searchTerm: '',
};

const farmerSlice = createSlice({
  name: 'farmer',
  initialState,
  reducers: {
    clearError: (state) => {
      state.error = null;
    },
    setSelectedFarmer: (state, action) => {
      state.selectedFarmer = action.payload;
    },
    clearSelectedFarmer: (state) => {
      state.selectedFarmer = null;
    },
    setSearchTerm: (state, action) => {
      state.searchTerm = action.payload;
    },
  },
  extraReducers: (builder) => {
    builder
      // Fetch all farmers
      .addCase(fetchAllFarmers.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchAllFarmers.fulfilled, (state, action) => {
        state.loading = false;
        state.farmers = action.payload;
      })
      .addCase(fetchAllFarmers.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      })

      // Fetch farmer by ID
      .addCase(fetchFarmerById.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchFarmerById.fulfilled, (state, action) => {
        state.loading = false;
        state.selectedFarmer = action.payload;
      })
      .addCase(fetchFarmerById.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      })

      // Create farmer
      .addCase(createFarmer.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(createFarmer.fulfilled, (state, action) => {
        state.loading = false;
        state.farmers.unshift(action.payload);
      })
      .addCase(createFarmer.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      })

      // Update farmer
      .addCase(updateFarmer.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(updateFarmer.fulfilled, (state, action) => {
        state.loading = false;
        const index = state.farmers.findIndex(
          (f) => f.farmer_id === action.payload.farmer_id
        );
        if (index !== -1) {
          state.farmers[index] = action.payload;
        }
        if (state.selectedFarmer?.farmer_id === action.payload.farmer_id) {
          state.selectedFarmer = action.payload;
        }
      })
      .addCase(updateFarmer.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      })

      // Delete farmer
      .addCase(deleteFarmer.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(deleteFarmer.fulfilled, (state, action) => {
        state.loading = false;
        state.farmers = state.farmers.filter(
          (f) => f.farmer_id !== action.payload
        );
        if (state.selectedFarmer?.farmer_id === action.payload) {
          state.selectedFarmer = null;
        }
      })
      .addCase(deleteFarmer.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      })

      // Search farmers
      .addCase(searchFarmers.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(searchFarmers.fulfilled, (state, action) => {
        state.loading = false;
        state.farmers = action.payload;
      })
      .addCase(searchFarmers.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      })

      // Fetch statistics
      .addCase(fetchFarmerStatistics.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchFarmerStatistics.fulfilled, (state, action) => {
        state.loading = false;
        state.statistics = action.payload;
      })
      .addCase(fetchFarmerStatistics.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      });
  },
});

export const { clearError, setSelectedFarmer, clearSelectedFarmer, setSearchTerm } = farmerSlice.actions;
export default farmerSlice.reducer;
