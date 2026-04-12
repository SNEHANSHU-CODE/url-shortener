/**
 * URL Cache - Redis.com Integration
 * Uses Redis.com cloud hosting for distributed caching with Redis memory management
 * Provides fast URL redirects by checking cache before database
 */

const { createClient } = require('redis');

class UrlCache {
  constructor() {
    this.client = null;
    this.connected = false;
    this.isInitializing = true;
    this.initializationPromise = this.initialize();
    this.stats = {
      hits: 0,
      misses: 0,
    };
  }

  /**
   * Wait for cache initialization to complete
   */
  async waitForInitialization() {
    return this.initializationPromise;
  }

  /**
   * Initialize Redis connection using SDK client
   * Connects to redis.com using host, port, username, and password
   * Using plain redis:// (non-TLS) protocol for compatibility
   */
  async initialize() {
    try {
      // Validate redis.com configuration
      if (!process.env.REDIS_HOST || !process.env.REDIS_PORT || !process.env.REDIS_PASSWORD) {
        console.warn('⚠️  Redis cache not configured. Add REDIS_HOST, REDIS_PORT, and REDIS_PASSWORD to .env');
        this.connected = false;
        this.isInitializing = false;
        return;
      }

      // Build connection URL using plain redis:// (no TLS)
      // redis.com typically uses plain protocol even though connection is over EC2
      const password = encodeURIComponent(process.env.REDIS_PASSWORD);
      const redisUrl = `redis://default:${password}@${process.env.REDIS_HOST}:${process.env.REDIS_PORT}`;

      console.log(`Attempting Redis connection to ${process.env.REDIS_HOST}:${process.env.REDIS_PORT}...`);

      // Create Redis client using standard redis:// protocol
      this.client = createClient({
        url: redisUrl,
        socket: {
          reconnectStrategy: (retries) => {
            if (retries > 10) return new Error('Max reconnect attempts exceeded');
            const delay = Math.min(retries * 100, 1000);
            return delay;
          },
          connectTimeout: 10000, // 10 second connection timeout
          keepAlive: 30000, // Keep alive interval in ms
        },
      });

      // Handle connection events
      this.client.on('error', (err) => {
        console.error('❌ Redis connection error:', err.message);
        this.connected = false;
      });

      this.client.on('connect', () => {
        console.log('✅ Connected to Redis.com cache');
        this.connected = true;
      });

      this.client.on('ready', () => {
        console.log('✅ Redis.com cache is ready');
        this.connected = true;
      });

      this.client.on('reconnecting', () => {
        // Suppress reconnection logs to avoid spam
      });

      // Connect to Redis
      await this.client.connect();
      this.connected = true;
      console.log('✅ Redis cache successfully initialized');
    } catch (error) {
      console.error('❌ Failed to initialize Redis cache:', error.message);
      this.connected = false;
    } finally {
      this.isInitializing = false;
    }
  }

  /**
   * Get URL from cache
   * Returns null if not found, cache unavailable, or error occurs
   * On error: logs but treats as cache miss (fallback to DB)
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
      // Log error but don't crash - treat as cache miss, fallback to DB
      console.error(`⚠️  Redis get error for ${shortCode}:`, error.message);
      this.stats.misses++;
      return null;
    }
  }

  /**
   * Set URL in cache (no TTL)
   * Redis manages memory via eviction policy
   * On error: logs but doesn't fail - missing cache entry just means next request hits DB
   */
  async set(shortCode, urlData) {
    if (!this.connected || !this.client) {
      return;
    }

    try {
      // Store without TTL - Redis handles eviction based on its policy
      await this.client.set(
        `url:${shortCode}`,
        JSON.stringify(urlData)
      );
    } catch (error) {
      // Log but don't crash - missing cache entry is not critical, just slower on next request
      console.error(`⚠️  Redis set error for ${shortCode}:`, error.message);
    }
  }

  /**
   * Invalidate (delete) cache entry
   * Used when a URL expires or is deleted
   * On error: logs but doesn't fail - stale cache entry will eventually expire via Redis eviction
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
      evictionPolicy: 'Redis LRU',
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
        console.log('✅ Redis connection closed');
      } catch (error) {
        console.error('❌ Error closing Redis connection:', error.message);
      }
    }
  }
}

// Singleton instance
const urlCache = new UrlCache();

module.exports = urlCache;
