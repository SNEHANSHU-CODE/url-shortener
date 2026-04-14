/**
 * Axios API Client
 * Centralized HTTP client with interceptors
 * Handles both Bearer tokens and httpOnly cookies
 */

import axios from 'axios';
import config from '../config';

// Storage key for access token
const TOKEN_STORAGE_KEY = 'accessToken';
const LOGOUT_FLAG = '_logoutInProgress'; // Prevent auto-refresh during logout

const api = axios.create({
  baseURL: config.apiUrl,
  withCredentials: true, // Include cookies in requests
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor
api.interceptors.request.use(
  (requestConfig) => {
    // Try to get access token from localStorage first
    let accessToken = localStorage.getItem(TOKEN_STORAGE_KEY);

    // Add Bearer token to Authorization header if available
    if (accessToken && !requestConfig.headers.Authorization) {
      requestConfig.headers.Authorization = `Bearer ${accessToken}`;
    }

    // Add guest ID if available (for non-authenticated guests)
    // FIX: Express lowercases all headers, so 'X-Guest-Id' becomes 'x-guest-id'
    // on the server. Use lowercase here to be explicit and consistent.
    const guestId = localStorage.getItem('guestId');
    if (guestId) {
      requestConfig.headers['x-guest-id'] = guestId;
    }

    return requestConfig;
  },
  (error) => Promise.reject(error)
);

// Response interceptor
api.interceptors.response.use(
  (response) => {
    // Store access token if returned in response
    if (response.data?.data?.accessToken) {
      localStorage.setItem(TOKEN_STORAGE_KEY, response.data.data.accessToken);
    }

    return response;
  },
  async (error) => {
    const originalRequest = error.config;

    // Check if logout is in progress - don't attempt refresh
    const isLogoutInProgress = localStorage.getItem(LOGOUT_FLAG) === 'true';
    if (isLogoutInProgress) {
      return Promise.reject(error);
    }

    // Don't try to refresh token on auth endpoints
    const isAuthEndpoint =
      originalRequest.url.includes('/auth/login') ||
      originalRequest.url.includes('/auth/register') ||
      originalRequest.url.includes('/auth/google') ||
      originalRequest.url.includes('/auth/send-otp') ||
      originalRequest.url.includes('/auth/verify-otp') ||
      originalRequest.url.includes('/auth/resend-otp') ||
      originalRequest.url.includes('/auth/logout') ||
      originalRequest.url.includes('/auth/refresh') ||
      originalRequest.url.includes('/auth/me') ||
      originalRequest.url.includes('/auth/guest');

    // FIX: Only attempt token refresh if we have reason to believe a session
    // exists (sessionActive flag). Without this guard, every page load triggers
    // a failing /auth/refresh call when the user was never logged in.
    const hasActiveSession = localStorage.getItem('sessionActive') === 'true';

    // Handle 401 errors - try to refresh token
    if (
      error.response?.status === 401 &&
      !originalRequest._retry &&
      !isAuthEndpoint &&
      hasActiveSession
    ) {
      originalRequest._retry = true;

      try {
        // Call refresh endpoint (sends and receives cookies)
        const refreshResponse = await axios.post(
          `${config.apiUrl}/auth/refresh`,
          {},
          { withCredentials: true }
        );

        // Store new token if returned
        if (refreshResponse.data?.data?.accessToken) {
          localStorage.setItem(TOKEN_STORAGE_KEY, refreshResponse.data.data.accessToken);
        }

        // Retry original request with new token
        return api(originalRequest);
      } catch (refreshError) {
        // Refresh failed - clear token and session flag, dispatch logout event
        localStorage.removeItem(TOKEN_STORAGE_KEY);
        localStorage.removeItem('sessionActive');
        window.dispatchEvent(new CustomEvent('auth:logout'));
        return Promise.reject(refreshError);
      }
    }

    return Promise.reject(error);
  }
);

/**
 * Utility to clear auth tokens
 */
export const clearAuthTokens = () => {
  localStorage.removeItem(TOKEN_STORAGE_KEY);
  localStorage.removeItem('sessionActive');
};

export default api;