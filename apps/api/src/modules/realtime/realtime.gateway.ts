import { Logger, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import {
  OnGatewayConnection,
  OnGatewayDisconnect,
  OnGatewayInit,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import type { Server, Socket } from 'socket.io';
import { createAdapter } from '@socket.io/redis-adapter';
import { Redis } from 'ioredis';
import {
  WS_EVENTS,
  wsRoomForRole,
  wsRoomForUser,
  wsRoomForWarehouse,
} from '@kardex/types';

import type { Configuration } from '../../config/configuration';
import type { JwtPayload } from '../auth/strategies/jwt.strategy';
import { PrismaService } from '../../prisma/prisma.service';

export interface AuthenticatedSocket extends Socket {
  data: {
    userId: string;
    role: string;
    warehouseIds: string[];
  };
}

@WebSocketGateway({
  cors: { origin: true, credentials: true },
  pingInterval: 25_000,
  pingTimeout: 60_000,
})
export class RealtimeGateway
  implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect
{
  private readonly logger = new Logger(RealtimeGateway.name);

  @WebSocketServer()
  server!: Server;

  constructor(
    private readonly jwtService: JwtService,
    private readonly config: ConfigService<Configuration, true>,
    private readonly prisma: PrismaService,
  ) {}

  async afterInit(server: Server): Promise<void> {
    const redisUrl = this.config.get<string>('redis.url', { infer: true });
    if (redisUrl) {
      try {
        const pubClient = new Redis(redisUrl, {
          lazyConnect: true,
          maxRetriesPerRequest: null,
        });
        const subClient = pubClient.duplicate();
        await Promise.all([pubClient.connect(), subClient.connect()]);
        server.adapter(createAdapter(pubClient, subClient));
        this.logger.log('Socket.IO Redis adapter enabled — ready for multi-instance');
      } catch (err) {
        this.logger.warn(
          `Redis adapter init failed, falling back to in-memory: ${String(err)}`,
        );
      }
    } else {
      this.logger.warn('REDIS_URL not set — running Socket.IO in single-instance mode');
    }
  }

  async handleConnection(client: Socket): Promise<void> {
    try {
      const token = this.extractToken(client);
      if (!token) throw new UnauthorizedException('No token');

      const payload = await this.jwtService.verifyAsync<JwtPayload>(token, {
        secret: this.config.get<string>('jwt.secret', { infer: true }),
      });

      // Resolver los warehouses a los que este usuario debe estar suscrito.
      const warehouseIds = await this.resolveWarehouseRooms(payload.sub, payload.role);

      (client as AuthenticatedSocket).data = {
        userId: payload.sub,
        role: payload.role,
        warehouseIds,
      };

      await client.join(wsRoomForUser(payload.sub));
      await client.join(wsRoomForRole(payload.role));
      for (const id of warehouseIds) {
        await client.join(wsRoomForWarehouse(id));
      }

      this.logger.debug(
        `Socket connected: ${client.id} (user=${payload.sub}, role=${payload.role}, warehouses=${warehouseIds.length})`,
      );
      client.emit(WS_EVENTS.CONNECTED, {
        userId: payload.sub,
        role: payload.role,
        warehouseIds,
      });
    } catch (err) {
      this.logger.debug(`Socket auth failed: ${String(err)}`);
      client.emit(WS_EVENTS.DISCONNECTED, { reason: 'unauthorized' });
      client.disconnect(true);
    }
  }

  handleDisconnect(client: Socket): void {
    const data = (client as AuthenticatedSocket).data;
    this.logger.debug(
      `Socket disconnected: ${client.id}${data?.userId ? ` (user=${data.userId})` : ''}`,
    );
  }

  /**
   * Calcula los IDs de warehouse a los que el usuario debe suscribirse:
   * - RESIDENTE: warehouses de las obras donde es responsable
   * - ADMIN / ALMACENERO: TODOS los warehouses activos (operan sobre todo el sistema)
   */
  private async resolveWarehouseRooms(userId: string, role: string): Promise<string[]> {
    if (role === 'RESIDENTE') {
      const warehouses = await this.prisma.warehouse.findMany({
        where: {
          deletedAt: null,
          obra: { responsibleUserId: userId, deletedAt: null },
        },
        select: { id: true },
      });
      return warehouses.map((w) => w.id);
    }

    // ADMIN / ALMACENERO operan en todo el sistema.
    const all = await this.prisma.warehouse.findMany({
      where: { deletedAt: null },
      select: { id: true },
    });
    return all.map((w) => w.id);
  }

  private extractToken(client: Socket): string | null {
    const authHeader =
      client.handshake.auth?.token ?? client.handshake.headers.authorization;
    if (!authHeader) return null;
    const raw = String(authHeader);
    return raw.startsWith('Bearer ') ? raw.slice(7) : raw;
  }
}
