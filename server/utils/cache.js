/**
 * URL Cache - Upstash Redis Integration
 * Uses Upstash Redis for distributed caching with Upstash's eviction policy
 * Provides fast URL redirects by checking cache before database
 * No TTL set - Upstash manages memory and eviction automatically
 */

const { createClient } = require('redis');

class UrlCache {
  constructor() {
    this.client = null;
    this.connected = false;
    this.stats = {
      hits: 0,
      misses: 0,
    };
    this.initialize();
  }

  /**
   * Initialize Redis connection
   */
  async initialize() {
    try {
      if (!process.env.REDIS_URL) {
        console.warn('⚠️  REDIS_URL not configured, cache disabled. Add REDIS_URL to .env');
        this.connected = false;
        return;
      }

      this.client = createClient({
        url: process.env.REDIS_URL,
        socket: {
          reconnectStrategy: (retries) => {
            const delay = Math.min(retries * 50, 500);
            return delay;
          },
          // For Upstash, ensure we're using the secure connection
          tls: true,
          keepAlive: 30000, // Keep alive interval in ms
        },
      });

      // Handle connection events
      this.client.on('error', (err) => {
        console.error('❌ Redis connection error:', err.message);
        this.connected = false;
      });

      this.client.on('connect', () => {
        console.log('✅ Connected to Upstash Redis cache');
        this.connected = true;
      });

      this.client.on('ready', () => {
        console.log('✅ Upstash Redis cache is ready');
        this.connected = true;
      });

      // Connect to Redis
      await this.client.connect();
      this.connected = true;
    } catch (error) {
      console.error('❌ Failed to initialize Redis cache:', error.message);
      this.connected = false;
    }
  }

  /**
   * Get URL from cache
   * Returns null if not found or cache unavailable
   */
  async get(shortCode) {
    if (!this.connected || !this.client) {
      this.stats.misses++;
      return null;
    }

    try {
      const cached = await this.client.get(`url:${shortCode}`);

      if (cached) {
        this.stats.hits++;
        return JSON.parse(cached);
      }

      this.stats.misses++;
      return null;
    } catch (error) {
      console.error(`❌ Cache get error for ${shortCode}:`, error.message);
      this.stats.misses++;
      return null;
    }
  }

  /**
   * Set URL in cache (no TTL)
   * Upstash Redis manages memory via its eviction policy
   * Entries remain until Upstash removes them based on available memory
   */
  async set(shortCode, urlData) {
    if (!this.connected || !this.client) {
      return;
    }

    try {
      // Store without TTL - Upstash handles eviction based on its policy
      await this.client.set(
        `url:${shortCode}`,
        JSON.stringify(urlData)
      );
    } catch (error) {
      console.error(`❌ Cache set error for ${shortCode}:`, error.message);
    }
  }

  /**
   * Invalidate (delete) cache entry
   */
  async invalidate(shortCode) {
    if (!this.connected || !this.client) {
      return;
    }

    try {
      await this.client.del(`url:${shortCode}`);
    } catch (error) {
      console.error(`❌ Cache invalidate error for ${shortCode}:`, error.message);
    }
  }

  /**
   * Get cache statistics
   */
  getStats() {
    return {
      hits: this.stats.hits,
      misses: this.stats.misses,
      hitRate: this.stats.hits + this.stats.misses > 0 
        ? ((this.stats.hits / (this.stats.hits + this.stats.misses)) * 100).toFixed(2) + '%'
        : '0%',
      connected: this.connected,
      evictionPolicy: 'Upstash Managed',
    };
  }

  /**
   * Clear all cache (use with caution)
   */
  async clear() {
    if (!this.connected || !this.client) {
      return;
    }

    try {
      // Get all URL keys and delete them
      const keys = await this.client.keys('url:*');
      if (keys.length > 0) {
        await this.client.del(keys);
        console.log(`✅ Cleared ${keys.length} cache entries`);
      }
    } catch (error) {
      console.error('❌ Cache clear error:', error.message);
    }
  }

  /**
   * Cleanup on shutdown
   */
  async destroy() {
    if (this.client) {
      try {
        await this.client.quit();
        console.log('✅ Upstash Redis connection closed');
      } catch (error) {
        console.error('❌ Error closing Redis connection:', error.message);
      }
    }
  }
}

// Singleton instance
const urlCache = new UrlCache();

module.exports = urlCache;
