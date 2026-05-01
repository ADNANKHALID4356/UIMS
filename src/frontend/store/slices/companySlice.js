import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';

/**
 * Company Redux Slice - State management for companies
 * Sprint 3 - FR-3.3 Company Management
 * All operations work completely offline
 */

// Async thunks for company operations
export const fetchAllCompanies = createAsyncThunk(
  'company/fetchAll',
  async (activeOnly = true, { rejectWithValue }) => {
    try {
      const result = await window.electronAPI.company.getAll(activeOnly);
      if (result.success) {
        return result.data;
      }
      return rejectWithValue(result.error);
    } catch (error) {
      return rejectWithValue(error.message);
    }
  }
);

export const fetchCompanyById = createAsyncThunk(
  'company/fetchById',
  async (companyId, { rejectWithValue }) => {
    try {
      const result = await window.electronAPI.company.getById(companyId);
      if (result.success) {
        return result.data;
      }
      return rejectWithValue(result.error);
    } catch (error) {
      return rejectWithValue(error.message);
    }
  }
);

export const createCompany = createAsyncThunk(
  'company/create',
  async ({ companyData, userId }, { rejectWithValue }) => {
    try {
      const result = await window.electronAPI.company.create(companyData, userId);
      if (result.success) {
        return result.data;
      }
      return rejectWithValue(result.error);
    } catch (error) {
      return rejectWithValue(error.message);
    }
  }
);

export const updateCompany = createAsyncThunk(
  'company/update',
  async ({ companyId, companyData, userId }, { rejectWithValue }) => {
    try {
      const result = await window.electronAPI.company.update(companyId, companyData, userId);
      if (result.success) {
        return result.data;
      }
      return rejectWithValue(result.error);
    } catch (error) {
      return rejectWithValue(error.message);
    }
  }
);

export const deleteCompany = createAsyncThunk(
  'company/delete',
  async ({ companyId, userId }, { rejectWithValue }) => {
    try {
      const result = await window.electronAPI.company.delete(companyId, userId);
      if (result.success) {
        return companyId;
      }
      return rejectWithValue(result.error);
    } catch (error) {
      return rejectWithValue(error.message);
    }
  }
);

export const searchCompanies = createAsyncThunk(
  'company/search',
  async (searchTerm, { rejectWithValue }) => {
    try {
      const result = await window.electronAPI.company.search(searchTerm);
      if (result.success) {
        return result.data;
      }
      return rejectWithValue(result.error);
    } catch (error) {
      return rejectWithValue(error.message);
    }
  }
);

export const fetchCompanyStatistics = createAsyncThunk(
  'company/fetchStatistics',
  async (_, { rejectWithValue }) => {
    try {
      const result = await window.electronAPI.company.getStats();
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
  companies: [],
  selectedCompany: null,
  searchResults: [],
  loading: false,
  error: null,
  statistics: {
    totalCompanies: 0,
    activeCompanies: 0,
    totalBalance: 0,
    totalCredit: 0
  }
};

// Company slice
const companySlice = createSlice({
  name: 'company',
  initialState,
  reducers: {
    selectCompany: (state, action) => {
      state.selectedCompany = action.payload;
    },
    clearSelectedCompany: (state) => {
      state.selectedCompany = null;
    },
    clearCompanyError: (state) => {
      state.error = null;
    },
    clearSearchResults: (state) => {
      state.searchResults = [];
    }
  },
  extraReducers: (builder) => {
    // Fetch all companies
    builder
      .addCase(fetchAllCompanies.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchAllCompanies.fulfilled, (state, action) => {
        state.loading = false;
        state.companies = action.payload;
      })
      .addCase(fetchAllCompanies.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      });

    // Fetch company by ID
    builder
      .addCase(fetchCompanyById.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchCompanyById.fulfilled, (state, action) => {
        state.loading = false;
        state.selectedCompany = action.payload;
      })
      .addCase(fetchCompanyById.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      });

    // Create company
    builder
      .addCase(createCompany.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(createCompany.fulfilled, (state, action) => {
        state.loading = false;
        state.companies.push(action.payload);
      })
      .addCase(createCompany.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      });

    // Update company
    builder
      .addCase(updateCompany.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(updateCompany.fulfilled, (state, action) => {
        state.loading = false;
        const index = state.companies.findIndex(
          (c) => c.company_id === action.payload.company_id
        );
        if (index !== -1) {
          state.companies[index] = action.payload;
        }
        if (state.selectedCompany?.company_id === action.payload.company_id) {
          state.selectedCompany = action.payload;
        }
      })
      .addCase(updateCompany.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      });

    // Delete company
    builder
      .addCase(deleteCompany.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(deleteCompany.fulfilled, (state, action) => {
        state.loading = false;
        state.companies = state.companies.filter(
          (c) => c.company_id !== action.payload
        );
        if (state.selectedCompany?.company_id === action.payload) {
          state.selectedCompany = null;
        }
      })
      .addCase(deleteCompany.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      });

    // Search companies
    builder
      .addCase(searchCompanies.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(searchCompanies.fulfilled, (state, action) => {
        state.loading = false;
        state.companies = action.payload;
      })
      .addCase(searchCompanies.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      });

    // Fetch company statistics
    builder
      .addCase(fetchCompanyStatistics.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchCompanyStatistics.fulfilled, (state, action) => {
        state.loading = false;
        state.statistics = action.payload;
      })
      .addCase(fetchCompanyStatistics.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      });
  }
});

export const {
  selectCompany,
  clearSelectedCompany,
  clearCompanyError,
  clearSearchResults
} = companySlice.actions;

export default companySlice.reducer;
