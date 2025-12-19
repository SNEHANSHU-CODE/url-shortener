/**
 * Application Configuration
 * All environment variables and config settings centralized here
 */

require('dotenv').config();

const config = {
  // Server
  port: process.env.PORT || 5000,
  nodeEnv: process.env.NODE_ENV || 'development',
  
  // Database
  mongoUri: process.env.MONGODB_URI,
  
  // JWT
  jwt: {
    accessSecret: process.env.JWT_ACCESS_SECRET || 'access-secret-dev',
    refreshSecret: process.env.JWT_REFRESH_SECRET || 'refresh-secret-dev',
    accessExpiry: '15m',
    refreshExpiry: '7d',
  },
  
  // Google OAuth
  google: {
    clientId: process.env.GOOGLE_CLIENT_ID,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET,
  },
  
  // URLs
  clientUrl: process.env.CLIENT_URL || 'http://localhost:3000',
  serverUrl: process.env.SERVER_URL || 'http://localhost:5000',
  
  // CORS
  corsOrigins: [
    'http://localhost:3000',
    'https://url-shortener-0f3m.onrender.com',
  ],
  
  // Rate Limiting
  rateLimit: {
    auth: { windowMs: 15 * 60 * 1000, max: 10 }, // 10 requests per 15 min
    url: { windowMs: 60 * 1000, max: 30 },       // 30 requests per min
    guest: { windowMs: 60 * 1000, max: 10 },     // 10 requests per min for guests
  },
  
  // URL Shortener
  shortCode: {
    length: 6,
    maxRetries: 5,
  },
  
  // Cache
  cache: {
    maxSize: 1000,
    ttl: 60 * 60 * 1000, // 1 hour
  },

  // SMTP (Email)
  smtp: {
    host: process.env.SMTP_HOST || 'smtp.gmail.com',
    port: parseInt(process.env.SMTP_PORT || '587'),
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
    from: process.env.SMTP_FROM,
  },
};

// Validate required config
const requiredEnvVars = ['MONGODB_URI'];
const missing = requiredEnvVars.filter(key => !process.env[key]);

if (missing.length > 0 && config.nodeEnv === 'production') {
  console.error(`Missing required environment variables: ${missing.join(', ')}`);
  process.exit(1);
}

module.exports = config;
