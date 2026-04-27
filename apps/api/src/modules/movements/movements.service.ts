import { Injectable, HttpStatus } from '@nestjs/common';
import { MovementSource, MovementType, Prisma, WarehouseType } from '@prisma/client';

import { PrismaService } from '../../prisma/prisma.service';
import { BusinessException } from '../../common/exceptions/business.exception';
import { BusinessErrorCode, WS_EVENTS } from '@kardex/types';
import { RealtimeService } from '../realtime/realtime.service';
import { assertWarehouseScope } from '../../common/utils/scope';
import type { CreateMovementDto } from './dto/movement.dto';

const CODE_PREFIX: Record<MovementType, string> = {
  ENTRADA: 'ENT',
  SALIDA: 'SAL',
  AJUSTE: 'AJU',
};

@Injectable()
export class MovementsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly realtime: RealtimeService,
  ) {}

  async findAll(query: {
    page?: number;
    pageSize?: number;
    type?: MovementType;
    warehouseId?: string;
    itemId?: string;
    search?: string;
  }) {
    const { page = 1, pageSize = 20, type, warehouseId, itemId, search } = query;
    const skip = (page - 1) * pageSize;

    const where: Prisma.MovementWhereInput = {
      ...(type && { type }),
      ...(warehouseId && { warehouseId }),
      ...(itemId && { items: { some: { itemId } } }),
      ...(search && {
        OR: [
          { code: { contains: search, mode: 'insensitive' } },
          { notes: { contains: search, mode: 'insensitive' } },
        ],
      }),
    };

    const [movements, total] = await Promise.all([
      this.prisma.movement.findMany({
        where,
        include: {
          warehouse: { select: { id: true, code: true, name: true } },
          user: { select: { id: true, firstName: true, lastName: true } },
          items: {
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
          },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: pageSize,
      }),
      this.prisma.movement.count({ where }),
    ]);

    return {
      items: movements,
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    };
  }

  async findOne(id: string) {
    const movement = await this.prisma.movement.findUnique({
      where: { id },
      include: {
        warehouse: { select: { id: true, code: true, name: true } },
        user: { select: { id: true, firstName: true, lastName: true } },
        items: {
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
        },
      },
    });

    if (!movement) {
      throw new BusinessException(
        BusinessErrorCode.NOT_FOUND,
        'Movimiento no encontrado',
        HttpStatus.NOT_FOUND,
      );
    }
    return movement;
  }

  async kardex(itemId: string, warehouseId?: string) {
    const entries = await this.prisma.movementItem.findMany({
      where: {
        itemId,
        movement: warehouseId ? { warehouseId } : undefined,
      },
      include: {
        movement: {
          select: {
            id: true,
            code: true,
            type: true,
            source: true,
            notes: true,
            createdAt: true,
            warehouse: { select: { id: true, code: true, name: true } },
            user: { select: { firstName: true, lastName: true } },
          },
        },
        item: {
          select: { code: true, name: true, unit: { select: { abbreviation: true } } },
        },
      },
      orderBy: { movement: { createdAt: 'asc' } },
    });

    return entries;
  }

  async create(dto: CreateMovementDto, userId: string) {
    await assertWarehouseScope(this.prisma, userId, dto.warehouseId);

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

    // Regla de negocio: las ENTRADAS (compras, devoluciones de proveedor, etc.)
    // solo pueden registrarse en el Almacén Principal. A las obras llegan por
    // transferencia, no por entrada directa.
    if (dto.type === MovementType.ENTRADA && warehouse.type !== WarehouseType.CENTRAL) {
      throw new BusinessException(
        BusinessErrorCode.INVALID_INPUT,
        'Las entradas (compras) solo se pueden registrar en el Almacén Principal. Para llevar materiales a una obra, crea una transferencia desde el Principal.',
        HttpStatus.BAD_REQUEST,
      );
    }

    // Regla: proveedor requerido solo si source=COMPRA; prohibido en cualquier otra.
    if (dto.source === MovementSource.COMPRA) {
      if (!dto.supplierId) {
        throw new BusinessException(
          BusinessErrorCode.INVALID_INPUT,
          'Proveedor requerido para movimientos con origen COMPRA.',
          HttpStatus.BAD_REQUEST,
        );
      }
      const supplier = await this.prisma.supplier.findFirst({
        where: { id: dto.supplierId, deletedAt: null, active: true },
      });
      if (!supplier) {
        throw new BusinessException(
          BusinessErrorCode.NOT_FOUND,
          'Proveedor no encontrado o inactivo.',
          HttpStatus.NOT_FOUND,
        );
      }
    } else if (dto.supplierId) {
      throw new BusinessException(
        BusinessErrorCode.INVALID_INPUT,
        'El proveedor solo aplica cuando el origen es COMPRA.',
        HttpStatus.BAD_REQUEST,
      );
    }

    // Validate all items exist and fetch their current stock
    for (const line of dto.items) {
      const item = await this.prisma.item.findFirst({
        where: { id: line.itemId, deletedAt: null },
      });
      if (!item) {
        throw new BusinessException(
          BusinessErrorCode.ITEM_NOT_FOUND,
          `Ítem ${line.itemId} no encontrado`,
          HttpStatus.NOT_FOUND,
        );
      }
    }

    return this.prisma.$transaction(async (tx) => {
      // Get/create next sequence number
      const seq = await tx.movementSequence.upsert({
        where: { type: dto.type },
        update: { lastValue: { increment: 1 } },
        create: { type: dto.type, lastValue: 1 },
      });
      const code = `${CODE_PREFIX[dto.type]}-${String(seq.lastValue).padStart(5, '0')}`;

      // Process each item with optimistic locking
      const processedItems: {
        itemId: string;
        quantity: number;
        unitCost?: number;
        stockBefore: number;
        stockAfter: number;
      }[] = [];

      for (const line of dto.items) {
        const stock = await tx.stock.findUnique({
          where: {
            itemId_warehouseId: { itemId: line.itemId, warehouseId: dto.warehouseId },
          },
        });

        if (!stock) {
          // Auto-create stock record if missing (e.g., warehouse created after item)
          await tx.stock.create({
            data: { itemId: line.itemId, warehouseId: dto.warehouseId, quantity: 0 },
          });
        }

        const currentQty = Number(stock?.quantity ?? 0);
        const version = stock?.version ?? 0;
        let newQty: number;

        if (dto.type === MovementType.ENTRADA) {
          newQty = currentQty + line.quantity;
        } else if (dto.type === MovementType.SALIDA) {
          if (currentQty < line.quantity) {
            const item = await tx.item.findUnique({
              where: { id: line.itemId },
              select: { code: true, name: true },
            });
            throw new BusinessException(
              BusinessErrorCode.STOCK_INSUFFICIENT,
              `Stock insuficiente para "${item?.name ?? line.itemId}": disponible ${currentQty}, solicitado ${line.quantity}`,
              HttpStatus.CONFLICT,
            );
          }
          newQty = currentQty - line.quantity;
        } else {
          // AJUSTE — set absolute quantity (must be >= 0)
          if (line.quantity < 0) {
            throw new BusinessException(
              BusinessErrorCode.NEGATIVE_QUANTITY_NOT_ALLOWED,
              'La cantidad del ajuste no puede ser negativa',
              HttpStatus.BAD_REQUEST,
            );
          }
          newQty = line.quantity;
        }

        // Optimistic locking: update only if version matches
        const updated = await tx.stock.updateMany({
          where: {
            itemId: line.itemId,
            warehouseId: dto.warehouseId,
            version,
          },
          data: {
            quantity: newQty,
            version: { increment: 1 },
          },
        });

        if (updated.count === 0) {
          throw new BusinessException(
            BusinessErrorCode.STOCK_CONFLICT,
            'Conflicto de concurrencia al actualizar stock. Intente nuevamente.',
            HttpStatus.CONFLICT,
          );
        }

        processedItems.push({
          itemId: line.itemId,
          quantity: line.quantity,
          unitCost: line.unitCost,
          stockBefore: currentQty,
          stockAfter: newQty,
        });
      }

      // Create movement record
      const movement = await tx.movement.create({
        data: {
          code,
          type: dto.type,
          source: dto.source,
          warehouseId: dto.warehouseId,
          userId,
          supplierId: dto.source === MovementSource.COMPRA ? dto.supplierId : null,
          notes: dto.notes,
          items: {
            create: processedItems.map((p) => ({
              itemId: p.itemId,
              quantity: p.quantity,
              unitCost: p.unitCost,
              stockBefore: p.stockBefore,
              stockAfter: p.stockAfter,
            })),
          },
        },
        include: {
          warehouse: { select: { id: true, code: true, name: true } },
          user: { select: { id: true, firstName: true, lastName: true } },
          items: {
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
          },
        },
      });

      // Notify connected clients of stock changes in this warehouse
      this.realtime.emitToWarehouse(dto.warehouseId, WS_EVENTS.STOCK_CHANGED, {
        warehouseId: dto.warehouseId,
        movementId: movement.id,
        type: movement.type,
        itemIds: processedItems.map((p) => p.itemId),
      });

      // Fire-and-forget alert checks (outside transaction is fine — stock is already updated)
      void this.checkAlerts(
        dto.warehouseId,
        processedItems.map((p) => p.itemId),
      );

      return movement;
    });
  }

  private async checkAlerts(warehouseId: string, itemIds: string[]) {
    try {
      const stocks = await this.prisma.stock.findMany({
        where: { warehouseId, itemId: { in: itemIds } },
        include: {
          item: { select: { id: true, code: true, name: true, minStock: true } },
        },
      });

      for (const s of stocks) {
        const qty = Number(s.quantity);
        const min = Number(s.item.minStock);
        if (min <= 0) continue;

        const alertType =
          qty === 0
            ? ('STOCK_CRITICO' as const)
            : qty < min
              ? ('STOCK_BAJO' as const)
              : null;
        if (!alertType) continue;

        // Avoid duplicate unread alerts
        const existing = await this.prisma.alert.findFirst({
          where: { itemId: s.itemId, warehouseId, read: false, type: alertType },
        });
        if (existing) continue;

        const alert = await this.prisma.alert.create({
          data: {
            type: alertType,
            itemId: s.itemId,
            warehouseId,
            quantity: qty,
            threshold: min,
            message:
              alertType === 'STOCK_CRITICO'
                ? `Sin stock: ${s.item.name}`
                : `Stock bajo: ${s.item.name} (${qty} < mínimo ${min})`,
          },
          include: {
            item: {
              select: {
                code: true,
                name: true,
                unit: { select: { abbreviation: true } },
              },
            },
          },
        });

        this.realtime.emitToWarehouse(warehouseId, WS_EVENTS.ALERT_CREATED, alert);
        this.realtime.emitToRole('ADMIN', WS_EVENTS.ALERT_CREATED, alert);
      }
    } catch {
      // Alert errors never break the main flow
    }
  }
}
