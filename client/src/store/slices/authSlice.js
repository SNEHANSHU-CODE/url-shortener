/**
 * Auth Slice
 * Redux state for authentication
 */

import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import { authService } from '../../services';

// Async thunks
export const register = createAsyncThunk(
  'auth/register',
  async (data, { rejectWithValue }) => {
    try {
      const response = await authService.register(data);
      localStorage.setItem('accessToken', response.data.accessToken);
      return response.data;
    } catch (error) {
      return rejectWithValue(error.response?.data?.error?.message || 'Registration failed');
    }
  }
);

export const login = createAsyncThunk(
  'auth/login',
  async (data, { rejectWithValue }) => {
    try {
      const response = await authService.login(data);
      localStorage.setItem('accessToken', response.data.accessToken);
      return response.data;
    } catch (error) {
      return rejectWithValue(error.response?.data?.error?.message || 'Login failed');
    }
  }
);

export const googleLogin = createAsyncThunk(
  'auth/googleLogin',
  async (token, { rejectWithValue }) => {
    try {
      const response = await authService.googleLogin(token);
      localStorage.setItem('accessToken', response.data.accessToken);
      return response.data;
    } catch (error) {
      return rejectWithValue(error.response?.data?.error?.message || 'Google login failed');
    }
  }
);

export const logout = createAsyncThunk(
  'auth/logout',
  async (_, { rejectWithValue }) => {
    try {
      await authService.logout();
      localStorage.removeItem('accessToken');
      return null;
    } catch (error) {
      localStorage.removeItem('accessToken');
      return rejectWithValue(error.response?.data?.error?.message || 'Logout failed');
    }
  }
);

export const checkAuth = createAsyncThunk(
  'auth/checkAuth',
  async (_, { rejectWithValue }) => {
    try {
      const token = localStorage.getItem('accessToken');
      if (!token) {
        return null;
      }
      const response = await authService.getCurrentUser();
      return response.data.user;
    } catch (error) {
      localStorage.removeItem('accessToken');
      return null;
    }
  }
);

export const initGuest = createAsyncThunk(
  'auth/initGuest',
  async (_, { rejectWithValue }) => {
    try {
      const existingId = localStorage.getItem('guestId');
      if (existingId) {
        return existingId;
      }
      const response = await authService.initGuest();
      localStorage.setItem('guestId', response.data.guestId);
      return response.data.guestId;
    } catch (error) {
      return rejectWithValue(error.response?.data?.error?.message || 'Failed to init guest');
    }
  }
);

const initialState = {
  user: null,
  guestId: localStorage.getItem('guestId') || null,
  isAuthenticated: false,
  isLoading: true,
  error: null,
};

const authSlice = createSlice({
  name: 'auth',
  initialState,
  reducers: {
    clearError: (state) => {
      state.error = null;
    },
    clearGuestId: (state) => {
      state.guestId = null;
      localStorage.removeItem('guestId');
    },
  },
  extraReducers: (builder) => {
    builder
      // Register
      .addCase(register.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(register.fulfilled, (state, action) => {
        state.isLoading = false;
        state.user = action.payload.user;
        state.isAuthenticated = true;
        state.guestId = null;
        localStorage.removeItem('guestId');
      })
      .addCase(register.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload;
      })
      // Login
      .addCase(login.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(login.fulfilled, (state, action) => {
        state.isLoading = false;
        state.user = action.payload.user;
        state.isAuthenticated = true;
        state.guestId = null;
        localStorage.removeItem('guestId');
      })
      .addCase(login.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload;
      })
      // Google Login
      .addCase(googleLogin.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(googleLogin.fulfilled, (state, action) => {
        state.isLoading = false;
        state.user = action.payload.user;
        state.isAuthenticated = true;
        state.guestId = null;
        localStorage.removeItem('guestId');
      })
      .addCase(googleLogin.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload;
      })
      // Logout
      .addCase(logout.fulfilled, (state) => {
        state.user = null;
        state.isAuthenticated = false;
        state.isLoading = false;
      })
      // Check Auth
      .addCase(checkAuth.pending, (state) => {
        state.isLoading = true;
      })
      .addCase(checkAuth.fulfilled, (state, action) => {
        state.isLoading = false;
        state.user = action.payload;
        state.isAuthenticated = !!action.payload;
      })
      .addCase(checkAuth.rejected, (state) => {
        state.isLoading = false;
        state.user = null;
        state.isAuthenticated = false;
      })
      // Init Guest
      .addCase(initGuest.fulfilled, (state, action) => {
        state.guestId = action.payload;
      });
  },
});

export const { clearError, clearGuestId } = authSlice.actions;
export default authSlice.reducer;
