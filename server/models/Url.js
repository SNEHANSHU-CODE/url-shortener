/**
 * URL Model
 * Stores shortened URLs with analytics
 */

const mongoose = require('mongoose');

const clickSchema = new mongoose.Schema({
  timestamp: { type: Date, default: Date.now },
  ip: String,
  userAgent: String,
  referer: String,
}, { _id: false });

const urlSchema = new mongoose.Schema({
  originalUrl: {
    type: String,
    required: true,
    trim: true,
  },
  shortCode: {
    type: String,
    required: true,
    unique: true,
    index: true,
  },
  customSlug: {
    type: String,
    default: null,
  },
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null,
    index: true,
  },
  guestId: {
    type: String,
    default: null,
    index: true,
  },
  clicks: {
    type: Number,
    default: 0,
  },
  clickHistory: {
    type: [clickSchema],
    default: [],
  },
  isActive: {
    type: Boolean,
    default: true,
  },
  expiresAt: {
    type: Date,
    default: null,
  },
  qrCode: {
    type: String,
    default: null,
  },
}, {
  timestamps: true,
});

// Index for efficient querying
urlSchema.index({ userId: 1, createdAt: -1 });
urlSchema.index({ guestId: 1, createdAt: -1 });
urlSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

// Static method to find by short code
urlSchema.statics.findByShortCode = function(shortCode) {
  return this.findOne({ shortCode, isActive: true });
};

// Instance method to record click
urlSchema.methods.recordClick = function(clickData) {
  this.clicks += 1;
  
  // Keep only last 100 clicks for analytics
  if (this.clickHistory.length >= 100) {
    this.clickHistory.shift();
  }
  
  this.clickHistory.push({
    timestamp: new Date(),
    ip: clickData.ip,
    userAgent: clickData.userAgent,
    referer: clickData.referer,
  });
  
  return this.save();
};

module.exports = mongoose.model('Url', urlSchema);
