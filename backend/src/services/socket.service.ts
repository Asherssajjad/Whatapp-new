import { Server as SocketIOServer } from 'socket.io';
import { Server as HTTPServer } from 'http';
import { config } from '../config';

let io: SocketIOServer;

export function initSocket(server: HTTPServer): SocketIOServer {
  // Allow all origins for Socket.io (same policy as Express CORS)
  const socketOrigin = config.cors.origins.includes('*') ? '*' : config.cors.origins;

  io = new SocketIOServer(server, {
    cors: {
      origin: socketOrigin,
      methods: ['GET', 'POST'],
      credentials: socketOrigin !== '*',
    },
    pingTimeout: 60000,
  });

  io.on('connection', socket => {
    socket.on('join:org', (organizationId: string) => {
      void socket.join(organizationId);
    });

    socket.on('leave:org', (organizationId: string) => {
      void socket.leave(organizationId);
    });

    socket.on('disconnect', () => {
      // cleanup handled automatically by socket.io
    });
  });

  return io;
}

export function getIO(): SocketIOServer {
  if (!io) throw new Error('Socket.io not initialized');
  return io;
}
