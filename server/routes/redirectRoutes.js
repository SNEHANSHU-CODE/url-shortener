/**
 * Redirect Routes
 * Handles short URL redirects
 */

const express = require('express');
const path = require('path');
const router = express.Router();
const urlController = require('../controllers/urlController');

// Client-side routes that should not be treated as short codes
const clientRoutes = ['login', 'register', 'signup', 'dashboard', 'forgot-password', 'reset-password'];

// Middleware to check if route is a client-side route
const isClientRoute = (shortCode) => {
  return clientRoutes.includes(shortCode.toLowerCase());
};

// Serve React app for client-side routes in production
router.get('/:shortCode', (req, res, next) => {
  const { shortCode } = req.params;
  
  // If it's a client-side route, serve the React app
  if (isClientRoute(shortCode)) {
    const indexPath = path.join(__dirname, '../../client/build/index.html');
    return res.sendFile(indexPath, (err) => {
      if (err) {
        // If build doesn't exist (development), let the error propagate
        // The React dev server should handle it via proxy
        next();
      }
    });
  }
  
  // Otherwise, treat as short URL redirect
  urlController.redirectUrl(req, res, next);
});

module.exports = router;
