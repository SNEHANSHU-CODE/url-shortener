/**
 * Hotload Utility
 * Loads all URLs from MongoDB into Redis cache on server startup
 * Runs only once on each server deployment
 */

const { Url } = require('../models');
const urlCache = require('./cache');

/**
 * Load all URLs from MongoDB into Redis cache
 * Only loads active, non-expired URLs
 */
const hotloadUrlsToCache = async () => {
  try {
    console.log('🔄 Starting hotload of URLs to cache...');

    // Fetch all active URLs from MongoDB
    const urls = await Url.find(
      {
        isActive: true,
        $or: [
          { expiresAt: null }, // No expiration
          { expiresAt: { $gt: new Date() } }, // Not expired
        ],
      },
      'shortCode originalUrl expiresAt', // Only load necessary fields
    ).lean();

    console.log(`📦 Found ${urls.length} active URLs to cache`);

    let cachedCount = 0;
    let failedCount = 0;

    // Load each URL into Redis cache
    for (const url of urls) {
      try {
        const urlData = {
          originalUrl: url.originalUrl,
          shortCode: url.shortCode,
          id: url._id,
          expiresAt: url.expiresAt || null,
        };

        await urlCache.set(url.shortCode, urlData);
        cachedCount++;

        // Log progress every 100 URLs
        if (cachedCount % 100 === 0) {
          console.log(`  ✅ Cached ${cachedCount} URLs...`);
        }
      } catch (error) {
        console.error(`  ❌ Failed to cache URL ${url.shortCode}:`, error.message);
        failedCount++;
      }
    }

    console.log(`
✅ Hotload completed:
   - Successfully cached: ${cachedCount} URLs
   - Failed to cache: ${failedCount} URLs
   - Total URLs loaded into Redis
`);

    return {
      total: urls.length,
      cached: cachedCount,
      failed: failedCount,
    };
  } catch (error) {
    console.error('❌ Hotload failed:', error.message);
    throw error;
  }
};

module.exports = {
  hotloadUrlsToCache,
};
