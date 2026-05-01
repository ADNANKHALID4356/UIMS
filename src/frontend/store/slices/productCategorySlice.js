/**
 * productCategorySlice - Sprint 4 Redux State Management
 * Manages product category state for the application
 */

import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';

// Async thunks for product category operations
export const fetchAllCategories = createAsyncThunk(
  'productCategory/fetchAll',
  async (filters = {}, { rejectWithValue }) => {
    try {
      console.log('[productCategorySlice] Fetching categories with filters:', filters);
      const categories = await window.electronAPI.productCategory.getAll(filters);
      console.log('[productCategorySlice] Fetched categories:', categories.length, 'items');
      return categories;
    } catch (error) {
      console.error('[productCategorySlice] Fetch error:', error);
      return rejectWithValue(error.message);
    }
  }
);

export const createCategory = createAsyncThunk(
  'productCategory/create',
  async ({ categoryData, userId }, { rejectWithValue }) => {
    try {
      console.log('[productCategorySlice] Creating category:', categoryData);
      const result = await window.electronAPI.productCategory.create(categoryData, userId);
      console.log('[productCategorySlice] Create result from IPC:', result);
      if (!result.success) {
        return rejectWithValue(result.message);
      }
      return result;
    } catch (error) {
      console.error('[productCategorySlice] Create error:', error);
      return rejectWithValue(error.message);
    }
  }
);

export const updateCategory = createAsyncThunk(
  'productCategory/update',
  async ({ categoryId, updateData, userId }, { rejectWithValue }) => {
    try {
      const result = await window.electronAPI.productCategory.update(categoryId, updateData, userId);
      if (!result.success) {
        return rejectWithValue(result.message);
      }
      return { categoryId, updateData };
    } catch (error) {
      return rejectWithValue(error.message);
    }
  }
);

export const deleteCategory = createAsyncThunk(
  'productCategory/delete',
  async ({ categoryId, userId, targetCategoryId = null }, { rejectWithValue }) => {
    try {
      console.log('[productCategorySlice] Deleting category:', categoryId, 'target:', targetCategoryId);
      const result = await window.electronAPI.productCategory.delete(categoryId, userId, targetCategoryId);
      console.log('[productCategorySlice] Delete result from IPC:', result);
      if (!result.success) {
        // Return full result for hasProducts scenario
        if (result.hasProducts) {
          return rejectWithValue(result);
        }
        return rejectWithValue(result.message);
      }
      return { categoryId, result };
    } catch (error) {
      console.error('[productCategorySlice] Delete error:', error);
      return rejectWithValue(error.message);
    }
  }
);

export const searchCategories = createAsyncThunk(
  'productCategory/search',
  async (searchTerm, { rejectWithValue }) => {
    try {
      const categories = await window.electronAPI.productCategory.search(searchTerm);
      return categories;
    } catch (error) {
      return rejectWithValue(error.message);
    }
  }
);

export const fetchCategoryStatistics = createAsyncThunk(
  'productCategory/fetchStatistics',
  async (_, { rejectWithValue }) => {
    try {
      const statistics = await window.electronAPI.productCategory.getStatistics();
      return statistics;
    } catch (error) {
      return rejectWithValue(error.message);
    }
  }
);

const productCategorySlice = createSlice({
  name: 'productCategory',
  initialState: {
    categories: [],
    statistics: {
      total_categories: 0,
      active_categories: 0,
      total_products: 0,
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
    // Fetch all categories
    builder.addCase(fetchAllCategories.pending, (state) => {
      state.loading = true;
      state.error = null;
    });
    builder.addCase(fetchAllCategories.fulfilled, (state, action) => {
      state.loading = false;
      state.categories = action.payload;
    });
    builder.addCase(fetchAllCategories.rejected, (state, action) => {
      state.loading = false;
      state.error = action.payload;
    });

    // Create category
    builder.addCase(createCategory.pending, (state) => {
      state.loading = true;
      state.error = null;
      state.operationSuccess = null;
    });
    builder.addCase(createCategory.fulfilled, (state, action) => {
      state.loading = false;
      state.operationSuccess = 'Category created successfully';
      // Note: We don't add to state here because we refetch all categories
      // to get the complete data with product_count and other joined fields
    });
    builder.addCase(createCategory.rejected, (state, action) => {
      state.loading = false;
      state.error = action.payload;
    });

    // Update category
    builder.addCase(updateCategory.pending, (state) => {
      state.loading = true;
      state.error = null;
      state.operationSuccess = null;
    });
    builder.addCase(updateCategory.fulfilled, (state, action) => {
      state.loading = false;
      state.operationSuccess = 'Category updated successfully';
      const index = state.categories.findIndex(c => c.category_id === action.payload.categoryId);
      if (index !== -1) {
        state.categories[index] = { ...state.categories[index], ...action.payload.updateData };
      }
    });
    builder.addCase(updateCategory.rejected, (state, action) => {
      state.loading = false;
      state.error = action.payload;
    });

    // Delete category
    builder.addCase(deleteCategory.pending, (state) => {
      state.loading = true;
      state.error = null;
      state.operationSuccess = null;
    });
    builder.addCase(deleteCategory.fulfilled, (state, action) => {
      state.loading = false;
      state.operationSuccess = 'Category deleted successfully';
      // Note: Soft delete sets is_active = 0, so we refetch to get updated data
      // rather than removing from the array
    });
    builder.addCase(deleteCategory.rejected, (state, action) => {
      state.loading = false;
      state.error = action.payload;
    });

    // Search categories
    builder.addCase(searchCategories.pending, (state) => {
      state.loading = true;
      state.error = null;
    });
    builder.addCase(searchCategories.fulfilled, (state, action) => {
      state.loading = false;
      state.categories = action.payload;
    });
    builder.addCase(searchCategories.rejected, (state, action) => {
      state.loading = false;
      state.error = action.payload;
    });

    // Fetch statistics
    builder.addCase(fetchCategoryStatistics.fulfilled, (state, action) => {
      state.statistics = action.payload;
    });
  },
});

export const { clearError, clearOperationSuccess } = productCategorySlice.actions;
export default productCategorySlice.reducer;
