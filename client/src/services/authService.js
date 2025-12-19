/**
 * Authentication Service
 * Handles auth API calls
 */

import api from './api';

export const authService = {
  async register(data) {
    const response = await api.post('/auth/register', data);
    return response.data;
  },

  async login(data) {
    const response = await api.post('/auth/login', data);
    return response.data;
  },

  async googleLogin(token) {
    const response = await api.post('/auth/google', { token });
    return response.data;
  },

  async logout() {
    const response = await api.post('/auth/logout');
    return response.data;
  },

  async getCurrentUser() {
    const response = await api.get('/auth/me');
    return response.data;
  },

  async refreshToken() {
    const response = await api.post('/auth/refresh');
    return response.data;
  },

  /**
   * Initialize guest session with optional fingerprint
   * @param {string} fingerprint - Browser fingerprint for returning visitor detection
   */
  async initGuest(fingerprint = null) {
    const config = fingerprint ? {
      headers: { 'X-Guest-Fingerprint': fingerprint }
    } : {};
    const response = await api.post('/auth/guest', {}, config);
    return response.data;
  },

  async forgotPassword(email) {
    const response = await api.post('/auth/forgot-password', { email });
    return response.data;
  },

  async resetPassword(token, newPassword) {
    const response = await api.post('/auth/reset-password', { token, newPassword });
    return response.data;
  },

  /**
   * Delete user account with password
   * @param {string} password - User's password for verification
   * @param {string} confirmText - Must be "DELETE" to confirm
   */
  async deleteAccount(password, confirmText) {
    const response = await api.delete('/auth/account', { 
      data: { password, confirmText } 
    });
    return response.data;
  },

  /**
   * Delete user account with Google verification
   * @param {string} accessToken - Google access token for verification
   */
  async deleteAccountWithGoogle(accessToken) {
    const response = await api.delete('/auth/account/google', { 
      data: { accessToken } 
    });
    return response.data;
  },
};

export default authService;
