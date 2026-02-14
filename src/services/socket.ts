import { io, Socket } from 'socket.io-client';

let socket: Socket | null = null;

// Use VITE_SOCKET_URL for dedicated socket server, or fallback to VITE_API_URL/localhost
const SOCKET_URL = (import.meta.env.VITE_SOCKET_URL || import.meta.env.VITE_API_URL || 'http://localhost:5000').replace(/\/api$/, '');

/**
 * Get or create the Socket.io connection
 */
export function getSocket(): Socket | null {
  return socket;
}

/**
 * Initialize Socket.io connection with authentication
 */
export function initSocket(token: string): Socket {
  if (socket?.connected) {
    return socket;
  }

  socket = io(SOCKET_URL, {
    auth: { token },
    reconnection: true,
    reconnectionAttempts: 5,
    reconnectionDelay: 1000,
    reconnectionDelayMax: 5000,
  });

  socket.on('connect', () => {
    console.log('🔌 Socket.io connected:', socket?.id);
  });

  socket.on('disconnect', (reason) => {
    console.log('🔌 Socket.io disconnected:', reason);
  });

  socket.on('connect_error', (error) => {
    console.error('🔌 Socket.io connection error:', error.message);
  });

  return socket;
}

/**
 * Disconnect Socket.io
 */
export function disconnectSocket(): void {
  if (socket) {
    socket.disconnect();
    socket = null;
    console.log('🔌 Socket.io manually disconnected');
  }
}

/**
 * Request news refresh from server
 */
export function requestNewsRefresh(): void {
  if (socket?.connected) {
    socket.emit('request-news-refresh');
  }
}
