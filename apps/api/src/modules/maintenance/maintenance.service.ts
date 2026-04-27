import { HttpStatus, Injectable } from '@nestjs/common';
import {
  EquipmentStatus,
  ItemType,
  MaintenanceStatus,
  MaintenanceType,
  MovementSource,
  MovementType,
  Prisma,
} from '@prisma/client';

import { BusinessException } from '../../common/exceptions/business.exception';
import { BusinessErrorCode, WS_EVENTS } from '@kardex/types';
import { PrismaService } from '../../prisma/prisma.service';
import { RealtimeService } from '../realtime/realtime.service';
import type {
  AddMaintenanceItemDto,
  CancelMaintenanceDto,
  CompleteMaintenanceDto,
  CreateMaintenanceDto,
  StartMaintenanceDto,
} from './dto/maintenance.dto';

const MAINTENANCE_INCLUDE = {
  equipment: {
    select: {
      id: true,
      code: true,
      name: true,
      type: true,
      status: true,
      currentCount: true,
      countType: true,
    },
  },
  technician: { select: { id: true, firstName: true, lastName: true } },
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
      warehouse: { select: { id: true, code: true, name: true } },
      movement: { select: { id: true, code: true } },
    },
  },
} as const;

@Injectable()
export class MaintenanceService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly realtime: RealtimeService,
  ) {}

  async findAll(query: {
    page?: number;
    pageSize?: number;
    equipmentId?: string;
    status?: MaintenanceStatus;
    type?: MaintenanceType;
    search?: string;
  }) {
    const { page = 1, pageSize = 20, equipmentId, status, type, search } = query;
    const skip = (page - 1) * pageSize;

    const and: Prisma.MaintenanceWhereInput[] = [];
    if (equipmentId) and.push({ equipmentId });
    if (status) and.push({ status });
    if (type) and.push({ type });
    if (search) {
      and.push({
        OR: [
          { code: { contains: search, mode: 'insensitive' } },
          { description: { contains: search, mode: 'insensitive' } },
          { equipment: { name: { contains: search, mode: 'insensitive' } } },
        ],
      });
    }

    const where: Prisma.MaintenanceWhereInput = and.length > 0 ? { AND: and } : {};

    const [items, total] = await Promise.all([
      this.prisma.maintenance.findMany({
        where,
        include: MAINTENANCE_INCLUDE,
        orderBy: [{ status: 'asc' }, { createdAt: 'desc' }],
        skip,
        take: pageSize,
      }),
      this.prisma.maintenance.count({ where }),
    ]);

    return { items, total, page, pageSize, totalPages: Math.ceil(total / pageSize) };
  }

  async findOne(id: string) {
    const maintenance = await this.prisma.maintenance.findUnique({
      where: { id },
      include: MAINTENANCE_INCLUDE,
    });
    if (!maintenance) {
      throw new BusinessException(
        BusinessErrorCode.NOT_FOUND,
        'Mantenimiento no encontrado',
        HttpStatus.NOT_FOUND,
      );
    }
    return maintenance;
  }

  async create(dto: CreateMaintenanceDto) {
    const equipment = await this.prisma.equipment.findFirst({
      where: { id: dto.equipmentId, deletedAt: null },
    });
    if (!equipment) {
      throw new BusinessException(
        BusinessErrorCode.NOT_FOUND,
        'Equipo no encontrado',
        HttpStatus.NOT_FOUND,
      );
    }
    if (equipment.status === EquipmentStatus.BAJA) {
      throw new BusinessException(
        BusinessErrorCode.INVALID_INPUT,
        'No se puede programar mantenimiento de un equipo en BAJA',
        HttpStatus.BAD_REQUEST,
      );
    }

    const seq = await this.prisma.maintenanceSequence.upsert({
      where: { id: 1 },
      update: { lastValue: { increment: 1 } },
      create: { id: 1, lastValue: 1 },
    });
    const code = `MAN-${String(seq.lastValue).padStart(5, '0')}`;

    return this.prisma.maintenance.create({
      data: {
        code,
        equipmentId: dto.equipmentId,
        type: dto.type,
        description: dto.description,
        scheduledDate: dto.scheduledDate ? new Date(dto.scheduledDate) : null,
        scheduledCount: dto.scheduledCount,
        technicianId: dto.technicianId,
        notes: dto.notes,
        status: MaintenanceStatus.PROGRAMADO,
      },
      include: MAINTENANCE_INCLUDE,
    });
  }

  async start(id: string, dto: StartMaintenanceDto) {
    const maintenance = await this.findOne(id);
    if (maintenance.status !== MaintenanceStatus.PROGRAMADO) {
      throw new BusinessException(
        BusinessErrorCode.INVALID_INPUT,
        `Solo se puede iniciar un mantenimiento PROGRAMADO (actual: ${maintenance.status})`,
        HttpStatus.CONFLICT,
      );
    }
    if (dto.countAtStart < Number(maintenance.equipment.currentCount)) {
      throw new BusinessException(
        BusinessErrorCode.INVALID_INPUT,
        `La lectura inicial (${dto.countAtStart}) no puede ser menor al valor actual del equipo (${maintenance.equipment.currentCount})`,
        HttpStatus.BAD_REQUEST,
      );
    }

    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.maintenance.update({
        where: { id },
        data: {
          status: MaintenanceStatus.EN_CURSO,
          startedAt: new Date(),
          countAtStart: dto.countAtStart,
        },
        include: MAINTENANCE_INCLUDE,
      });
      await tx.equipment.update({
        where: { id: maintenance.equipmentId },
        data: {
          status: EquipmentStatus.EN_MANTENIMIENTO,
          currentCount: dto.countAtStart,
        },
      });
      await tx.equipmentCountReading.create({
        data: {
          equipmentId: maintenance.equipmentId,
          countValue: dto.countAtStart,
          source: 'MAINTENANCE_START',
          sourceId: maintenance.code,
        },
      });
      return updated;
    });
  }

  async addItem(id: string, dto: AddMaintenanceItemDto, userId: string) {
    const maintenance = await this.findOne(id);
    if (maintenance.status !== MaintenanceStatus.EN_CURSO) {
      throw new BusinessException(
        BusinessErrorCode.INVALID_INPUT,
        `Solo se pueden añadir repuestos a un mantenimiento EN_CURSO (actual: ${maintenance.status})`,
        HttpStatus.CONFLICT,
      );
    }

    const [item, warehouse] = await Promise.all([
      this.prisma.item.findFirst({
        where: { id: dto.itemId, deletedAt: null, active: true },
      }),
      this.prisma.warehouse.findFirst({
        where: { id: dto.warehouseId, deletedAt: null, active: true },
      }),
    ]);
    if (!item) {
      throw new BusinessException(
        BusinessErrorCode.ITEM_NOT_FOUND,
        'Ítem no encontrado',
        HttpStatus.NOT_FOUND,
      );
    }
    if (item.type !== ItemType.REPUESTO && item.type !== ItemType.MATERIAL) {
      throw new BusinessException(
        BusinessErrorCode.INVALID_INPUT,
        'Solo se pueden usar ítems tipo REPUESTO o MATERIAL en un mantenimiento',
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

    return this.prisma
      .$transaction(async (tx) => {
        const stock = await tx.stock.findUnique({
          where: {
            itemId_warehouseId: { itemId: dto.itemId, warehouseId: dto.warehouseId },
          },
        });
        if (!stock) {
          throw new BusinessException(
            BusinessErrorCode.STOCK_INSUFFICIENT,
            'No hay stock registrado',
            HttpStatus.CONFLICT,
          );
        }
        const stockBefore = Number(stock.quantity);
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
            version: stock.version,
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

        const movSeq = await tx.movementSequence.upsert({
          where: { type: MovementType.SALIDA },
          update: { lastValue: { increment: 1 } },
          create: { type: MovementType.SALIDA, lastValue: 1 },
        });
        const movementCode = `SAL-${String(movSeq.lastValue).padStart(5, '0')}`;

        const movement = await tx.movement.create({
          data: {
            code: movementCode,
            type: MovementType.SALIDA,
            source: MovementSource.CONSUMO,
            warehouseId: dto.warehouseId,
            userId,
            notes: `Mantenimiento ${maintenance.code}: ${item.name}`,
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

        const maintenanceItem = await tx.maintenanceItem.create({
          data: {
            maintenanceId: id,
            itemId: dto.itemId,
            warehouseId: dto.warehouseId,
            quantity: dto.quantity,
            movementId: movement.id,
            notes: dto.notes,
          },
        });

        return maintenanceItem;
      })
      .then(async (mi) => {
        // Emit WS fuera de la transacción
        this.realtime.emitToWarehouse(dto.warehouseId, WS_EVENTS.STOCK_CHANGED, {
          warehouseId: dto.warehouseId,
          movementId: mi.movementId,
          type: MovementType.SALIDA,
          itemIds: [dto.itemId],
        });
        return mi;
      });
  }

  async complete(id: string, dto: CompleteMaintenanceDto) {
    const maintenance = await this.findOne(id);
    if (maintenance.status !== MaintenanceStatus.EN_CURSO) {
      throw new BusinessException(
        BusinessErrorCode.INVALID_INPUT,
        `Solo se puede completar un mantenimiento EN_CURSO (actual: ${maintenance.status})`,
        HttpStatus.CONFLICT,
      );
    }
    if (
      maintenance.countAtStart != null &&
      dto.countAtEnd < Number(maintenance.countAtStart)
    ) {
      throw new BusinessException(
        BusinessErrorCode.INVALID_INPUT,
        `La lectura final (${dto.countAtEnd}) no puede ser menor a la inicial (${maintenance.countAtStart})`,
        HttpStatus.BAD_REQUEST,
      );
    }

    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.maintenance.update({
        where: { id },
        data: {
          status: MaintenanceStatus.COMPLETADO,
          completedAt: new Date(),
          countAtEnd: dto.countAtEnd,
          totalCost: dto.totalCost,
          notes: dto.notes ?? maintenance.notes,
        },
        include: MAINTENANCE_INCLUDE,
      });
      await tx.equipment.update({
        where: { id: maintenance.equipmentId },
        data: {
          status: EquipmentStatus.OPERATIVO,
          currentCount: dto.countAtEnd,
        },
      });
      await tx.equipmentCountReading.create({
        data: {
          equipmentId: maintenance.equipmentId,
          countValue: dto.countAtEnd,
          source: 'MAINTENANCE_END',
          sourceId: maintenance.code,
        },
      });
      return updated;
    });
  }

  async cancel(id: string, dto: CancelMaintenanceDto) {
    const maintenance = await this.findOne(id);
    if (maintenance.status === MaintenanceStatus.COMPLETADO) {
      throw new BusinessException(
        BusinessErrorCode.INVALID_INPUT,
        'No se puede cancelar un mantenimiento COMPLETADO',
        HttpStatus.CONFLICT,
      );
    }
    if (maintenance.status === MaintenanceStatus.CANCELADO) {
      throw new BusinessException(
        BusinessErrorCode.INVALID_INPUT,
        'Mantenimiento ya está CANCELADO',
        HttpStatus.CONFLICT,
      );
    }

    // Capturar estado previo antes del update (el objeto puede ser mutado por la tx)
    const wasInProgress = maintenance.status === MaintenanceStatus.EN_CURSO;
    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.maintenance.update({
        where: { id },
        data: {
          status: MaintenanceStatus.CANCELADO,
          cancelledAt: new Date(),
          cancelReason: dto.reason,
        },
        include: MAINTENANCE_INCLUDE,
      });
      // Si estaba EN_CURSO, el equipo vuelve a OPERATIVO
      if (wasInProgress) {
        await tx.equipment.update({
          where: { id: maintenance.equipmentId },
          data: { status: EquipmentStatus.OPERATIVO },
        });
      }
      return updated;
    });
  }
}
