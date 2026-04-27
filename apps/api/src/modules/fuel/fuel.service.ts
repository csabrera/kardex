import { HttpStatus, Injectable } from '@nestjs/common';
import { ItemType, MovementSource, MovementType, Prisma } from '@prisma/client';

import { BusinessException } from '../../common/exceptions/business.exception';
import { BusinessErrorCode, WS_EVENTS } from '@kardex/types';
import { PrismaService } from '../../prisma/prisma.service';
import { RealtimeService } from '../realtime/realtime.service';
import type { DispatchFuelDto } from './dto/fuel.dto';

const FUEL_INCLUDE = {
  equipment: {
    select: {
      id: true,
      code: true,
      name: true,
      type: true,
      countType: true,
      currentCount: true,
    },
  },
  item: {
    select: {
      id: true,
      code: true,
      name: true,
      type: true,
      unit: { select: { abbreviation: true } },
    },
  },
  warehouse: {
    select: {
      id: true,
      code: true,
      name: true,
      type: true,
      obra: { select: { id: true, code: true, name: true } },
    },
  },
  operatorWorker: {
    select: { id: true, firstName: true, lastName: true },
  },
  dispatchedBy: { select: { id: true, firstName: true, lastName: true } },
  movement: { select: { id: true, code: true } },
} as const;

@Injectable()
export class FuelService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly realtime: RealtimeService,
  ) {}

  async findAll(query: {
    page?: number;
    pageSize?: number;
    equipmentId?: string;
    warehouseId?: string;
    dateFrom?: string;
    dateTo?: string;
    search?: string;
  }) {
    const {
      page = 1,
      pageSize = 20,
      equipmentId,
      warehouseId,
      dateFrom,
      dateTo,
      search,
    } = query;
    const skip = (page - 1) * pageSize;

    const and: Prisma.FuelDispatchWhereInput[] = [];
    if (equipmentId) and.push({ equipmentId });
    if (warehouseId) and.push({ warehouseId });
    if (dateFrom) and.push({ createdAt: { gte: new Date(dateFrom) } });
    if (dateTo) and.push({ createdAt: { lte: new Date(dateTo) } });
    if (search) {
      and.push({
        OR: [
          { code: { contains: search, mode: 'insensitive' } },
          { equipment: { name: { contains: search, mode: 'insensitive' } } },
          { equipment: { code: { contains: search, mode: 'insensitive' } } },
        ],
      });
    }

    const where: Prisma.FuelDispatchWhereInput = and.length > 0 ? { AND: and } : {};

    const [items, total] = await Promise.all([
      this.prisma.fuelDispatch.findMany({
        where,
        include: FUEL_INCLUDE,
        orderBy: { createdAt: 'desc' },
        skip,
        take: pageSize,
      }),
      this.prisma.fuelDispatch.count({ where }),
    ]);

    return { items, total, page, pageSize, totalPages: Math.ceil(total / pageSize) };
  }

  async findOne(id: string) {
    const dispatch = await this.prisma.fuelDispatch.findUnique({
      where: { id },
      include: FUEL_INCLUDE,
    });
    if (!dispatch) {
      throw new BusinessException(
        BusinessErrorCode.NOT_FOUND,
        'Despacho no encontrado',
        HttpStatus.NOT_FOUND,
      );
    }
    return dispatch;
  }

  async dispatch(dto: DispatchFuelDto, userId: string) {
    // Validaciones previas
    const [equipment, item, warehouse] = await Promise.all([
      this.prisma.equipment.findFirst({
        where: { id: dto.equipmentId, deletedAt: null },
      }),
      this.prisma.item.findFirst({
        where: { id: dto.itemId, deletedAt: null, active: true },
      }),
      this.prisma.warehouse.findFirst({
        where: { id: dto.warehouseId, deletedAt: null, active: true },
      }),
    ]);

    if (!equipment) {
      throw new BusinessException(
        BusinessErrorCode.NOT_FOUND,
        'Equipo no encontrado',
        HttpStatus.NOT_FOUND,
      );
    }
    if (equipment.status === 'BAJA') {
      throw new BusinessException(
        BusinessErrorCode.INVALID_INPUT,
        'No se puede despachar combustible a un equipo en BAJA',
        HttpStatus.BAD_REQUEST,
      );
    }
    if (!item) {
      throw new BusinessException(
        BusinessErrorCode.ITEM_NOT_FOUND,
        'Ítem no encontrado o inactivo',
        HttpStatus.NOT_FOUND,
      );
    }
    if (item.type !== ItemType.COMBUSTIBLE) {
      throw new BusinessException(
        BusinessErrorCode.INVALID_INPUT,
        'Solo se pueden despachar ítems de tipo COMBUSTIBLE',
        HttpStatus.BAD_REQUEST,
      );
    }
    if (!warehouse) {
      throw new BusinessException(
        BusinessErrorCode.WAREHOUSE_NOT_FOUND,
        'Almacén no encontrado',
        HttpStatus.NOT_FOUND,
      );
    }

    const currentCount = Number(equipment.currentCount);
    if (dto.countReading < currentCount) {
      throw new BusinessException(
        BusinessErrorCode.INVALID_INPUT,
        `La lectura (${dto.countReading}) no puede ser menor al valor actual del equipo (${currentCount})`,
        HttpStatus.BAD_REQUEST,
      );
    }

    if (dto.operatorWorkerId) {
      const worker = await this.prisma.worker.findFirst({
        where: { id: dto.operatorWorkerId, deletedAt: null, active: true },
      });
      if (!worker) {
        throw new BusinessException(
          BusinessErrorCode.WORKER_NOT_FOUND,
          'Operador no encontrado o inactivo',
          HttpStatus.NOT_FOUND,
        );
      }
    }

    // Stock check
    const stock = await this.prisma.stock.findUnique({
      where: { itemId_warehouseId: { itemId: dto.itemId, warehouseId: dto.warehouseId } },
    });
    const available = Number(stock?.quantity ?? 0);
    if (dto.quantity > available) {
      throw new BusinessException(
        BusinessErrorCode.STOCK_INSUFFICIENT,
        `Stock insuficiente de "${item.name}". Disponible: ${available}, solicitado: ${dto.quantity}.`,
        HttpStatus.CONFLICT,
      );
    }

    const result = await this.prisma.$transaction(async (tx) => {
      // Update stock con optimistic locking
      const stockRow = await tx.stock.findUnique({
        where: {
          itemId_warehouseId: { itemId: dto.itemId, warehouseId: dto.warehouseId },
        },
      });
      if (!stockRow) {
        throw new BusinessException(
          BusinessErrorCode.STOCK_INSUFFICIENT,
          'No hay stock registrado',
          HttpStatus.CONFLICT,
        );
      }
      const stockBefore = Number(stockRow.quantity);
      const stockAfter = stockBefore - dto.quantity;
      if (stockAfter < 0) {
        throw new BusinessException(
          BusinessErrorCode.STOCK_INSUFFICIENT,
          `Stock insuficiente (${stockBefore} < ${dto.quantity})`,
          HttpStatus.CONFLICT,
        );
      }

      const updated = await tx.stock.updateMany({
        where: {
          itemId: dto.itemId,
          warehouseId: dto.warehouseId,
          version: stockRow.version,
        },
        data: { quantity: stockAfter, version: { increment: 1 } },
      });
      if (updated.count === 0) {
        throw new BusinessException(
          BusinessErrorCode.STOCK_CONFLICT,
          'Conflicto al actualizar stock. Reintente.',
          HttpStatus.CONFLICT,
        );
      }

      // Secuencias
      const movSeq = await tx.movementSequence.upsert({
        where: { type: MovementType.SALIDA },
        update: { lastValue: { increment: 1 } },
        create: { type: MovementType.SALIDA, lastValue: 1 },
      });
      const movementCode = `SAL-${String(movSeq.lastValue).padStart(5, '0')}`;

      const fuelSeq = await tx.fuelDispatchSequence.upsert({
        where: { id: 1 },
        update: { lastValue: { increment: 1 } },
        create: { id: 1, lastValue: 1 },
      });
      const fuelCode = `COMB-${String(fuelSeq.lastValue).padStart(5, '0')}`;

      // Movement
      const movement = await tx.movement.create({
        data: {
          code: movementCode,
          type: MovementType.SALIDA,
          source: MovementSource.CONSUMO,
          warehouseId: dto.warehouseId,
          userId,
          notes: `Despacho combustible (${fuelCode}) a equipo ${equipment.code}`,
          items: {
            create: [
              {
                itemId: dto.itemId,
                quantity: dto.quantity,
                stockBefore,
                stockAfter,
              },
            ],
          },
        },
      });

      // Equipment update + reading history
      await tx.equipment.update({
        where: { id: dto.equipmentId },
        data: { currentCount: dto.countReading },
      });
      await tx.equipmentCountReading.create({
        data: {
          equipmentId: dto.equipmentId,
          countValue: dto.countReading,
          source: 'FUEL_DISPATCH',
          sourceId: fuelCode,
          recordedById: userId,
        },
      });

      // FuelDispatch
      const dispatch = await tx.fuelDispatch.create({
        data: {
          code: fuelCode,
          equipmentId: dto.equipmentId,
          itemId: dto.itemId,
          warehouseId: dto.warehouseId,
          quantity: dto.quantity,
          countReading: dto.countReading,
          operatorWorkerId: dto.operatorWorkerId,
          dispatchedById: userId,
          movementId: movement.id,
          notes: dto.notes,
        },
        include: FUEL_INCLUDE,
      });

      return dispatch;
    });

    // WebSocket
    this.realtime.emitToWarehouse(dto.warehouseId, WS_EVENTS.STOCK_CHANGED, {
      warehouseId: dto.warehouseId,
      movementId: result.movementId,
      type: MovementType.SALIDA,
      itemIds: [dto.itemId],
    });

    return result;
  }

  /**
   * Resumen de consumo por equipo en un rango (últimos N días).
   */
  async consumptionSummary(days = 30) {
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
    const dispatches = await this.prisma.fuelDispatch.findMany({
      where: { createdAt: { gte: since } },
      include: {
        equipment: { select: { id: true, code: true, name: true } },
        item: {
          select: {
            id: true,
            code: true,
            name: true,
            unit: { select: { abbreviation: true } },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    const byEquipment = new Map<
      string,
      { code: string; name: string; totalQuantity: number; unit: string; count: number }
    >();
    for (const d of dispatches) {
      const existing = byEquipment.get(d.equipmentId) ?? {
        code: d.equipment.code,
        name: d.equipment.name,
        totalQuantity: 0,
        unit: d.item.unit.abbreviation,
        count: 0,
      };
      existing.totalQuantity += Number(d.quantity);
      existing.count += 1;
      byEquipment.set(d.equipmentId, existing);
    }

    return {
      days,
      total: dispatches.length,
      byEquipment: Array.from(byEquipment.entries())
        .map(([equipmentId, v]) => ({ equipmentId, ...v }))
        .sort((a, b) => b.totalQuantity - a.totalQuantity),
    };
  }
}
