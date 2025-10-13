// backend/models/Screen.js
const mongoose = require('mongoose');

const seatSchema = new mongoose.Schema({
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
    enum: ['regular', 'premium', 'vip', 'wheelchair'],
    default: 'regular'
  },
  isActive: {
    type: Boolean,
    default: true
  }
});

const screenSchema = new mongoose.Schema({
  theaterId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Theater',
    required: true
  },
  name: {
    type: String,
    required: true,
    trim: true
  },
  rows: {
    type: Number,
    required: true,
    min: 1,
    max: 26 // A-Z rows
  },
  columns: {
    type: Number,
    required: true,
    min: 1,
    max: 50
  },
  seats: [seatSchema], // Pre-generated seats based on rows and columns
  totalSeats: {
    type: Number,
    required: true
  },
  screenType: {
    type: String,
    enum: ['2D', '3D', 'IMAX', '4DX'],
    default: '2D'
  },
  soundSystem: {
    type: String,
    enum: ['Dolby Digital', 'Dolby Atmos', 'DTS', 'Standard'],
    default: 'Standard'
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

// Generate seats automatically when screen is created
screenSchema.pre('save', function (next) {
  if (this.isNew && !this.seats.length) {
    this.generateSeats();
  }
  this.updatedAt = Date.now();
  next();
});

// Method to generate seats based on rows and columns
screenSchema.methods.generateSeats = function () {
  const seats = [];
  const rows = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L', 'M', 'N', 'O', 'P', 'Q', 'R', 'S', 'T', 'U', 'V', 'W', 'X', 'Y', 'Z'];

  for (let i = 0; i < this.rows; i++) {
    for (let j = 1; j <= this.columns; j++) {
      // Determine seat type based on position (middle seats are premium)
      let seatType = 'regular';
      if (i >= 2 && i < this.rows - 2 && j > 3 && j < this.columns - 3) {
        seatType = 'premium';
      }

      seats.push({
        row: rows[i],
        number: j,
        type: seatType
      });
    }
  }

  this.seats = seats;
  this.totalSeats = seats.length;
};

// Method to get seat by row and number
screenSchema.methods.getSeat = function (row, number) {
  return this.seats.find(seat => seat.row === row && seat.number === number);
};

// Method to update seat status
screenSchema.methods.updateSeatStatus = function (row, number, isActive) {
  const seat = this.seats.find(seat => seat.row === row && seat.number === number);
  if (seat) {
    seat.isActive = isActive;
    return true;
  }
  return false;
};

module.exports = mongoose.model('Screen', screenSchema);
