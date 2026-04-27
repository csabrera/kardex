import { Injectable } from '@nestjs/common';
import type { AlertType } from '@prisma/client';

import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class AlertsService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(query: { read?: boolean; warehouseId?: string; type?: AlertType } = {}) {
    const { read, warehouseId, type } = query;
    return this.prisma.alert.findMany({
      where: {
        ...(read !== undefined && { read }),
        ...(warehouseId && { warehouseId }),
        ...(type && { type }),
      },
      include: {
        item: {
          select: {
            id: true,
            code: true,
            name: true,
            unit: { select: { abbreviation: true } },
          },
        },
        warehouse: { select: { id: true, code: true, name: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
  }

  async unreadCount() {
    const count = await this.prisma.alert.count({ where: { read: false } });
    return { count };
  }

  async markRead(id: string) {
    return this.prisma.alert.update({ where: { id }, data: { read: true } });
  }

  async markAllRead() {
    const { count } = await this.prisma.alert.updateMany({
      where: { read: false },
      data: { read: true },
    });
    return { updated: count };
  }
}
