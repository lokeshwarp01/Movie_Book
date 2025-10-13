// backend/routes/theaters.js
const express = require('express');
const Joi = require('joi');
const rateLimit = require('express-rate-limit');
const Theater = require('../models/Theater');
const Screen = require('../models/Screen');
const Show = require('../models/Show');
const User = require('../models/User');
const { authenticate, authorize } = require('../middleware/auth');

const router = express.Router();

// Rate limiting for admin endpoints
const adminLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  message: { success: false, message: 'Too many admin requests from this IP' },
  standardHeaders: true,
  legacyHeaders: false,
});

// Apply rate limiting to all admin routes
router.use('/admin/', adminLimiter);

// Simple sanitization function
const sanitizeInput = (input) => {
  if (typeof input !== 'string') return input;
  return input
    .trim()
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;')
    .replace(/\//g, '&#x2F;');
};

// Sanitization middleware
const sanitizeRequestBody = (req, res, next) => {
  if (req.body.name) req.body.name = sanitizeInput(req.body.name);
  if (req.body.description) req.body.description = sanitizeInput(req.body.description);
  if (req.body.address) {
    if (req.body.address.street) req.body.address.street = sanitizeInput(req.body.address.street);
    if (req.body.address.city) req.body.address.city = sanitizeInput(req.body.address.city);
    if (req.body.address.state) req.body.address.state = sanitizeInput(req.body.address.state);
    if (req.body.address.zipCode) req.body.address.zipCode = sanitizeInput(req.body.address.zipCode);
    if (req.body.address.pincode) req.body.address.pincode = sanitizeInput(req.body.address.pincode);
  }
  if (req.body.contact) {
    if (req.body.contact.phone) req.body.contact.phone = sanitizeInput(req.body.contact.phone);
  }
  next();
};

// Validation schemas - FIXED: More flexible validation
const theaterSchema = Joi.object({
  name: Joi.string().min(3).max(100).trim().required(),
  address: Joi.object({
    street: Joi.string().trim().required(),
    city: Joi.string().trim().required(),
    state: Joi.string().trim().required(),
    zipCode: Joi.string().trim().pattern(/^[0-9]{5,6}$/).optional().allow(''),
    pincode: Joi.string().trim().pattern(/^[0-9]{5,6}$/).optional().allow('')
  }).required(),
  location: Joi.object({
    type: Joi.string().valid('Point').default('Point'),
    coordinates: Joi.array().items(Joi.number()).length(2).required()
  }).required(),
  contact: Joi.object({
    email: Joi.string().email().normalize().lowercase().required(),
    phone: Joi.string().pattern(/^[0-9]{10,15}$/).required()
  }).required(),
  ownerUserId: Joi.string().hex().length(24).optional().allow(''),
  facilities: Joi.array().items(Joi.string()).default([]),
  description: Joi.string().max(500).trim().optional().allow(''),
  status: Joi.string().valid('pending', 'approved', 'rejected').default('pending')
});

const updateTheaterSchema = Joi.object({
  name: Joi.string().min(3).max(100).trim().optional(),
  address: Joi.object({
    street: Joi.string().trim().optional(),
    city: Joi.string().trim().optional(),
    state: Joi.string().trim().optional(),
    zipCode: Joi.string().trim().pattern(/^[0-9]{5,6}$/).optional().allow(''),
    pincode: Joi.string().trim().pattern(/^[0-9]{5,6}$/).optional().allow('')
  }).optional(),
  location: Joi.object({
    type: Joi.string().valid('Point').default('Point'),
    coordinates: Joi.array().items(Joi.number()).length(2).optional()
  }).optional(),
  contact: Joi.object({
    email: Joi.string().email().normalize().lowercase().optional(),
    phone: Joi.string().pattern(/^[0-9]{10,15}$/).optional()
  }).optional(),
  facilities: Joi.array().items(Joi.string()).optional(),
  description: Joi.string().max(500).trim().optional().allow(''),
  status: Joi.string().valid('pending', 'approved', 'rejected').optional()
});

const screenSchema = Joi.object({
  name: Joi.string().min(3).max(50).trim().required(),
  rows: Joi.number().min(10).max(30).required(),
  columns: Joi.number().min(10).max(30).required(),
  screenType: Joi.string().valid('Regular', 'IMAX', '4DX', 'Premium').default('Regular'),
  soundSystem: Joi.string().valid('Stereo', 'Dolby Digital', 'Dolby Atmos', 'DTS').default('Dolby Digital')
});

const querySchema = Joi.object({
  search: Joi.string().trim().max(100).optional().allow(''),
  city: Joi.string().trim().optional().allow(''),
  state: Joi.string().trim().optional().allow(''),
  status: Joi.string().valid('pending', 'approved', 'rejected').optional().allow(''),
  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(100).default(10),
  sortBy: Joi.string().valid('name', 'city', 'createdAt', 'updatedAt').default('createdAt'),
  sortOrder: Joi.string().valid('asc', 'desc').default('desc')
});

const bulkActionSchema = Joi.object({
  theaterIds: Joi.array().items(Joi.string().hex().length(24)).min(1).required(),
  action: Joi.string().valid('approve', 'reject', 'delete').required(),
  reason: Joi.string().max(500).optional().allow('')
});

const rejectSchema = Joi.object({
  reason: Joi.string().max(500).required()
});

// Helper functions
const handleErrors = (res, error, defaultMessage = 'Operation failed') => {
  console.error('Error:', error);
  
  if (error.name === 'ValidationError') {
    return res.status(400).json({ 
      success: false, 
      message: 'Validation failed', 
      errors: Object.values(error.errors).map(e => e.message) 
    });
  }
  
  if (error.code === 11000) {
    return res.status(409).json({ 
      success: false, 
      message: 'Theater already exists' 
    });
  }
  
  if (error.name === 'CastError') {
    return res.status(400).json({ 
      success: false, 
      message: 'Invalid theater ID' 
    });
  }
  
  res.status(500).json({ 
    success: false, 
    message: defaultMessage 
  });
};

const sendResponse = (res, statusCode, message, data = null) => {
  const response = { success: statusCode < 400, message };
  if (data) response.data = data;
  res.status(statusCode).json(response);
};

// GET /api/theaters/admin/all - List all theaters with advanced filtering (super_admin)
router.get('/admin/all', authenticate, authorize('super_admin'), async (req, res) => {
  try {
    const { search, city, state, status, page = 1, limit = 10 } = req.query;

    const filter = {};
    if (search) {
      filter.$or = [
        { name: { $regex: search, $options: 'i' } },
        { 'address.city': { $regex: search, $options: 'i' } },
        { 'address.state': { $regex: search, $options: 'i' } }
      ];
    }
    if (city) filter['address.city'] = { $regex: city, $options: 'i' };
    if (state) filter['address.state'] = { $regex: state, $options: 'i' };
    if (status) filter.status = status;

    const pageNum = parseInt(page);
    const limitNum = parseInt(limit);
    const skip = (pageNum - 1) * limitNum;

    const [theaters, total] = await Promise.all([
      Theater.find(filter)
        .populate('ownerUserId', 'name email phone')
        .populate('approvedBy', 'name email')
        .populate('rejectedBy', 'name email')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limitNum)
        .lean(),
      Theater.countDocuments(filter)
    ]);

    // Get screens count for each theater
    const theatersWithScreens = await Promise.all(
      theaters.map(async (theater) => {
        const screensCount = await Screen.countDocuments({ theaterId: theater._id });
        return {
          ...theater,
          screensCount
        };
      })
    );

    sendResponse(res, 200, 'Theaters fetched successfully', {
      theaters: theatersWithScreens,
      pagination: {
        currentPage: pageNum,
        totalPages: Math.ceil(total / limitNum),
        totalTheaters: total,
        hasNext: skip + theatersWithScreens.length < total,
        hasPrev: pageNum > 1
      }
    });
  } catch (error) {
    handleErrors(res, error, 'Failed to fetch theaters');
  }
});

// GET /api/theaters/admin/stats - Get theater statistics (super_admin)
router.get('/admin/stats', authenticate, authorize('super_admin'), async (req, res) => {
  try {
    const stats = await Theater.aggregate([
      {
        $facet: {
          totalTheaters: [{ $count: 'count' }],
          theatersByStatus: [
            { $group: { _id: '$status', count: { $count: {} } } }
          ],
          theatersByCity: [
            { $group: { _id: '$address.city', count: { $count: {} } } },
            { $sort: { count: -1 } },
            { $limit: 10 }
          ],
          recentRegistrations: [
            { $sort: { createdAt: -1 } },
            { $limit: 5 },
            { 
              $project: {
                name: 1,
                'address.city': 1,
                status: 1,
                createdAt: 1
              }
            }
          ]
        }
      }
    ]);

    const formattedStats = {
      total: stats[0]?.totalTheaters[0]?.count || 0,
      byStatus: stats[0]?.theatersByStatus.reduce((acc, curr) => {
        acc[curr._id] = curr.count;
        return acc;
      }, {}),
      topCities: stats[0]?.theatersByCity || [],
      recentRegistrations: stats[0]?.recentRegistrations || []
    };

    sendResponse(res, 200, 'Theater statistics fetched successfully', { stats: formattedStats });
  } catch (error) {
    handleErrors(res, error, 'Failed to fetch theater statistics');
  }
});

// GET /api/theaters/admin/:id - Get theater details (super_admin)
router.get('/admin/:id', authenticate, authorize('super_admin'), async (req, res) => {
  try {
    const theater = await Theater.findById(req.params.id)
      .populate('ownerUserId', 'name email phone')
      .populate('approvedBy', 'name email')
      .populate('rejectedBy', 'name email');

    if (!theater) return sendResponse(res, 404, 'Theater not found');

    // Get screens and shows count for this theater
    const [screensCount, showsCount] = await Promise.all([
      Screen.countDocuments({ theaterId: theater._id }),
      Show.countDocuments({ theaterId: theater._id })
    ]);

    const theaterDetails = {
      ...theater.toObject(),
      stats: {
        screensCount,
        showsCount,
        totalSeats: screensCount * 100 // Approximate calculation
      }
    };

    sendResponse(res, 200, 'Theater details fetched successfully', { theater: theaterDetails });
  } catch (error) {
    handleErrors(res, error, 'Failed to fetch theater details');
  }
});

// POST /api/theaters/admin - Add theater (super_admin) - FIXED VALIDATION
router.post('/admin', authenticate, authorize('super_admin'), sanitizeRequestBody, async (req, res) => {
  try {
    // Handle pincode/zipCode mapping
    if (req.body?.address?.pincode && !req.body.address.zipCode) {
      req.body.address.zipCode = req.body.address.pincode;
    } else if (req.body?.address?.zipCode && !req.body.address.pincode) {
      req.body.address.pincode = req.body.address.zipCode;
    }

    const { error, value } = theaterSchema.validate(req.body);
    if (error) {
      console.log('Validation error:', error.details);
      return sendResponse(res, 400, error.details[0].message);
    }

    // Check for existing theater
    const existing = await Theater.findOne({ 
      name: value.name, 
      'address.city': value.address.city 
    });
    if (existing) return sendResponse(res, 409, 'Theater already exists in this city');

    const theater = new Theater({
      ...value,
      ownerUserId: value.ownerUserId || req.user._id,
      status: 'approved', // Auto-approve when created by super_admin
      approvedAt: new Date(),
      approvedBy: req.user._id,
      location: {
        type: 'Point',
        coordinates: [
          Number(value.location.coordinates[0]) || 0,
          Number(value.location.coordinates[1]) || 0
        ]
      }
    });

    await theater.save();

    // Update user role if owner is specified
    if (value.ownerUserId && value.ownerUserId.trim()) {
      await User.findByIdAndUpdate(value.ownerUserId, { 
        role: 'theater_admin', 
        theaterId: theater._id 
      });
    }

    const populatedTheater = await Theater.findById(theater._id)
      .populate('ownerUserId', 'name email phone')
      .populate('approvedBy', 'name email');

    sendResponse(res, 201, 'Theater added successfully', { theater: populatedTheater });
  } catch (error) {
    console.error('Add theater error:', error);
    handleErrors(res, error, 'Failed to add theater');
  }
});

// PUT /api/theaters/admin/:id - Update theater (super_admin)
router.put('/admin/:id', authenticate, authorize('super_admin'), sanitizeRequestBody, async (req, res) => {
  try {
    // Handle pincode/zipCode mapping
    if (req.body?.address?.pincode && !req.body.address.zipCode) {
      req.body.address.zipCode = req.body.address.pincode;
    } else if (req.body?.address?.zipCode && !req.body.address.pincode) {
      req.body.address.pincode = req.body.address.zipCode;
    }

    const { error, value } = updateTheaterSchema.validate(req.body);
    if (error) return sendResponse(res, 400, error.details[0].message);

    const theater = await Theater.findById(req.params.id);
    if (!theater) return sendResponse(res, 404, 'Theater not found');

    // Check for duplicate theater name in same city
    if (value.name && value.address?.city) {
      const existing = await Theater.findOne({
        name: value.name,
        'address.city': value.address.city,
        _id: { $ne: theater._id }
      });
      if (existing) return sendResponse(res, 409, 'Theater already exists in this city');
    }

    Object.assign(theater, value);
    await theater.save();

    const updatedTheater = await Theater.findById(theater._id)
      .populate('ownerUserId', 'name email phone')
      .populate('approvedBy', 'name email')
      .populate('rejectedBy', 'name email');

    sendResponse(res, 200, 'Theater updated successfully', { theater: updatedTheater });
  } catch (error) {
    handleErrors(res, error, 'Failed to update theater');
  }
});

// DELETE /api/theaters/admin/:id - Delete theater (super_admin)
router.delete('/admin/:id', authenticate, authorize('super_admin'), async (req, res) => {
  try {
    const theater = await Theater.findById(req.params.id);
    if (!theater) return sendResponse(res, 404, 'Theater not found');

    // Check if theater has active shows
    const activeShows = await Show.countDocuments({ 
      theaterId: theater._id, 
      startTime: { $gte: new Date() } 
    });

    if (activeShows > 0) {
      return sendResponse(res, 400, 'Cannot delete theater with active shows');
    }

    // Delete associated screens and shows
    await Promise.all([
      Screen.deleteMany({ theaterId: theater._id }),
      Show.deleteMany({ theaterId: theater._id })
    ]);

    // Reset user role if this was their theater
    if (theater.ownerUserId) {
      await User.findByIdAndUpdate(theater.ownerUserId, { 
        role: 'user', 
        $unset: { theaterId: 1 } 
      });
    }

    await Theater.findByIdAndDelete(req.params.id);

    sendResponse(res, 200, 'Theater deleted successfully');
  } catch (error) {
    handleErrors(res, error, 'Failed to delete theater');
  }
});

// GET /api/theaters/admin/pending - Get pending theater approvals (super_admin) - FIXED
router.get('/admin/pending', authenticate, authorize('super_admin'), async (req, res) => {
  try {
    const { page = 1, limit = 10 } = req.query;
    
    const pageNum = parseInt(page) || 1;
    const limitNum = parseInt(limit) || 10;
    const skip = (pageNum - 1) * limitNum;

    const [pendingTheaters, total] = await Promise.all([
      Theater.find({ status: 'pending' })
        .populate('ownerUserId', 'name email phone')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limitNum)
        .lean(),
      Theater.countDocuments({ status: 'pending' })
    ]);

    res.json({ 
      success: true, 
      data: { 
        theaters: pendingTheaters,
        pagination: {
          currentPage: pageNum,
          totalPages: Math.ceil(total / limitNum),
          totalTheaters: total,
          hasNext: skip + pendingTheaters.length < total,
          hasPrev: pageNum > 1
        }
      } 
    });
  } catch (error) {
    console.error('Error fetching pending theaters:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch pending theaters' });
  }
});

// PUT /api/theaters/admin/:id/approve - Approve theater (super_admin)
router.put('/admin/:id/approve', authenticate, authorize('super_admin'), async (req, res) => {
  try {
    const theater = await Theater.findById(req.params.id).populate('ownerUserId', 'name email');
    if (!theater) return sendResponse(res, 404, 'Theater not found');
    if (theater.status !== 'pending') return sendResponse(res, 400, 'Theater is not pending approval');

    theater.status = 'approved';
    theater.approvedAt = new Date();
    theater.approvedBy = req.user._id;
    await theater.save();

    // Update user role to theater_admin
    if (theater.ownerUserId) {
      await User.findByIdAndUpdate(theater.ownerUserId._id, { 
        role: 'theater_admin', 
        theaterId: theater._id 
      });
    }

    const updatedTheater = await Theater.findById(theater._id)
      .populate('ownerUserId', 'name email phone')
      .populate('approvedBy', 'name email');

    sendResponse(res, 200, 'Theater approved successfully', { theater: updatedTheater });
  } catch (error) {
    handleErrors(res, error, 'Failed to approve theater');
  }
});

// PUT /api/theaters/admin/:id/reject - Reject theater (super_admin)
router.put('/admin/:id/reject', authenticate, authorize('super_admin'), sanitizeRequestBody, async (req, res) => {
  try {
    const { error, value } = rejectSchema.validate(req.body);
    if (error) return sendResponse(res, 400, error.details[0].message);

    const theater = await Theater.findById(req.params.id).populate('ownerUserId', 'name email');
    if (!theater) return sendResponse(res, 404, 'Theater not found');
    if (theater.status !== 'pending') return sendResponse(res, 400, 'Theater is not pending approval');

    theater.status = 'rejected';
    theater.rejectedAt = new Date();
    theater.rejectedBy = req.user._id;
    theater.rejectionReason = value.reason;
    await theater.save();

    const updatedTheater = await Theater.findById(theater._id)
      .populate('ownerUserId', 'name email phone')
      .populate('rejectedBy', 'name email');

    sendResponse(res, 200, 'Theater rejected successfully', { theater: updatedTheater });
  } catch (error) {
    handleErrors(res, error, 'Failed to reject theater');
  }
});

// POST /api/theaters/admin/bulk-action - Bulk theater actions (super_admin)
router.post('/admin/bulk-action', authenticate, authorize('super_admin'), sanitizeRequestBody, async (req, res) => {
  try {
    const { error, value } = bulkActionSchema.validate(req.body);
    if (error) return sendResponse(res, 400, error.details[0].message);

    const { theaterIds, action, reason } = value;

    let update;
    let message;

    switch (action) {
      case 'approve':
        update = { 
          status: 'approved',
          approvedAt: new Date(),
          approvedBy: req.user._id
        };
        message = 'approved';
        
        // Update user roles for approved theaters
        const theatersToApprove = await Theater.find({ _id: { $in: theaterIds } });
        for (const theater of theatersToApprove) {
          if (theater.ownerUserId) {
            await User.findByIdAndUpdate(theater.ownerUserId, {
              role: 'theater_admin',
              theaterId: theater._id
            });
          }
        }
        break;

      case 'reject':
        update = { 
          status: 'rejected',
          rejectedAt: new Date(),
          rejectedBy: req.user._id,
          rejectionReason: reason || 'Bulk rejection'
        };
        message = 'rejected';
        break;

      case 'delete':
        // For delete action, remove theaters and associated data
        const theatersToDelete = await Theater.find({ _id: { $in: theaterIds } });
        
        for (const theater of theatersToDelete) {
          // Delete associated screens and shows
          await Promise.all([
            Screen.deleteMany({ theaterId: theater._id }),
            Show.deleteMany({ theaterId: theater._id })
          ]);

          // Reset user roles
          if (theater.ownerUserId) {
            await User.findByIdAndUpdate(theater.ownerUserId, {
              role: 'user',
              $unset: { theaterId: 1 }
            });
          }
        }

        const deleteResult = await Theater.deleteMany({ _id: { $in: theaterIds } });
        return sendResponse(res, 200, `Successfully deleted ${deleteResult.deletedCount} theaters`);

      default:
        return sendResponse(res, 400, 'Invalid action');
    }

    const updateResult = await Theater.updateMany(
      { _id: { $in: theaterIds } },
      update
    );

    sendResponse(res, 200, `Successfully ${message} ${updateResult.modifiedCount} theaters`);
  } catch (error) {
    handleErrors(res, error, 'Bulk operation failed');
  }
});

// GET /api/theaters/admin/:id/screens - Get theater screens (super_admin)
router.get('/admin/:id/screens', authenticate, authorize('super_admin'), async (req, res) => {
  try {
    const screens = await Screen.find({ theaterId: req.params.id }).sort({ name: 1 });
    sendResponse(res, 200, 'Screens fetched successfully', { screens });
  } catch (error) {
    handleErrors(res, error, 'Failed to fetch screens');
  }
});

// POST /api/theaters/admin/:id/screens - Add screen to theater (super_admin)
router.post('/admin/:id/screens', authenticate, authorize('super_admin'), sanitizeRequestBody, async (req, res) => {
  try {
    const { error, value } = screenSchema.validate(req.body);
    if (error) return sendResponse(res, 400, error.details[0].message);

    const theater = await Theater.findById(req.params.id);
    if (!theater) return sendResponse(res, 404, 'Theater not found');

    // Check if screen name already exists in this theater
    const existingScreen = await Screen.findOne({
      theaterId: req.params.id,
      name: value.name
    });
    if (existingScreen) return sendResponse(res, 409, 'Screen with this name already exists in this theater');

    const screen = new Screen({
      ...value,
      theaterId: req.params.id
    });

    await screen.save();

    sendResponse(res, 201, 'Screen added successfully', { screen });
  } catch (error) {
    handleErrors(res, error, 'Failed to add screen');
  }
});

// ========== ORIGINAL ROUTES (Keep your existing functionality) ==========

// GET /api/theaters - Public theaters list
router.get('/', async (req, res) => {
  try {
    const { city, page = 1, limit = 10 } = req.query;
    const filter = { status: 'approved' };
    
    if (city) filter['address.city'] = { $regex: city, $options: 'i' };

    const pageNum = parseInt(page) || 1;
    const limitNum = parseInt(limit) || 10;
    const skip = (pageNum - 1) * limitNum;

    const [theaters, total] = await Promise.all([
      Theater.find(filter)
        .select('name address contact facilities description')
        .sort({ name: 1 })
        .skip(skip)
        .limit(limitNum)
        .lean(),
      Theater.countDocuments(filter)
    ]);

    res.json({
      success: true,
      data: {
        theaters,
        pagination: {
          currentPage: pageNum,
          totalPages: Math.ceil(total / limitNum),
          totalTheaters: total,
          hasNext: skip + theaters.length < total,
          hasPrev: pageNum > 1
        }
      }
    });
  } catch (error) {
    console.error('Error fetching theaters:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch theaters' });
  }
});

// GET /api/theaters/search - Search theaters
router.get('/search', async (req, res) => {
  try {
    const { q, city } = req.query;
    const filter = { status: 'approved' };

    if (q) {
      filter.$or = [
        { name: { $regex: q, $options: 'i' } },
        { 'address.city': { $regex: q, $options: 'i' } },
        { 'address.area': { $regex: q, $options: 'i' } }
      ];
    }
    if (city) filter['address.city'] = { $regex: city, $options: 'i' };

    const theaters = await Theater.find(filter)
      .select('name address contact facilities')
      .limit(20)
      .lean();

    res.json({ success: true, data: { theaters } });
  } catch (error) {
    console.error('Error searching theaters:', error);
    res.status(500).json({ success: false, message: 'Failed to search theaters' });
  }
});

// GET /api/theaters/:id - Get theater details
router.get('/:id', async (req, res) => {
  try {
    const theater = await Theater.findById(req.params.id)
      .select('-ownerUserId -approvedBy -rejectedBy')
      .lean();

    if (!theater || theater.status !== 'approved') {
      return res.status(404).json({ success: false, message: 'Theater not found' });
    }

    res.json({ success: true, data: { theater } });
  } catch (error) {
    console.error('Error fetching theater:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch theater' });
  }
});

// POST /api/theaters - Theater registration (pending approval)
router.post('/', authenticate, sanitizeRequestBody, async (req, res) => {
  try {
    // Handle pincode/zipCode mapping
    if (req.body?.address?.pincode && !req.body.address.zipCode) {
      req.body.address.zipCode = req.body.address.pincode;
    } else if (req.body?.address?.zipCode && !req.body.address.pincode) {
      req.body.address.pincode = req.body.address.zipCode;
    }

    const { error, value } = theaterSchema.validate(req.body);
    if (error) return res.status(400).json({ success: false, message: error.details[0].message });

    const existing = await Theater.findOne({ 
      name: value.name, 
      'address.city': value.address.city 
    });
    if (existing) return res.status(409).json({ success: false, message: 'Theater already exists in this city' });

    const theater = new Theater({
      ...value,
      ownerUserId: req.user._id,
      status: 'pending', // Requires admin approval
      location: {
        type: 'Point',
        coordinates: [
          Number(value.location.coordinates[0]) || 0,
          Number(value.location.coordinates[1]) || 0
        ]
      }
    });

    await theater.save();

    res.status(201).json({ 
      success: true, 
      message: 'Theater registration submitted for approval', 
      data: { theater } 
    });
  } catch (error) {
    console.error('Error registering theater:', error);
    res.status(500).json({ success: false, message: 'Failed to register theater' });
  }
});

// PUT /api/theaters/:id - Update theater (theater admin only)
router.put('/:id', authenticate, async (req, res) => {
  try {
    const theater = await Theater.findById(req.params.id);
    if (!theater) return res.status(404).json({ success: false, message: 'Theater not found' });

    // Check if user owns this theater or is super_admin
    if (theater.ownerUserId.toString() !== req.user._id.toString() && req.user.role !== 'super_admin') {
      return res.status(403).json({ success: false, message: 'Not authorized to update this theater' });
    }

    const { error, value } = updateTheaterSchema.validate(req.body);
    if (error) return res.status(400).json({ success: false, message: error.details[0].message });

    Object.assign(theater, value);
    await theater.save();

    res.json({ success: true, message: 'Theater updated successfully', data: { theater } });
  } catch (error) {
    console.error('Error updating theater:', error);
    res.status(500).json({ success: false, message: 'Failed to update theater' });
  }
});

// POST /api/theaters/:id/screens - Add screen (theater admin only)
router.post('/:id/screens', authenticate, sanitizeRequestBody, async (req, res) => {
  try {
    const theater = await Theater.findById(req.params.id);
    if (!theater) return res.status(404).json({ success: false, message: 'Theater not found' });

    // Check if user owns this theater or is super_admin
    if (theater.ownerUserId.toString() !== req.user._id.toString() && req.user.role !== 'super_admin') {
      return res.status(403).json({ success: false, message: 'Not authorized to add screens to this theater' });
    }

    const { error, value } = screenSchema.validate(req.body);
    if (error) return res.status(400).json({ success: false, message: error.details[0].message });

    const existingScreen = await Screen.findOne({
      theaterId: req.params.id,
      name: value.name
    });
    if (existingScreen) return res.status(409).json({ success: false, message: 'Screen with this name already exists' });

    const screen = new Screen({
      ...value,
      theaterId: req.params.id
    });

    await screen.save();

    res.status(201).json({ success: true, message: 'Screen added successfully', data: { screen } });
  } catch (error) {
    console.error('Error adding screen:', error);
    res.status(500).json({ success: false, message: 'Failed to add screen' });
  }
});

// GET /api/theaters/:id/screens - Get theater screens
router.get('/:id/screens', async (req, res) => {
  try {
    const theater = await Theater.findById(req.params.id);
    if (!theater || theater.status !== 'approved') {
      return res.status(404).json({ success: false, message: 'Theater not found' });
    }

    const screens = await Screen.find({ theaterId: req.params.id }).sort({ name: 1 });
    res.json({ success: true, data: { screens } });
  } catch (error) {
    console.error('Error fetching screens:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch screens' });
  }
});

module.exports = router;