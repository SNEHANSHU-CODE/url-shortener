/**
 * URL Controller
 * Handles HTTP requests for URL operations
 */

const urlService = require('../services/urlService');
const config = require('../config');
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
    
    // Validate expiresAt if provided
    if (userId && expiresAt) {
      const expireDate = new Date(expiresAt);
      if (expireDate <= new Date()) {
        throw AppError.badRequest('Expiration date must be in the future');
      }
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
 * Redirects to original URL or to client 404 page if not found
 */
const redirectUrl = async (req, res, next) => {
  try {
    const { shortCode } = req.params;
    
    try {
      const url = await urlService.getByShortCode(shortCode);
      
      if (!url) {
        // Short URL not found - redirect to client 404 page using CLIENT_URL from env
        console.log(`❌ Not found: ${shortCode} -> Redirecting to ${config.clientUrl}/notfound`);
        return res.redirect(302, `${config.clientUrl}/notfound`);
      }
      
      // Check if expired
      if (url.expiresAt && new Date() > url.expiresAt) {
        // Short URL expired - redirect to client 404 page using CLIENT_URL from env
        console.log(`⏰ Expired: ${shortCode} -> Redirecting to ${config.clientUrl}/notfound`);
        return res.redirect(302, `${config.clientUrl}/notfound`);
      }
      
      // Log redirect source (⚡ = Redis hit, 💾 = DB fallback)
      const cacheSource = url._source || 'Unknown';
      const sourceEmoji = cacheSource === 'Redis' ? '⚡' : '💾';
      console.log(`🔗 ${shortCode} -> ${sourceEmoji} ${cacheSource} | ${url.originalUrl}`);
      
      // Record the click asynchronously
      urlService.recordClick(shortCode, {
        userAgent: req.headers['user-agent'],
        referrer: req.headers.referer || req.headers.referrer,
        ip: req.ip,
      }).catch(console.error);
      
      res.redirect(301, url.originalUrl);
    } catch (error) {
      // Any error in URL lookup - show 404 page
      if (error instanceof AppError && (error.statusCode === 404 || error.statusCode === 410)) {
        console.log(`❌ Error (${error.statusCode}): ${error.message} -> Redirecting to ${config.clientUrl}/notfound`);
        return res.redirect(302, `${config.clientUrl}/notfound`);
      }
      // Other errors - pass to error handler
      throw error;
    }
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
    
    // Parse with radix 10 and validate positive integers
    let pageNum = parseInt(page, 10);
    let limitNum = parseInt(limit, 10);
    
    // Validate and set defaults/max
    pageNum = isNaN(pageNum) || pageNum < 1 ? 1 : pageNum;
    limitNum = isNaN(limitNum) || limitNum < 1 ? 10 : limitNum > 100 ? 100 : limitNum;
    
    // Add bounds check for page number to prevent DB scans
    const maxPages = Math.ceil(10000 / limitNum);
    if (pageNum > maxPages) {
      pageNum = maxPages;
    }
    
    const result = await urlService.getUserUrls(req.user._id, {
      page: pageNum,
      limit: limitNum,
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
    const { page = 1, limit = 10, search } = req.query;
    
    if (!guestId) {
      throw AppError.badRequest('Guest ID is required');
    }
    
    // Parse with radix 10 and validate positive integers
    let pageNum = parseInt(page, 10);
    let limitNum = parseInt(limit, 10);
    
    pageNum = isNaN(pageNum) || pageNum < 1 ? 1 : pageNum;
    limitNum = isNaN(limitNum) || limitNum < 1 ? 10 : limitNum > 100 ? 100 : limitNum;
    
    // Add bounds check for page number to prevent DB scans
    const maxPages = Math.ceil(10000 / limitNum);
    if (pageNum > maxPages) {
      pageNum = maxPages;
    }
    
    const result = await urlService.getGuestUrls(guestId, { page: pageNum, limit: limitNum, search });
    
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
