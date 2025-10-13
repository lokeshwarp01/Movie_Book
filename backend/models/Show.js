// backend/models/Show.js
const mongoose = require('mongoose');

const showSchema = new mongoose.Schema({
  movieId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Movie',
    required: true
  },
  theaterId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Theater',
    required: true
  },
  screenId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Screen',
    required: true
  },
  startTime: {
    type: Date,
    required: true
  },
  endTime: {
    type: Date,
    required: true
  },
  price: {
    regular: {
      type: Number,
      required: true,
      min: 0
    },
    premium: {
      type: Number,
      required: true,
      min: 0
    },
    vip: {
      type: Number,
      required: true,
      min: 0
    }
  },
  totalSeats: {
    type: Number,
    required: true
  },
  availableSeats: {
    type: Number,
    required: true
  },
  isActive: {
    type: Boolean,
    default: true
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
});

// Compound index to ensure unique shows at same time in same screen
showSchema.index({ screenId: 1, startTime: 1 }, { unique: true });

// Index for efficient querying
showSchema.index({ theaterId: 1, startTime: 1 });
showSchema.index({ movieId: 1, startTime: 1 });

// Update the updatedAt field before saving
showSchema.pre('save', function (next) {
  this.updatedAt = Date.now();
  next();
});

// Virtual to check if show is in the future
showSchema.virtual('isUpcoming').get(function () {
  return this.startTime > new Date();
});

// Virtual to check if show is currently running
showSchema.virtual('isRunning').get(function () {
  const now = new Date();
  return this.startTime <= now && this.endTime >= now;
});

// Method to calculate end time based on movie duration
showSchema.methods.calculateEndTime = function (movieDuration) {
  const startTime = new Date(this.startTime);
  const endTime = new Date(startTime.getTime() + movieDuration * 60000); // Convert minutes to milliseconds
  this.endTime = endTime;
  return endTime;
};

// Method to get seat availability
showSchema.methods.getSeatAvailability = function () {
  return {
    total: this.totalSeats,
    available: this.availableSeats,
    booked: this.totalSeats - this.availableSeats
  };
};

// Static method to find shows by date range
showSchema.statics.findByDateRange = function (startDate, endDate) {
  return this.find({
    startTime: {
      $gte: startDate,
      $lte: endDate
    }
  }).populate('movieId theaterId screenId');
};

module.exports = mongoose.model('Show', showSchema);
