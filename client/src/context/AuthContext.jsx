/**
 * Auth Context
 * Manages authentication state with React Context
 * Enterprise-standard guest identification with fingerprinting
 */

import React, { createContext, useContext, useReducer, useEffect, useCallback } from 'react';
import { authService } from '../services';
import { clearAuthTokens } from '../services/api';
import {
  getGuestIdentifier,
  storeGuestId,
  clearGuestId,
  getBrowserFingerprint,
} from '../utils/guestFingerprint';

const AuthContext = createContext(null);

// Action types
const AUTH_ACTIONS = {
  SET_LOADING: 'SET_LOADING',
  SET_USER: 'SET_USER',
  SET_GUEST: 'SET_GUEST',
  SET_ERROR: 'SET_ERROR',
  LOGOUT: 'LOGOUT',
  CLEAR_ERROR: 'CLEAR_ERROR',
};

// Initial state
const initialState = {
  user: null,
  guestId: null, // Will be loaded from storage in useEffect
  isAuthenticated: false,
  isLoading: true,
  error: null,
};

// Reducer
const authReducer = (state, action) => {
  switch (action.type) {
    case AUTH_ACTIONS.SET_LOADING:
      return { ...state, isLoading: action.payload };
    case AUTH_ACTIONS.SET_USER:
      return {
        ...state,
        user: action.payload,
        isAuthenticated: !!action.payload,
        isLoading: false,
        // FIX: Don't wipe guestId here; SET_USER is also called during checkAuth
        // on mount. Clearing guestId here prevents guest users from being
        // recognised before their session is confirmed. guestId is cleared
        // explicitly in login/register/googleLogin after successful auth.
        error: null,
      };
    case AUTH_ACTIONS.SET_GUEST:
      return { ...state, guestId: action.payload };
    case AUTH_ACTIONS.SET_ERROR:
      return { ...state, error: action.payload, isLoading: false };
    case AUTH_ACTIONS.LOGOUT:
      return { ...initialState, isLoading: false, guestId: state.guestId };
    case AUTH_ACTIONS.CLEAR_ERROR:
      return { ...state, error: null };
    default:
      return state;
  }
};

// Provider component
export const AuthProvider = ({ children }) => {
  const [state, dispatch] = useReducer(authReducer, initialState);

  // Check auth and restore guest ID on mount
  useEffect(() => {
    let isMounted = true;

    const checkAuth = async () => {
      // Only call /auth/me if a session was previously established.
      // Prevents a guaranteed 401 on every cold load for unauthenticated users.
      const sessionActive = localStorage.getItem('sessionActive');
      if (!sessionActive) {
        if (isMounted) {
          const storedGuestId = localStorage.getItem('guestId');
          if (storedGuestId) {
            dispatch({ type: AUTH_ACTIONS.SET_GUEST, payload: storedGuestId });
          }
          dispatch({ type: AUTH_ACTIONS.SET_LOADING, payload: false });
        }
        return;
      }

      try {
        const response = await authService.getCurrentUser();
        if (isMounted) {
          localStorage.setItem('sessionActive', 'true');
          dispatch({ type: AUTH_ACTIONS.SET_USER, payload: response.data.user });
        }
      } catch (error) {
        // Session token expired or invalid — clean up and restore guest if present
        if (isMounted) {
          localStorage.removeItem('sessionActive');
          const storedGuestId = localStorage.getItem('guestId');
          if (storedGuestId) {
            dispatch({ type: AUTH_ACTIONS.SET_GUEST, payload: storedGuestId });
          }
          dispatch({ type: AUTH_ACTIONS.SET_LOADING, payload: false });
        }
      }
    };

    checkAuth();

    // Listen for forced logout from API interceptor
    const handleForcedLogout = () => {
      if (isMounted) {
        clearGuestId();
        dispatch({ type: AUTH_ACTIONS.LOGOUT });
      }
    };

    // FIX: Listen for user-updated event fired after OTP registration completes.
    // This updates isAuthenticated in context without needing a full page reload.
    const handleUserUpdated = (e) => {
      if (isMounted && e.detail) {
        localStorage.setItem('sessionActive', 'true');
        clearGuestId();
        dispatch({ type: AUTH_ACTIONS.SET_USER, payload: e.detail });
        dispatch({ type: AUTH_ACTIONS.SET_GUEST, payload: null });
      }
    };

    window.addEventListener('auth:logout', handleForcedLogout);
    window.addEventListener('auth:user-updated', handleUserUpdated);
    return () => {
      isMounted = false;
      window.removeEventListener('auth:logout', handleForcedLogout);
      window.removeEventListener('auth:user-updated', handleUserUpdated);
    };
  }, []);

  // Auth actions
  const login = useCallback(async (credentials) => {
    dispatch({ type: AUTH_ACTIONS.SET_LOADING, payload: true });
    try {
      const response = await authService.login(credentials);

      // FIX: Mark session as active so the refresh interceptor works on subsequent 401s
      localStorage.setItem('sessionActive', 'true');

      // Clear guest data after successful login (URLs already migrated server-side)
      clearGuestId();

      if (response.success && response.data?.user) {
        dispatch({ type: AUTH_ACTIONS.SET_USER, payload: response.data.user });
        // FIX: Also clear guestId from state after login
        dispatch({ type: AUTH_ACTIONS.SET_GUEST, payload: null });
        return { success: true, migratedUrls: response.data.migratedUrls || 0 };
      } else {
        throw new Error('Invalid response format');
      }
    } catch (error) {
      clearAuthTokens();
      const message =
        error.response?.data?.error?.message || error.message || 'Login failed. Please try again.';
      dispatch({ type: AUTH_ACTIONS.SET_ERROR, payload: message });
      return { success: false, error: message };
    }
  }, []);

  const googleLogin = useCallback(async (token) => {
    dispatch({ type: AUTH_ACTIONS.SET_LOADING, payload: true });
    try {
      const response = await authService.googleLogin(token);

      if (response.success && response.data?.user) {
        // FIX: Mark session as active
        localStorage.setItem('sessionActive', 'true');

        // Clear guest data after successful Google login
        clearGuestId();
        dispatch({ type: AUTH_ACTIONS.SET_USER, payload: response.data.user });
        dispatch({ type: AUTH_ACTIONS.SET_GUEST, payload: null });
        return {
          success: true,
          isNewUser: response.data.isNewUser || false,
          migratedUrls: response.data.migratedUrls || 0,
        };
      } else {
        throw new Error('Invalid response from Google login');
      }
    } catch (error) {
      const message =
        error.response?.data?.error?.message ||
        error.message ||
        'Google login failed. Please try again.';
      dispatch({ type: AUTH_ACTIONS.SET_ERROR, payload: message });
      return { success: false, error: message };
    }
  }, []);

  const register = useCallback(async (data) => {
    dispatch({ type: AUTH_ACTIONS.SET_LOADING, payload: true });
    try {
      const response = await authService.register(data);

      // FIX: Mark session as active
      localStorage.setItem('sessionActive', 'true');

      // Clear guest data after successful registration (URLs already migrated server-side)
      clearGuestId();

      if (response.success && response.data?.user) {
        dispatch({ type: AUTH_ACTIONS.SET_USER, payload: response.data.user });
        dispatch({ type: AUTH_ACTIONS.SET_GUEST, payload: null });
        return { success: true, migratedUrls: response.data.migratedUrls || 0 };
      } else {
        throw new Error('Invalid response format');
      }
    } catch (error) {
      const message =
        error.response?.data?.error?.message ||
        error.message ||
        'Registration failed. Please try again.';
      dispatch({ type: AUTH_ACTIONS.SET_ERROR, payload: message });
      return { success: false, error: message };
    }
  }, []);

  const logout = useCallback(async () => {
    try {
      localStorage.setItem('_logoutInProgress', 'true');
      await authService.logout();
    } catch (error) {
      // Ignore logout errors
    } finally {
      clearAuthTokens(); // also removes sessionActive
      clearGuestId();
      localStorage.removeItem('_logoutInProgress');
      dispatch({ type: AUTH_ACTIONS.LOGOUT });
    }
  }, []);

  /**
   * Initialize guest session with enterprise-standard identification
   * Uses fingerprinting for returning visitor detection
   */
  const initGuest = useCallback(async () => {
    if (state.isAuthenticated) return null;

    // Check if we already have a valid guest ID
    const existingGuestId = await getGuestIdentifier();
    if (existingGuestId) {
      // Update state if not already set (handles page refresh case)
      if (state.guestId !== existingGuestId) {
        dispatch({ type: AUTH_ACTIONS.SET_GUEST, payload: existingGuestId });
      }
      return existingGuestId;
    }

    try {
      const fingerprint = await getBrowserFingerprint();
      const response = await authService.initGuest(fingerprint);
      const guestId = response.data.guestId;

      storeGuestId(guestId);
      dispatch({ type: AUTH_ACTIONS.SET_GUEST, payload: guestId });

      return guestId;
    } catch (error) {
      dispatch({ type: AUTH_ACTIONS.SET_ERROR, payload: 'Failed to initialize guest session' });
      return null;
    }
  }, [state.guestId, state.isAuthenticated]);

  const clearError = useCallback(() => {
    dispatch({ type: AUTH_ACTIONS.CLEAR_ERROR });
  }, []);

  const value = {
    ...state,
    login,
    googleLogin,
    register,
    logout,
    initGuest,
    clearError,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

// Hook
export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
};

export default AuthContext;