/**
 * Guest Service
 * Handles guest user management and migration
 * Enterprise-standard guest identification using fingerprinting
 */

const { Guest, Url } = require('../models');
const { generateGuestId } = require('../utils/shortCode');
const { errors } = require('../utils/AppError');

class GuestService {
  /**
   * Create or get existing guest
   * Uses multiple identification strategies:
   * 1. Existing guestId (from localStorage/cookie)
   * 2. Browser fingerprint matching (for returning visitors)
   * 3. Create new guest if none found
   */
  async getOrCreateGuest(guestId, ipAddress, userAgent, fingerprint = null) {
    // Strategy 1: Check if existing guestId is valid
    if (guestId) {
      const existing = await Guest.findOne({ guestId, migratedToUserId: null });
      if (existing) {
        // Update fingerprint if provided and not set
        if (fingerprint && !existing.fingerprint) {
          existing.fingerprint = fingerprint;
        }
        await existing.updateActivity();
        return existing;
      }
    }
    
    // Strategy 2: Try to find guest by fingerprint (for returning visitors who cleared localStorage)
    if (fingerprint) {
      const existingByFingerprint = await Guest.findOne({ 
        fingerprint, 
        migratedToUserId: null 
      });
      if (existingByFingerprint) {
        await existingByFingerprint.updateActivity();
        return existingByFingerprint;
      }
    }
    
    // Strategy 3: Create new guest
    const newGuestId = generateGuestId();
    const guest = new Guest({
      guestId: newGuestId,
      fingerprint: fingerprint || null,
      ipAddress,
      userAgent,
    });
    await guest.save();
    
    return guest;
  }
  
  /**
   * Validate guest ID
   */
  async validateGuest(guestId) {
    if (!guestId) return null;
    
    const guest = await Guest.findOne({ guestId, migratedToUserId: null });
    return guest;
  }
  
  /**
   * Find guest by fingerprint
   */
  async findByFingerprint(fingerprint) {
    if (!fingerprint) return null;
    
    const guest = await Guest.findOne({ fingerprint, migratedToUserId: null });
    return guest;
  }
  
  /**
   * Migrate guest URLs to authenticated user
   * This is called when a guest user logs in or registers
   */
  async migrateToUser(guestId, userId) {
    if (!guestId) return { migrated: 0 };
    
    const guest = await Guest.findOne({ guestId });
    if (!guest || guest.migratedToUserId) {
      return { migrated: 0 };
    }
    
    // Update all guest URLs to belong to user
    // Also remove expiration since user URLs don't expire
    const result = await Url.updateMany(
      { guestId, userId: null },
      { 
        $set: { userId, guestId: null, expiresAt: null }
      }
    );
    
    // Mark guest as migrated
    guest.migratedToUserId = userId;
    await guest.save();
    
    console.log(`🔄 Migrated ${result.modifiedCount} URLs from guest ${guestId} to user ${userId}`);
    
    return { migrated: result.modifiedCount };
  }
  
  /**
   * Get guest statistics
   */
  async getGuestStats(guestId) {
    const guest = await Guest.findOne({ guestId });
    if (!guest) {
      throw errors.notFound('Guest not found');
    }
    
    const urlCount = await Url.countDocuments({ guestId });
    
    return {
      guestId: guest.guestId,
      urlCount,
      createdAt: guest.createdAt,
      lastActivity: guest.lastActivity,
    };
  }
}

module.exports = new GuestService();
