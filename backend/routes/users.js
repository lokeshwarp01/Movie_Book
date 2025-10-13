// backend/routes/users.js
const express = require('express');
const Joi = require('joi');
const bcrypt = require('bcryptjs');
const mongoose = require('mongoose');
const rateLimit = require('express-rate-limit');
const sanitizeHtml = require('sanitize-html');
const User = require('../models/User');
const { authenticate, authorize } = require('../middleware/auth');

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
router.use('/admin/', adminLimiter);

// Validation schemas
const userSchema = Joi.object({
  name: Joi.string().min(3).max(100).trim().required(),
  email: Joi.string().email().normalize().lowercase().required(),
  phone: Joi.string().pattern(/^[0-9]{10}$/).required(),
  password: Joi.string().min(8).pattern(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/).required()
    .messages({
      'string.pattern.base': 'Password must contain at least one uppercase letter, one lowercase letter, and one number'
    }),
  role: Joi.string().valid('user', 'theater_admin', 'super_admin').default('user')
});

const updateSchema = Joi.object({
  name: Joi.string().min(3).max(100).trim().optional(),
  email: Joi.string().email().normalize().lowercase().optional(),
  phone: Joi.string().pattern(/^[0-9]{10}$/).optional(),
  role: Joi.string().valid('user', 'theater_admin', 'super_admin').optional(),
  isActive: Joi.boolean().optional()
});

const querySchema = Joi.object({
  search: Joi.string().trim().max(100).optional().allow(''),
  role: Joi.string().valid('user', 'theater_admin', 'super_admin').optional().allow(''),
  isActive: Joi.boolean().optional().allow(''),
  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(100).default(10),
  sortBy: Joi.string().valid('name', 'email', 'createdAt', 'updatedAt').default('createdAt'),
  sortOrder: Joi.string().valid('asc', 'desc').default('desc')
});

const bulkActionSchema = Joi.object({
  userIds: Joi.array().items(Joi.string().hex().length(24)).min(1).required(),
  action: Joi.string().valid('activate', 'deactivate', 'delete').required(),
  reason: Joi.string().max(500).optional()
});

const changeRoleSchema = Joi.object({
  newRole: Joi.string().valid('user', 'theater_admin', 'super_admin').required()
});

const deactivateSchema = Joi.object({
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
      message: 'Email already exists' 
    });
  }
  
  if (error.name === 'CastError') {
    return res.status(400).json({ 
      success: false, 
      message: 'Invalid user ID' 
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

// Sanitization middleware
const sanitizeInput = (req, res, next) => {
  if (req.body.name) {
    req.body.name = sanitizeHtml(req.body.name.trim());
  }
  if (req.body.email) {
    req.body.email = sanitizeHtml(req.body.email.trim().toLowerCase());
  }
  if (req.body.phone) {
    req.body.phone = sanitizeHtml(req.body.phone.trim());
  }
  if (req.body.reason) {
    req.body.reason = sanitizeHtml(req.body.reason.trim());
  }
  next();
};

// GET /api/users/admin/users - List users with advanced filtering (super_admin)
router.get('/admin/users', authenticate, authorize('super_admin'), async (req, res) => {
  try {
    const { error, value } = querySchema.validate(req.query);
    if (error) return sendResponse(res, 400, error.details[0].message);

    const { search, role, isActive, page, limit, sortBy, sortOrder } = value;

    const filter = {};
    if (search) {
      filter.$or = [
        { name: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } },
        { phone: { $regex: search, $options: 'i' } }
      ];
    }
    if (role) filter.role = role;
    if (isActive !== undefined) filter.isActive = isActive;

    const sort = { [sortBy]: sortOrder === 'asc' ? 1 : -1 };
    const skip = (page - 1) * limit;

    const [users, total] = await Promise.all([
      User.find(filter)
        .select('-passwordHash')
        .sort(sort)
        .skip(skip)
        .limit(limit)
        .lean(),
      User.countDocuments(filter)
    ]);

    // Get user statistics (you can replace this with actual booking data)
    const usersWithStats = await Promise.all(
      users.map(async (user) => {
        // Placeholder for actual statistics - replace with your booking model queries
        const userStats = {
          totalBookings: 0,
          totalSpent: 0,
          lastActivity: user.updatedAt
        };
        
        return {
          ...user,
          stats: userStats
        };
      })
    );

    sendResponse(res, 200, 'Users fetched successfully', {
      users: usersWithStats,
      pagination: {
        currentPage: page,
        totalPages: Math.ceil(total / limit),
        totalUsers: total,
        hasNext: skip + users.length < total,
        hasPrev: page > 1
      }
    });
  } catch (error) {
    handleErrors(res, error, 'Failed to fetch users');
  }
});

// GET /api/users/admin/users/:id - Get user details (super_admin)
router.get('/admin/users/:id', authenticate, authorize('super_admin'), async (req, res) => {
  try {
    const user = await User.findById(req.params.id).select('-passwordHash');
    if (!user) return sendResponse(res, 404, 'User not found');

    // Add detailed user statistics here
    const userDetails = {
      ...user.toObject(),
      stats: {
        totalBookings: 0,
        totalSpent: 0,
        joinedDate: user.createdAt,
        lastLogin: user.updatedAt
      }
    };

    sendResponse(res, 200, 'User details fetched successfully', { user: userDetails });
  } catch (error) {
    handleErrors(res, error, 'Failed to fetch user details');
  }
});

// POST /api/users/admin/users - Add user (super_admin)
router.post('/admin/users', authenticate, authorize('super_admin'), sanitizeInput, async (req, res) => {
  try {
    const { error, value } = userSchema.validate(req.body);
    if (error) return sendResponse(res, 400, error.details[0].message);

    const existingUser = await User.findOne({ email: value.email });
    if (existingUser) return sendResponse(res, 409, 'Email already exists');

    const user = new User({
      name: value.name,
      email: value.email,
      phone: value.phone,
      role: value.role,
      passwordHash: value.password, // Will be hashed by model pre-save hook
      isActive: true
    });

    await user.save();

    const userResponse = { ...user.toObject() };
    delete userResponse.passwordHash;

    sendResponse(res, 201, 'User added successfully', { user: userResponse });
  } catch (error) {
    handleErrors(res, error, 'Failed to add user');
  }
});

// PUT /api/users/admin/users/:id - Update user (super_admin)
router.put('/admin/users/:id', authenticate, authorize('super_admin'), sanitizeInput, async (req, res) => {
  try {
    const { error, value } = updateSchema.validate(req.body);
    if (error) return sendResponse(res, 400, error.details[0].message);

    const user = await User.findById(req.params.id);
    if (!user) return sendResponse(res, 404, 'User not found');

    // Check if email is being changed and if it already exists
    if (value.email && value.email !== user.email) {
      const existingUser = await User.findOne({ email: value.email });
      if (existingUser) return sendResponse(res, 409, 'Email already exists');
    }

    Object.assign(user, value);
    await user.save();

    const userResponse = { ...user.toObject() };
    delete userResponse.passwordHash;

    sendResponse(res, 200, 'User updated successfully', { user: userResponse });
  } catch (error) {
    handleErrors(res, error, 'Failed to update user');
  }
});

// DELETE /api/users/admin/users/:id - Delete user (super_admin)
router.delete('/admin/users/:id', authenticate, authorize('super_admin'), async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) return sendResponse(res, 404, 'User not found');

    // Prevent super_admin from deleting themselves
    if (user._id.toString() === req.user._id.toString()) {
      return sendResponse(res, 400, 'Cannot delete your own account');
    }

    await User.findByIdAndDelete(req.params.id);
    sendResponse(res, 200, 'User deleted successfully');
  } catch (error) {
    handleErrors(res, error, 'Failed to delete user');
  }
});

// PUT /api/users/admin/users/:id/activate - Activate user (super_admin)
router.put('/admin/users/:id/activate', authenticate, authorize('super_admin'), async (req, res) => {
  try {
    const user = await User.findByIdAndUpdate(
      req.params.id, 
      { 
        isActive: true,
        deactivationReason: null,
        reactivatedAt: new Date()
      }, 
      { new: true, runValidators: true }
    );
    
    if (!user) return sendResponse(res, 404, 'User not found');
    
    sendResponse(res, 200, 'User activated successfully');
  } catch (error) {
    handleErrors(res, error, 'Failed to activate user');
  }
});

// PUT /api/users/admin/users/:id/deactivate - Deactivate user (super_admin)
router.put('/admin/users/:id/deactivate', authenticate, authorize('super_admin'), sanitizeInput, async (req, res) => {
  try {
    const { error, value } = deactivateSchema.validate(req.body);
    if (error) return sendResponse(res, 400, error.details[0].message);

    // Prevent super_admin from deactivating themselves
    if (req.params.id === req.user._id.toString()) {
      return sendResponse(res, 400, 'Cannot deactivate your own account');
    }

    const user = await User.findByIdAndUpdate(
      req.params.id, 
      { 
        isActive: false, 
        deactivationReason: value.reason,
        deactivatedAt: new Date()
      }, 
      { new: true, runValidators: true }
    );
    
    if (!user) return sendResponse(res, 404, 'User not found');
    
    sendResponse(res, 200, 'User deactivated successfully');
  } catch (error) {
    handleErrors(res, error, 'Failed to deactivate user');
  }
});

// PUT /api/users/admin/users/:id/role - Change role (super_admin)
router.put('/admin/users/:id/role', authenticate, authorize('super_admin'), async (req, res) => {
  try {
    const { error, value } = changeRoleSchema.validate(req.body);
    if (error) return sendResponse(res, 400, error.details[0].message);

    // Prevent super_admin from changing their own role
    if (req.params.id === req.user._id.toString()) {
      return sendResponse(res, 400, 'Cannot change your own role');
    }

    const user = await User.findByIdAndUpdate(
      req.params.id, 
      { role: value.newRole }, 
      { new: true, runValidators: true }
    );
    
    if (!user) return sendResponse(res, 404, 'User not found');
    
    sendResponse(res, 200, 'User role updated successfully');
  } catch (error) {
    handleErrors(res, error, 'Failed to change user role');
  }
});

// POST /api/users/admin/users/bulk-action - Bulk user actions (super_admin)
router.post('/admin/users/bulk-action', authenticate, authorize('super_admin'), sanitizeInput, async (req, res) => {
  try {
    const { error, value } = bulkActionSchema.validate(req.body);
    if (error) return sendResponse(res, 400, error.details[0].message);

    const { userIds, action, reason } = value;

    // Prevent including current user in bulk actions
    const filteredUserIds = userIds.filter(id => id !== req.user._id.toString());
    if (filteredUserIds.length !== userIds.length) {
      return sendResponse(res, 400, 'Cannot perform action on your own account');
    }

    let update;
    let message;

    switch (action) {
      case 'activate':
        update = { 
          isActive: true, 
          deactivationReason: null,
          reactivatedAt: new Date() 
        };
        message = 'activated';
        break;
      case 'deactivate':
        update = { 
          isActive: false, 
          deactivationReason: reason || 'Bulk deactivation',
          deactivatedAt: new Date() 
        };
        message = 'deactivated';
        break;
      case 'delete':
        // For delete action, we'll remove users directly
        const deleteResult = await User.deleteMany({ _id: { $in: filteredUserIds } });
        return sendResponse(res, 200, `Successfully deleted ${deleteResult.deletedCount} users`);
      default:
        return sendResponse(res, 400, 'Invalid action');
    }

    const updateResult = await User.updateMany(
      { _id: { $in: filteredUserIds } },
      update
    );

    sendResponse(res, 200, `Successfully ${message} ${updateResult.modifiedCount} users`);
  } catch (error) {
    handleErrors(res, error, 'Bulk operation failed');
  }
});

// GET /api/users/admin/users/stats - Get user statistics (super_admin)
router.get('/admin/users/stats', authenticate, authorize('super_admin'), async (req, res) => {
  try {
    const stats = await User.aggregate([
      {
        $facet: {
          totalUsers: [{ $count: 'count' }],
          usersByRole: [
            { $group: { _id: '$role', count: { $count: {} } } }
          ],
          usersByStatus: [
            { $group: { _id: '$isActive', count: { $count: {} } } }
          ],
          recentRegistrations: [
            { $sort: { createdAt: -1 } },
            { $limit: 5 },
            { 
              $project: {
                name: 1,
                email: 1,
                role: 1,
                createdAt: 1
              }
            }
          ],
          registrationTrend: [
            {
              $group: {
                _id: {
                  year: { $year: '$createdAt' },
                  month: { $month: '$createdAt' }
                },
                count: { $count: {} }
              }
            },
            { $sort: { '_id.year': 1, '_id.month': 1 } },
            { $limit: 12 }
          ]
        }
      }
    ]);

    const formattedStats = {
      total: stats[0]?.totalUsers[0]?.count || 0,
      byRole: stats[0]?.usersByRole.reduce((acc, curr) => {
        acc[curr._id] = curr.count;
        return acc;
      }, {}),
      byStatus: {
        active: stats[0]?.usersByStatus.find(s => s._id === true)?.count || 0,
        inactive: stats[0]?.usersByStatus.find(s => s._id === false)?.count || 0
      },
      recentRegistrations: stats[0]?.recentRegistrations || [],
      registrationTrend: stats[0]?.registrationTrend || []
    };

    sendResponse(res, 200, 'User statistics fetched successfully', { stats: formattedStats });
  } catch (error) {
    handleErrors(res, error, 'Failed to fetch user statistics');
  }
});

// GET /api/users/admin/users/:id/activity - Get user activity log (super_admin)
router.get('/admin/users/:id/activity', authenticate, authorize('super_admin'), async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) return sendResponse(res, 404, 'User not found');

    // Placeholder for actual activity logging system
    // In a real application, you would query an Activity model
    const activityLog = [
      {
        action: 'profile_updated',
        timestamp: user.updatedAt,
        details: 'User profile updated'
      },
      {
        action: 'account_created',
        timestamp: user.createdAt,
        details: 'User account created'
      }
    ];

    sendResponse(res, 200, 'User activity fetched successfully', {
      user: { name: user.name, email: user.email },
      activity: activityLog
    });
  } catch (error) {
    handleErrors(res, error, 'Failed to fetch user activity');
  }
});

// PUT /api/users/admin/users/:id/reset-password - Reset user password (super_admin)
router.put('/admin/users/:id/reset-password', authenticate, authorize('super_admin'), async (req, res) => {
  try {
    const { newPassword } = req.body;
    
    if (!newPassword || newPassword.length < 8) {
      return sendResponse(res, 400, 'Password must be at least 8 characters long');
    }

    const user = await User.findById(req.params.id);
    if (!user) return sendResponse(res, 404, 'User not found');

    // Set new password (model pre-save hook will hash it)
    user.passwordHash = newPassword;
    await user.save();

    // In a real application, you might want to:
    // 1. Send password reset email to user
    // 2. Log this action for security purposes
    // 3. Invalidate existing sessions

    sendResponse(res, 200, 'Password reset successfully');
  } catch (error) {
    handleErrors(res, error, 'Failed to reset password');
  }
});

module.exports = router;