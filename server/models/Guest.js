/**
 * Guest Model
 * Tracks guest users and their activity
 */

const mongoose = require('mongoose');

const guestSchema = new mongoose.Schema({
  guestId: {
    type: String,
    required: true,
    unique: true,
    index: true,
  },
  fingerprint: {
    type: String,
    default: null,
    index: true,
  },
  ipAddress: {
    type: String,
    default: 'unknown',
  },
  userAgent: {
    type: String,
    default: null,
  },
  urlCount: {
    type: Number,
    default: 0,
  },
  lastActivity: {
    type: Date,
    default: Date.now,
  },
  migratedToUserId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null,
  },
}, {
  timestamps: true,
});

// Auto-expire guests after 30 days of inactivity
guestSchema.index({ lastActivity: 1 }, { expireAfterSeconds: 30 * 24 * 60 * 60 });

// Update last activity
guestSchema.methods.updateActivity = function() {
  this.lastActivity = new Date();
  return this.save();
};

// Increment URL count
guestSchema.methods.incrementUrlCount = function() {
  this.urlCount += 1;
  this.lastActivity = new Date();
  return this.save();
};

module.exports = mongoose.model('Guest', guestSchema);
