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
  getBrowserFingerprint 
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
  guestId: null,  // Will be loaded from storage in useEffect
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
        guestId: null,
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
      try {
        const response = await authService.getCurrentUser();
        if (isMounted) {
          dispatch({ type: AUTH_ACTIONS.SET_USER, payload: response.data.user });
        }
      } catch (error) {
        // User not authenticated, check for guest ID in storage
        if (isMounted) {
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
        // Clear guest data and log out
        clearGuestId();
        dispatch({ type: AUTH_ACTIONS.LOGOUT });
      }
    };

    window.addEventListener('auth:logout', handleForcedLogout);
    return () => {
      isMounted = false;
      window.removeEventListener('auth:logout', handleForcedLogout);
    };
  }, []);

  // Auth actions
  const login = useCallback(async (credentials) => {
    dispatch({ type: AUTH_ACTIONS.SET_LOADING, payload: true });
    try {
      const response = await authService.login(credentials);
      // Server sets httpOnly cookie + returns token
      // API interceptor will extract and store token from response
      
      // Clear guest data after successful login (URLs already migrated server-side)
      clearGuestId();
      
      if (response.success && response.data?.user) {
        dispatch({ type: AUTH_ACTIONS.SET_USER, payload: response.data.user });
        return { success: true, migratedUrls: response.data.migratedUrls || 0 };
      } else {
        throw new Error('Invalid response format');
      }
    } catch (error) {
      clearAuthTokens(); // Clear on error
      const message = error.response?.data?.error?.message || error.message || 'Login failed. Please try again.';
      dispatch({ type: AUTH_ACTIONS.SET_ERROR, payload: message });
      return { success: false, error: message };
    }
  }, []);

  const googleLogin = useCallback(async (token) => {
    dispatch({ type: AUTH_ACTIONS.SET_LOADING, payload: true });
    try {
      const response = await authService.googleLogin(token);
      
      if (response.success && response.data?.user) {
        // Clear guest data after successful Google login
        clearGuestId();
        dispatch({ type: AUTH_ACTIONS.SET_USER, payload: response.data.user });
        return { success: true, isNewUser: response.data.isNewUser || false, migratedUrls: response.data.migratedUrls || 0 };
      } else {
        throw new Error('Invalid response from Google login');
      }
    } catch (error) {
      const message = error.response?.data?.error?.message || error.message || 'Google login failed. Please try again.';
      dispatch({ type: AUTH_ACTIONS.SET_ERROR, payload: message });
      return { success: false, error: message };
    }
  }, []);

  const register = useCallback(async (data) => {
    dispatch({ type: AUTH_ACTIONS.SET_LOADING, payload: true });
    try {
      const response = await authService.register(data);
      // Access token is set as httpOnly cookie by server
      
      // Clear guest data after successful registration (URLs already migrated server-side)
      clearGuestId();
      
      if (response.success && response.data?.user) {
        dispatch({ type: AUTH_ACTIONS.SET_USER, payload: response.data.user });
        return { success: true, migratedUrls: response.data.migratedUrls || 0 };
      } else {
        throw new Error('Invalid response format');
      }
    } catch (error) {
      const message = error.response?.data?.error?.message || error.message || 'Registration failed. Please try again.';
      dispatch({ type: AUTH_ACTIONS.SET_ERROR, payload: message });
      return { success: false, error: message };
    }
  }, []);

  const logout = useCallback(async () => {
    try {
      // Set logout flag to prevent auto-refresh during logout
      localStorage.setItem('_logoutInProgress', 'true');
      
      await authService.logout();
    } catch (error) {
      // Ignore logout errors
    } finally {
      // Clear tokens and cookies
      clearAuthTokens();
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
    if (existingGuestId && state.guestId === existingGuestId) {
      return existingGuestId;
    }

    try {
      // Get fingerprint for server-side matching
      const fingerprint = await getBrowserFingerprint();
      
      const response = await authService.initGuest(fingerprint);
      const guestId = response.data.guestId;
      
      // Store guest ID for persistence
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
