const { Server } = require('socket.io');
const jwt = require('jsonwebtoken');
const config = require('../config/env');

let io = null;

/**
 * Initialize Socket.io with HTTP server
 */
function initSocket(httpServer) {
  io = new Server(httpServer, {
    cors: {
      origin: [config.clientUrl, 'http://localhost:5173', 'http://127.0.0.1:5173'],
      methods: ['GET', 'POST', 'PUT', 'DELETE'],
      credentials: true,
    },
    pingTimeout: 60000,
  });

  // JWT Authentication Middleware for Socket.io
  io.use((socket, next) => {
    try {
      let token = socket.handshake.auth?.token;

      // Also check headers if not in handshake auth
      if (!token && socket.handshake.headers?.authorization) {
        const parts = socket.handshake.headers.authorization.split(' ');
        if (parts.length === 2 && parts[0] === 'Bearer') {
          token = parts[1];
        }
      }

      if (!token) {
        return next(new Error('Authentication error: Token required for socket connection'));
      }

      jwt.verify(token, config.jwtSecret, (err, decoded) => {
        if (err) {
          return next(new Error('Authentication error: Invalid or expired token'));
        }
        socket.user = decoded;
        next();
      });
    } catch (err) {
      next(new Error(`Authentication error: ${err.message}`));
    }
  });

  io.on('connection', (socket) => {
    const user = socket.user;
    if (!user) {
      socket.disconnect(true);
      return;
    }

    // Join personal room for 1-to-1 notifications: e.g. "user_12"
    socket.join(`user_${user.id}`);

    // Join association room if user belongs to an association: e.g. "association_1"
    if (user.association_id) {
      socket.join(`association_${user.association_id}`);
    }

    // Join super admin room for global platform monitoring
    if (user.role === 'super_admin') {
      socket.join('super_admin');
    }

    console.log(`[Socket Connected] User ${user.name} (${user.id}) [Role: ${user.role}] Joined Rooms.`);

    // Client can join a poll room to receive real-time vote updates
    socket.on('poll:join', (pollId) => {
      if (pollId) {
        socket.join(`poll_${pollId}`);
      }
    });

    socket.on('poll:leave', (pollId) => {
      if (pollId) {
        socket.leave(`poll_${pollId}`);
      }
    });

    socket.on('disconnect', (reason) => {
      console.log(`[Socket Disconnected] User ${user.id} (${reason})`);
    });
  });

  return io;
}

/**
 * Access the initialized Socket.io instance
 */
function getIO() {
  if (!io) {
    throw new Error('Socket.io has not been initialized yet. Call initSocket(server) first.');
  }
  return io;
}

/**
 * Socket helper emission methods
 */
const socketEvents = {
  // Emit SOS alert to association members & super admins
  emitSOSAlert(associationId, alertData) {
    if (!io) return;
    io.to(`association_${associationId}`).to('super_admin').emit('sos:trigger', alertData);
  },

  // Emit SOS acknowledgement
  emitSOSAcknowledge(associationId, alertData) {
    if (!io) return;
    io.to(`association_${associationId}`).to('super_admin').emit('sos:acknowledge', alertData);
  },

  // Emit SOS resolved
  emitSOSResolve(associationId, alertData) {
    if (!io) return;
    io.to(`association_${associationId}`).to('super_admin').emit('sos:resolve', alertData);
  },

  // Emit Poll Vote and updated tally
  emitVoteUpdate(pollId, resultsData) {
    if (!io) return;
    io.to(`poll_${pollId}`).emit('vote:results', resultsData);
  },

  // Emit new user notification
  emitUserNotification(userId, notification) {
    if (!io) return;
    io.to(`user_${userId}`).emit('notification:new', notification);
  },

  // Emit new community news post
  emitNewsPost(associationId, newsData) {
    if (!io) return;
    io.to(`association_${associationId}`).emit('news:new', newsData);
  },
};

module.exports = {
  initSocket,
  getIO,
  socketEvents,
};
