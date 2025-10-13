const mongoose = require('mongoose');

const seatBookingSchema = new mongoose.Schema({
  row: {
    type: String,
    required: true
  },
  number: {
    type: Number,
    required: true
  },
  type: {
    type: String,
    enum: ['regular', 'premium', 'vip'],
    required: true
  },
  price: {
    type: Number,
    required: true
  }
});

const bookingSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  showId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Show',
    required: true
  },
  seats: [seatBookingSchema],
  totalAmount: {
    type: Number,
    required: true,
    min: 0
  },
  status: {
    type: String,
    enum: ['pending', 'confirmed', 'cancelled', 'refunded'],
    default: 'pending'
  },
  paymentStatus: {
    type: String,
    enum: ['pending', 'completed', 'failed', 'refunded'],
    default: 'pending'
  },
  paymentId: {
    type: String
  },
  bookingReference: {
    type: String,
    unique: true,
    required: true
  },
  qrCode: {
    type: String // Base64 encoded QR code
  },
  specialRequests: {
    type: String
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  confirmedAt: {
    type: Date
  },
  cancelledAt: {
    type: Date
  },
  expiresAt: {
    type: Date // For pending bookings that need confirmation
  }
});

// Index for efficient queries
bookingSchema.index({ userId: 1, createdAt: -1 });
bookingSchema.index({ showId: 1, status: 1 });
// Duplicate with the unique field option below; keeping the unique option only
// bookingSchema.index({ bookingReference: 1 });

// Generate unique booking reference before saving
bookingSchema.pre('save', function(next) {
  if (this.isNew && !this.bookingReference) {
    this.bookingReference = this.generateBookingReference();
  }

  if (this.isModified('status')) {
    if (this.status === 'confirmed') {
      this.confirmedAt = new Date();
    } else if (this.status === 'cancelled') {
      this.cancelledAt = new Date();
    }
  }

  next();
});

// Method to generate unique booking reference
bookingSchema.methods.generateBookingReference = function() {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substr(2, 5);
  return `BK${timestamp}${random}`.toUpperCase();
};

// Method to calculate total amount
bookingSchema.methods.calculateTotal = function() {
  this.totalAmount = this.seats.reduce((total, seat) => total + seat.price, 0);
  return this.totalAmount;
};

// Method to check if booking can be cancelled
bookingSchema.methods.canCancel = function() {
  if (this.status === 'cancelled') return false;

  const show = this.populated('showId');
  if (!show) return false;

  const now = new Date();
  const hoursUntilShow = (show.startTime - now) / (1000 * 60 * 60);

  // Can cancel if more than 2 hours until show
  return hoursUntilShow > 2;
};

// Static method to find bookings by date range
bookingSchema.statics.findByDateRange = function(startDate, endDate) {
  return this.find({
    createdAt: {
      $gte: startDate,
      $lte: endDate
    }
  }).populate('userId showId');
};

// Virtual for booking status description
bookingSchema.virtual('statusDescription').get(function() {
  const descriptions = {
    pending: 'Booking is pending confirmation',
    confirmed: 'Booking confirmed successfully',
    cancelled: 'Booking has been cancelled',
    refunded: 'Booking has been refunded'
  };
  return descriptions[this.status] || 'Unknown status';
});

module.exports = mongoose.model('Booking', bookingSchema);
