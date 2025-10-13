// backend/server.js
require('dotenv').config();

const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const compression = require('compression');
const { createServer } = require('http');
const { Server } = require('socket.io');

// Import routes
const authRoutes = require('./routes/auth');
const movieRoutes = require('./routes/movies');
const theaterRoutes = require('./routes/theaters');
const showRoutes = require('./routes/shows');
const bookingRoutes = require('./routes/bookings');
const userRoutes = require('./routes/users');
const adminRoutes = require('./routes/admin');
const createLogger = require('./middleware/logger');

const app = express();
const server = createServer(app);

// Enhanced CORS configuration
const corsOptions = {
  origin: process.env.FRONTEND_URL || "http://localhost:3000",
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  maxAge: 86400 // 24 hours
};

const io = new Server(server, {
  cors: corsOptions,
  pingTimeout: 60000,
  pingInterval: 25000
});

// Enhanced rate limiting with different tiers
const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100,
  message: { success: false, message: 'Too many requests, please try again later' },
  standardHeaders: true,
  legacyHeaders: false
});

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5, // More restrictive for auth endpoints
  message: { success: false, message: 'Too many authentication attempts' }
});

const bookingLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 10, // Limited booking attempts
  message: { success: false, message: 'Too many booking attempts' }
});

// Enhanced middleware stack
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", "data:", "https:"]
    }
  }
}));

app.use(compression());
app.use(cors(corsOptions));
app.use(express.json({ limit: '10mb' }));

// Apply different rate limits
// Auth-specific limiter is applied per-route inside routes/auth.js to avoid blocking all auth endpoints
app.use('/api/bookings', bookingLimiter);
app.use('/api', generalLimiter);

const connectDB = async () => {
  try {
    const conn = await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/moviebook', {
      maxPoolSize: 10,
      serverSelectionTimeoutMS: 5000,
      socketTimeoutMS: 45000
    });

    console.log(`MongoDB connected: ${conn.connection.host}`);

    // Monitor connection (keep this)
    mongoose.connection.on('error', err => console.error('MongoDB connection error:', err));
    mongoose.connection.on('disconnected', () => console.warn('MongoDB disconnected'));
  } catch (error) {
    console.error('MongoDB connection failed:', error);
    process.exit(1);
  }
};



// Routes
app.use('/api/auth', authRoutes);
app.use('/api/movies', movieRoutes);
app.use('/api/theaters', theaterRoutes);
app.use('/api/shows', showRoutes);
app.use('/api/bookings', bookingRoutes);
app.use('/api/users', userRoutes);
app.use('/api/admin', adminRoutes);

// Enhanced Socket.IO for seat management with cleanup
const activeSeatLocks = new Map();
const roomUsers = new Map(); // Track users per room

// Cleanup expired locks periodically
setInterval(() => {
  const now = new Date();
  for (const [key, lock] of activeSeatLocks.entries()) {
    if (lock.expiresAt < now) {
      activeSeatLocks.delete(key);
      io.to(`show_${lock.showId}`).emit('seatLocksUpdated', {
        action: 'released',
        seatIds: [lock.seatId],
        reason: 'expired'
      });
    }
  }
}, 30000); // Check every 30 seconds

io.on('connection', (socket) => {
  console.log('🔌 User connected:', socket.id);

  socket.on('joinShow', (data) => {
    try {
      const { showId, userId } = data;
      if (!showId || !userId) {
        socket.emit('error', { message: 'Show ID and User ID are required' });
        return;
      }

      socket.join(`show_${showId}`);

      // Track users in room
      if (!roomUsers.has(`show_${showId}`)) {
        roomUsers.set(`show_${showId}`, new Set());
      }
      roomUsers.get(`show_${showId}`).add(socket.id);

      console.log(`👥 User ${socket.id} joined show ${showId}`);

      // Send current locks to new user
      const currentLocks = Array.from(activeSeatLocks.entries())
        .filter(([key]) => key.startsWith(`${showId}_`))
        .map(([, lock]) => ({
          seatId: lock.seatId,
          lockedBy: lock.userId,
          expiresAt: lock.expiresAt.toISOString()
        }));

      socket.emit('currentLocks', currentLocks);

    } catch (error) {
      console.error('❌ joinShow error:', error);
      socket.emit('error', { message: 'Failed to join show' });
    }
  });

  socket.on('leaveShow', (showId) => {
    try {
      socket.leave(`show_${showId}`);

      // Remove from room tracking
      if (roomUsers.has(`show_${showId}`)) {
        roomUsers.get(`show_${showId}`).delete(socket.id);
        if (roomUsers.get(`show_${showId}`).size === 0) {
          roomUsers.delete(`show_${showId}`);
        }
      }

      console.log(`👋 User ${socket.id} left show ${showId}`);
    } catch (error) {
      console.error('❌ leaveShow error:', error);
    }
  });

  socket.on('requestLock', async (data) => {
    try {
      const { showId, seatIds, userId } = data;

      if (!showId || !seatIds || !Array.isArray(seatIds) || !userId) {
        socket.emit('error', { message: 'Invalid lock request data' });
        return;
      }

      if (seatIds.length > 8) {
        socket.emit('error', { message: 'Cannot lock more than 8 seats' });
        return;
      }

      const lockId = `lock_${showId}_${userId}_${Date.now()}`;
      const expiresAt = new Date(Date.now() + 3 * 60 * 1000);
      const conflicts = [];

      // Check for conflicts
      seatIds.forEach(seatId => {
        const lockKey = `${showId}_${seatId}`;
        if (activeSeatLocks.has(lockKey)) {
          conflicts.push(seatId);
        }
      });

      if (conflicts.length > 0) {
        socket.emit('lockFailed', {
          message: `Seats ${conflicts.join(', ')} are already locked`,
          conflicts
        });
        return;
      }

      // Create locks
      seatIds.forEach(seatId => {
        const lockKey = `${showId}_${seatId}`;
        activeSeatLocks.set(lockKey, {
          lockId,
          userId,
          seatId,
          showId,
          expiresAt,
          socketId: socket.id
        });
      });

      // Notify all users
      io.to(`show_${showId}`).emit('seatLocksUpdated', {
        action: 'locked',
        seatIds,
        lockId,
        expiresAt: expiresAt.toISOString(),
        lockedBy: userId
      });

      socket.emit('lockSuccess', { lockId, expiresAt: expiresAt.toISOString() });
      console.log(`🔒 Seats locked: ${seatIds.join(', ')} for show ${showId}`);

      // Auto-release after 3 minutes
      setTimeout(() => {
        releaseSeatLock(showId, seatIds, lockId);
      }, 3 * 60 * 1000);

    } catch (error) {
      console.error('❌ Seat lock error:', error);
      socket.emit('error', { message: 'Failed to lock seats' });
    }
  });

  socket.on('releaseLock', (data) => {
    const { showId, seatIds, lockId } = data;
    releaseSeatLock(showId, seatIds, lockId);
  });

  socket.on('confirmBooking', (data) => {
    const { showId, seatIds, bookingId } = data;

    releaseSeatLock(showId, seatIds);

    io.to(`show_${showId}`).emit('seatsBooked', {
      seatIds,
      bookingId,
      bookedAt: new Date().toISOString()
    });

    console.log(`✅ Seats booked: ${seatIds.join(', ')} for show ${showId}`);
  });

  socket.on('disconnect', (reason) => {
    console.log('🔌 User disconnected:', socket.id, 'Reason:', reason);

    // Clean up locks and room tracking
    for (const [key, lock] of activeSeatLocks.entries()) {
      if (lock.socketId === socket.id) {
        activeSeatLocks.delete(key);
        io.to(`show_${lock.showId}`).emit('seatLocksUpdated', {
          action: 'released',
          seatIds: [lock.seatId],
          reason: 'user_disconnected'
        });
      }
    }

    // Clean up room tracking
    for (const [room, users] of roomUsers.entries()) {
      users.delete(socket.id);
      if (users.size === 0) {
        roomUsers.delete(room);
      }
    }
  });

  socket.on('error', (error) => {
    console.error('❌ Socket error:', error);
  });
});

function releaseSeatLock(showId, seatIds, specificLockId = null) {
  seatIds.forEach(seatId => {
    const lockKey = `${showId}_${seatId}`;
    const lock = activeSeatLocks.get(lockKey);

    if (lock && (!specificLockId || lock.lockId === specificLockId)) {
      activeSeatLocks.delete(lockKey);
      io.to(`show_${showId}`).emit('seatLocksUpdated', {
        action: 'released',
        seatIds: [seatId],
        lockId: lock.lockId
      });
    }
  });
}

// Enhanced health check
app.get('/api/health', async (req, res) => {
  try {
    const dbStatus = mongoose.connection.readyState === 1 ? 'Connected' : 'Disconnected';
    const memUsage = process.memoryUsage();

    res.json({
      status: 'OK',
      timestamp: new Date().toISOString(),
      database: dbStatus,
      activeLocks: activeSeatLocks.size,
      activeRooms: roomUsers.size,
      memory: {
        used: Math.round(memUsage.heapUsed / 1024 / 1024) + 'MB',
        total: Math.round(memUsage.heapTotal / 1024 / 1024) + 'MB'
      },
      uptime: Math.round(process.uptime()) + 's'
    });
  } catch (error) {
    res.status(500).json({
      status: 'ERROR',
      message: error.message
    });
  }
});

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({
    success: false,
    message: `Route ${req.originalUrl} not found`,
    timestamp: new Date().toISOString()
  });
});

// Enhanced error handling middleware
app.use((error, req, res, next) => {
  console.error('❌ Server error:', error);

  // Mongoose validation error
  if (error.name === 'ValidationError') {
    const messages = Object.values(error.errors).map(e => e.message);
    return res.status(400).json({
      success: false,
      message: 'Validation Error',
      errors: messages
    });
  }

  // MongoDB duplicate key error
  if (error.code === 11000) {
    const field = Object.keys(error.keyValue)[0];
    return res.status(400).json({
      success: false,
      message: `${field} already exists`
    });
  }

  // JWT errors
  if (error.name === 'JsonWebTokenError') {
    return res.status(401).json({
      success: false,
      message: 'Invalid token'
    });
  }

  res.status(500).json({
    success: false,
    message: process.env.NODE_ENV === 'production' ? 'Internal server error' : error.message
  });
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM received, shutting down gracefully');
  server.close(() => {
    mongoose.connection.close(false, () => {
      console.log('Process terminated');
      process.exit(0);
    });
  });
});

async function startServer() {
  const logger = await createLogger();
  app.use(logger);

  app.use(express.urlencoded({ extended: true, limit: '10mb' }));

  await connectDB();

  const PORT = process.env.PORT || 5000;
  server.listen(PORT, () => {
    console.log(`🚀 Server running on port ${PORT}`);
    console.log(`🌐 Environment: ${process.env.NODE_ENV || 'development'}`);
    console.log(`🔗 Frontend URL: ${process.env.FRONTEND_URL || 'http://localhost:3000'}`);
  });
}

startServer();

module.exports = { app, io };
