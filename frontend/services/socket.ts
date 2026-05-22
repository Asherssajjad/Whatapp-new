import { io, Socket } from 'socket.io-client';

const SOCKET_URL = process.env.NEXT_PUBLIC_SOCKET_URL ?? 'http://localhost:5000';

let socket: Socket | null = null;

export function getSocket(): Socket {
  if (!socket) {
    socket = io(SOCKET_URL, {
      autoConnect: false,
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionAttempts: 10,
    });
  }
  return socket;
}

export function connectSocket(organizationId: string): Socket {
  const s = getSocket();
  if (!s.connected) s.connect();
  s.emit('join:org', organizationId);
  return s;
}

export function disconnectSocket(organizationId?: string): void {
  if (!socket) return;
  if (organizationId) socket.emit('leave:org', organizationId);
  socket.disconnect();
  socket = null;
}
