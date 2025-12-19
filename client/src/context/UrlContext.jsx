/**
 * URL Context
 * Manages URL state with React Context
 */

import React, { createContext, useContext, useReducer, useCallback } from 'react';
import { urlService, authService } from '../services';
import { storeGuestId, getBrowserFingerprint } from '../utils/guestFingerprint';

const UrlContext = createContext(null);

// Action types
const URL_ACTIONS = {
  SET_LOADING: 'SET_LOADING',
  SET_CREATING: 'SET_CREATING',
  SET_URLS: 'SET_URLS',
  ADD_URL: 'ADD_URL',
  UPDATE_URL: 'UPDATE_URL',
  DELETE_URL: 'DELETE_URL',
  SET_ERROR: 'SET_ERROR',
  CLEAR_ERROR: 'CLEAR_ERROR',
  SET_SUCCESS: 'SET_SUCCESS',
  CLEAR_SUCCESS: 'CLEAR_SUCCESS',
  CLEAR_URLS: 'CLEAR_URLS',
};

// Initial state
const initialState = {
  urls: [],
  pagination: null,
  isLoading: false,
  isCreating: false,
  error: null,
  createSuccess: false,
  lastCreatedUrl: null,
};

// Reducer
const urlReducer = (state, action) => {
  switch (action.type) {
    case URL_ACTIONS.SET_LOADING:
      return { ...state, isLoading: action.payload };
    case URL_ACTIONS.SET_CREATING:
      return { ...state, isCreating: action.payload };
    case URL_ACTIONS.SET_URLS:
      return {
        ...state,
        urls: action.payload.urls,
        pagination: action.payload.pagination || null,
        isLoading: false,
      };
    case URL_ACTIONS.ADD_URL:
      return {
        ...state,
        urls: [action.payload, ...state.urls],
        isCreating: false,
        createSuccess: true,
        lastCreatedUrl: action.payload,
      };
    case URL_ACTIONS.UPDATE_URL:
      return {
        ...state,
        urls: state.urls.map((u) =>
          u.shortCode === action.payload.shortCode ? action.payload : u
        ),
      };
    case URL_ACTIONS.DELETE_URL:
      return {
        ...state,
        urls: state.urls.filter((u) => u.shortCode !== action.payload),
      };
    case URL_ACTIONS.SET_ERROR:
      return { ...state, error: action.payload, isLoading: false, isCreating: false };
    case URL_ACTIONS.CLEAR_ERROR:
      return { ...state, error: null };
    case URL_ACTIONS.SET_SUCCESS:
      return { ...state, createSuccess: true };
    case URL_ACTIONS.CLEAR_SUCCESS:
      return { ...state, createSuccess: false, lastCreatedUrl: null };
    case URL_ACTIONS.CLEAR_URLS:
      return { ...state, urls: [], pagination: null };
    default:
      return state;
  }
};

// Provider component
export const UrlProvider = ({ children }) => {
  const [state, dispatch] = useReducer(urlReducer, initialState);

  const createUrl = useCallback(async (data) => {
    dispatch({ type: URL_ACTIONS.SET_CREATING, payload: true });
    dispatch({ type: URL_ACTIONS.CLEAR_ERROR });
    
    try {
      // Ensure guest session exists if not authenticated
      const token = localStorage.getItem('accessToken');
      let guestId = localStorage.getItem('guestId');
      
      if (!token && !guestId) {
        // Initialize guest session first with fingerprint
        const fingerprint = await getBrowserFingerprint();
        const guestResponse = await authService.initGuest(fingerprint);
        guestId = guestResponse.data.guestId;
        storeGuestId(guestId); // Use utility for proper storage
      }
      
      const response = await urlService.createUrl(data);
      dispatch({ type: URL_ACTIONS.ADD_URL, payload: response.data.url });
      return { success: true, url: response.data.url };
    } catch (error) {
      const message = error.response?.data?.error?.message || 'Failed to create URL';
      dispatch({ type: URL_ACTIONS.SET_ERROR, payload: message });
      return { success: false, error: message };
    }
  }, []);

  const fetchUserUrls = useCallback(async (params = {}) => {
    dispatch({ type: URL_ACTIONS.SET_LOADING, payload: true });
    
    try {
      const response = await urlService.getUserUrls(params);
      dispatch({
        type: URL_ACTIONS.SET_URLS,
        payload: {
          urls: response.data.urls,
          pagination: response.data.pagination,
        },
      });
    } catch (error) {
      const message = error.response?.data?.error?.message || 'Failed to fetch URLs';
      dispatch({ type: URL_ACTIONS.SET_ERROR, payload: message });
    }
  }, []);

  const fetchGuestUrls = useCallback(async () => {
    dispatch({ type: URL_ACTIONS.SET_LOADING, payload: true });
    
    try {
      const response = await urlService.getGuestUrls();
      dispatch({
        type: URL_ACTIONS.SET_URLS,
        payload: { urls: response.data.urls },
      });
    } catch (error) {
      dispatch({ type: URL_ACTIONS.SET_LOADING, payload: false });
    }
  }, []);

  const updateUrl = useCallback(async (shortCode, data) => {
    try {
      const response = await urlService.updateUrl(shortCode, data);
      dispatch({ type: URL_ACTIONS.UPDATE_URL, payload: response.data.url });
      return { success: true };
    } catch (error) {
      const message = error.response?.data?.error?.message || 'Failed to update URL';
      return { success: false, error: message };
    }
  }, []);

  const deleteUrl = useCallback(async (shortCode) => {
    try {
      // Check if authenticated or guest
      const token = localStorage.getItem('accessToken');
      if (token) {
        await urlService.deleteUrl(shortCode);
      } else {
        await urlService.deleteGuestUrl(shortCode);
      }
      dispatch({ type: URL_ACTIONS.DELETE_URL, payload: shortCode });
      return { success: true };
    } catch (error) {
      const message = error.response?.data?.error?.message || 'Failed to delete URL';
      return { success: false, error: message };
    }
  }, []);

  const clearError = useCallback(() => {
    dispatch({ type: URL_ACTIONS.CLEAR_ERROR });
  }, []);

  const clearSuccess = useCallback(() => {
    dispatch({ type: URL_ACTIONS.CLEAR_SUCCESS });
  }, []);

  const clearUrls = useCallback(() => {
    dispatch({ type: URL_ACTIONS.CLEAR_URLS });
  }, []);

  const value = {
    ...state,
    createUrl,
    fetchUserUrls,
    fetchGuestUrls,
    updateUrl,
    deleteUrl,
    clearError,
    clearSuccess,
    clearUrls,
  };

  return <UrlContext.Provider value={value}>{children}</UrlContext.Provider>;
};

// Hook
export const useUrls = () => {
  const context = useContext(UrlContext);
  if (!context) {
    throw new Error('useUrls must be used within UrlProvider');
  }
  return context;
};

export default UrlContext;
