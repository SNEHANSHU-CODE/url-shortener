/**
 * URL Service
 * Handles URL shortening business logic
 */

const { Url } = require('../models');
const { generateUniqueShortCode, isValidSlug } = require('../utils/shortCode');
const { errors } = require('../utils/AppError');
const urlCache = require('../utils/cache');
const config = require('../config');
const { getGuestUrlExpirationDate } = require('./cleanupService');

class UrlService {
  /**
   * Create a shortened URL
   * @param {Object} params
   * @param {string} params.originalUrl - The URL to shorten
   * @param {string} params.customSlug - Optional custom slug
   * @param {string} params.userId - User ID (for authenticated users)
   * @param {string} params.guestId - Guest ID (for guests)
   * @param {Date} params.expiresAt - Optional expiration date (for authenticated users)
   */
  async createUrl({ originalUrl, customSlug, userId, guestId, expiresAt }) {
    // Validate URL format
    if (!this.isValidUrl(originalUrl)) {
      throw errors.badRequest('Invalid URL format');
    }
    
    let shortCode;
    
    if (customSlug) {
      // Validate custom slug
      if (!isValidSlug(customSlug)) {
        throw errors.badRequest('Invalid slug format. Use 3-50 alphanumeric characters, hyphens, or underscores');
      }
      
      // Check if slug is taken
      const existing = await Url.findOne({ shortCode: customSlug });
      if (existing) {
        throw errors.conflict('This custom slug is already taken');
      }
      
      shortCode = customSlug;
    } else {
      // Generate unique short code
      shortCode = await generateUniqueShortCode(async (code) => {
        return await Url.exists({ shortCode: code });
      });
    }
    
    // Determine expiration:
    // - Guest URLs: always 7 days
    // - User URLs: use provided expiresAt or null (no expiration)
    let urlExpiration = null;
    if (guestId && !userId) {
      urlExpiration = getGuestUrlExpirationDate();
    } else if (userId && expiresAt) {
      urlExpiration = new Date(expiresAt);
    }
    
    const url = new Url({
      originalUrl,
      shortCode,
      customSlug: customSlug || null,
      userId: userId || null,
      guestId: guestId || null,
      expiresAt: urlExpiration,
    });
    
    await url.save();
    
    return this.formatUrlResponse(url);
  }
  
  /**
   * Get URL by short code (with caching)
   */
  async getByShortCode(shortCode) {
    // Try cache first
    let urlData = urlCache.get(shortCode);
    
    if (!urlData) {
      // Cache miss - fetch from DB
      const url = await Url.findByShortCode(shortCode);
      
      if (!url) {
        throw errors.notFound('URL not found');
      }
      
      // Check expiration
      if (url.expiresAt && url.expiresAt < new Date()) {
        throw errors.notFound('URL has expired');
      }
      
      urlData = {
        originalUrl: url.originalUrl,
        shortCode: url.shortCode,
        id: url._id,
      };
      
      // Cache for future requests
      urlCache.set(shortCode, urlData);
    }
    
    return urlData;
  }
  
  /**
   * Record a click on a URL
   */
  async recordClick(shortCode, clickData) {
    const url = await Url.findOne({ shortCode });
    if (url) {
      await url.recordClick(clickData);
    }
  }
  
  /**
   * Get user's URLs
   */
  async getUserUrls(userId, { page = 1, limit = 10 } = {}) {
    const skip = (page - 1) * limit;
    
    const [urls, total] = await Promise.all([
      Url.find({ userId })
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      Url.countDocuments({ userId }),
    ]);
    
    return {
      urls: urls.map(url => this.formatUrlResponse(url)),
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    };
  }
  
  /**
   * Get guest's URLs
   */
  async getGuestUrls(guestId, { page = 1, limit = 10 } = {}) {
    const skip = (page - 1) * limit;
    
    const [urls, total] = await Promise.all([
      Url.find({ guestId })
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      Url.countDocuments({ guestId }),
    ]);
    
    return {
      urls: urls.map(url => this.formatUrlResponse(url)),
      pagination: { page, limit, total, pages: Math.ceil(total / limit) },
    };
  }
  
  /**
   * Update URL by shortCode (authenticated users only)
   * Can update: originalUrl, isActive, expiresAt
   * Cannot update: shortCode (it's permanent once generated)
   */
  async updateUrl(shortCode, userId, updates) {
    const url = await Url.findOne({ shortCode, userId });
    
    if (!url) {
      throw errors.notFound('URL not found or access denied');
    }
    
    // Only allow updating certain fields (shortCode cannot be changed)
    const allowedUpdates = ['originalUrl', 'isActive', 'expiresAt'];
    Object.keys(updates).forEach(key => {
      if (allowedUpdates.includes(key)) {
        // Handle null/empty expiresAt to remove expiration
        if (key === 'expiresAt' && !updates[key]) {
          url[key] = null;
        } else {
          url[key] = updates[key];
        }
      }
    });
    
    await url.save();
    
    // Invalidate cache
    urlCache.invalidate(url.shortCode);
    
    return this.formatUrlResponse(url);
  }
  
  /**
   * Delete URL by shortCode (authenticated users only)
   */
  async deleteUrl(shortCode, userId) {
    const url = await Url.findOneAndDelete({ shortCode, userId });
    
    if (!url) {
      throw errors.notFound('URL not found or access denied');
    }
    
    // Invalidate cache
    urlCache.invalidate(url.shortCode);
    
    return { message: 'URL deleted successfully' };
  }
  
  /**
   * Delete URL for guest
   */
  async deleteGuestUrl(shortCode, guestId) {
    const url = await Url.findOneAndDelete({ shortCode, guestId });
    
    if (!url) {
      throw errors.notFound('URL not found or access denied');
    }
    
    // Invalidate cache
    urlCache.invalidate(url.shortCode);
    
    return { message: 'URL deleted successfully' };
  }
  
  /**
   * Get URL statistics by shortCode
   */
  async getUrlStats(shortCode, userId) {
    const url = await Url.findOne({ shortCode, userId });
    
    if (!url) {
      throw errors.notFound('URL not found or access denied');
    }
    
    // Aggregate clicks by date
    const clicksByDate = {};
    url.clickHistory.forEach(click => {
      const date = click.timestamp.toISOString().split('T')[0];
      clicksByDate[date] = (clicksByDate[date] || 0) + 1;
    });
    
    return {
      ...this.formatUrlResponse(url),
      totalClicks: url.clicks,
      clicksByDate,
      recentClicks: url.clickHistory.slice(-10),
    };
  }
  
  /**
   * Format URL for API response
   */
  formatUrlResponse(url) {
    return {
      id: url._id,
      originalUrl: url.originalUrl,
      shortCode: url.shortCode,
      shortUrl: `${config.serverUrl}/${url.shortCode}`,
      clicks: url.clicks,
      isActive: url.isActive,
      createdAt: url.createdAt,
      expiresAt: url.expiresAt,
    };
  }
  
  /**
   * Validate URL format
   */
  isValidUrl(string) {
    try {
      const url = new URL(string);
      return url.protocol === 'http:' || url.protocol === 'https:';
    } catch {
      return false;
    }
  }
}

module.exports = new UrlService();
