import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';

// Async thunks for transaction operations

export const processFarmerPurchase = createAsyncThunk(
  'transactions/processFarmerPurchase',
  async ({ data, userId }, { rejectWithValue }) => {
    try {
      const result = await window.electronAPI.transaction.processFarmerPurchase(data, userId);
      return result;
    } catch (error) {
      return rejectWithValue(error.message);
    }
  }
);

export const processFarmerSaleGrain = createAsyncThunk(
  'transactions/processFarmerSaleGrain',
  async ({ data, userId }, { rejectWithValue }) => {
    try {
      const result = await window.electronAPI.transaction.processFarmerSaleGrain(data, userId);
      return result;
    } catch (error) {
      return rejectWithValue(error.message);
    }
  }
);

export const fetchTransactions = createAsyncThunk(
  'transactions/fetchAll',
  async (filters = {}, { rejectWithValue }) => {
    try {
      const transactions = await window.electronAPI.transaction.getAll(filters);
      return transactions;
    } catch (error) {
      return rejectWithValue(error.message);
    }
  }
);

export const fetchTransactionById = createAsyncThunk(
  'transactions/fetchById',
  async (transactionId, { rejectWithValue }) => {
    try {
      const transaction = await window.electronAPI.transaction.getById(transactionId);
      return transaction;
    } catch (error) {
      return rejectWithValue(error.message);
    }
  }
);

export const fetchDailySummary = createAsyncThunk(
  'transactions/fetchDailySummary',
  async (date, { rejectWithValue }) => {
    try {
      const summary = await window.electronAPI.transaction.getDailySummary(date);
      return summary;
    } catch (error) {
      return rejectWithValue(error.message);
    }
  }
);

export const fetchDailySummaries = createAsyncThunk(
  'transactions/fetchDailySummaries',
  async ({ dateFrom, dateTo }, { rejectWithValue }) => {
    try {
      const summaries = await window.electronAPI.transaction.getDailySummaries(dateFrom, dateTo);
      return summaries;
    } catch (error) {
      return rejectWithValue(error.message);
    }
  }
);

export const fetchTransactionStatistics = createAsyncThunk(
  'transactions/fetchStatistics',
  async (filters = {}, { rejectWithValue }) => {
    try {
      const stats = await window.electronAPI.transaction.getStatistics(filters);
      return stats;
    } catch (error) {
      return rejectWithValue(error.message);
    }
  }
);

export const validateTransaction = createAsyncThunk(
  'transactions/validate',
  async (data, { rejectWithValue }) => {
    try {
      const validation = await window.electronAPI.transaction.validate(data);
      return validation;
    } catch (error) {
      return rejectWithValue(error.message);
    }
  }
);

// Initial state
const initialState = {
  transactions: [],
  currentTransaction: null,
  dailySummary: null,
  dailySummaries: [],
  statistics: null,
  validationResult: null,
  loading: false,
  error: null,
  processingTransaction: false,
  lastProcessedTransaction: null,
};

// Slice
const transactionSlice = createSlice({
  name: 'transactions',
  initialState,
  reducers: {
    clearError: (state) => {
      state.error = null;
    },
    clearValidation: (state) => {
      state.validationResult = null;
    },
    clearLastProcessed: (state) => {
      state.lastProcessedTransaction = null;
    },
    setCurrentTransaction: (state, action) => {
      state.currentTransaction = action.payload;
    },
  },
  extraReducers: (builder) => {
    // Process Farmer Purchase
    builder
      .addCase(processFarmerPurchase.pending, (state) => {
        state.processingTransaction = true;
        state.error = null;
      })
      .addCase(processFarmerPurchase.fulfilled, (state, action) => {
        state.processingTransaction = false;
        state.lastProcessedTransaction = action.payload;
        state.error = null;
      })
      .addCase(processFarmerPurchase.rejected, (state, action) => {
        state.processingTransaction = false;
        state.error = action.payload;
      });

    // Process Farmer Sale Grain
    builder
      .addCase(processFarmerSaleGrain.pending, (state) => {
        state.processingTransaction = true;
        state.error = null;
      })
      .addCase(processFarmerSaleGrain.fulfilled, (state, action) => {
        state.processingTransaction = false;
        state.lastProcessedTransaction = action.payload;
        state.error = null;
      })
      .addCase(processFarmerSaleGrain.rejected, (state, action) => {
        state.processingTransaction = false;
        state.error = action.payload;
      });

    // Fetch Transactions
    builder
      .addCase(fetchTransactions.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchTransactions.fulfilled, (state, action) => {
        state.loading = false;
        state.transactions = action.payload;
        state.error = null;
      })
      .addCase(fetchTransactions.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      });

    // Fetch Transaction By ID
    builder
      .addCase(fetchTransactionById.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchTransactionById.fulfilled, (state, action) => {
        state.loading = false;
        state.currentTransaction = action.payload;
        state.error = null;
      })
      .addCase(fetchTransactionById.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      });

    // Fetch Daily Summary
    builder
      .addCase(fetchDailySummary.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchDailySummary.fulfilled, (state, action) => {
        state.loading = false;
        state.dailySummary = action.payload;
        state.error = null;
      })
      .addCase(fetchDailySummary.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      });

    // Fetch Daily Summaries
    builder
      .addCase(fetchDailySummaries.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchDailySummaries.fulfilled, (state, action) => {
        state.loading = false;
        state.dailySummaries = action.payload;
        state.error = null;
      })
      .addCase(fetchDailySummaries.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      });

    // Fetch Statistics
    builder
      .addCase(fetchTransactionStatistics.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchTransactionStatistics.fulfilled, (state, action) => {
        state.loading = false;
        state.statistics = action.payload;
        state.error = null;
      })
      .addCase(fetchTransactionStatistics.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      });

    // Validate Transaction
    builder
      .addCase(validateTransaction.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(validateTransaction.fulfilled, (state, action) => {
        state.loading = false;
        state.validationResult = action.payload;
        state.error = null;
      })
      .addCase(validateTransaction.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      });
  },
});

export const { clearError, clearValidation, clearLastProcessed, setCurrentTransaction } = transactionSlice.actions;

export default transactionSlice.reducer;
