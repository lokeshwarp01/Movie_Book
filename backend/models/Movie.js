const mongoose = require('mongoose');

const movieSchema = new mongoose.Schema({
  title: {
    type: String,
    required: true,
    trim: true
  },
  genre: [{
    type: String,
    enum: ['Action', 'Adventure', 'Comedy', 'Drama', 'Horror', 'Romance', 'Sci-Fi', 'Thriller', 'Animation', 'Documentary']
  }],
  language: {
    type: String,
    required: true
  },
  duration: {
    type: Number, // in minutes
    required: true,
    min: 60,
    max: 300
  },
  description: {
    type: String,
    required: true
  },
  director: {
    type: String,
    required: true
  },
  cast: [{
    type: String
  }],
  releaseDate: {
    type: Date,
    required: true
  },
  posterUrl: {
    type: String,
    required: true
  },
  trailerUrl: {
    type: String
  },
  rating: {
    type: String,
    enum: ['U', 'U/A', 'A', 'R'],
    default: 'U/A'
  },
  imdbRating: {
    type: Number,
    min: 0,
    max: 10
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

// Update the updatedAt field before saving
movieSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  next();
});

// Virtual for checking if movie is currently running
movieSchema.virtual('isCurrentlyRunning').get(function() {
  const now = new Date();
  const threeMonthsAgo = new Date();
  threeMonthsAgo.setMonth(now.getMonth() - 3);

  return this.releaseDate >= threeMonthsAgo && this.releaseDate <= now;
});

// Index for text search
movieSchema.index({
  title: 'text',
  description: 'text',
  director: 'text'
});

module.exports = mongoose.model('Movie', movieSchema);
