import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';

/**
 * Organization Slice
 * ==================
 * Manages organization/industry configuration state.
 * SRS v2.0 Sprint 1 — Foundation & Industry Configuration
 */

// Check if organization is configured
export const checkOrganizationSetup = createAsyncThunk(
  'organization/checkSetup',
  async (_, { rejectWithValue }) => {
    try {
      const result = await window.electronAPI.organization.isConfigured();
      if (result.success) {
        return result.data; // boolean
      }
      return rejectWithValue(result.error);
    } catch (error) {
      return rejectWithValue(error.message);
    }
  }
);

// Get organization settings
export const fetchOrganizationSettings = createAsyncThunk(
  'organization/fetchSettings',
  async (_, { rejectWithValue }) => {
    try {
      const result = await window.electronAPI.organization.getSettings();
      if (result.success) {
        return result.data;
      }
      return rejectWithValue(result.error);
    } catch (error) {
      return rejectWithValue(error.message);
    }
  }
);

// Get industry configuration (terminology, features, navigation)
export const fetchIndustryConfig = createAsyncThunk(
  'organization/fetchIndustryConfig',
  async (_, { rejectWithValue }) => {
    try {
      const result = await window.electronAPI.organization.getIndustryConfig();
      if (result.success) {
        return result.data;
      }
      return rejectWithValue(result.error);
    } catch (error) {
      return rejectWithValue(error.message);
    }
  }
);

// Setup organization (wizard)
export const setupOrganization = createAsyncThunk(
  'organization/setup',
  async (data, { rejectWithValue }) => {
    try {
      const result = await window.electronAPI.organization.setup(data);
      if (result.success) {
        return result.data;
      }
      return rejectWithValue(result.error);
    } catch (error) {
      return rejectWithValue(error.message);
    }
  }
);

// Update organization settings
export const updateOrganizationSettings = createAsyncThunk(
  'organization/updateSettings',
  async (data, { rejectWithValue }) => {
    try {
      const result = await window.electronAPI.organization.updateSettings(data);
      if (result.success) {
        return result.data;
      }
      return rejectWithValue(result.error);
    } catch (error) {
      return rejectWithValue(error.message);
    }
  }
);

// Get available industries for wizard
export const fetchAvailableIndustries = createAsyncThunk(
  'organization/fetchAvailableIndustries',
  async (_, { rejectWithValue }) => {
    try {
      const result = await window.electronAPI.organization.getAvailableIndustries();
      if (result.success) {
        return result.data;
      }
      return rejectWithValue(result.error);
    } catch (error) {
      return rejectWithValue(error.message);
    }
  }
);

// Change industry type (from Settings)
export const changeIndustry = createAsyncThunk(
  'organization/changeIndustry',
  async (newIndustryType, { rejectWithValue }) => {
    try {
      const result = await window.electronAPI.organization.changeIndustry(newIndustryType);
      if (result.success) {
        return result.data;
      }
      return rejectWithValue(result.error);
    } catch (error) {
      return rejectWithValue(error.message);
    }
  }
);

const organizationSlice = createSlice({
  name: 'organization',
  initialState: {
    // Setup status
    isConfigured: false,
    isCheckingSetup: true,
    
    // Organization settings
    settings: null,
    
    // Industry configuration (terminology, features, navigation)
    industryConfig: null,
    
    // Available industries for wizard
    availableIndustries: [],
    
    // Loading/error states
    isLoading: false,
    isSettingUp: false,
    error: null,
    setupError: null,
  },

  reducers: {
    clearError: (state) => {
      state.error = null;
      state.setupError = null;
    },
    resetOrganization: (state) => {
      state.isConfigured = false;
      state.settings = null;
      state.industryConfig = null;
    },
  },

  extraReducers: (builder) => {
    // checkOrganizationSetup
    builder.addCase(checkOrganizationSetup.pending, (state) => {
      state.isCheckingSetup = true;
    });
    builder.addCase(checkOrganizationSetup.fulfilled, (state, action) => {
      state.isCheckingSetup = false;
      state.isConfigured = action.payload;
    });
    builder.addCase(checkOrganizationSetup.rejected, (state, action) => {
      state.isCheckingSetup = false;
      state.isConfigured = false;
      state.error = action.payload;
    });

    // fetchOrganizationSettings
    builder.addCase(fetchOrganizationSettings.pending, (state) => {
      state.isLoading = true;
    });
    builder.addCase(fetchOrganizationSettings.fulfilled, (state, action) => {
      state.isLoading = false;
      state.settings = action.payload;
    });
    builder.addCase(fetchOrganizationSettings.rejected, (state, action) => {
      state.isLoading = false;
      state.error = action.payload;
    });

    // fetchIndustryConfig
    builder.addCase(fetchIndustryConfig.pending, (state) => {
      state.isLoading = true;
    });
    builder.addCase(fetchIndustryConfig.fulfilled, (state, action) => {
      state.isLoading = false;
      state.industryConfig = action.payload;
    });
    builder.addCase(fetchIndustryConfig.rejected, (state, action) => {
      state.isLoading = false;
      state.error = action.payload;
    });

    // setupOrganization
    builder.addCase(setupOrganization.pending, (state) => {
      state.isSettingUp = true;
      state.setupError = null;
    });
    builder.addCase(setupOrganization.fulfilled, (state, action) => {
      state.isSettingUp = false;
      state.isConfigured = true;
      state.setupError = null;
      // Store the setup result data if available
      if (action.payload) {
        state.settings = action.payload;
      }
    });
    builder.addCase(setupOrganization.rejected, (state, action) => {
      state.isSettingUp = false;
      state.setupError = action.payload;
    });

    // updateOrganizationSettings
    builder.addCase(updateOrganizationSettings.pending, (state) => {
      state.isLoading = true;
      state.error = null;
    });
    builder.addCase(updateOrganizationSettings.fulfilled, (state) => {
      state.isLoading = false;
      // Will refetch settings after update
    });
    builder.addCase(updateOrganizationSettings.rejected, (state, action) => {
      state.isLoading = false;
      state.error = action.payload;
    });

    // fetchAvailableIndustries
    builder.addCase(fetchAvailableIndustries.pending, (state) => {
      state.isLoading = true;
    });
    builder.addCase(fetchAvailableIndustries.fulfilled, (state, action) => {
      state.isLoading = false;
      state.availableIndustries = action.payload;
    });
    builder.addCase(fetchAvailableIndustries.rejected, (state, action) => {
      state.isLoading = false;
      state.error = action.payload;
    });

    // changeIndustry
    builder.addCase(changeIndustry.pending, (state) => {
      state.isLoading = true;
      state.error = null;
    });
    builder.addCase(changeIndustry.fulfilled, (state) => {
      state.isLoading = false;
      // Will re-fetch settings and industry config after change
    });
    builder.addCase(changeIndustry.rejected, (state, action) => {
      state.isLoading = false;
      state.error = action.payload;
    });
  },
});

export const { clearError, resetOrganization } = organizationSlice.actions;
export default organizationSlice.reducer;
