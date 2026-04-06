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
    // Normalize and validate URL
    const trimmedUrl = String(originalUrl).trim();
    if (!this.isValidUrl(trimmedUrl)) {
      throw errors.badRequest('Invalid URL format');
    }
    if (trimmedUrl.length > 2048) {
      throw errors.badRequest('URL exceeds maximum length of 2048 characters');
    }
    // Validate URL protocol and domain safety
    const urlObj = new URL(trimmedUrl);
    const allowedProtocols = ['http:', 'https:'];
    if (!allowedProtocols.includes(urlObj.protocol)) {
      throw errors.badRequest('Only HTTP and HTTPS protocols are allowed');
    }
    
    let shortCode;
    
    if (customSlug) {
      // Sanitize and validate custom slug
      const sanitizedSlug = String(customSlug).trim();
      if (!isValidSlug(sanitizedSlug)) {
        throw errors.badRequest('Invalid slug format. Use 3-50 alphanumeric characters, hyphens, or underscores');
      }
      
      shortCode = sanitizedSlug;
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
      originalUrl: trimmedUrl,
      shortCode,
      customSlug: customSlug || null,
      userId: userId || null,
      guestId: guestId || null,
      expiresAt: urlExpiration,
    });
    
    try {
      await url.save();
    } catch (error) {
      // Handle duplicate shortCode (E11000 error)
      if (error.code === 11000 && error.keyPattern?.shortCode) {
        throw errors.conflict('This custom slug is already taken');
      }
      throw error;
    }
    
    return this.formatUrlResponse(url);
  }
  
  /**
   * Get URL by short code (with caching)
   * Checks cache first (Upstash Redis) then falls back to database
   */
  async getByShortCode(shortCode) {
    // Try cache first
    let urlData = await urlCache.get(shortCode);
    
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
        expiresAt: url.expiresAt || null,
      };
      
      // Cache for future requests (async, don't wait)
      urlCache.set(shortCode, urlData).catch(err => {
        console.error(`Failed to cache URL ${shortCode}:`, err.message);
      });
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
   * Get user's URLs with optional search
   * Search by shortCode or originalUrl
   */
  async getUserUrls(userId, { page = 1, limit = 10, search = '' } = {}) {
    const skip = (page - 1) * limit;
    
    // Build search query
    const query = { userId };
    if (search && search.trim()) {
      const searchTerm = search.trim();
      query.$or = [
        { shortCode: { $regex: searchTerm, $options: 'i' } },
        { originalUrl: { $regex: searchTerm, $options: 'i' } },
        { customSlug: { $regex: searchTerm, $options: 'i' } },
      ];
    }
    
    const [urls, total] = await Promise.all([
      Url.find(query)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      Url.countDocuments(query),
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
   * Get guest's URLs with optional search
   */
  async getGuestUrls(guestId, { page = 1, limit = 10, search = '' } = {}) {
    const skip = (page - 1) * limit;
    
    // Build search query
    const query = { guestId };
    if (search && search.trim()) {
      const searchTerm = search.trim();
      query.$or = [
        { shortCode: { $regex: searchTerm, $options: 'i' } },
        { originalUrl: { $regex: searchTerm, $options: 'i' } },
        { customSlug: { $regex: searchTerm, $options: 'i' } },
      ];
    }
    
    const [urls, total] = await Promise.all([
      Url.find(query)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      Url.countDocuments(query),
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
   * Updates Redis cache immediately after database update
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
    
    // Update cache with new data (async, don't wait)
    const cacheData = {
      originalUrl: url.originalUrl,
      shortCode: url.shortCode,
      id: url._id,
      expiresAt: url.expiresAt || null,
    };
    urlCache.set(url.shortCode, cacheData).catch(err => {
      console.error(`Failed to update cache for ${url.shortCode}:`, err.message);
    });
    
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
    
    // Invalidate cache (async, don't wait)
    urlCache.invalidate(url.shortCode).catch(err => {
      console.error(`Failed to invalidate cache for ${url.shortCode}:`, err.message);
    });
    
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
    
    // Invalidate cache (async, don't wait)
    urlCache.invalidate(url.shortCode).catch(err => {
      console.error(`Failed to invalidate cache for ${url.shortCode}:`, err.message);
    });
    
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
