// Socket event name constants. Avoid magic strings scattered across files.
export const SOCKET_EVENTS = {
  STOCK_UPDATED: 'STOCK_UPDATED',
  RESERVATION_EXPIRED: 'RESERVATION_EXPIRED',
} as const;

export type SocketEventName = (typeof SOCKET_EVENTS)[keyof typeof SOCKET_EVENTS];

/** Why the stock changed — lets the frontend decide whether to refresh the activity feed */
export type StockUpdatedReason = 'reserve' | 'expire' | 'purchase';