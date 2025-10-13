// backend/routes/bookings.js
const express = require('express');
const Joi = require('joi');
const mongoose = require('mongoose');
const QRCode = require('qrcode');
const Booking = require('../models/Booking');
const Show = require('../models/Show');
const SeatLock = require('../models/SeatLock');
const { authenticate, authorize } = require('../middleware/auth');

const router = express.Router();

// Enhanced validation schema
const bookingSchema = Joi.object({
  showId: Joi.string().hex().length(24).required(),
  seats: Joi.array().items(Joi.object({
    row: Joi.string().pattern(/^[A-Z]$/).required(),
    number: Joi.number().integer().min(1).max(50).required(),
    type: Joi.string().valid('regular', 'premium', 'vip').required()
  })).min(1).max(8).required(),
  specialRequests: Joi.string().max(200).optional()
});

// Enhanced QR code generation
const generateQRCode = async (booking) => {
  try {
    const payload = {
      bookingId: booking._id.toString(),
      reference: booking.bookingReference,
      showId: booking.showId.toString(),
      seats: booking.seats.map(s => `${s.row}${s.number}`),
      amount: booking.totalAmount,
      timestamp: new Date().toISOString()
    };

    return await QRCode.toDataURL(JSON.stringify(payload), {
      errorCorrectionLevel: 'M',
      type: 'image/png',
      quality: 0.92,
      margin: 1,
      width: 256
    });
  } catch (error) {
    console.error('QR Code generation error:', error);
    throw new Error('Failed to generate QR code');
  }
};

// POST /api/bookings - Create booking
router.post('/', authenticate, async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const { error, value } = bookingSchema.validate(req.body);
    if (error) {
      await session.abortTransaction();
      return res.status(400).json({
        success: false,
        message: error.details[0].message,
        field: error.details[0].path[0]
      });
    }

    // Verify show exists and is bookable
    const show = await Show.findById(value.showId)
      .populate('movieId', 'title duration')
      .populate('screenId', 'totalSeats')
      .session(session);

    if (!show || !show.isActive) {
      await session.abortTransaction();
      return res.status(404).json({
        success: false,
        message: 'Show not found or inactive'
      });
    }

    const showStartTime = new Date(show.startTime);
    const currentTime = new Date();
    const timeDiff = (showStartTime - currentTime) / (1000 * 60); // minutes

    if (timeDiff < 15) {
      await session.abortTransaction();
      return res.status(400).json({
        success: false,
        message: 'Cannot book tickets less than 15 minutes before show'
      });
    }

    const seatIds = value.seats.map(s => `${s.row}${s.number}`);

    // Check for existing bookings
    const existingBookings = await Booking.aggregate([
      {
        $match: {
          showId: new mongoose.Types.ObjectId(value.showId),
          status: { $in: ['confirmed', 'pending'] }
        }
      },
      { $unwind: '$seats' },
      {
        $project: {
          seatId: { $concat: ['$seats.row', { $toString: '$seats.number' }] }
        }
      }
    ]).session(session);

    const bookedSeatIds = new Set(existingBookings.map(b => b.seatId));
    const conflicts = seatIds.filter(id => bookedSeatIds.has(id));

    if (conflicts.length > 0) {
      await session.abortTransaction();
      return res.status(409).json({
        success: false,
        message: `Seats ${conflicts.join(', ')} are already booked`,
        conflicts
      });
    }

    // Verify seat locks
    const activeLocks = await SeatLock.find({
      showId: value.showId,
      seatId: { $in: seatIds },
      expiresAt: { $gte: new Date() }
    }).session(session);

    const userLocks = activeLocks.filter(lock =>
      lock.lockedByUserId.toString() === req.user._id.toString()
    );

    if (userLocks.length !== seatIds.length) {
      await session.abortTransaction();
      return res.status(409).json({
        success: false,
        message: 'Please lock all seats before booking',
        missingLocks: seatIds.filter(seatId =>
          !userLocks.some(lock => lock.seatId === seatId)
        )
      });
    }

    // Calculate pricing
    const seatsWithPrices = value.seats.map(seat => ({
      ...seat,
      price: show.price[seat.type] || show.price.regular
    }));

    const totalAmount = seatsWithPrices.reduce((sum, seat) => sum + seat.price, 0);

    // Create booking
    const bookingData = {
      userId: req.user._id,
      showId: value.showId,
      seats: seatsWithPrices,
      totalAmount,
      status: 'confirmed', // In real app, this would be 'pending' until payment
      paymentStatus: 'completed', // In real app, this would be handled by payment gateway
      specialRequests: value.specialRequests
    };

    const booking = new Booking(bookingData);
    await booking.save({ session });

    // Generate QR code
    const qrCode = await generateQRCode(booking);
    booking.qrCode = qrCode;
    await booking.save({ session });

    // Release seat locks
    await SeatLock.deleteMany({
      showId: value.showId,
      seatId: { $in: seatIds },
      lockedByUserId: req.user._id
    }).session(session);

    // Update available seats
    await Show.findByIdAndUpdate(
      value.showId,
      { $inc: { availableSeats: -seatIds.length } },
      { session }
    );

    await session.commitTransaction();

    // Fetch populated booking
    const populatedBooking = await Booking.findById(booking._id)
      .populate({
        path: 'showId',
        populate: [
          { path: 'movieId', select: 'title duration genre posterUrl' },
          { path: 'theaterId', select: 'name address contact' },
          { path: 'screenId', select: 'name screenType' }
        ]
      })
      .populate('userId', 'name email phone');

    res.status(201).json({
      success: true,
      message: 'Booking confirmed successfully',
      data: { booking: populatedBooking }
    });

  } catch (error) {
    await session.abortTransaction();
    console.error('Booking creation error:', error);

    if (error.name === 'ValidationError') {
      return res.status(400).json({
        success: false,
        message: 'Invalid booking data',
        errors: Object.values(error.errors).map(e => e.message)
      });
    }

    res.status(500).json({
      success: false,
      message: 'Booking failed. Please try again.'
    });
  } finally {
    session.endSession();
  }
});

// GET /api/bookings/user - Get user's bookings
router.get('/user', authenticate, async (req, res) => {
  try {
    const {
      status,
      page = 1,
      limit = 10,
      sortBy = 'createdAt',
      order = 'desc',
      from,
      to
    } = req.query;

    const filter = { userId: req.user._id };

    if (status && ['pending', 'confirmed', 'cancelled', 'refunded'].includes(status)) {
      filter.status = status;
    }

    // Date range filter
    if (from || to) {
      filter.createdAt = {};
      if (from) filter.createdAt.$gte = new Date(from);
      if (to) filter.createdAt.$lte = new Date(to);
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);
    const sortOrder = order === 'desc' ? -1 : 1;

    const [bookings, total] = await Promise.all([
      Booking.find(filter)
        .populate({
          path: 'showId',
          populate: [
            { path: 'movieId', select: 'title posterUrl genre duration rating' },
            { path: 'theaterId', select: 'name address' },
            { path: 'screenId', select: 'name screenType' }
          ]
        })
        .sort({ [sortBy]: sortOrder })
        .skip(skip)
        .limit(parseInt(limit))
        .lean(),
      Booking.countDocuments(filter)
    ]);

    // Add computed fields
    const enrichedBookings = bookings.map(booking => ({
      ...booking,
      canCancel: booking.status === 'confirmed' &&
        booking.showId?.startTime &&
        new Date(booking.showId.startTime) > new Date(Date.now() + 2 * 60 * 60 * 1000),
      showStatus: booking.showId?.startTime ? (
        new Date(booking.showId.startTime) > new Date() ? 'upcoming' : 'completed'
      ) : 'unknown'
    }));

    const totalPages = Math.ceil(total / parseInt(limit));

    res.json({
      success: true,
      data: {
        bookings: enrichedBookings,
        pagination: {
          currentPage: parseInt(page),
          totalPages,
          totalBookings: total,
          hasNext: parseInt(page) < totalPages,
          hasPrev: parseInt(page) > 1,
          limit: parseInt(limit)
        }
      }
    });

  } catch (error) {
    console.error('Fetch bookings error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch bookings'
    });
  }
});

// GET /api/bookings/:id - Get specific booking
router.get('/:id', authenticate, async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid booking ID format'
      });
    }

    const booking = await Booking.findById(req.params.id)
      .populate({
        path: 'showId',
        populate: [
          { path: 'movieId' },
          { path: 'theaterId' },
          { path: 'screenId' }
        ]
      })
      .populate('userId', 'name email phone');

    if (!booking) {
      return res.status(404).json({
        success: false,
        message: 'Booking not found'
      });
    }

    // Check access permissions
    const canAccess = booking.userId._id.toString() === req.user._id.toString() ||
      ['super_admin', 'theater_admin'].includes(req.user.role);

    if (!canAccess) {
      return res.status(403).json({
        success: false,
        message: 'Access denied'
      });
    }

    // Add computed fields
    const enrichedBooking = {
      ...booking.toObject(),
      canCancel: booking.status === 'confirmed' &&
        booking.showId?.startTime &&
        new Date(booking.showId.startTime) > new Date(Date.now() + 2 * 60 * 60 * 1000)
    };

    res.json({
      success: true,
      data: { booking: enrichedBooking }
    });

  } catch (error) {
    console.error('Fetch booking error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch booking details'
    });
  }
});

// PUT /api/bookings/:id/cancel - Cancel booking
router.put('/:id/cancel', authenticate, async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const booking = await Booking.findById(req.params.id)
      .populate('showId', 'startTime')
      .session(session);

    if (!booking) {
      await session.abortTransaction();
      return res.status(404).json({
        success: false,
        message: 'Booking not found'
      });
    }

    if (booking.userId.toString() !== req.user._id.toString()) {
      await session.abortTransaction();
      return res.status(403).json({
        success: false,
        message: 'Access denied'
      });
    }

    if (booking.status !== 'confirmed') {
      await session.abortTransaction();
      return res.status(400).json({
        success: false,
        message: 'Only confirmed bookings can be cancelled'
      });
    }

    // Check cancellation window (2 hours before show)
    const timeDiff = (new Date(booking.showId.startTime) - new Date()) / (1000 * 60 * 60);
    if (timeDiff < 2) {
      await session.abortTransaction();
      return res.status(400).json({
        success: false,
        message: 'Cannot cancel booking less than 2 hours before show'
      });
    }

    // Update booking status
    booking.status = 'cancelled';
    booking.cancelledAt = new Date();
    booking.paymentStatus = 'refunded'; // In real app, trigger refund process
    await booking.save({ session });

    // Return seats to available pool
    await Show.findByIdAndUpdate(
      booking.showId._id,
      { $inc: { availableSeats: booking.seats.length } },
      { session }
    );

    await session.commitTransaction();

    res.json({
      success: true,
      message: 'Booking cancelled successfully. Refund will be processed within 5-7 business days.',
      data: {
        bookingId: booking._id,
        refundAmount: booking.totalAmount,
        cancelledAt: booking.cancelledAt
      }
    });

  } catch (error) {
    await session.abortTransaction();
    console.error('Cancel booking error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to cancel booking'
    });
  } finally {
    session.endSession();
  }
});

// GET /api/bookings/:id/ticket - Get e-ticket
router.get('/:id/ticket', authenticate, async (req, res) => {
  try {
    const booking = await Booking.findById(req.params.id)
      .populate({
        path: 'showId',
        populate: [
          { path: 'movieId', select: 'title genre duration rating' },
          { path: 'theaterId', select: 'name address contact' },
          { path: 'screenId', select: 'name screenType soundSystem' }
        ]
      })
      .populate('userId', 'name email');

    if (!booking) {
      return res.status(404).json({
        success: false,
        message: 'Booking not found'
      });
    }

    if (booking.userId._id.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        message: 'Access denied'
      });
    }

    if (booking.status !== 'confirmed') {
      return res.status(400).json({
        success: false,
        message: 'E-ticket available only for confirmed bookings'
      });
    }

    // Regenerate QR code if missing
    if (!booking.qrCode) {
      booking.qrCode = await generateQRCode(booking);
      await booking.save();
    }

    const ticket = {
      bookingReference: booking.bookingReference,
      movie: booking.showId.movieId,
      theater: booking.showId.theaterId,
      screen: booking.showId.screenId,
      showTime: booking.showId.startTime,
      seats: booking.seats,
      totalAmount: booking.totalAmount,
      qrCode: booking.qrCode,
      status: booking.status,
      bookedAt: booking.createdAt,
      specialRequests: booking.specialRequests
    };

    res.json({
      success: true,
      data: { ticket }
    });

  } catch (error) {
    console.error('Generate ticket error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to generate e-ticket'
    });
  }
});

module.exports = router;
