// backend/routes/admin.js
const express = require('express');
const rateLimit = require('express-rate-limit');
const { authenticate, authorize } = require('../middleware/auth');
const User = require('../models/User');
const Theater = require('../models/Theater');
const Movie = require('../models/Movie');
const Booking = require('../models/Booking');
const Show = require('../models/Show');
const mongoose = require('mongoose');

const router = express.Router();

// Rate limiting for admin endpoints
const adminLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  message: { success: false, message: 'Too many admin requests from this IP' },
  standardHeaders: true,
  legacyHeaders: false,
});

// Apply rate limiting to all admin routes
router.use('/', adminLimiter);

// Helper functions
const sendResponse = (res, statusCode, message, data = null) => {
  const response = { success: statusCode < 400, message };
  if (data) response.data = data;
  res.status(statusCode).json(response);
};

const handleErrors = (res, error, defaultMessage = 'An error occurred') => {
  console.error('Admin route error:', error);
  const message = error.message || defaultMessage;
  sendResponse(res, 500, message);
};

// GET /api/admin/stats - Get overall dashboard statistics (super_admin)
router.get('/stats', authenticate, authorize('super_admin'), async (req, res) => {
  try {
    const [usersCount, theatersCount, moviesCount, bookingsData] = await Promise.all([
      User.countDocuments(),
      Theater.countDocuments({ status: 'approved' }),
      Movie.countDocuments(),
      Booking.aggregate([
        {
          $group: {
            _id: null,
            totalBookings: { $sum: 1 },
            totalRevenue: { $sum: '$totalAmount' }
          }
        }
      ])
    ]);

    // Get monthly revenue for the last 6 months
    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

    const monthlyRevenue = await Booking.aggregate([
      {
        $match: {
          createdAt: { $gte: sixMonthsAgo }
        }
      },
      {
        $group: {
          _id: {
            year: { $year: '$createdAt' },
            month: { $month: '$createdAt' }
          },
          revenue: { $sum: '$totalAmount' }
        }
      },
      {
        $sort: { '_id.year': 1, '_id.month': 1 }
      }
    ]);

    const stats = {
      totalUsers: usersCount,
      totalTheaters: theatersCount,
      totalMovies: moviesCount,
      totalBookings: bookingsData[0]?.totalBookings || 0,
      totalRevenue: bookingsData[0]?.totalRevenue || 0,
      monthlyRevenue: monthlyRevenue
    };

    sendResponse(res, 200, 'Dashboard statistics fetched successfully', { stats });
  } catch (error) {
    handleErrors(res, error, 'Failed to fetch dashboard statistics');
  }
});

// GET /api/admin/recent-activity - Get recent system activity (super_admin)
router.get('/recent-activity', authenticate, authorize('super_admin'), async (req, res) => {
  try {
    const [recentUsers, recentTheaters, recentBookings] = await Promise.all([
      User.find()
        .select('name email role createdAt')
        .sort({ createdAt: -1 })
        .limit(5)
        .lean(),
      Theater.find()
        .select('name address.city status createdAt')
        .sort({ createdAt: -1 })
        .limit(5)
        .lean(),
      Booking.find()
        .populate('userId', 'name')
        .populate('showId')
        .populate({
          path: 'showId',
          populate: {
            path: 'movieId',
            select: 'title'
          }
        })
        .sort({ createdAt: -1 })
        .limit(5)
        .lean()
    ]);

    const activities = [];

    // Add user registrations
    recentUsers.forEach(user => {
      activities.push({
        type: 'user_registration',
        description: `New user ${user.name} registered`,
        timestamp: user.createdAt,
        metadata: { userId: user._id, role: user.role }
      });
    });

    // Add theater registrations
    recentTheaters.forEach(theater => {
      activities.push({
        type: 'theater_registration',
        description: `New theater ${theater.name} registered in ${theater.address.city}`,
        timestamp: theater.createdAt,
        metadata: { theaterId: theater._id, status: theater.status }
      });
    });

    // Add bookings
    recentBookings.forEach(booking => {
      if (booking.showId && booking.showId.movieId) {
        activities.push({
          type: 'booking',
          description: `${booking.userId?.name || 'User'} booked ${booking.showId.movieId.title}`,
          timestamp: booking.createdAt,
          metadata: { 
            bookingId: booking._id, 
            userId: booking.userId?._id,
            movieId: booking.showId.movieId._id
          }
        });
      }
    });

    // Sort by timestamp and limit to 10
    activities.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
    activities.splice(10);

    sendResponse(res, 200, 'Recent activity fetched successfully', { activities });
  } catch (error) {
    handleErrors(res, error, 'Failed to fetch recent activity');
  }
});

// GET /api/admin/theater/stats - Get theater admin dashboard statistics (super_admin, theater_admin)
router.get('/theater/stats', authenticate, authorize('super_admin', 'theater_admin'), async (req, res) => {
  try {
    let theaterId;
    if (req.user.role === 'super_admin') {
      theaterId = req.query.theaterId; // Super admin can query any theater
    } else {
      theaterId = req.user.theaterId; // Theater admin is locked to their own
    }

    console.log('Theater Admin Debug:', {
      userId: req.user._id,
      userRole: req.user.role,
      theaterId: theaterId,
      hasTheaterId: !!theaterId,
      isSuperAdminQuery: req.user.role === 'super_admin'
    });
    
    if (!theaterId) {
      const message = req.user.role === 'super_admin' 
        ? 'Super admin must provide a theaterId query parameter.'
        : 'User is not associated with any theater. Please contact super admin to assign you to a theater.';
      return sendResponse(res, 400, message);
    }

    const [showsCount, bookingsData, todayBookings] = await Promise.all([
      Show.countDocuments({ theaterId }),
      Booking.aggregate([
        {
          $lookup: {
            from: 'shows',
            localField: 'showId',
            foreignField: '_id',
            as: 'show'
          }
        },
        {
          $unwind: '$show'
        },
        {
          $match: {
            'show.theaterId': new mongoose.Types.ObjectId(theaterId)
          }
        },
        {
          $group: {
            _id: null,
            totalBookings: { $sum: 1 },
            totalRevenue: { $sum: '$totalAmount' }
          }
        }
      ]),
      Booking.aggregate([
        {
          $lookup: {
            from: 'shows',
            localField: 'showId',
            foreignField: '_id',
            as: 'show'
          }
        },
        {
          $unwind: '$show'
        },
        {
          $match: {
            'show.theaterId': new mongoose.Types.ObjectId(theaterId),
            createdAt: {
              $gte: new Date(new Date().setHours(0, 0, 0, 0)),
              $lt: new Date(new Date().setHours(23, 59, 59, 999))
            }
          }
        },
        {
          $count: 'todayBookings'
        }
      ])
    ]);

    const stats = {
      totalShows: showsCount,
      totalBookings: bookingsData[0]?.totalBookings || 0,
      totalRevenue: bookingsData[0]?.totalRevenue || 0,
      todayBookings: todayBookings[0]?.todayBookings || 0
    };

    sendResponse(res, 200, 'Theater statistics fetched successfully', { stats });
  } catch (error) {
    handleErrors(res, error, 'Failed to fetch theater statistics');
  }
});

// GET /api/admin/theater/shows - Get theater shows (super_admin, theater_admin)
router.get('/theater/shows', authenticate, authorize('super_admin', 'theater_admin'), async (req, res) => {
  try {
    let theaterId;
    if (req.user.role === 'super_admin') {
      theaterId = req.query.theaterId;
    } else {
      theaterId = req.user.theaterId;
    }

    if (!theaterId) {
      const message = req.user.role === 'super_admin' 
        ? 'Super admin must provide a theaterId query parameter.'
        : 'User is not associated with any theater.';
      return sendResponse(res, 400, message);
    }

    const shows = await Show.find({ theaterId })
      .populate('movieId', 'title language genre posterUrl')
      .populate('screenId', 'name')
      .sort({ startTime: -1 })
      .lean();

    // Get booking count for each show
    const showsWithBookings = await Promise.all(
      shows.map(async (show) => {
        const bookingCount = await Booking.countDocuments({ showId: show._id });
        return {
          ...show,
          bookings: bookingCount
        };
      })
    );

    sendResponse(res, 200, 'Theater shows fetched successfully', { shows: showsWithBookings });
  } catch (error) {
    handleErrors(res, error, 'Failed to fetch theater shows');
  }
});

// POST /api/admin/theater/shows - Create show (super_admin, theater_admin)
router.post('/theater/shows', authenticate, authorize('super_admin', 'theater_admin'), async (req, res) => {
  try {
    let theaterId;
    if (req.user.role === 'super_admin') {
      theaterId = req.query.theaterId;
    } else {
      theaterId = req.user.theaterId;
    }

    if (!theaterId) {
      const message = req.user.role === 'super_admin' 
        ? 'Super admin must provide a theaterId query parameter.'
        : 'User is not associated with any theater.';
      return sendResponse(res, 400, message);
    }

    const { movieId, date, time, screen, price } = req.body;

    // Validate required fields
    if (!movieId || !date || !time || !screen || !price) {
      return sendResponse(res, 400, 'All fields are required');
    }

    // Create start time from date and time
    const startTime = new Date(`${date}T${time}:00`);
    const endTime = new Date(startTime.getTime() + (2 * 60 * 60 * 1000)); // Assuming 2 hours duration

    const show = new Show({
      movieId,
      theaterId,
      screenId: screen, // Assuming screen is the screen ID
      startTime,
      endTime,
      price: Number(price),
      totalSeats: 100, // Default seats, should be from screen
      availableSeats: 100,
      isActive: true
    });

    await show.save();

    // Populate the show data
    await show.populate([
      { path: 'movieId', select: 'title language genre posterUrl' },
      { path: 'screenId', select: 'name' }
    ]);

    sendResponse(res, 201, 'Show created successfully', { show });
  } catch (error) {
    handleErrors(res, error, 'Failed to create show');
  }
});

// PUT /api/admin/theater/shows/:id - Update show (super_admin, theater_admin)
router.put('/theater/shows/:id', authenticate, authorize('super_admin', 'theater_admin'), async (req, res) => {
  try {
    let theaterId;
    if (req.user.role === 'super_admin') {
      theaterId = req.query.theaterId;
    } else {
      theaterId = req.user.theaterId;
    }
    const showId = req.params.id;

    if (!theaterId) {
      const message = req.user.role === 'super_admin' 
        ? 'Super admin must provide a theaterId query parameter.'
        : 'User is not associated with any theater.';
      return sendResponse(res, 400, message);
    }

    const show = await Show.findOne({ _id: showId, theaterId });
    if (!show) {
      return sendResponse(res, 404, 'Show not found');
    }

    const { movieId, date, time, screen, price } = req.body;

    if (movieId) show.movieId = movieId;
    if (date && time) {
      show.startTime = new Date(`${date}T${time}:00`);
      show.endTime = new Date(show.startTime.getTime() + (2 * 60 * 60 * 1000));
    }
    if (screen) show.screenId = screen;
    if (price) show.price = Number(price);

    await show.save();

    // Populate the show data
    await show.populate([
      { path: 'movieId', select: 'title language genre posterUrl' },
      { path: 'screenId', select: 'name' }
    ]);

    sendResponse(res, 200, 'Show updated successfully', { show });
  } catch (error) {
    handleErrors(res, error, 'Failed to update show');
  }
});

// DELETE /api/admin/theater/shows/:id - Delete show (super_admin, theater_admin)
router.delete('/theater/shows/:id', authenticate, authorize('super_admin', 'theater_admin'), async (req, res) => {
  try {
    let theaterId;
    if (req.user.role === 'super_admin') {
      theaterId = req.query.theaterId;
    } else {
      theaterId = req.user.theaterId;
    }
    const showId = req.params.id;

    if (!theaterId) {
      const message = req.user.role === 'super_admin' 
        ? 'Super admin must provide a theaterId query parameter.'
        : 'User is not associated with any theater.';
      return sendResponse(res, 400, message);
    }

    const show = await Show.findOne({ _id: showId, theaterId });
    if (!show) {
      return sendResponse(res, 404, 'Show not found');
    }

    // Check if there are any bookings for this show
    const bookingCount = await Booking.countDocuments({ showId });
    if (bookingCount > 0) {
      return sendResponse(res, 400, 'Cannot delete show with existing bookings');
    }

    await Show.findByIdAndDelete(showId);

    sendResponse(res, 200, 'Show deleted successfully');
  } catch (error) {
    handleErrors(res, error, 'Failed to delete show');
  }
});

// GET /api/admin/theater/bookings - Get theater bookings (super_admin, theater_admin)
router.get('/theater/bookings', authenticate, authorize('super_admin', 'theater_admin'), async (req, res) => {
  try {
    let theaterId;
    if (req.user.role === 'super_admin') {
      theaterId = req.query.theaterId;
    } else {
      theaterId = req.user.theaterId;
    }

    if (!theaterId) {
      const message = req.user.role === 'super_admin' 
        ? 'Super admin must provide a theaterId query parameter.'
        : 'User is not associated with any theater.';
      return sendResponse(res, 400, message);
    }

    const { page = 1, limit = 10, search = '', status = '', dateFrom = '', dateTo = '' } = req.query;
    const skip = (page - 1) * limit;

    // Build match query
    const matchQuery = {};
    
    // Date range filter
    if (dateFrom || dateTo) {
      matchQuery.createdAt = {};
      if (dateFrom) matchQuery.createdAt.$gte = new Date(dateFrom);
      if (dateTo) matchQuery.createdAt.$lte = new Date(dateTo + 'T23:59:59.999Z');
    }

    // Status filter
    if (status) {
      matchQuery.status = status;
    }

    const pipeline = [
      {
        $lookup: {
          from: 'shows',
          localField: 'showId',
          foreignField: '_id',
          as: 'show'
        }
      },
      {
        $unwind: '$show'
      },
      {
        $match: {
          'show.theaterId': theaterId,
          ...matchQuery
        }
      },
      {
        $lookup: {
          from: 'users',
          localField: 'userId',
          foreignField: '_id',
          as: 'user'
        }
      },
      {
        $unwind: '$user'
      },
      {
        $lookup: {
          from: 'movies',
          localField: 'show.movieId',
          foreignField: '_id',
          as: 'movie'
        }
      },
      {
        $unwind: '$movie'
      },
      {
        $lookup: {
          from: 'screens',
          localField: 'show.screenId',
          foreignField: '_id',
          as: 'screen'
        }
      },
      {
        $unwind: '$screen'
      }
    ];

    // Add search filter if provided
    if (search) {
      pipeline.push({
        $match: {
          $or: [
            { 'user.name': { $regex: search, $options: 'i' } },
            { 'user.email': { $regex: search, $options: 'i' } },
            { 'movie.title': { $regex: search, $options: 'i' } }
          ]
        }
      });
    }

    // Add sorting and pagination
    pipeline.push(
      { $sort: { createdAt: -1 } },
      { $skip: skip },
      { $limit: parseInt(limit) },
      {
        $project: {
          _id: 1,
          seats: 1,
          totalAmount: 1,
          status: 1,
          createdAt: 1,
          'user._id': 1,
          'user.name': 1,
          'user.email': 1,
          'user.phone': 1,
          'show._id': 1,
          'show.startTime': 1,
          'show.endTime': 1,
          'movie._id': 1,
          'movie.title': 1,
          'movie.language': 1,
          'movie.genre': 1,
          'screen._id': 1,
          'screen.name': 1
        }
      }
    );

    const [bookings, totalCount] = await Promise.all([
      Booking.aggregate(pipeline),
      Booking.aggregate([
        ...pipeline.slice(0, -4), // Remove sort, skip, limit, project
        { $count: 'total' }
      ])
    ]);

    const total = totalCount[0]?.total || 0;

    // Transform the data to match expected format
    const transformedBookings = bookings.map(booking => ({
      _id: booking._id,
      seats: booking.seats,
      totalAmount: booking.totalAmount,
      status: booking.status,
      createdAt: booking.createdAt,
      userId: {
        _id: booking.user._id,
        name: booking.user.name,
        email: booking.user.email,
        phone: booking.user.phone
      },
      showId: {
        _id: booking.show._id,
        startTime: booking.show.startTime,
        endTime: booking.show.endTime,
        movieId: {
          _id: booking.movie._id,
          title: booking.movie.title,
          language: booking.movie.language,
          genre: booking.movie.genre
        },
        screenId: {
          _id: booking.screen._id,
          name: booking.screen.name
        }
      }
    }));

    sendResponse(res, 200, 'Theater bookings fetched successfully', {
      bookings: transformedBookings,
      pagination: {
        currentPage: parseInt(page),
        totalPages: Math.ceil(total / limit),
        totalBookings: total,
        hasNext: skip + bookings.length < total,
        hasPrev: page > 1
      }
    });
  } catch (error) {
    handleErrors(res, error, 'Failed to fetch theater bookings');
  }
});

// PUT /api/admin/theater/bookings/:id/confirm - Confirm booking (theater_admin)
router.put('/theater/bookings/:id/confirm', authenticate, authorize('theater_admin'), async (req, res) => {
  try {
    const theaterId = req.user.theaterId;
    const bookingId = req.params.id;

    const booking = await Booking.findOne({ _id: bookingId })
      .populate('showId')
      .lean();

    if (!booking) {
      return sendResponse(res, 404, 'Booking not found');
    }

    if (booking.showId.theaterId.toString() !== theaterId) {
      return sendResponse(res, 403, 'Access denied');
    }

    await Booking.findByIdAndUpdate(bookingId, { status: 'confirmed' });

    sendResponse(res, 200, 'Booking confirmed successfully');
  } catch (error) {
    handleErrors(res, error, 'Failed to confirm booking');
  }
});

// PUT /api/admin/theater/bookings/:id/cancel - Cancel booking (theater_admin)
router.put('/theater/bookings/:id/cancel', authenticate, authorize('theater_admin'), async (req, res) => {
  try {
    const theaterId = req.user.theaterId;
    const bookingId = req.params.id;

    const booking = await Booking.findOne({ _id: bookingId })
      .populate('showId')
      .lean();

    if (!booking) {
      return sendResponse(res, 404, 'Booking not found');
    }

    if (booking.showId.theaterId.toString() !== theaterId) {
      return sendResponse(res, 403, 'Access denied');
    }

    await Booking.findByIdAndUpdate(bookingId, { status: 'cancelled' });

    sendResponse(res, 200, 'Booking cancelled successfully');
  } catch (error) {
    handleErrors(res, error, 'Failed to cancel booking');
  }
});

// GET /api/admin/theater/current - Get current theater data (super_admin, theater_admin)
router.get('/theater/current', authenticate, authorize('super_admin', 'theater_admin'), async (req, res) => {
  try {
    let theaterId;
    if (req.user.role === 'super_admin') {
      theaterId = req.query.theaterId;
    } else {
      theaterId = req.user.theaterId;
    }

    if (!theaterId) {
      const message = req.user.role === 'super_admin' 
        ? 'Super admin must provide a theaterId query parameter.'
        : 'User is not associated with any theater.';
      return sendResponse(res, 400, message);
    }

    const theater = await Theater.findById(theaterId);
    if (!theater) {
      return sendResponse(res, 404, 'Theater not found');
    }

    sendResponse(res, 200, 'Theater data fetched successfully', { theater });
  } catch (error) {
    handleErrors(res, error, 'Failed to fetch theater data');
  }
});

// PUT /api/admin/theater/current - Update current theater (super_admin, theater_admin)
router.put('/theater/current', authenticate, authorize('super_admin', 'theater_admin'), async (req, res) => {
  try {
    let theaterId;
    if (req.user.role === 'super_admin') {
      theaterId = req.query.theaterId;
    } else {
      theaterId = req.user.theaterId;
    }

    if (!theaterId) {
      const message = req.user.role === 'super_admin' 
        ? 'Super admin must provide a theaterId query parameter.'
        : 'User is not associated with any theater.';
      return sendResponse(res, 400, message);
    }

    const theater = await Theater.findByIdAndUpdate(
      theaterId,
      req.body,
      { new: true, runValidators: true }
    );

    if (!theater) {
      return sendResponse(res, 404, 'Theater not found');
    }

    sendResponse(res, 200, 'Theater updated successfully', { theater });
  } catch (error) {
    handleErrors(res, error, 'Failed to update theater');
  }
});

// PUT /api/admin/users/:userId/assign-theater - Assign theater admin to theater (super_admin)
router.put('/users/:userId/assign-theater', authenticate, authorize('super_admin'), async (req, res) => {
  try {
    const { theaterId } = req.body;
    
    if (!theaterId) {
      return sendResponse(res, 400, 'Theater ID is required');
    }

    // Verify theater exists
    const theater = await Theater.findById(theaterId);
    if (!theater) {
      return sendResponse(res, 404, 'Theater not found');
    }

    // Update user's theaterId
    const user = await User.findByIdAndUpdate(
      req.params.userId,
      { theaterId: theaterId },
      { new: true, runValidators: true }
    ).select('-passwordHash');

    if (!user) {
      return sendResponse(res, 404, 'User not found');
    }

    sendResponse(res, 200, 'User assigned to theater successfully', { user });
  } catch (error) {
    handleErrors(res, error, 'Failed to assign user to theater');
  }
});

// GET /api/admin/debug/users - Debug endpoint to see all users and their theater assignments (super_admin)
router.get('/debug/users', authenticate, authorize('super_admin'), async (req, res) => {
  try {
    const users = await User.find({ role: 'theater_admin' })
      .select('name email role theaterId isActive')
      .populate('theaterId', 'name address.city')
      .lean();

    const theaters = await Theater.find({ status: 'approved' })
      .select('name address.city')
      .lean();

    sendResponse(res, 200, 'Debug data fetched successfully', { 
      theaterAdmins: users,
      availableTheaters: theaters 
    });
  } catch (error) {
    handleErrors(res, error, 'Failed to fetch debug data');
  }
});

// GET /api/admin/analytics - Get detailed analytics (super_admin, theater_admin)
router.get('/analytics', authenticate, authorize('super_admin', 'theater_admin'), async (req, res) => {
  try {
    const { from, to } = req.query;
    const fromDate = new Date(from);
    const toDate = new Date(to + 'T23:59:59.999Z');

    let matchQuery = {
      createdAt: { $gte: fromDate, $lte: toDate }
    };

    if (req.user.role === 'theater_admin') {
      if (!req.user.theaterId) {
        return sendResponse(res, 400, 'User is not associated with any theater.');
      }
      const showsInTheater = await Show.find({ theaterId: req.user.theaterId }).select('_id');
      const showIds = showsInTheater.map(s => s._id);
      matchQuery.showId = { $in: showIds };
    }

    const [revenue, bookings, users, movies, theatersByCity, theatersTotal] = await Promise.all([
      // Revenue analytics
      Booking.aggregate([
        { $match: matchQuery },
        {
          $group: {
            _id: null,
            total: { $sum: '$totalAmount' }
          }
        }
      ]),
      // Booking analytics
      Booking.aggregate([
        { $match: matchQuery },
        {
          $group: {
            _id: '$status',
            count: { $sum: 1 }
          }
        }
      ]),
      // User analytics (only for super_admin)
      req.user.role === 'super_admin' ? User.countDocuments({ createdAt: { $gte: fromDate, $lte: toDate } }) : Promise.resolve(0),
      // Movie analytics
      Booking.aggregate([
        { $match: matchQuery },
        {
          $lookup: {
            from: 'shows',
            localField: 'showId',
            foreignField: '_id',
            as: 'show'
          }
        },
        { $unwind: '$show' },
        {
          $group: {
            _id: '$show.movieId',
            bookings: { $sum: 1 },
            revenue: { $sum: '$totalAmount' }
          }
        },
        {
          $lookup: {
            from: 'movies',
            localField: '_id',
            foreignField: '_id',
            as: 'movie'
          }
        },
        { $unwind: '$movie' },
        { $sort: { revenue: -1 } },
        { $limit: 5 },
        {
          $project: {
            title: '$movie.title',
            language: '$movie.language',
            bookings: 1,
            revenue: 1
          }
        }
      ]),
      // Theater analytics (only for super_admin)
      req.user.role === 'super_admin' ? Theater.aggregate([
        { $group: { _id: '$address.city', count: { $sum: 1 } } },
        { $sort: { count: -1 } },
        { $project: { city: '$_id', count: 1, _id: 0 } }
      ]) : Promise.resolve([]),
      req.user.role === 'super_admin' ? Theater.countDocuments() : Promise.resolve(0)
    ]);

    const analyticsData = {
      revenue: {
        total: revenue[0]?.total || 0
      },
      bookings: {
        total: bookings.reduce((acc, b) => acc + b.count, 0),
        status: bookings.reduce((acc, b) => ({ ...acc, [b._id]: b.count }), {})
      },
      users: {
        total: users
      },
      movies: {
        topPerforming: movies
      },
      theaters: {
        byCity: theatersByCity,
        total: theatersTotal
      }
    };

    sendResponse(res, 200, 'Analytics data fetched successfully', analyticsData);

  } catch (error) {
    handleErrors(res, error, 'Failed to fetch analytics data');
  }
});

// GET /api/admin/theater/analytics - Get detailed analytics for a specific theater (theater_admin)
router.get('/theater/analytics', authenticate, authorize('theater_admin'), async (req, res) => {
  try {
    const { from, to } = req.query;
    const fromDate = new Date(from);
    const toDate = new Date(to + 'T23:59:59.999Z');
    const theaterId = req.user.theaterId;

    if (!theaterId) {
      return sendResponse(res, 400, 'User is not associated with any theater.');
    }

    const showsInTheater = await Show.find({ theaterId: theaterId }).select('_id');
    const showIds = showsInTheater.map(s => s._id);

    let matchQuery = {
      createdAt: { $gte: fromDate, $lte: toDate },
      showId: { $in: showIds }
    };

    const [revenue, bookings, movies] = await Promise.all([
      // Revenue analytics
      Booking.aggregate([
        { $match: matchQuery },
        {
          $group: {
            _id: null,
            total: { $sum: '$totalAmount' }
          }
        }
      ]),
      // Booking analytics
      Booking.aggregate([
        { $match: matchQuery },
        {
          $group: {
            _id: '$status',
            count: { $sum: 1 }
          }
        }
      ]),
      // Movie analytics
      Booking.aggregate([
        { $match: matchQuery },
        {
          $lookup: {
            from: 'shows',
            localField: 'showId',
            foreignField: '_id',
            as: 'show'
          }
        },
        { $unwind: '$show' },
        {
          $group: {
            _id: '$show.movieId',
            bookings: { $sum: 1 },
            revenue: { $sum: '$totalAmount' }
          }
        },
        {
          $lookup: {
            from: 'movies',
            localField: '_id',
            foreignField: '_id',
            as: 'movie'
          }
        },
        { $unwind: '$movie' },
        { $sort: { revenue: -1 } },
        { $limit: 5 },
        {
          $project: {
            title: '$movie.title',
            language: '$movie.language',
            bookings: 1,
            revenue: 1
          }
        }
      ])
    ]);

    const analyticsData = {
      revenue: {
        total: revenue[0]?.total || 0
      },
      bookings: {
        total: bookings.reduce((acc, b) => acc + b.count, 0),
        status: bookings.reduce((acc, b) => ({ ...acc, [b._id]: b.count }), {})
      },
      movies: {
        topPerforming: movies
      }
    };

    sendResponse(res, 200, 'Theater analytics data fetched successfully', analyticsData);

  } catch (error) {
    handleErrors(res, error, 'Failed to fetch theater analytics data');
  }
});

module.exports = router;
