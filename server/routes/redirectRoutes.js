/**
 * Redirect Routes
 * Handles short URL redirects
 */

const express = require('express');
const router = express.Router();
const urlController = require('../controllers/urlController');

// Redirect short URL to original
router.get('/:shortCode', urlController.redirectUrl);

module.exports = router;
