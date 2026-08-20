import { Server as HttpServer } from 'node:http';
import { Server as SocketServer } from 'socket.io';
import { env } from '../config/env';
import { SOCKET_EVENTS, type StockUpdatedReason } from './events';

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
 * Emits a STOCK_UPDATED event to all connected clients.
 * Called after every transaction that changes available_stock.
 * IMPORTANT: Always call AFTER the transaction commits, never before.
 *
 * @param reason - Why the stock changed. Frontend uses this to decide
 *   whether to refresh the activity feed (only needed on 'purchase').
 */
export function emitStockUpdate(
  dropId: number,
  availableStock: number,
  reason: StockUpdatedReason = 'reserve',
): void {
  if (!io) {
    console.warn('[Socket] emitStockUpdate called before io was initialized.');
    return;
  }
  const payload = { dropId, availableStock, reason };
  io.to(`drop:${dropId}`).emit(SOCKET_EVENTS.STOCK_UPDATED, payload);
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