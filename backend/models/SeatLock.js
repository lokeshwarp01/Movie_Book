// backend/models/SeatLock.js
const mongoose = require('mongoose');

const seatLockSchema = new mongoose.Schema({
  showId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Show',
    required: true
  },
  seatId: {
    type: String,
    required: true
  },
  lockedByUserId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  lockedByBookingId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Booking'
  },
  expiresAt: {
    type: Date,
    required: true
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

// Compound index to ensure unique seat locks per show
seatLockSchema.index({ showId: 1, seatId: 1 }, { unique: true });

// Index for efficient cleanup queries
seatLockSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

// Method to check if lock is expired
seatLockSchema.methods.isExpired = function () {
  return this.expiresAt < new Date();
};

// Static method to clean up expired locks
seatLockSchema.statics.cleanupExpired = function () {
  return this.deleteMany({
    expiresAt: { $lt: new Date() }
  });
};

// Static method to find locks by show
seatLockSchema.statics.findByShow = function (showId) {
  return this.find({ showId }).populate('lockedByUserId');
};

// Static method to find locks by user
seatLockSchema.statics.findByUser = function (userId) {
  return this.find({ lockedByUserId: userId }).populate('showId');
};

module.exports = mongoose.model('SeatLock', seatLockSchema);
