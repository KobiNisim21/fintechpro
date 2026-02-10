import jwt from 'jsonwebtoken';
import User from '../models/User.js';

/**
 * Socket.io authentication middleware
 * Verifies JWT token and attaches user to socket
 */
export const socketAuthMiddleware = async (socket, next) => {
    try {
        const token = socket.handshake.auth?.token ||
            socket.handshake.headers?.authorization?.replace('Bearer ', '');

        if (!token) {
            return next(new Error('Authentication required'));
        }

        // Verify token
        const decoded = jwt.verify(token, process.env.JWT_SECRET);

        // Get user from database
        const user = await User.findById(decoded.id).select('-password');
        if (!user) {
            return next(new Error('User not found'));
        }

        // Attach user to socket
        socket.user = user;
        socket.userId = user._id.toString();

        next();
    } catch (error) {
        console.error('Socket authentication error:', error.message);
        next(new Error('Invalid token'));
    }
};
