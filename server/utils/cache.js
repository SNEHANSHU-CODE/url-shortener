/**
 * URL Cache
 * Simple in-memory cache for hot URLs with TTL-based eviction
 */

const config = require('../config');

class UrlCache {
  constructor() {
    this.cache = new Map();
    this.maxSize = config.cache.maxSize;
    this.ttl = config.cache.ttl;
    
    // Cleanup expired entries every 5 minutes
    this.cleanupInterval = setInterval(() => this.cleanup(), 5 * 60 * 1000);
  }
  
  /**
   * Get URL from cache
   */
  get(shortCode) {
    const entry = this.cache.get(shortCode);
    
    if (!entry) return null;
    
    // Check if expired
    if (Date.now() > entry.expiresAt) {
      this.cache.delete(shortCode);
      return null;
    }
    
    // Update hit count for LRU-like behavior
    entry.hits += 1;
    entry.lastAccess = Date.now();
    
    return entry.data;
  }
  
  /**
   * Set URL in cache
   */
  set(shortCode, urlData) {
    // Evict if at max capacity
    if (this.cache.size >= this.maxSize) {
      this.evictLeastUsed();
    }
    
    this.cache.set(shortCode, {
      data: urlData,
      expiresAt: Date.now() + this.ttl,
      hits: 1,
      lastAccess: Date.now(),
    });
  }
  
  /**
   * Invalidate cache entry
   */
  invalidate(shortCode) {
    this.cache.delete(shortCode);
  }
  
  /**
   * Evict least recently used entry
   */
  evictLeastUsed() {
    let oldest = null;
    let oldestKey = null;
    
    for (const [key, entry] of this.cache.entries()) {
      if (!oldest || entry.lastAccess < oldest.lastAccess) {
        oldest = entry;
        oldestKey = key;
      }
    }
    
    if (oldestKey) {
      this.cache.delete(oldestKey);
    }
  }
  
  /**
   * Cleanup expired entries
   */
  cleanup() {
    const now = Date.now();
    
    for (const [key, entry] of this.cache.entries()) {
      if (now > entry.expiresAt) {
        this.cache.delete(key);
      }
    }
  }
  
  /**
   * Get cache stats
   */
  getStats() {
    return {
      size: this.cache.size,
      maxSize: this.maxSize,
      ttl: this.ttl,
    };
  }
  
  /**
   * Clear all cache
   */
  clear() {
    this.cache.clear();
  }
  
  /**
   * Cleanup on shutdown
   */
  destroy() {
    clearInterval(this.cleanupInterval);
    this.clear();
  }
}

// Singleton instance
const urlCache = new UrlCache();

module.exports = urlCache;
