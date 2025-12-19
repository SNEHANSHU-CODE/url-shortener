/**
 * API Configuration
 */

const config = {
  apiUrl: process.env.REACT_APP_API_URL || '/api',
  baseUrl: process.env.REACT_APP_BASE_URL || 'http://localhost:5000',
  googleClientId: process.env.REACT_APP_GOOGLE_CLIENT_ID || '',
};

export default config;
