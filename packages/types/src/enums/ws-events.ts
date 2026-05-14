export const WS_EVENTS = {
  // Transfer
  TRANSFER_PENDING: 'transfer.pending',
  TRANSFER_APPROVED: 'transfer.approved',
  TRANSFER_IN_TRANSIT: 'transfer.in_transit',
  TRANSFER_RECEIVED: 'transfer.received',
  TRANSFER_REJECTED: 'transfer.rejected',
  TRANSFER_CANCELLED: 'transfer.cancelled',

  // Requisition
  REQUISITION_NEW: 'requisition.new',
  REQUISITION_APPROVED: 'requisition.approved',
  REQUISITION_FULFILLED: 'requisition.fulfilled',
  REQUISITION_REJECTED: 'requisition.rejected',

  // Stock & Alerts
  STOCK_CHANGED: 'stock.changed',
  ALERT_CREATED: 'alert.created',
  ALERT_STOCK: 'alert.stock',

  // Inventory counts
  INVENTORY_COUNT_CLOSED: 'inventory_count.closed',
  INVENTORY_COUNT_CANCELLED: 'inventory_count.cancelled',

  // Session
  SESSION_KILLED: 'session.killed',

  // Connection
  CONNECTED: 'connected',
  DISCONNECTED: 'disconnected',
} as const;

export type WsEvent = (typeof WS_EVENTS)[keyof typeof WS_EVENTS];

/**
 * Razones por las que el backend puede cerrar una sesión por WebSocket.
 * Mantiene en sync con `apps/api/src/modules/users/users.service.ts`.
 */
export type SessionKilledReason = 'USER_DISABLED' | 'PASSWORD_RESET';

export interface SessionKilledPayload {
  reason: SessionKilledReason;
}

export function wsRoomForUser(userId: string): string {
  return `user:${userId}`;
}

export function wsRoomForWarehouse(warehouseId: string): string {
  return `warehouse:${warehouseId}`;
}

export function wsRoomForRole(role: string): string {
  return `role:${role}`;
}
