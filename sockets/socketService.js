import { Server } from 'socket.io';
import jwt from 'jsonwebtoken';
import User from '../models/User.js';

let io = null;

/**
 * Initialize Socket.IO Server with JWT authentication middleware
 * @param {Object} server - HTTP Server instance
 * @returns {Object} Socket.IO Server instance
 */
export const initSocket = (server) => {
  io = new Server(server, {
    cors: {
      origin: process.env.FRONTEND_URL || 'http://localhost:5173',
      methods: ['GET', 'POST', 'PUT', 'DELETE'],
      credentials: true,
    },
  });

  // JWT Connection Handshake Authentication
  io.use(async (socket, next) => {
    try {
      const token = socket.handshake.auth?.token || socket.handshake.headers?.authorization?.split(' ')[1];
      if (!token) {
        return next(new Error('Authentication error: Token is required'));
      }

      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      const user = await User.findById(decoded.id).select('isActive isBlocked role name tokenVersion');
      
      if (!user) {
        return next(new Error('Authentication error: User not found'));
      }

      if (!user.isActive) {
        return next(new Error('Authentication error: Account is inactive'));
      }

      if (user.isBlocked) {
        return next(new Error('Authentication error: Account has been blocked'));
      }

      if (decoded.tokenVersion !== undefined && decoded.tokenVersion !== (user.tokenVersion || 0)) {
        return next(new Error('Authentication error: Session is expired'));
      }

      socket.user = user;
      next();
    } catch (err) {
      return next(new Error('Authentication error: Token is invalid or expired'));
    }
  });

  io.on('connection', (socket) => {
    const userId = socket.user._id.toString();
    const roleName = socket.user.role;

    // Securely join room parameters automatically
    socket.join(userId);
    socket.join(roleName);
    console.log(`Socket Client Connected: ${socket.id} (User: ${userId}, Role: ${roleName})`);

    socket.on('disconnect', () => {
      console.log(`Socket Client Disconnected: ${socket.id} (User: ${userId})`);
    });
  });

  return io;
};

/**
 * Get initialized Socket.IO instance
 * @returns {Object} io
 */
export const getIO = () => {
  if (!io) {
    throw new Error('Socket.IO is not initialized! Call initSocket first.');
  }
  return io;
};

/**
 * Force logout a specific user immediately, emit warning event, and close sockets
 * @param {String} userId - User ID to disconnect
 */
export const emitForceLogout = (userId) => {
  if (io) {
    const roomName = userId.toString();
    
    // Broadcast forceLogout warning event
    io.to(roomName).emit('forceLogout', {
      message: 'Your account has been blocked or deactivated by the administrator.',
    });

    // Invalidate and sever all active socket links in the user adapter room
    const userRoom = io.sockets.adapter.rooms.get(roomName);
    if (userRoom) {
      const socketIds = Array.from(userRoom);
      socketIds.forEach((socketId) => {
        const socket = io.sockets.sockets.get(socketId);
        if (socket) {
          socket.disconnect(true);
        }
      });
    }
  }
};

/**
 * Broadcast notifications to a specific room (user, role, or general)
 * @param {String} room - Room name/User ID
 * @param {String} event - Event name
 * @param {Object} data - Payload
 */
export const broadcastToRoom = (room, event, data) => {
  if (io) {
    io.to(room).emit(event, data);
  }
};

