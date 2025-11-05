import jwt from 'jsonwebtoken';
import { User } from '../models/User.models.js';
import { ApiError } from '../APIStatus/APIError.js';

/**
 * Socket Authentication - Handles authentication for socket connections
 */
export class SocketAuthentication {
  #logger;

  constructor({ logger }) {
    this.#logger = logger;
  }

  /**
   * Authenticates a socket connection
   * @param {Socket} socket - Socket.IO socket instance
   * @returns {Promise<User>} - Authenticated user object
   */
  async authenticate(socket) {
    try {
      // Get token from handshake auth or query
      const token =
        socket.handshake.auth?.token ||
        socket.handshake.query?.token ||
        socket.handshake.headers?.authorization?.replace('Bearer ', '');

      if (!token) {
        throw new ApiError(401, 'Authentication token required');
      }

      // Verify JWT token
      const decodedToken = jwt.verify(
        token,
        process.env.ACCESS_TOKEN_SECRET
      );

      if (!decodedToken?._id) {
        throw new ApiError(401, 'Invalid token payload');
      }

      // Fetch user from database
      const user = await User.findById(decodedToken._id).select(
        '-password -refreshToken -emailVerificationToken -emailVerificationExpiry'
      );

      if (!user) {
        throw new ApiError(401, 'User not found');
      }

      this.#logger?.debug('Socket authenticated', {
        socketId: socket.id,
        userId: user._id.toString(),
      });

      return user;
    } catch (error) {
      this.#logger?.error('Socket authentication error', {
        socketId: socket.id,
        error: error.message,
      });

      if (error instanceof ApiError) {
        throw error;
      }

      // Handle JWT errors
      if (error.name === 'JsonWebTokenError') {
        throw new ApiError(401, 'Invalid token');
      }

      if (error.name === 'TokenExpiredError') {
        throw new ApiError(401, 'Token expired');
      }

      throw new ApiError(401, 'Authentication failed');
    }
  }
}

