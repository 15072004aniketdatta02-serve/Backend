import { Server } from 'socket.io';
import { SocketAuthentication } from './SocketAuthentication.js';
import { SocketEventHandlers } from './SocketEventHandlers.js';
import { Logger } from '../logger/logger.js';

/**
 * Socket Manager - Main class for managing WebSocket connections
 */
export class SocketManager {
  #io;
  #logger;
  #authenticator;
  #eventHandlers;
  #connectedUsers = new Map(); // userId -> Set of socketIds
  #socketToUser = new Map(); // socketId -> userId

  /**
   * @param {Object} options - Configuration options
   * @param {http.Server} options.server - HTTP server instance
   * @param {Object} options.cors - CORS configuration
   * @param {Logger} options.logger - Logger instance
   */
  constructor({ server, cors, logger }) {
    this.#logger = logger || new Logger('socket', 'socket.log');
    this.#authenticator = new SocketAuthentication({ logger: this.#logger });
    this.#eventHandlers = new SocketEventHandlers({ logger: this.#logger });

    // Initialize Socket.IO server
    this.#io = new Server(server, {
      cors: {
        origin: cors?.origin || process.env.CORS_ORIGIN?.split(',') || '*',
        credentials: true,
        methods: ['GET', 'POST'],
      },
      transports: ['websocket', 'polling'],
      pingTimeout: 60000,
      pingInterval: 25000,
    });

    this.#setupEventHandlers();
  }

  /**
   * Sets up connection and disconnection handlers
   */
  #setupEventHandlers() {
    this.#io.use(async (socket, next) => {
      try {
        const user = await this.#authenticator.authenticate(socket);
        socket.data.user = user;
        socket.data.userId = user._id.toString();
        next();
      } catch (error) {
        this.#logger.error('Socket authentication failed', {
          error: error.message,
          socketId: socket.id,
        });
        next(error);
      }
    });

    this.#io.on('connection', (socket) => {
      this.#handleConnection(socket);
    });

    // Handle server shutdown gracefully
    process.on('SIGTERM', () => this.#gracefulShutdown());
    process.on('SIGINT', () => this.#gracefulShutdown());
  }

  /**
   * Handles new socket connection
   */
  #handleConnection(socket) {
    const { user, userId } = socket.data;
    const socketId = socket.id;

    // Track user connections
    if (!this.#connectedUsers.has(userId)) {
      this.#connectedUsers.set(userId, new Set());
    }
    this.#connectedUsers.get(userId).add(socketId);
    this.#socketToUser.set(socketId, userId);

    this.#logger.info('Socket connected', {
      socketId,
      userId,
      username: user.username || user.email,
      totalConnections: this.#io.engine.clientsCount,
    });

    // Join user's personal room
    socket.join(`user:${userId}`);

    // Emit connection status to user
    socket.emit('connected', {
      socketId,
      userId,
      timestamp: new Date().toISOString(),
    });

    // Register event handlers
    this.#registerSocketHandlers(socket);

    // Handle disconnection
    socket.on('disconnect', (reason) => {
      this.#handleDisconnection(socket, reason);
    });

    // Handle errors
    socket.on('error', (error) => {
      this.#logger.error('Socket error', {
        socketId,
        userId,
        error: error.message,
      });
    });
  }

  /**
   * Registers event handlers for a socket
   */
  #registerSocketHandlers(socket) {
    const { userId } = socket.data;

    // Join project room
    socket.on('join:project', async (data) => {
      await this.#eventHandlers.handleJoinProject(socket, data);
    });

    // Leave project room
    socket.on('leave:project', async (data) => {
      await this.#eventHandlers.handleLeaveProject(socket, data);
    });

    // Task events
    socket.on('task:created', async (data) => {
      await this.#eventHandlers.handleTaskCreated(socket, data);
    });

    socket.on('task:updated', async (data) => {
      await this.#eventHandlers.handleTaskUpdated(socket, data);
    });

    socket.on('task:deleted', async (data) => {
      await this.#eventHandlers.handleTaskDeleted(socket, data);
    });

    // Project events
    socket.on('project:created', async (data) => {
      await this.#eventHandlers.handleProjectCreated(socket, data);
    });

    socket.on('project:updated', async (data) => {
      await this.#eventHandlers.handleProjectUpdated(socket, data);
    });

    // Note events
    socket.on('note:created', async (data) => {
      await this.#eventHandlers.handleNoteCreated(socket, data);
    });

    // Typing indicators
    socket.on('typing:start', async (data) => {
      await this.#eventHandlers.handleTypingStart(socket, data);
    });

    socket.on('typing:stop', async (data) => {
      await this.#eventHandlers.handleTypingStop(socket, data);
    });

    // Ping/pong for connection health
    socket.on('ping', () => {
      socket.emit('pong', { timestamp: Date.now() });
    });
  }

  /**
   * Handles socket disconnection
   */
  #handleDisconnection(socket, reason) {
    const { userId } = socket.data;
    const socketId = socket.id;

    // Remove from tracking
    const userSockets = this.#connectedUsers.get(userId);
    if (userSockets) {
      userSockets.delete(socketId);
      if (userSockets.size === 0) {
        this.#connectedUsers.delete(userId);
      }
    }
    this.#socketToUser.delete(socketId);

    this.#logger.info('Socket disconnected', {
      socketId,
      userId,
      reason,
      totalConnections: this.#io.engine.clientsCount,
    });
  }

  /**
   * Emits an event to a specific user
   */
  emitToUser(userId, event, data) {
    const userSockets = this.#connectedUsers.get(userId?.toString());
    if (userSockets && userSockets.size > 0) {
      userSockets.forEach((socketId) => {
        this.#io.to(socketId).emit(event, data);
      });
      return true;
    }
    return false;
  }

  /**
   * Emits an event to all users in a project room
   */
  emitToProject(projectId, event, data, excludeUserId = null) {
    const room = `project:${projectId}`;
    if (excludeUserId) {
      // Emit to all except the excluded user
      this.#io.to(room).except(`user:${excludeUserId}`).emit(event, data);
    } else {
      this.#io.to(room).emit(event, data);
    }
    return true;
  }

  /**
   * Emits an event to all connected users
   */
  emitToAll(event, data) {
    this.#io.emit(event, data);
  }

  /**
   * Gets the number of connected users
   */
  getConnectedUsersCount() {
    return this.#connectedUsers.size;
  }

  /**
   * Gets the total number of socket connections
   */
  getTotalConnections() {
    return this.#io.engine.clientsCount || 0;
  }

  /**
   * Gets all connected user IDs
   */
  getConnectedUserIds() {
    return Array.from(this.#connectedUsers.keys());
  }

  /**
   * Checks if a user is currently connected
   */
  isUserConnected(userId) {
    return this.#connectedUsers.has(userId?.toString());
  }

  /**
   * Gets the Socket.IO instance (for advanced usage)
   */
  getIO() {
    return this.#io;
  }

  /**
   * Gracefully shuts down the socket server
   */
  async #gracefulShutdown() {
    this.#logger.info('Shutting down socket server gracefully');
    
    // Disconnect all sockets
    this.#io.disconnectSockets(true);
    
    // Close the server
    this.#io.close(() => {
      this.#logger.info('Socket server closed');
    });
  }
}

