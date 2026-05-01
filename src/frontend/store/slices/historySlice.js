import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';

/**
 * History Slice — Redux state for audit trail / activity log
 * Sprint 3 - Entity Management: History logging viewer
 */

// Async thunks
export const fetchHistory = createAsyncThunk(
  'history/fetchHistory',
  async (filters = {}, { rejectWithValue }) => {
    try {
      const result = await window.electronAPI.history.getAll(filters);
      if (!result.success) throw new Error(result.error);
      return result.data; // { entries, total }
    } catch (error) {
      return rejectWithValue(error.message || 'Failed to fetch history');
    }
  }
);

export const fetchHistoryByEntity = createAsyncThunk(
  'history/fetchByEntity',
  async ({ tableName, recordId }, { rejectWithValue }) => {
    try {
      const result = await window.electronAPI.history.getByEntity(tableName, recordId);
      if (!result.success) throw new Error(result.error);
      return result.data;
    } catch (error) {
      return rejectWithValue(error.message || 'Failed to fetch entity history');
    }
  }
);

export const fetchTableNames = createAsyncThunk(
  'history/fetchTableNames',
  async (_, { rejectWithValue }) => {
    try {
      const result = await window.electronAPI.history.getTableNames();
      if (!result.success) throw new Error(result.error);
      return result.data;
    } catch (error) {
      return rejectWithValue(error.message || 'Failed to fetch table names');
    }
  }
);

export const fetchHistoryStatistics = createAsyncThunk(
  'history/fetchStatistics',
  async (_, { rejectWithValue }) => {
    try {
      const result = await window.electronAPI.history.getStatistics();
      if (!result.success) throw new Error(result.error);
      return result.data;
    } catch (error) {
      return rejectWithValue(error.message || 'Failed to fetch history statistics');
    }
  }
);

const historySlice = createSlice({
  name: 'history',
  initialState: {
    entries: [],
    total: 0,
    entityHistory: [],
    tableNames: [],
    statistics: null,
    loading: false,
    error: null,
    filters: {
      tableName: '',
      actionType: '',
      searchTerm: '',
      startDate: '',
      endDate: '',
      limit: 50,
      offset: 0,
    },
  },
  reducers: {
    clearHistoryError: (state) => {
      state.error = null;
    },
    setHistoryFilters: (state, action) => {
      state.filters = { ...state.filters, ...action.payload };
    },
    resetHistoryFilters: (state) => {
      state.filters = {
        tableName: '',
        actionType: '',
        searchTerm: '',
        startDate: '',
        endDate: '',
        limit: 50,
        offset: 0,
      };
    },
  },
  extraReducers: (builder) => {
    builder
      // fetchHistory
      .addCase(fetchHistory.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchHistory.fulfilled, (state, action) => {
        state.loading = false;
        state.entries = action.payload.entries;
        state.total = action.payload.total;
      })
      .addCase(fetchHistory.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      })
      // fetchHistoryByEntity
      .addCase(fetchHistoryByEntity.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchHistoryByEntity.fulfilled, (state, action) => {
        state.loading = false;
        state.entityHistory = action.payload;
      })
      .addCase(fetchHistoryByEntity.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      })
      // fetchTableNames
      .addCase(fetchTableNames.fulfilled, (state, action) => {
        state.tableNames = action.payload;
      })
      // fetchHistoryStatistics
      .addCase(fetchHistoryStatistics.fulfilled, (state, action) => {
        state.statistics = action.payload;
      });
  },
});

export const { clearHistoryError, setHistoryFilters, resetHistoryFilters } = historySlice.actions;
export default historySlice.reducer;
