import { Injectable, Logger } from '@nestjs/common';
import { WsEvent, wsRoomForRole, wsRoomForUser, wsRoomForWarehouse } from '@kardex/types';

import { RealtimeGateway } from './realtime.gateway';

@Injectable()
export class RealtimeService {
  private readonly logger = new Logger(RealtimeService.name);

  constructor(private readonly gateway: RealtimeGateway) {}

  emitToUser(userId: string, event: WsEvent, payload: unknown): void {
    this.safeEmit(wsRoomForUser(userId), event, payload);
  }

  emitToWarehouse(warehouseId: string, event: WsEvent, payload: unknown): void {
    this.safeEmit(wsRoomForWarehouse(warehouseId), event, payload);
  }

  emitToRole(role: string, event: WsEvent, payload: unknown): void {
    this.safeEmit(wsRoomForRole(role), event, payload);
  }

  emitToAll(event: WsEvent, payload: unknown): void {
    try {
      this.gateway.server?.emit(event, payload);
    } catch (err) {
      this.logger.warn(`Broadcast failed for ${event}: ${String(err)}`);
    }
  }

  private safeEmit(room: string, event: WsEvent, payload: unknown): void {
    try {
      this.gateway.server?.to(room).emit(event, payload);
    } catch (err) {
      this.logger.warn(`Emit to ${room} for ${event} failed: ${String(err)}`);
    }
  }
}
