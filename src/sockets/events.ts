// Socket event name constants. Avoid magic strings scattered across files.
export const SOCKET_EVENTS = {
  STOCK_UPDATED: 'STOCK_UPDATED',
  RESERVATION_EXPIRED: 'RESERVATION_EXPIRED',
} as const;

export type SocketEventName = (typeof SOCKET_EVENTS)[keyof typeof SOCKET_EVENTS];