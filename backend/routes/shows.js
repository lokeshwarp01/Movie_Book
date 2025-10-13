// backend/routes/shows.js
const express = require('express');
const Joi = require('joi');
const Show = require('../models/Show');
const Screen = require('../models/Screen');
const Movie = require('../models/Movie');
const Booking = require('../models/Booking');
const SeatLock = require('../models/SeatLock');
const { authenticate, authorize } = require('../middleware/auth');

const router = express.Router();

const showSchema = Joi.object({
  movieId: Joi.string().required(),
  screenId: Joi.string().required(),
  startTime: Joi.date().min('now').required(),
  price: Joi.object({
    regular: Joi.number().min(0).required(),
    premium: Joi.number().min(0).required(),
    vip: Joi.number().min(0).required()
  }).required()
});

// GET /api/shows/movie/:movieId
router.get('/movie/:movieId', async (req, res) => {
  try {
    const { city, date, page = 1, limit = 20 } = req.query;
    const match = { movieId: req.params.movieId, startTime: { $gte: new Date() }, isActive: true };
    if (date) {
      const start = new Date(date); const end = new Date(date); end.setHours(23, 59, 59, 999);
      match.startTime = { $gte: start, $lte: end };
    }
    const pipeline = [
      { $match: match },
      { $lookup: { from: 'theaters', localField: 'theaterId', foreignField: '_id', as: 'theater' } },
      { $unwind: '$theater' },
      { $match: { 'theater.status': 'approved', 'theater.isActive': true } }
    ];
    if (city) pipeline.push({ $match: { 'theater.address.city': { $regex: city, $options: 'i' } } });
    pipeline.push(
      { $lookup: { from: 'screens', localField: 'screenId', foreignField: '_id', as: 'screen' } },
      { $unwind: '$screen' },
      { $lookup: { from: 'movies', localField: 'movieId', foreignField: '_id', as: 'movie' } },
      { $unwind: '$movie' },
      {
        $group: {
          _id: { theaterId: '$theaterId', date: { $dateToString: { format: '%Y-%m-%d', date: '$startTime' } } },
          theater: { $first: '$theater' }, movie: { $first: '$movie' },
          shows: { $push: { _id: '$_id', startTime: '$startTime', endTime: '$endTime', price: '$price', availableSeats: '$availableSeats', totalSeats: '$totalSeats', screen: '$screen' } }
        }
      },
      { $group: { _id: '$_id.theaterId', theater: { $first: '$theater' }, movie: { $first: '$movie' }, showDates: { $push: { date: '$_id.date', shows: '$shows' } } } },
      { $sort: { 'theater.name': 1 } },
      { $skip: (parseInt(page) - 1) * parseInt(limit) },
      { $limit: parseInt(limit) }
    );
    const result = await Show.aggregate(pipeline);
    const theaters = result.map(r => ({ theater: r.theater, showDates: r.showDates.reduce((a, d) => { a[d.date] = d.shows; return a; }, {}) }));
    res.json({ success: true, data: { movie: result[0]?.movie, theaters } });
  } catch (e) {
    console.error(e);
    res.status(500).json({ success: false, message: 'Failed to fetch movie shows' });
  }
});

// GET /api/shows/theater/:theaterId
router.get('/theater/:theaterId', async (req, res) => {
  try {
    const { date, page = 1, limit = 20 } = req.query;
    const match = { theaterId: req.params.theaterId, startTime: { $gte: new Date() }, isActive: true };
    if (date) {
      const s = new Date(date); const e = new Date(date); e.setHours(23, 59, 59, 999);
      match.startTime = { $gte: s, $lte: e };
    }
    const pipeline = [
      { $match: match },
      { $lookup: { from: 'movies', localField: 'movieId', foreignField: '_id', as: 'movie' } },
      { $unwind: '$movie' },
      { $lookup: { from: 'screens', localField: 'screenId', foreignField: '_id', as: 'screen' } },
      { $unwind: '$screen' },
      {
        $group: {
          _id: { movieId: '$movieId', date: { $dateToString: { format: '%Y-%m-%d', date: '$startTime' } } },
          movie: { $first: '$movie' },
          shows: { $push: { _id: '$_id', startTime: '$startTime', endTime: '$endTime', price: '$price', availableSeats: '$availableSeats', totalSeats: '$totalSeats', screen: '$screen' } }
        }
      },
      { $group: { _id: '$_id.movieId', movie: { $first: '$movie' }, showDates: { $push: { date: '$_id.date', shows: '$shows' } } } },
      { $sort: { 'movie.title': 1 } },
      { $skip: (parseInt(page) - 1) * parseInt(limit) },
      { $limit: parseInt(limit) }
    ];
    const result = await Show.aggregate(pipeline);
    const movies = result.map(r => ({ movie: r.movie, showDates: r.showDates.reduce((a, d) => { a[d.date] = d.shows; return a; }, {}) }));
    res.json({ success: true, data: { movies } });
  } catch (e) {
    console.error(e);
    res.status(500).json({ success: false, message: 'Failed to fetch theater shows' });
  }
});

// GET /api/shows/:id
router.get('/:id', async (req, res) => {
  try {
    const show = await Show.findById(req.params.id).populate('movieId').populate('theaterId').populate('screenId').lean();
    if (!show) return res.status(404).json({ success: false, message: 'Show not found' });
    res.json({ success: true, data: { show } });
  } catch (e) {
    console.error(e);
    res.status(500).json({ success: false, message: 'Failed to fetch show details' });
  }
});

// GET /api/shows/:id/seats
router.get('/:id/seats', async (req, res) => {
  try {
    const show = await Show.findById(req.params.id).populate('movieId', 'title duration').populate('theaterId', 'name').populate('screenId').lean();
    if (!show || !show.isActive) return res.status(404).json({ success: false, message: 'Show not found or inactive' });

    const screen = show.screenId;

    const bookedAgg = await Booking.aggregate([
      { $match: { showId: show._id, status: { $in: ['confirmed', 'pending'] } } },
      { $unwind: '$seats' },
      { $project: { seatId: { $concat: ['$seats.row', { $toString: '$seats.number' }] } } }
    ]);
    const booked = new Set(bookedAgg.map(x => x.seatId));

    const locks = await SeatLock.find({ showId: show._id, expiresAt: { $gte: new Date() } }).select('seatId').lean();
    const locked = new Set(locks.map(x => x.seatId));

    const seatsByRow = {};
    const summary = { total: 0, booked: 0, locked: 0, available: 0 };

    screen.seats.forEach(seat => {
      const id = seat.row + seat.number;
      if (!seatsByRow[seat.row]) seatsByRow[seat.row] = [];
      let status = 'available';
      if (booked.has(id)) { status = 'booked'; summary.booked++; }
      else if (locked.has(id)) { status = 'locked'; summary.locked++; }
      else { summary.available++; }
      summary.total++;
      seatsByRow[seat.row].push({ ...seat.toObject?.() ?? seat, status, price: show.price[seat.type] || show.price.regular });
    });

    Object.keys(seatsByRow).forEach(r => seatsByRow[r].sort((a, b) => a.number - b.number));

    res.json({
      success: true, data: {
        show: {
          _id: show._id, startTime: show.startTime, endTime: show.endTime, price: show.price,
          availableSeats: show.availableSeats, totalSeats: show.totalSeats
        }, screen: { _id: screen._id, name: screen.name, rows: screen.rows, columns: screen.columns, screenType: screen.screenType, soundSystem: screen.soundSystem },
        seatsByRow, summary
      }
    });
  } catch (e) {
    console.error(e);
    res.status(500).json({ success: false, message: 'Failed to fetch seat availability' });
  }
});

// POST /api/shows (theater_admin)
router.post('/', authenticate, authorize('theater_admin'), async (req, res) => {
  try {
    const { error, value } = showSchema.validate(req.body);
    if (error) return res.status(400).json({ success: false, message: error.details[0].message });

    const screen = await Screen.findById(value.screenId).populate('theaterId');
    if (!screen) return res.status(404).json({ success: false, message: 'Screen not found' });
    if (screen.theaterId._id.toString() !== req.user.theaterId.toString()) return res.status(403).json({ success: false, message: 'Access denied. Screen not in your theater' });

    const movie = await Movie.findById(value.movieId);
    if (!movie || !movie.isActive) return res.status(404).json({ success: false, message: 'Movie not found or inactive' });

    const start = new Date(value.startTime);
    const end = new Date(start.getTime() + (movie.duration + 30) * 60000); // +30m buffer

    const conflict = await Show.findOne({
      screenId: value.screenId, isActive: true,
      $or: [{ startTime: { $lt: end }, endTime: { $gt: start } }]
    });
    if (conflict) return res.status(409).json({ success: false, message: 'Show time conflicts with existing show' });

    const show = await Show.create({
      ...value, theaterId: screen.theaterId._id, endTime: end,
      totalSeats: screen.totalSeats, availableSeats: screen.totalSeats
    });

    const populated = await Show.findById(show._id).populate('movieId', 'title duration').populate('screenId', 'name').populate('theaterId', 'name');
    res.status(201).json({ success: true, message: 'Show created successfully', data: { show: populated } });
  } catch (e) {
    console.error(e);
    res.status(500).json({ success: false, message: 'Failed to create show' });
  }
});

// PUT /api/shows/:id (theater_admin)
router.put('/:id', authenticate, authorize('theater_admin'), async (req, res) => {
  try {
    const { error, value } = showSchema.validate(req.body);
    if (error) return res.status(400).json({ success: false, message: error.details[0].message });

    const existing = await Show.findById(req.params.id).populate('theaterId');
    if (!existing) return res.status(404).json({ success: false, message: 'Show not found' });
    if (existing.theaterId._id.toString() !== req.user.theaterId.toString()) return res.status(403).json({ success: false, message: 'Access denied' });

    const hasBookings = await Booking.exists({ showId: req.params.id, status: { $in: ['confirmed', 'pending'] } });
    if (hasBookings) return res.status(400).json({ success: false, message: 'Cannot update show with existing bookings' });

    const movie = await Movie.findById(value.movieId);
    const start = new Date(value.startTime);
    const end = new Date(start.getTime() + (movie.duration + 30) * 60000);

    const overlapping = await Show.findOne({
      _id: { $ne: req.params.id }, screenId: value.screenId, isActive: true,
      $or: [{ startTime: { $lt: end }, endTime: { $gt: start } }]
    });
    if (overlapping) return res.status(409).json({ success: false, message: 'Show time conflicts with existing show' });

    const updated = await Show.findByIdAndUpdate(req.params.id, { ...value, endTime: end, updatedAt: new Date() }, { new: true })
      .populate('movieId screenId theaterId');
    res.json({ success: true, message: 'Show updated successfully', data: { show: updated } });
  } catch (e) {
    console.error(e);
    res.status(500).json({ success: false, message: 'Failed to update show' });
  }
});

// DELETE /api/shows/:id (theater_admin)
router.delete('/:id', authenticate, authorize('theater_admin'), async (req, res) => {
  try {
    const show = await Show.findById(req.params.id).populate('theaterId');
    if (!show) return res.status(404).json({ success: false, message: 'Show not found' });
    if (show.theaterId._id.toString() !== req.user.theaterId.toString()) return res.status(403).json({ success: false, message: 'Access denied' });

    const hasBookings = await Booking.exists({ showId: req.params.id, status: { $in: ['confirmed', 'pending'] } });
    if (hasBookings) return res.status(400).json({ success: false, message: 'Cannot delete show with existing bookings' });

    await Show.findByIdAndUpdate(req.params.id, { isActive: false, updatedAt: new Date() });
    res.json({ success: true, message: 'Show deleted successfully' });
  } catch (e) {
    console.error(e);
    res.status(500).json({ success: false, message: 'Failed to delete show' });
  }
});

// GET /api/shows/:id/bookings (theater_admin)
router.get('/:id/bookings', authenticate, authorize('theater_admin'), async (req, res) => {
  try {
    const show = await Show.findById(req.params.id).populate('theaterId');
    if (!show) return res.status(404).json({ success: false, message: 'Show not found' });
    if (show.theaterId._id.toString() !== req.user.theaterId.toString()) return res.status(403).json({ success: false, message: 'Access denied' });

    const bookings = await Booking.find({ showId: req.params.id }).populate('userId', 'name email phone').sort({ createdAt: -1 }).lean();
    res.json({ success: true, data: { bookings } });
  } catch (e) {
    console.error(e);
    res.status(500).json({ success: false, message: 'Failed to fetch show bookings' });
  }
});

module.exports = router;
