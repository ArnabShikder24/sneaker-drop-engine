import { Server as HttpServer } from 'node:http';
import { Server as SocketServer } from 'socket.io';
import { env } from '../config/env';
import { SOCKET_EVENTS } from './events';

let io: SocketServer;

/**
 * Initializes Socket.io and attaches it to the existing HTTP server.
 * Must be called once in server.ts after the HTTP server is created.
 */
export function initSocket(httpServer: HttpServer): SocketServer {
  io = new SocketServer(httpServer, {
    cors: {
      origin: env.CORS_ORIGIN,
      methods: ['GET', 'POST'],
    },
  });

  io.on('connection', (socket) => {
    console.log(`[Socket] Client connected: ${socket.id}`);

    /**
     * Allow clients to join a drop-specific room so we can scope events.
     * The frontend can call: socket.emit('JOIN_DROP', dropId)
     * Broadcasting to everyone is also fine for this assessment — rooms
     * are a "nice to have" for larger scale.
     */
    socket.on('JOIN_DROP', (dropId: number) => {
      socket.join(`drop:${dropId}`);
    });

    socket.on('disconnect', () => {
      console.log(`[Socket] Client disconnected: ${socket.id}`);
    });
  });

  console.log('✅ Socket.io initialized.');
  return io;
}

/**
 * Emits a STOCK_UPDATED event to all connected clients (or a specific drop room).
 * Called after every transaction that changes available_stock — reserve, expire, purchase.
 * IMPORTANT: Always call AFTER the transaction commits, never before.
 */
export function emitStockUpdate(dropId: number, availableStock: number): void {
  if (!io) {
    console.warn('[Socket] emitStockUpdate called before io was initialized.');
    return;
  }
  const payload = { dropId, availableStock };
  // Broadcast to the specific drop room AND global — covers clients in both
  io.to(`drop:${dropId}`).emit(SOCKET_EVENTS.STOCK_UPDATED, payload);
  // Also broadcast globally so any client not in a room still receives it
  io.emit(SOCKET_EVENTS.STOCK_UPDATED, payload);
}

/**
 * Emits a RESERVATION_EXPIRED event to a specific socket (the user whose reservation expired).
 */
export function emitReservationExpired(
  socketId: string,
  reservationId: number,
  dropId: number,
): void {
  if (!io) return;
  io.to(socketId).emit(SOCKET_EVENTS.RESERVATION_EXPIRED, { reservationId, dropId });
}

export { io };