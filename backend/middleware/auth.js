const jwt = require('jsonwebtoken');
const User = require('../models/User');

// Enhanced authentication middleware (required token)
const authenticate = async (req, res, next) => {
  try {
    const authHeader = req.header('Authorization');

    if (!authHeader) {
      return res.status(401).json({
        success: false,
        message: 'Access denied. No token provided.'
      });
    }

    const token = authHeader.startsWith('Bearer ')
      ? authHeader.slice(7)
      : authHeader;

    if (!token) {
      return res.status(401).json({
        success: false,
        message: 'Access denied. Invalid token format.'
      });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    const user = await User.findById(decoded.userId)
      .select('-passwordHash')
      .lean();

    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'Invalid token. User not found.'
      });
    }

    if (!user.isActive) {
      return res.status(403).json({
        success: false,
        message: 'Account deactivated. Contact support.'
      });
    }

    req.user = user;
    next();
  } catch (error) {
    console.error('Authentication error:', error);

    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({
        success: false,
        message: 'Token expired. Please login again.',
        expired: true
      });
    }

    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({
        success: false,
        message: 'Invalid token format.'
      });
    }

    res.status(500).json({
      success: false,
      message: 'Authentication failed.'
    });
  }
};

// Enhanced authorization middleware (role-based)
const authorize = (...allowedRoles) => {
  return (req, res, next) => {
    try {
      if (!req.user) {
        return res.status(401).json({
          success: false,
          message: 'Authentication required.'
        });
      }

      if (!allowedRoles.includes(req.user.role)) {
        return res.status(403).json({
          success: false,
          message: `Access denied. Required role: ${allowedRoles.join(' or ')}`
        });
      }

      next();
    } catch (error) {
      console.error('Authorization error:', error);
      res.status(500).json({
        success: false,
        message: 'Authorization failed.'
      });
    }
  };
};

// Middleware to check if user owns the theater
const checkTheaterOwnership = async (req, res, next) => {
  try {
    if (req.user.role === 'super_admin') {  // Updated for consistency with User.js model
      return next(); // Super admin can access all theaters
    }

    if (req.user.role !== 'theater_admin') {  // Updated for consistency
      return res.status(403).json({
        success: false,
        message: 'Theater admin access required.'
      });
    }

    const theaterId = req.params.theaterId || req.body.theaterId;
    if (!theaterId) {
      return res.status(400).json({
        success: false,
        message: 'Theater ID required.'
      });
    }

    if (req.user.theaterId?.toString() !== theaterId) {
      return res.status(403).json({
        success: false,
        message: 'Access denied. Not your theater.'
      });
    }

    next();
  } catch (error) {
    console.error('Theater ownership check error:', error);
    res.status(500).json({
      success: false,
      message: 'Authorization failed.'
    });
  }
};

// New: Optional authentication middleware
// Sets req.user if token is valid; otherwise, sets null and proceeds
const optionalAuth = async (req, res, next) => {
  try {
    const authHeader = req.header('Authorization');

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      req.user = null;
      return next();
    }

    const token = authHeader.slice(7);
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    const user = await User.findById(decoded.userId)
      .select('-passwordHash')
      .lean();

    if (!user || !user.isActive) {
      req.user = null;
      return next();
    }

    req.user = user;
    next();
  } catch (error) {
    console.error('Optional authentication error:', error);
    req.user = null;
    next();  // Proceed without rejecting
  }
};

module.exports = {
  authenticate,
  authorize,
  checkTheaterOwnership,
  optionalAuth  // Now exported
};
