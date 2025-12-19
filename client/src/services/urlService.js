/**
 * URL Service
 * Handles URL API calls
 */

import api from './api';

export const urlService = {
  async createUrl(data) {
    const response = await api.post('/urls', data);
    return response.data;
  },

  async getUserUrls(params = {}) {
    const response = await api.get('/urls/my-urls', { params });
    return response.data;
  },

  async getGuestUrls() {
    const response = await api.get('/urls/guest-urls');
    return response.data;
  },

  async getUrlInfo(shortCode) {
    const response = await api.get(`/urls/${shortCode}/info`);
    return response.data;
  },

  async getUrlStats(shortCode) {
    const response = await api.get(`/urls/${shortCode}/stats`);
    return response.data;
  },

  async updateUrl(shortCode, data) {
    const response = await api.patch(`/urls/${shortCode}`, data);
    return response.data;
  },

  async deleteUrl(shortCode) {
    const response = await api.delete(`/urls/${shortCode}`);
    return response.data;
  },

  async deleteGuestUrl(shortCode) {
    const response = await api.delete(`/urls/guest/${shortCode}`);
    return response.data;
  },
};

export default urlService;
