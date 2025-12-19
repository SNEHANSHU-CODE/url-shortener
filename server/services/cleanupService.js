/**
 * URL Cleanup Service
 * Cleans up expired guest URLs (older than 7 days)
 */

const Url = require('../models/Url');
const Guest = require('../models/Guest');

// 7 days in milliseconds
const GUEST_URL_EXPIRY_DAYS = 7;
const CLEANUP_INTERVAL_MS = 60 * 60 * 1000; // 1 hour

let cleanupInterval = null;

/**
 * Delete URLs that have expired (have expiresAt in the past)
 */
const cleanupExpiredUrls = async () => {
  try {
    const result = await Url.deleteMany({
      expiresAt: { $lt: new Date() },
    });
    
    if (result.deletedCount > 0) {
      console.log(`🧹 Cleaned up ${result.deletedCount} expired URLs`);
    }
    
    return result.deletedCount;
  } catch (error) {
    console.error('Error cleaning up expired URLs:', error);
    return 0;
  }
};

/**
 * Set expiration date for guest URLs that don't have one
 * This handles URLs created before the expiration feature was added
 */
const setExpirationForGuestUrls = async () => {
  try {
    const expirationDate = new Date();
    expirationDate.setDate(expirationDate.getDate() + GUEST_URL_EXPIRY_DAYS);
    
    const result = await Url.updateMany(
      {
        guestId: { $ne: null },
        userId: null,
        expiresAt: null,
      },
      {
        $set: { expiresAt: expirationDate },
      }
    );
    
    if (result.modifiedCount > 0) {
      console.log(`📅 Set expiration for ${result.modifiedCount} guest URLs`);
    }
    
    return result.modifiedCount;
  } catch (error) {
    console.error('Error setting expiration for guest URLs:', error);
    return 0;
  }
};

/**
 * Clean up old guest sessions (older than 7 days with no activity)
 */
const cleanupOldGuests = async () => {
  try {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - GUEST_URL_EXPIRY_DAYS);
    
    const result = await Guest.deleteMany({
      lastActivity: { $lt: cutoffDate },
    });
    
    if (result.deletedCount > 0) {
      console.log(`🧹 Cleaned up ${result.deletedCount} old guest sessions`);
    }
    
    return result.deletedCount;
  } catch (error) {
    console.error('Error cleaning up old guests:', error);
    return 0;
  }
};

/**
 * Run all cleanup tasks
 */
const runCleanup = async () => {
  console.log('🔄 Running scheduled cleanup...');
  
  // First, set expiration for any guest URLs that don't have one
  await setExpirationForGuestUrls();
  
  // Then clean up expired URLs
  const expiredUrls = await cleanupExpiredUrls();
  
  // Clean up old guest sessions
  const oldGuests = await cleanupOldGuests();
  
  console.log(`✅ Cleanup complete. Removed ${expiredUrls} URLs, ${oldGuests} guests`);
};

/**
 * Start the cleanup scheduler
 */
const startCleanupScheduler = () => {
  if (cleanupInterval) {
    console.log('Cleanup scheduler already running');
    return;
  }
  
  console.log('🕐 Starting URL cleanup scheduler (runs every hour)');
  
  // Run cleanup immediately on startup
  runCleanup();
  
  // Then run every hour
  cleanupInterval = setInterval(runCleanup, CLEANUP_INTERVAL_MS);
};

/**
 * Stop the cleanup scheduler
 */
const stopCleanupScheduler = () => {
  if (cleanupInterval) {
    clearInterval(cleanupInterval);
    cleanupInterval = null;
    console.log('Cleanup scheduler stopped');
  }
};

/**
 * Get expiration date for a new guest URL
 */
const getGuestUrlExpirationDate = () => {
  const expirationDate = new Date();
  expirationDate.setDate(expirationDate.getDate() + GUEST_URL_EXPIRY_DAYS);
  return expirationDate;
};

module.exports = {
  cleanupExpiredUrls,
  setExpirationForGuestUrls,
  cleanupOldGuests,
  runCleanup,
  startCleanupScheduler,
  stopCleanupScheduler,
  getGuestUrlExpirationDate,
  GUEST_URL_EXPIRY_DAYS,
};
