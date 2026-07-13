import { io } from 'socket.io-client';

// In production, use current origin without explicit URL
const getSocketUrl = () => {
  // Explicit URL always wins, in any mode
  if (import.meta.env.VITE_API_URL && import.meta.env.VITE_API_URL.trim() !== '') {
    return import.meta.env.VITE_API_URL;
  }

  // Dev server with no explicit URL configured - assume local backend
  if (import.meta.env.DEV) {
    return 'http://localhost:5004';
  }

  // Production build with no explicit URL - use current page origin
  // rather than risk a stale/wrong default (e.g. a dev-only localhost URL).
  console.log('Using current origin for Socket.IO connection');
  return undefined;
};

const socketUrl = getSocketUrl();
console.log('Socket.IO URL:', socketUrl || 'current origin');

const socket = io(socketUrl, {
  path: '/socket.io/',
  transports: ['polling', 'websocket'], // Try polling first, then websocket
  withCredentials: true,
});

socket.on('connect', () => console.log('Connected to Socket.io Server'));
socket.on('response', (data) => console.log('Received:', data));
socket.on('connect_error', (error) =>
  console.error('Connection Error:', error)
);
// the backend emits a generic 'error' event for rejected actions (e.g. a non-host
// trying to end/force-advance the game); without a handler these fail completely
// silently on the client, so surface them instead of leaving the user guessing
socket.on('error', (data) => {
  console.error('Socket error:', data);
  if (data && data.message) {
    alert(data.message);
  }
});

export default socket;
