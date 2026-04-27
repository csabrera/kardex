import { HttpStatus, Injectable } from '@nestjs/common';
import {
  InventoryCountStatus,
  MovementSource,
  MovementType,
  Prisma,
} from '@prisma/client';

import { PrismaService } from '../../prisma/prisma.service';
import { BusinessException } from '../../common/exceptions/business.exception';
import { BusinessErrorCode, WS_EVENTS } from '@kardex/types';
import { RealtimeService } from '../realtime/realtime.service';
import type {
  CancelInventoryCountDto,
  CloseInventoryCountDto,
  CreateInventoryCountDto,
  QueryInventoryCountsDto,
  UpdateCountItemDto,
} from './dto/inventory-count.dto';

const COUNT_INCLUDE = {
  warehouse: { select: { id: true, code: true, name: true, type: true } },
  startedBy: { select: { id: true, firstName: true, lastName: true } },
  closedBy: { select: { id: true, firstName: true, lastName: true } },
  cancelledBy: { select: { id: true, firstName: true, lastName: true } },
  adjustmentMovement: { select: { id: true, code: true } },
  items: {
    include: {
      item: {
        select: {
          id: true,
          code: true,
          name: true,
          type: true,
          unit: { select: { abbreviation: true } },
        },
      },
    },
    orderBy: { item: { name: 'asc' } },
  },
} as const satisfies Prisma.InventoryCountInclude;

@Injectable()
export class InventoryCountsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly realtime: RealtimeService,
  ) {}

  async findAll(query: QueryInventoryCountsDto) {
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 20;

    const where: Prisma.InventoryCountWhereInput = {
      ...(query.status && { status: query.status }),
      ...(query.warehouseId && { warehouseId: query.warehouseId }),
    };

    const [items, total] = await this.prisma.$transaction([
      this.prisma.inventoryCount.findMany({
        where,
        include: {
          warehouse: { select: { id: true, code: true, name: true } },
          startedBy: { select: { id: true, firstName: true, lastName: true } },
          _count: { select: { items: true } },
        },
        orderBy: { startedAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.inventoryCount.count({ where }),
    ]);

    return {
      items,
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    };
  }

  async findOne(id: string) {
    const count = await this.prisma.inventoryCount.findUnique({
      where: { id },
      include: COUNT_INCLUDE,
    });
    if (!count) {
      throw new BusinessException(
        BusinessErrorCode.NOT_FOUND,
        'Conteo de inventario no encontrado',
        HttpStatus.NOT_FOUND,
      );
    }
    return count;
  }

  async create(dto: CreateInventoryCountDto, userId: string) {
    const warehouse = await this.prisma.warehouse.findFirst({
      where: { id: dto.warehouseId, deletedAt: null, active: true },
    });
    if (!warehouse) {
      throw new BusinessException(
        BusinessErrorCode.WAREHOUSE_NOT_FOUND,
        'Almacén no encontrado o inactivo',
        HttpStatus.NOT_FOUND,
      );
    }

    const existing = await this.prisma.inventoryCount.findFirst({
      where: {
        warehouseId: dto.warehouseId,
        status: InventoryCountStatus.IN_PROGRESS,
      },
    });
    if (existing) {
      throw new BusinessException(
        BusinessErrorCode.DUPLICATE_RESOURCE,
        `Ya existe un conteo en progreso (${existing.code}) para este almacén`,
        HttpStatus.CONFLICT,
      );
    }

    const stocks = await this.prisma.stock.findMany({
      where: { warehouseId: dto.warehouseId, item: { deletedAt: null } },
      include: { item: { select: { id: true } } },
    });

    return this.prisma.$transaction(async (tx) => {
      const seq = await tx.inventoryCountSequence.upsert({
        where: { id: 1 },
        update: { lastValue: { increment: 1 } },
        create: { id: 1, lastValue: 1 },
      });
      const code = `INV-${String(seq.lastValue).padStart(5, '0')}`;

      return tx.inventoryCount.create({
        data: {
          code,
          warehouseId: dto.warehouseId,
          startedById: userId,
          notes: dto.notes,
          items: {
            create: stocks.map((s) => ({
              itemId: s.itemId,
              expectedQty: s.quantity,
            })),
          },
        },
        include: COUNT_INCLUDE,
      });
    });
  }

  async updateItem(countId: string, itemId: string, dto: UpdateCountItemDto) {
    const count = await this.prisma.inventoryCount.findUnique({
      where: { id: countId },
      select: { id: true, status: true },
    });
    if (!count) {
      throw new BusinessException(
        BusinessErrorCode.NOT_FOUND,
        'Conteo no encontrado',
        HttpStatus.NOT_FOUND,
      );
    }
    if (count.status !== InventoryCountStatus.IN_PROGRESS) {
      throw new BusinessException(
        BusinessErrorCode.INVALID_INPUT,
        'No se puede modificar un conteo que no está en progreso',
        HttpStatus.CONFLICT,
      );
    }

    const line = await this.prisma.inventoryCountItem.findUnique({
      where: { countId_itemId: { countId, itemId } },
    });
    if (!line) {
      throw new BusinessException(
        BusinessErrorCode.NOT_FOUND,
        'Línea del conteo no encontrada',
        HttpStatus.NOT_FOUND,
      );
    }

    const variance = dto.countedQty - Number(line.expectedQty);

    return this.prisma.inventoryCountItem.update({
      where: { id: line.id },
      data: {
        countedQty: dto.countedQty,
        variance,
        notes: dto.notes,
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
      },
    });
  }

  async close(id: string, dto: CloseInventoryCountDto, userId: string) {
    const count = await this.prisma.inventoryCount.findUnique({
      where: { id },
      include: { items: true },
    });
    if (!count) {
      throw new BusinessException(
        BusinessErrorCode.NOT_FOUND,
        'Conteo no encontrado',
        HttpStatus.NOT_FOUND,
      );
    }
    if (count.status !== InventoryCountStatus.IN_PROGRESS) {
      throw new BusinessException(
        BusinessErrorCode.INVALID_INPUT,
        'Solo se pueden cerrar conteos en progreso',
        HttpStatus.CONFLICT,
      );
    }

    const adjustableLines = count.items.filter(
      (l) => l.countedQty !== null && Number(l.countedQty) !== Number(l.expectedQty),
    );

    const result = await this.prisma.$transaction(async (tx) => {
      let movementId: string | null = null;

      if (adjustableLines.length > 0) {
        const seq = await tx.movementSequence.upsert({
          where: { type: MovementType.AJUSTE },
          update: { lastValue: { increment: 1 } },
          create: { type: MovementType.AJUSTE, lastValue: 1 },
        });
        const code = `AJU-${String(seq.lastValue).padStart(5, '0')}`;

        const movementItems: {
          itemId: string;
          quantity: number;
          stockBefore: number;
          stockAfter: number;
        }[] = [];

        for (const line of adjustableLines) {
          const counted = Number(line.countedQty);
          const expected = Number(line.expectedQty);

          const stock = await tx.stock.findUnique({
            where: {
              itemId_warehouseId: {
                itemId: line.itemId,
                warehouseId: count.warehouseId,
              },
            },
          });
          if (!stock) {
            throw new BusinessException(
              BusinessErrorCode.STOCK_CONFLICT,
              'Stock no encontrado al cerrar conteo (se eliminó el ítem del almacén)',
              HttpStatus.CONFLICT,
            );
          }
          if (Number(stock.quantity) !== expected) {
            throw new BusinessException(
              BusinessErrorCode.STOCK_CONFLICT,
              `El stock del ítem cambió desde el snapshot (esperado ${expected}, actual ${Number(stock.quantity)}). Inicie un nuevo conteo.`,
              HttpStatus.CONFLICT,
            );
          }

          const updated = await tx.stock.updateMany({
            where: {
              itemId: line.itemId,
              warehouseId: count.warehouseId,
              version: stock.version,
            },
            data: {
              quantity: counted,
              version: { increment: 1 },
            },
          });
          if (updated.count === 0) {
            throw new BusinessException(
              BusinessErrorCode.STOCK_CONFLICT,
              'Conflicto de concurrencia al actualizar stock. Reintente.',
              HttpStatus.CONFLICT,
            );
          }

          movementItems.push({
            itemId: line.itemId,
            quantity: counted,
            stockBefore: expected,
            stockAfter: counted,
          });
        }

        const movement = await tx.movement.create({
          data: {
            code,
            type: MovementType.AJUSTE,
            source: MovementSource.INVENTARIO,
            warehouseId: count.warehouseId,
            userId,
            notes: `Ajuste por inventario físico ${count.code}`,
            items: { create: movementItems },
          },
        });
        movementId = movement.id;
      }

      return tx.inventoryCount.update({
        where: { id: count.id },
        data: {
          status: InventoryCountStatus.CLOSED,
          closedById: userId,
          closedAt: new Date(),
          adjustmentMovementId: movementId,
          notes: dto.notes ?? count.notes,
        },
        include: COUNT_INCLUDE,
      });
    });

    // Notificar a todos los clientes del almacén que el stock cambió y el conteo se cerró.
    this.realtime.emitToWarehouse(count.warehouseId, WS_EVENTS.INVENTORY_COUNT_CLOSED, {
      id: result.id,
      code: result.code,
      warehouseId: count.warehouseId,
      adjustmentMovement: result.adjustmentMovement,
      linesAdjusted: adjustableLines.length,
    });
    if (adjustableLines.length > 0) {
      this.realtime.emitToWarehouse(count.warehouseId, WS_EVENTS.STOCK_CHANGED, {
        warehouseId: count.warehouseId,
        source: 'INVENTARIO',
        itemIds: adjustableLines.map((l) => l.itemId),
      });
    }

    return result;
  }

  async cancel(id: string, dto: CancelInventoryCountDto, userId: string) {
    const count = await this.prisma.inventoryCount.findUnique({
      where: { id },
      select: { id: true, status: true, notes: true, warehouseId: true, code: true },
    });
    if (!count) {
      throw new BusinessException(
        BusinessErrorCode.NOT_FOUND,
        'Conteo no encontrado',
        HttpStatus.NOT_FOUND,
      );
    }
    if (count.status !== InventoryCountStatus.IN_PROGRESS) {
      throw new BusinessException(
        BusinessErrorCode.INVALID_INPUT,
        'Solo se pueden cancelar conteos en progreso',
        HttpStatus.CONFLICT,
      );
    }

    const result = await this.prisma.inventoryCount.update({
      where: { id },
      data: {
        status: InventoryCountStatus.CANCELLED,
        cancelledById: userId,
        cancelledAt: new Date(),
        notes: dto.reason
          ? `${count.notes ? count.notes + ' · ' : ''}Cancelado: ${dto.reason}`
          : count.notes,
      },
      include: COUNT_INCLUDE,
    });

    this.realtime.emitToWarehouse(
      count.warehouseId,
      WS_EVENTS.INVENTORY_COUNT_CANCELLED,
      { id: result.id, code: count.code, warehouseId: count.warehouseId },
    );

    return result;
  }
}
