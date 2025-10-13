// backend/routes/movies.js
const express = require('express');
const Joi = require('joi');
const Movie = require('../models/Movie');
const Show = require('../models/Show');
const { authenticate, authorize, optionalAuth } = require('../middleware/auth');

const router = express.Router();

const movieSchema = Joi.object({
  title: Joi.string().min(1).max(100).required(),
  genre: Joi.array().items(Joi.string().valid(
    'Action', 'Adventure', 'Comedy', 'Drama', 'Horror', 'Romance', 'Sci-Fi', 'Thriller', 'Animation', 'Documentary'
  )).min(1).required(),
  language: Joi.string().required(),
  duration: Joi.number().min(60).max(300).required(),
  description: Joi.string().required(),
  director: Joi.string().required(),
  cast: Joi.array().items(Joi.string()),
  releaseDate: Joi.date().required(),
  posterUrl: Joi.string().uri().required(),
  trailerUrl: Joi.string().uri().optional(),
  rating: Joi.string().valid('U', 'U/A', 'A', 'R').default('U/A'),
  imdbRating: Joi.number().min(0).max(10).optional()
});

// GET /api/movies
router.get('/', optionalAuth, async (req, res) => {
  try {
    const { search, genre, language, sortBy = 'releaseDate', order = 'desc', page = 1, limit = 20, minRating, maxRating, releasedAfter, releasedBefore } = req.query;

    const filter = { isActive: true };
    if (search) {
      filter.$or = [
        { title: { $regex: search, $options: 'i' } },
        { director: { $regex: search, $options: 'i' } },
        { cast: { $elemMatch: { $regex: search, $options: 'i' } } }
      ];
    }
    if (genre) filter.genre = { $in: Array.isArray(genre) ? genre : [genre] };
    if (language) filter.language = { $in: Array.isArray(language) ? language : [language] };
    if (minRating || maxRating) {
      filter.imdbRating = {};
      if (minRating) filter.imdbRating.$gte = parseFloat(minRating);
      if (maxRating) filter.imdbRating.$lte = parseFloat(maxRating);
    }
    if (releasedAfter || releasedBefore) {
      filter.releaseDate = {};
      if (releasedAfter) filter.releaseDate.$gte = new Date(releasedAfter);
      if (releasedBefore) filter.releaseDate.$lte = new Date(releasedBefore);
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);
    const sort = { [sortBy]: order === 'desc' ? -1 : 1 };
    const [movies, total] = await Promise.all([
      Movie.find(filter).sort(sort).skip(skip).limit(parseInt(limit)).lean(),
      Movie.countDocuments(filter)
    ]);

    const moviesWithShows = await Promise.all(movies.map(async (m) => {
      const hasShows = await Show.exists({ movieId: m._id, startTime: { $gte: new Date() }, isActive: true });
      return { ...m, hasUpcomingShows: !!hasShows };
    }));

    res.json({
      success: true, data: {
        movies: moviesWithShows, pagination: {
          currentPage: parseInt(page),
          totalPages: Math.ceil(total / parseInt(limit)),
          totalMovies: total,
          hasNext: skip + movies.length < total,
          hasPrev: parseInt(page) > 1
        }
      }
    });
  } catch (e) {
    console.error(e);
    res.status(500).json({ success: false, message: 'Failed to fetch movies' });
  }
});

// GET /api/movies/search
router.get('/search', optionalAuth, async (req, res) => {
  try {
    const { q, limit = 10 } = req.query;
    if (!q || q.length < 2) return res.json({ success: true, data: { movies: [] } });

    const movies = await Movie.find({
      $and: [
        { isActive: true },
        {
          $or: [
            { title: { $regex: q, $options: 'i' } },
            { director: { $regex: q, $options: 'i' } },
            { cast: { $elemMatch: { $regex: q, $options: 'i' } } },
            { genre: { $elemMatch: { $regex: q, $options: 'i' } } }
          ]
        }
      ]
    }).select('title director cast genre language posterUrl releaseDate imdbRating')
      .limit(parseInt(limit)).sort({ imdbRating: -1, releaseDate: -1 }).lean();

    res.json({ success: true, data: { movies } });
  } catch (e) {
    console.error(e);
    res.status(500).json({ success: false, message: 'Failed to search movies' });
  }
});

// GET /api/movies/filters
router.get('/filters', async (_req, res) => {
  try {
    const [genreAgg, langAgg] = await Promise.all([
      Movie.aggregate([{ $match: { isActive: true } }, { $unwind: '$genre' }, { $group: { _id: '$genre' } }, { $sort: { _id: 1 } }]),
      Movie.aggregate([{ $match: { isActive: true } }, { $group: { _id: '$language' } }, { $sort: { _id: 1 } }])
    ]);
    const genres = genreAgg.map(x => x._id);
    const languages = langAgg.map(x => x._id);
    res.json({
      success: true, data: {
        genres, languages,
        ratings: ['U', 'U/A', 'A', 'R'],
        sortOptions: [
          { value: 'releaseDate', label: 'Release Date' },
          { value: 'imdbRating', label: 'IMDb Rating' },
          { value: 'title', label: 'Title' }
        ]
      }
    });
  } catch (e) {
    console.error(e);
    res.status(500).json({ success: false, message: 'Failed to fetch filter options' });
  }
});

// GET /api/movies/:id
router.get('/:id', optionalAuth, async (req, res) => {
  try {
    const movie = await Movie.findOne({ _id: req.params.id, isActive: true }).lean();
    if (!movie) return res.status(404).json({ success: false, message: 'Movie not found' });

    const shows = await Show.find({ movieId: movie._id, startTime: { $gte: new Date() }, isActive: true })
      .populate('theaterId', 'name location address')
      .populate('screenId', 'name').sort({ startTime: 1 }).lean();

    const grouped = shows.reduce((acc, s) => {
      const key = s.theaterId._id.toString();
      if (!acc[key]) acc[key] = { theater: s.theaterId, showDates: {} };
      const dateKey = new Date(s.startTime).toDateString();
      if (!acc[key].showDates[dateKey]) acc[key].showDates[dateKey] = [];
      acc[key].showDates[dateKey].push({
        _id: s._id, startTime: s.startTime, endTime: s.endTime, price: s.price,
        availableSeats: s.availableSeats, totalSeats: s.totalSeats, screen: s.screenId
      });
      return acc;
    }, {});

    res.json({ success: true, data: { movie, theaters: Object.values(grouped) } });
  } catch (e) {
    console.error(e);
    res.status(500).json({ success: false, message: 'Failed to fetch movie details' });
  }
});

// POST /api/movies (super_admin only)
router.post('/', authenticate, authorize('super_admin'), async (req, res) => {
  try {
    const { error, value } = movieSchema.validate(req.body);
    if (error) return res.status(400).json({ success: false, message: error.details[0].message });

    const duplicate = await Movie.findOne({ title: value.title, releaseDate: value.releaseDate, language: value.language });
    if (duplicate) return res.status(409).json({ success: false, message: 'Movie already exists with same title, date, language' });

    const movie = await Movie.create(value);
    res.status(201).json({ success: true, message: 'Movie added successfully', data: { movie } });
  } catch (e) {
    console.error(e);
    res.status(500).json({ success: false, message: 'Failed to add movie' });
  }
});

// PUT /api/movies/:id (super_admin)
router.put('/:id', authenticate, authorize('super_admin'), async (req, res) => {
  try {
    const { error, value } = movieSchema.validate(req.body);
    if (error) return res.status(400).json({ success: false, message: error.details[0].message });

    const movie = await Movie.findByIdAndUpdate(req.params.id, { ...value, updatedAt: new Date() }, { new: true, runValidators: true });
    if (!movie) return res.status(404).json({ success: false, message: 'Movie not found' });

    res.json({ success: true, message: 'Movie updated successfully', data: { movie } });
  } catch (e) {
    console.error(e);
    res.status(500).json({ success: false, message: 'Failed to update movie' });
  }
});

// DELETE /api/movies/:id (super_admin)
router.delete('/:id', authenticate, authorize('super_admin'), async (req, res) => {
  try {
    const hasUpcoming = await Show.exists({ movieId: req.params.id, startTime: { $gte: new Date() }, isActive: true });
    if (hasUpcoming) return res.status(400).json({ success: false, message: 'Cannot delete movie with upcoming shows' });

    const movie = await Movie.findByIdAndUpdate(req.params.id, { isActive: false, updatedAt: new Date() }, { new: true });
    if (!movie) return res.status(404).json({ success: false, message: 'Movie not found' });

    res.json({ success: true, message: 'Movie deleted successfully' });
  } catch (e) {
    console.error(e);
    res.status(500).json({ success: false, message: 'Failed to delete movie' });
  }
});

module.exports = router;
