// backend/routes/auth.js
const express = require('express');
const Joi = require('joi');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken'); // FIXED: Missing import
const User = require('../models/User');
const { authenticate } = require('../middleware/auth');

const router = express.Router();

// In-memory tracker for login attempts per IP+email
const loginAttempts = new Map();

// Per-route rate limiter for auth endpoints
const rateLimit = require('express-rate-limit');
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'Too many authentication attempts. Please try again later.' }
});

// Enhanced validation schemas
const registerSchema = Joi.object({
  name: Joi.string().min(2).max(50).required().trim()
    .pattern(/^[a-zA-Z ]+$/)  // Allows letters and spaces only
    .message('Name should only contain letters and spaces'),
  email: Joi.string().email().required().trim().lowercase(),
  password: Joi.string().min(8).max(128).required()
    .pattern(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{8,}$/)  // Requires lowercase, uppercase, digit, min 8 chars
    .message('Password must contain at least one lowercase letter, one uppercase letter, and one number'),
  phone: Joi.string()
    .pattern(/^[6-9]\d{9}$/)  // Valid Indian phone: starts with 6-9, exactly 10 digits
    .message('Please enter a valid Indian phone number')
    .required(),
  // Accept legacy variants and normalize later
  role: Joi.string().valid('user','theater_admin', 'super_admin').default('user'),
  theaterId: Joi.when('role', { is: 'theater_admin', then: Joi.string().required(), otherwise: Joi.optional() })
});

const loginSchema = Joi.object({
  email: Joi.string().email().required().trim().lowercase(),
  password: Joi.string().required()
});

// Input sanitization middleware
const sanitizeInput = (req, res, next) => {
  if (req.body.name) {
    req.body.name = req.body.name.replace(/[<>\"'%;()&+]/g, '');
  }
  next();
};

// Register new user
router.post('/register', authLimiter, sanitizeInput, async (req, res) => {
  try {
    const { error, value } = registerSchema.validate(req.body);
    if (error) {
      return res.status(400).json({
        success: false,
        message: error.details[0].message,
        field: error.details[0].path[0]
      });
    }

    // Normalize role to match User model enum
    if (value.role === 'theateradmin') value.role = 'theater_admin';
    if (value.role === 'superadmin') value.role = 'super_admin';

    // Check if user already exists
    const existingUser = await User.findOne({
      $or: [{ email: value.email }, { phone: value.phone }]
    });

    if (existingUser) {
      return res.status(409).json({
        success: false,
        message: existingUser.email === value.email
          ? 'Email already registered'
          : 'Phone number already registered'
      });
    }

    // Validate theater if theater_admin
    if (value.role === 'theater_admin' && value.theaterId) {
      const Theater = require('../models/Theater');
      const theater = await Theater.findById(value.theaterId);
      if (!theater) {
        return res.status(400).json({
          success: false,
          message: 'Invalid theater ID'
        });
      }
    }

    const userData = {
      name: value.name,
      email: value.email,
      passwordHash: value.password,
      phone: value.phone,
      role: value.role
    };

    if (value.theaterId) {
      userData.theaterId = value.theaterId;
    }

    const user = new User(userData);
    await user.save();

    const accessToken = user.generateAuthToken();
    const refreshToken = user.generateRefreshToken();

    user.lastLogin = new Date();
    await user.save();

    res.status(201).json({
      success: true,
      message: 'Registration successful',
      data: {
        user: {
          id: user._id,
          name: user.name,
          email: user.email,
          phone: user.phone,
          role: user.role,
          theaterId: user.theaterId,
          profileImage: user.profileImage,
          createdAt: user.createdAt
        },
        tokens: { accessToken, refreshToken }
      }
    });

  } catch (error) {
    console.error('Registration error:', error);

    if (error.code === 11000) {
      const field = Object.keys(error.keyValue)[0];
      return res.status(409).json({
        success: false,
        message: `${field} already exists`
      });
    }

    res.status(500).json({
      success: false,
      message: 'Registration failed. Please try again.'
    });
  }
});

// Enhanced login with attempt tracking
router.post('/login', authLimiter, async (req, res) => {
  try {
    const clientIP = req.ip || req.connection.remoteAddress;
    const attemptKey = `${clientIP}_${req.body.email}`;

    // Track login attempts
    const attempts = loginAttempts.get(attemptKey) || { count: 0, lastAttempt: new Date() };
    const timeSinceLastAttempt = new Date() - attempts.lastAttempt;

    if (attempts.count >= 5 && timeSinceLastAttempt < 15 * 60 * 1000) {
      return res.status(429).json({
        success: false,
        message: 'Too many failed login attempts. Please try again in 15 minutes.'
      });
    }

    // Validate input
    const { error, value } = loginSchema.validate(req.body);
    if (error) {
      return res.status(400).json({
        success: false,
        message: error.details[0].message
      });
    }

    const user = await User.findOne({ email: value.email });
    if (!user || !user.comparePassword(value.password)) {
      attempts.count++;
      attempts.lastAttempt = new Date();
      loginAttempts.set(attemptKey, attempts);

      return res.status(401).json({
        success: false,
        message: 'Invalid credentials'
      });
    }

    if (!user.isActive) {
      return res.status(403).json({
        success: false,
        message: 'Account is deactivated. Please contact support.'
      });
    }

    // Clear attempts on success
    loginAttempts.delete(attemptKey);

    const accessToken = jwt.sign(
      { userId: user._id, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: '1d' }
    );

    const refreshToken = jwt.sign(
      { userId: user._id },
      process.env.JWT_REFRESH_SECRET,
      { expiresIn: '7d' }
    );

    user.lastLogin = new Date();
    await user.save();

    res.json({
      success: true,
      message: 'Login successful',
      data: {
        user: {
          id: user._id,
          name: user.name,
          email: user.email,
          phone: user.phone,
          role: user.role,
          theaterId: user.theaterId,
          profileImage: user.profileImage,
          lastLogin: user.lastLogin
        },
        tokens: { accessToken, refreshToken }
      }
    });

  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({
      success: false,
      message: 'Login failed. Please try again.'
    });
  }
});

// Fixed refresh token endpoint
router.post('/refresh', async (req, res) => {
  try {
    const { refreshToken } = req.body;

    if (!refreshToken) {
      return res.status(400).json({
        success: false,
        message: 'Refresh token is required'
      });
    }

    const decoded = jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET);
    const user = await User.findById(decoded.userId);

    if (!user || !user.isActive) {
      return res.status(401).json({
        success: false,
        message: 'Invalid refresh token'
      });
    }

    const newAccessToken = user.generateAuthToken();

    res.json({
      success: true,
      message: 'Token refreshed successfully',
      data: { accessToken: newAccessToken }
    });

  } catch (error) {
    console.error('Token refresh error:', error);

    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({
        success: false,
        message: 'Refresh token expired. Please login again.'
      });
    }

    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({
        success: false,
        message: 'Invalid refresh token format'
      });
    }

    res.status(500).json({
      success: false,
      message: 'Token refresh failed'
    });
  }
});

// Get current user profile
router.get('/profile', authenticate, async (req, res) => {
  try {
    const user = await User.findById(req.user._id)
      .populate('theaterId', 'name address')
      .select('-passwordHash');

    res.json({
      success: true,
      data: { user }
    });
  } catch (error) {
    console.error('Profile fetch error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching profile'
    });
  }
});

// Enhanced profile update
router.put('/profile', authenticate, async (req, res) => {
  try {
    const updateSchema = Joi.object({
      name: Joi.string().min(2).max(50).trim()
        .pattern(/^[a-zA-Z ]+$/)
        .message('Name should only contain letters and spaces'),
      phone: Joi.string()
        .pattern(/^[6-9]\d{9}$/)
        .message('Please enter a valid Indian phone number'),
      profileImage: Joi.string().uri().max(500)
    });

    const { error, value } = updateSchema.validate(req.body);
    if (error) {
      return res.status(400).json({
        success: false,
        message: error.details[0].message
      });
    }

    // Check if phone is already used by another user
    if (value.phone) {
      const existingUser = await User.findOne({
        phone: value.phone,
        _id: { $ne: req.user._id }
      });

      if (existingUser) {
        return res.status(409).json({
          success: false,
          message: 'Phone number already in use'
        });
      }
    }

    const user = await User.findByIdAndUpdate(
      req.user._id,
      { $set: value },
      { new: true, runValidators: true }
    ).select('-passwordHash');

    res.json({
      success: true,
      message: 'Profile updated successfully',
      data: { user }
    });

  } catch (error) {
    console.error('Profile update error:', error);
    res.status(500).json({
      success: false,
      message: 'Profile update failed'
    });
  }
});

// Enhanced password change with better validation
router.put('/change-password', authenticate, async (req, res) => {
  try {
    const schema = Joi.object({
      currentPassword: Joi.string().required(),
      newPassword: Joi.string().min(8).max(128).required()
        .pattern(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{8,}$/)
        .invalid(Joi.ref('currentPassword'))
        .message('New password must be different from current password and contain at least one lowercase letter, one uppercase letter, and one number')
    });

    const { error, value } = schema.validate(req.body);
    if (error) {
      return res.status(400).json({
        success: false,
        message: error.details[0].message
      });
    }

    const user = await User.findById(req.user._id);

    if (!user.comparePassword(value.currentPassword)) {
      return res.status(400).json({
        success: false,
        message: 'Current password is incorrect'
      });
    }

    user.passwordHash = value.newPassword;
    await user.save();

    res.json({
      success: true,
      message: 'Password updated successfully'
    });

  } catch (error) {
    console.error('Password change error:', error);
    res.status(500).json({
      success: false,
      message: 'Password change failed'
    });
  }
});

// Logout endpoint (optional - for token blacklisting)
router.post('/logout', authenticate, async (req, res) => {
  try {
    // In a production app, you might want to blacklist the token
    // For now, we'll just send a success response
    res.json({
      success: true,
      message: 'Logged out successfully'
    });
  } catch (error) {
    console.error('Logout error:', error);
    res.status(500).json({
      success: false,
      message: 'Logout failed'
    });
  }
});

module.exports = router;
