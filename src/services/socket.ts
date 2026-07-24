import { io, Socket } from 'socket.io-client';

type ConnectionState = 'connecting' | 'connected' | 'disconnected' | 'reconnecting';
type StateChangeCallback = (state: ConnectionState) => void;

let socket: Socket | null = null;
let currentState: ConnectionState = 'disconnected';
const stateListeners: Set<StateChangeCallback> = new Set();

const SOCKET_URL = (import.meta.env.VITE_SOCKET_URL || import.meta.env.VITE_API_URL || 'http://localhost:5000').replace(/\/api$/, '');

function setState(state: ConnectionState) {
  currentState = state;
  stateListeners.forEach(cb => cb(state));
}

export function getConnectionState(): ConnectionState {
  return currentState;
}

export function onConnectionStateChange(callback: StateChangeCallback): () => void {
  stateListeners.add(callback);
  return () => stateListeners.delete(callback);
}

export function getSocket(): Socket | null {
  return socket;
}

export function initSocket(token: string): Socket {
  if (socket?.connected) return socket;

  setState('connecting');

  socket = io(SOCKET_URL, {
    auth: { token },
    reconnection: true,
    reconnectionAttempts: Infinity,  // Never give up
    reconnectionDelay: 1000,
    reconnectionDelayMax: 10000,
    timeout: 10000,
  });

  socket.on('connect', () => setState('connected'));
  socket.on('disconnect', () => setState('disconnected'));
  socket.io.on('reconnect_attempt', () => setState('reconnecting'));
  socket.on('connect_error', (error) => {
    console.error('Socket.io connection error:', error.message);
  });

  return socket;
}

export function disconnectSocket(): void {
  if (socket) {
    socket.disconnect();
    socket = null;
    setState('disconnected');
  }
}

export function requestNewsRefresh(): void {
  if (socket?.connected) {
    socket.emit('request-news-refresh');
  }
}
