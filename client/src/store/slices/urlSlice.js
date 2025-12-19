/**
 * URL Slice
 * Redux state for URLs
 */

import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import { urlService } from '../../services';

// Async thunks
export const createUrl = createAsyncThunk(
  'urls/create',
  async (data, { rejectWithValue }) => {
    try {
      const response = await urlService.createUrl(data);
      return response.data.url;
    } catch (error) {
      return rejectWithValue(error.response?.data?.error?.message || 'Failed to create URL');
    }
  }
);

export const fetchUserUrls = createAsyncThunk(
  'urls/fetchUserUrls',
  async (params, { rejectWithValue }) => {
    try {
      const response = await urlService.getUserUrls(params);
      return response.data;
    } catch (error) {
      return rejectWithValue(error.response?.data?.error?.message || 'Failed to fetch URLs');
    }
  }
);

export const fetchGuestUrls = createAsyncThunk(
  'urls/fetchGuestUrls',
  async (_, { rejectWithValue }) => {
    try {
      const response = await urlService.getGuestUrls();
      return response.data.urls;
    } catch (error) {
      return rejectWithValue(error.response?.data?.error?.message || 'Failed to fetch URLs');
    }
  }
);

export const updateUrl = createAsyncThunk(
  'urls/update',
  async ({ shortCode, data }, { rejectWithValue }) => {
    try {
      const response = await urlService.updateUrl(shortCode, data);
      return response.data.url;
    } catch (error) {
      return rejectWithValue(error.response?.data?.error?.message || 'Failed to update URL');
    }
  }
);

export const deleteUrl = createAsyncThunk(
  'urls/delete',
  async (shortCode, { rejectWithValue }) => {
    try {
      await urlService.deleteUrl(shortCode);
      return shortCode;
    } catch (error) {
      return rejectWithValue(error.response?.data?.error?.message || 'Failed to delete URL');
    }
  }
);

export const fetchUrlStats = createAsyncThunk(
  'urls/fetchStats',
  async (shortCode, { rejectWithValue }) => {
    try {
      const response = await urlService.getUrlStats(shortCode);
      return { shortCode, stats: response.data.stats };
    } catch (error) {
      return rejectWithValue(error.response?.data?.error?.message || 'Failed to fetch stats');
    }
  }
);

const initialState = {
  urls: [],
  pagination: null,
  selectedUrl: null,
  urlStats: {},
  isLoading: false,
  isCreating: false,
  error: null,
  createSuccess: false,
};

const urlSlice = createSlice({
  name: 'urls',
  initialState,
  reducers: {
    clearError: (state) => {
      state.error = null;
    },
    clearCreateSuccess: (state) => {
      state.createSuccess = false;
    },
    selectUrl: (state, action) => {
      state.selectedUrl = action.payload;
    },
    clearUrls: (state) => {
      state.urls = [];
      state.pagination = null;
    },
  },
  extraReducers: (builder) => {
    builder
      // Create URL
      .addCase(createUrl.pending, (state) => {
        state.isCreating = true;
        state.error = null;
        state.createSuccess = false;
      })
      .addCase(createUrl.fulfilled, (state, action) => {
        state.isCreating = false;
        state.urls.unshift(action.payload);
        state.createSuccess = true;
      })
      .addCase(createUrl.rejected, (state, action) => {
        state.isCreating = false;
        state.error = action.payload;
      })
      // Fetch User URLs
      .addCase(fetchUserUrls.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(fetchUserUrls.fulfilled, (state, action) => {
        state.isLoading = false;
        state.urls = action.payload.urls;
        state.pagination = action.payload.pagination;
      })
      .addCase(fetchUserUrls.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload;
      })
      // Fetch Guest URLs
      .addCase(fetchGuestUrls.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(fetchGuestUrls.fulfilled, (state, action) => {
        state.isLoading = false;
        state.urls = action.payload;
      })
      .addCase(fetchGuestUrls.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload;
      })
      // Update URL
      .addCase(updateUrl.fulfilled, (state, action) => {
        const index = state.urls.findIndex(u => u.shortCode === action.payload.shortCode);
        if (index !== -1) {
          state.urls[index] = action.payload;
        }
      })
      // Delete URL
      .addCase(deleteUrl.fulfilled, (state, action) => {
        state.urls = state.urls.filter(u => u.shortCode !== action.payload);
      })
      // Fetch Stats
      .addCase(fetchUrlStats.fulfilled, (state, action) => {
        state.urlStats[action.payload.shortCode] = action.payload.stats;
      });
  },
});

export const { clearError, clearCreateSuccess, selectUrl, clearUrls } = urlSlice.actions;
export default urlSlice.reducer;
