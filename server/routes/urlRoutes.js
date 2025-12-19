/**
 * URL Routes
 */

const express = require('express');
const router = express.Router();
const urlController = require('../controllers/urlController');
const { requireAuth, optionalAuth, urlLimiter, guestLimiter } = require('../middleware');

/**
 * Middleware to select appropriate rate limiter
 */
const dynamicRateLimiter = (req, res, next) => {
  if (req.user) {
    return urlLimiter(req, res, next);
  }
  return guestLimiter(req, res, next);
};

// Create short URL (authenticated users get higher limits)
router.post(
  '/',
  optionalAuth,
  dynamicRateLimiter,
  urlController.createUrl
);

// Get user's URLs (authenticated only)
router.get('/my-urls', requireAuth, urlController.getUserUrls);

// Get guest's URLs
router.get('/guest-urls', urlController.getGuestUrls);

// Get URL info by short code
router.get('/:shortCode/info', urlController.getUrlInfo);

// Get URL statistics (authenticated only)
router.get('/:shortCode/stats', requireAuth, urlController.getUrlStats);

// Update URL (authenticated only)
router.patch('/:shortCode', requireAuth, urlController.updateUrl);

// Delete URL (authenticated only)
router.delete('/:shortCode', requireAuth, urlController.deleteUrl);

// Delete guest URL
router.delete('/guest/:shortCode', urlController.deleteGuestUrl);

module.exports = router;
