/**
 * Auth Context
 * Manages authentication state with React Context
 * Enterprise-standard guest identification with fingerprinting
 */

import React, { createContext, useContext, useReducer, useEffect, useCallback } from 'react';
import { authService } from '../services';
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
  guestId: localStorage.getItem('guestId') || null,
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

  // Check auth on mount
  useEffect(() => {
    const checkAuth = async () => {
      const token = localStorage.getItem('accessToken');
      if (!token) {
        dispatch({ type: AUTH_ACTIONS.SET_LOADING, payload: false });
        return;
      }

      try {
        const response = await authService.getCurrentUser();
        dispatch({ type: AUTH_ACTIONS.SET_USER, payload: response.data.user });
      } catch (error) {
        localStorage.removeItem('accessToken');
        dispatch({ type: AUTH_ACTIONS.SET_LOADING, payload: false });
      }
    };

    checkAuth();
  }, []);

  // Auth actions
  const login = useCallback(async (credentials) => {
    dispatch({ type: AUTH_ACTIONS.SET_LOADING, payload: true });
    try {
      const response = await authService.login(credentials);
      localStorage.setItem('accessToken', response.data.accessToken);
      
      // Clear guest data after successful login (URLs already migrated server-side)
      clearGuestId();
      
      dispatch({ type: AUTH_ACTIONS.SET_USER, payload: response.data.user });
      return { success: true, migratedUrls: response.data.migratedUrls };
    } catch (error) {
      const message = error.response?.data?.error?.message || 'Login failed';
      dispatch({ type: AUTH_ACTIONS.SET_ERROR, payload: message });
      return { success: false, error: message };
    }
  }, []);

  const register = useCallback(async (data) => {
    dispatch({ type: AUTH_ACTIONS.SET_LOADING, payload: true });
    try {
      const response = await authService.register(data);
      localStorage.setItem('accessToken', response.data.accessToken);
      
      // Clear guest data after successful registration (URLs already migrated server-side)
      clearGuestId();
      
      dispatch({ type: AUTH_ACTIONS.SET_USER, payload: response.data.user });
      return { success: true, migratedUrls: response.data.migratedUrls };
    } catch (error) {
      const message = error.response?.data?.error?.message || 'Registration failed';
      dispatch({ type: AUTH_ACTIONS.SET_ERROR, payload: message });
      return { success: false, error: message };
    }
  }, []);

  const logout = useCallback(async () => {
    try {
      await authService.logout();
    } catch (error) {
      // Ignore logout errors
    }
    localStorage.removeItem('accessToken');
    // Don't clear guestId on logout - user may want to continue as guest
    dispatch({ type: AUTH_ACTIONS.LOGOUT });
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
      const isRecovered = response.data.recovered;
      
      // Store guest ID for persistence
      storeGuestId(guestId);
      dispatch({ type: AUTH_ACTIONS.SET_GUEST, payload: guestId });
      
      if (isRecovered) {
        console.log('🔄 Recovered guest session from fingerprint');
      }
      
      return guestId;
    } catch (error) {
      console.error('Failed to init guest:', error);
      return null;
    }
  }, [state.guestId, state.isAuthenticated]);

  const clearError = useCallback(() => {
    dispatch({ type: AUTH_ACTIONS.CLEAR_ERROR });
  }, []);

  const value = {
    ...state,
    login,
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
