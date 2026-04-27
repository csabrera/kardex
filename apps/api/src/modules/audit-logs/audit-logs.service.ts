import { Injectable } from '@nestjs/common';
import type { Prisma } from '@prisma/client';

import { PrismaService } from '../../prisma/prisma.service';
import { QueryAuditLogsDto } from './dto/query-audit-logs.dto';

@Injectable()
export class AuditLogsService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(query: QueryAuditLogsDto) {
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 50;

    const where: Prisma.AuditLogWhereInput = {
      ...(query.userId && { userId: query.userId }),
      ...(query.resource && { resource: query.resource }),
      ...(query.action && { action: query.action.toUpperCase() }),
      ...((query.from || query.to) && {
        createdAt: {
          ...(query.from && { gte: new Date(query.from) }),
          ...(query.to && { lte: new Date(query.to) }),
        },
      }),
    };

    const [items, total] = await this.prisma.$transaction([
      this.prisma.auditLog.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.auditLog.count({ where }),
    ]);

    const userIds = Array.from(
      new Set(items.map((i) => i.userId).filter((v): v is string => !!v)),
    );
    const users = userIds.length
      ? await this.prisma.user.findMany({
          where: { id: { in: userIds } },
          select: {
            id: true,
            firstName: true,
            lastName: true,
            documentType: true,
            documentNumber: true,
          },
        })
      : [];
    const userMap = new Map(users.map((u) => [u.id, u]));

    return {
      items: items.map((log) => ({
        ...log,
        user: log.userId ? (userMap.get(log.userId) ?? null) : null,
      })),
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    };
  }

  async distinctResources() {
    const rows = await this.prisma.auditLog.findMany({
      distinct: ['resource'],
      select: { resource: true },
      orderBy: { resource: 'asc' },
    });
    return rows.map((r) => r.resource);
  }
}
