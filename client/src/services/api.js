/**
 * Axios API Client
 * Centralized HTTP client with interceptors
 */

import axios from 'axios';
import config from '../config';

const api = axios.create({
  baseURL: config.apiUrl,
  withCredentials: true,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor
api.interceptors.request.use(
  (config) => {
    // Tokens are sent automatically via cookies with withCredentials: true
    
    // Add guest ID if available
    const guestId = localStorage.getItem('guestId');
    if (guestId) {
      config.headers['X-Guest-Id'] = guestId;
    }
    
    return config;
  },
  (error) => Promise.reject(error)
);

// Response interceptor
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;
    
    // Handle 401 errors - try to refresh token
    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;
      
      try {
        // Access token will be refreshed in httpOnly cookie automatically
        await axios.post(
          `${config.apiUrl}/auth/refresh`,
          {},
          { withCredentials: true }
        );
        
        // Retry original request with refreshed token (sent automatically via cookie)
        return api(originalRequest);
      } catch (refreshError) {
        // Refresh failed - dispatch logout event
        window.dispatchEvent(new CustomEvent('auth:logout'));
        return Promise.reject(refreshError);
      }
    }
    
    return Promise.reject(error);
  }
);

export default api;
