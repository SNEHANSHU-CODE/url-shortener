/**
 * URL Controller
 * Handles HTTP requests for URL operations
 */

const urlService = require('../services/urlService');
const { AppError } = require('../utils/AppError');

/**
 * Create short URL
 */
const createUrl = async (req, res, next) => {
  try {
    const { originalUrl, customSlug, expiresAt } = req.body;
    
    if (!originalUrl) {
      throw AppError.badRequest('Original URL is required');
    }
    
    // Determine owner (user or guest)
    const userId = req.user?._id || null;
    const guestId = !userId ? req.headers['x-guest-id'] : null;
    
    if (!userId && !guestId) {
      throw AppError.badRequest('User authentication or guest ID required');
    }
    
    const url = await urlService.createUrl({
      originalUrl,
      customSlug,
      expiresAt: userId ? expiresAt : null, // Only authenticated users can set custom expiry
      userId,
      guestId,
    });
    
    res.status(201).json({
      success: true,
      data: {
        url: formatUrlResponse(url, req),
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get URL by short code (for redirect)
 */
const redirectUrl = async (req, res, next) => {
  try {
    const { shortCode } = req.params;
    
    const url = await urlService.getByShortCode(shortCode);
    
    if (!url) {
      throw AppError.notFound('Short URL not found');
    }
    
    // Check if expired
    if (url.expiresAt && new Date() > url.expiresAt) {
      throw AppError.gone('This short URL has expired');
    }
    
    // Record the click asynchronously
    urlService.recordClick(shortCode, {
      userAgent: req.headers['user-agent'],
      referrer: req.headers.referer || req.headers.referrer,
      ip: req.ip,
    }).catch(console.error);
    
    res.redirect(301, url.originalUrl);
  } catch (error) {
    next(error);
  }
};

/**
 * Get URL info (without redirecting)
 */
const getUrlInfo = async (req, res, next) => {
  try {
    const { shortCode } = req.params;
    
    const url = await urlService.getByShortCode(shortCode);
    
    if (!url) {
      throw AppError.notFound('Short URL not found');
    }
    
    res.json({
      success: true,
      data: {
        url: formatUrlResponse(url, req),
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get user's URLs
 */
const getUserUrls = async (req, res, next) => {
  try {
    const { page = 1, limit = 10, search } = req.query;
    
    const result = await urlService.getUserUrls(req.user._id, {
      page: parseInt(page),
      limit: parseInt(limit),
      search,
    });
    
    res.json({
      success: true,
      data: {
        urls: result.urls.map(url => formatUrlResponse(url, req)),
        pagination: result.pagination,
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get guest's URLs
 */
const getGuestUrls = async (req, res, next) => {
  try {
    const guestId = req.headers['x-guest-id'];
    
    if (!guestId) {
      throw AppError.badRequest('Guest ID is required');
    }
    
    const result = await urlService.getGuestUrls(guestId);
    
    res.json({
      success: true,
      data: {
        urls: result.urls.map(url => formatUrlResponse(url, req)),
        pagination: result.pagination,
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Update URL
 * Allows editing: originalUrl, expiresAt, isActive
 * shortCode cannot be changed once generated
 */
const updateUrl = async (req, res, next) => {
  try {
    const { shortCode } = req.params;
    const { originalUrl, expiresAt, isActive } = req.body;
    
    const url = await urlService.updateUrl(shortCode, req.user._id, {
      originalUrl,
      expiresAt,
      isActive,
    });
    
    res.json({
      success: true,
      data: {
        url: formatUrlResponse(url, req),
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Delete URL
 */
const deleteUrl = async (req, res, next) => {
  try {
    const { shortCode } = req.params;
    
    await urlService.deleteUrl(shortCode, req.user._id);
    
    res.json({
      success: true,
      message: 'URL deleted successfully',
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Delete guest URL
 */
const deleteGuestUrl = async (req, res, next) => {
  try {
    const { shortCode } = req.params;
    const guestId = req.headers['x-guest-id'];
    
    if (!guestId) {
      throw AppError.badRequest('Guest ID is required');
    }
    
    await urlService.deleteGuestUrl(shortCode, guestId);
    
    res.json({
      success: true,
      message: 'URL deleted successfully',
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get URL statistics
 */
const getUrlStats = async (req, res, next) => {
  try {
    const { shortCode } = req.params;
    
    const stats = await urlService.getUrlStats(shortCode, req.user._id);
    
    res.json({
      success: true,
      data: {
        stats,
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Format URL for response
 */
const formatUrlResponse = (url, req) => {
  const baseUrl = `${req.protocol}://${req.get('host')}`;
  
  return {
    id: url._id,
    shortCode: url.shortCode,
    shortUrl: `${baseUrl}/${url.shortCode}`,
    originalUrl: url.originalUrl,
    clicks: url.clicks,
    isActive: url.isActive,
    expiresAt: url.expiresAt,
    createdAt: url.createdAt,
    updatedAt: url.updatedAt,
  };
};

module.exports = {
  createUrl,
  redirectUrl,
  getUrlInfo,
  getUserUrls,
  getGuestUrls,
  updateUrl,
  deleteUrl,
  deleteGuestUrl,
  getUrlStats,
};
