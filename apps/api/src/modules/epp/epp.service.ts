import { HttpStatus, Injectable } from '@nestjs/common';
import {
  ItemType,
  MovementSource,
  MovementType,
  Prisma,
  WarehouseType,
} from '@prisma/client';

import { BusinessException } from '../../common/exceptions/business.exception';
import { BusinessErrorCode, WS_EVENTS } from '@kardex/types';
import { PrismaService } from '../../prisma/prisma.service';
import { RealtimeService } from '../realtime/realtime.service';
import { assertWarehouseScope } from '../../common/utils/scope';
import type { AssignEPPDto, ReplaceEPPDto } from './dto/epp.dto';

const EPP_INCLUDE = {
  worker: {
    select: {
      id: true,
      firstName: true,
      lastName: true,
      documentType: true,
      documentNumber: true,
      phone: true,
      specialty: { select: { id: true, code: true, name: true } },
      obra: { select: { id: true, code: true, name: true } },
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
  assignedBy: { select: { id: true, firstName: true, lastName: true } },
  movement: { select: { id: true, code: true } },
  replaces: {
    select: {
      id: true,
      code: true,
      assignedAt: true,
      replacementReason: true,
    },
  },
} as const;

@Injectable()
export class EPPService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly realtime: RealtimeService,
  ) {}

  async findAll(query: {
    page?: number;
    pageSize?: number;
    workerId?: string;
    itemId?: string;
    warehouseId?: string;
    obraId?: string;
    dateFrom?: string;
    dateTo?: string;
    search?: string;
  }) {
    const {
      page = 1,
      pageSize = 20,
      workerId,
      itemId,
      warehouseId,
      obraId,
      dateFrom,
      dateTo,
      search,
    } = query;
    const skip = (page - 1) * pageSize;

    const andConditions: Prisma.EPPAssignmentWhereInput[] = [];
    if (workerId) andConditions.push({ workerId });
    if (itemId) andConditions.push({ itemId });
    if (warehouseId) andConditions.push({ warehouseId });
    if (obraId) andConditions.push({ warehouse: { obraId } });
    if (dateFrom) andConditions.push({ assignedAt: { gte: new Date(dateFrom) } });
    if (dateTo) andConditions.push({ assignedAt: { lte: new Date(dateTo) } });
    if (search) {
      andConditions.push({
        OR: [
          { code: { contains: search, mode: 'insensitive' } },
          {
            item: {
              OR: [
                { code: { contains: search, mode: 'insensitive' } },
                { name: { contains: search, mode: 'insensitive' } },
              ],
            },
          },
          {
            worker: {
              OR: [
                { firstName: { contains: search, mode: 'insensitive' } },
                { lastName: { contains: search, mode: 'insensitive' } },
                { documentNumber: { contains: search } },
              ],
            },
          },
        ],
      });
    }

    const where: Prisma.EPPAssignmentWhereInput =
      andConditions.length > 0 ? { AND: andConditions } : {};

    const [items, total] = await Promise.all([
      this.prisma.ePPAssignment.findMany({
        where,
        include: EPP_INCLUDE,
        orderBy: { assignedAt: 'desc' },
        skip,
        take: pageSize,
      }),
      this.prisma.ePPAssignment.count({ where }),
    ]);

    return { items, total, page, pageSize, totalPages: Math.ceil(total / pageSize) };
  }

  async findOne(id: string) {
    const assignment = await this.prisma.ePPAssignment.findUnique({
      where: { id },
      include: EPP_INCLUDE,
    });
    if (!assignment) {
      throw new BusinessException(
        BusinessErrorCode.NOT_FOUND,
        'Asignación de EPP no encontrada',
        HttpStatus.NOT_FOUND,
      );
    }
    return assignment;
  }

  async findByWorker(workerId: string) {
    return this.prisma.ePPAssignment.findMany({
      where: { workerId },
      include: EPP_INCLUDE,
      orderBy: { assignedAt: 'desc' },
    });
  }

  async assign(dto: AssignEPPDto, userId: string) {
    const { workerId, itemId, warehouseId, quantity } = dto;
    await assertWarehouseScope(this.prisma, userId, warehouseId);
    await this.validateAssignment({ workerId, itemId, warehouseId, quantity });
    return this.createAssignmentTransaction({
      workerId,
      itemId,
      warehouseId,
      quantity,
      userId,
      notes: dto.notes,
    });
  }

  async replace(assignmentId: string, dto: ReplaceEPPDto, userId: string) {
    const original = await this.findOne(assignmentId);
    await assertWarehouseScope(this.prisma, userId, dto.warehouseId);

    // Validaciones de reposición
    await this.validateAssignment({
      workerId: original.workerId,
      itemId: original.itemId,
      warehouseId: dto.warehouseId,
      quantity: dto.quantity,
    });

    return this.createAssignmentTransaction({
      workerId: original.workerId,
      itemId: original.itemId,
      warehouseId: dto.warehouseId,
      quantity: dto.quantity,
      userId,
      notes: dto.notes,
      replacesId: original.id,
      replacementReason: dto.reason,
    });
  }

  /**
   * Valida: item existe y es tipo EPP · warehouse es de obra · worker pertenece a la obra · stock suficiente
   */
  private async validateAssignment({
    workerId,
    itemId,
    warehouseId,
    quantity,
  }: {
    workerId: string;
    itemId: string;
    warehouseId: string;
    quantity: number;
  }) {
    const [item, warehouse, worker] = await Promise.all([
      this.prisma.item.findFirst({
        where: { id: itemId, deletedAt: null, active: true },
      }),
      this.prisma.warehouse.findFirst({
        where: { id: warehouseId, deletedAt: null, active: true },
      }),
      this.prisma.worker.findFirst({
        where: { id: workerId, deletedAt: null, active: true },
      }),
    ]);

    if (!item) {
      throw new BusinessException(
        BusinessErrorCode.ITEM_NOT_FOUND,
        'Ítem no encontrado o inactivo',
        HttpStatus.NOT_FOUND,
      );
    }
    if (item.type !== ItemType.EPP) {
      throw new BusinessException(
        BusinessErrorCode.INVALID_INPUT,
        'Solo se pueden asignar ítems de tipo EPP',
        HttpStatus.BAD_REQUEST,
      );
    }

    if (!warehouse) {
      throw new BusinessException(
        BusinessErrorCode.WAREHOUSE_NOT_FOUND,
        'Almacén no encontrado o inactivo',
        HttpStatus.NOT_FOUND,
      );
    }
    if (warehouse.type !== WarehouseType.OBRA) {
      throw new BusinessException(
        BusinessErrorCode.INVALID_INPUT,
        'El EPP solo se entrega desde un Almacén de Obra (no desde Principal)',
        HttpStatus.BAD_REQUEST,
      );
    }
    if (!warehouse.obraId) {
      throw new BusinessException(
        BusinessErrorCode.INVALID_INPUT,
        'El almacén no tiene obra asociada',
        HttpStatus.BAD_REQUEST,
      );
    }

    if (!worker) {
      throw new BusinessException(
        BusinessErrorCode.WORKER_NOT_FOUND,
        'Empleado no encontrado o inactivo',
        HttpStatus.NOT_FOUND,
      );
    }
    if (worker.obraId && worker.obraId !== warehouse.obraId) {
      throw new BusinessException(
        BusinessErrorCode.INVALID_INPUT,
        'El empleado está asignado a otra obra distinta',
        HttpStatus.BAD_REQUEST,
      );
    }

    const stock = await this.prisma.stock.findUnique({
      where: { itemId_warehouseId: { itemId, warehouseId } },
    });
    const available = Number(stock?.quantity ?? 0);
    if (quantity > available) {
      throw new BusinessException(
        BusinessErrorCode.STOCK_INSUFFICIENT,
        `Stock insuficiente de "${item.name}" en este almacén. Disponible: ${available}, solicitado: ${quantity}.`,
        HttpStatus.CONFLICT,
      );
    }
  }

  /**
   * Crea asignación + SALIDA (Movement) + actualiza stock en una transacción atómica.
   * Emite WebSocket STOCK_CHANGED al finalizar.
   */
  private async createAssignmentTransaction(params: {
    workerId: string;
    itemId: string;
    warehouseId: string;
    quantity: number;
    userId: string;
    notes?: string;
    replacesId?: string;
    replacementReason?: Prisma.EPPAssignmentCreateInput['replacementReason'];
  }) {
    const {
      workerId,
      itemId,
      warehouseId,
      quantity,
      userId,
      notes,
      replacesId,
      replacementReason,
    } = params;

    const result = await this.prisma.$transaction(async (tx) => {
      // 1. Re-leer stock bajo la transacción para lock optimista
      const stock = await tx.stock.findUnique({
        where: { itemId_warehouseId: { itemId, warehouseId } },
      });
      if (!stock) {
        throw new BusinessException(
          BusinessErrorCode.STOCK_INSUFFICIENT,
          'No hay stock registrado para este ítem en el almacén',
          HttpStatus.CONFLICT,
        );
      }
      const stockBefore = Number(stock.quantity);
      const stockAfter = stockBefore - quantity;
      if (stockAfter < 0) {
        throw new BusinessException(
          BusinessErrorCode.STOCK_INSUFFICIENT,
          `Stock insuficiente (disponible ${stockBefore}, solicitado ${quantity})`,
          HttpStatus.CONFLICT,
        );
      }

      // 2. Update con optimistic locking
      const updated = await tx.stock.updateMany({
        where: { itemId, warehouseId, version: stock.version },
        data: { quantity: stockAfter, version: { increment: 1 } },
      });
      if (updated.count === 0) {
        throw new BusinessException(
          BusinessErrorCode.STOCK_CONFLICT,
          'Conflicto de concurrencia al actualizar stock. Reintente.',
          HttpStatus.CONFLICT,
        );
      }

      // 3. Generar códigos
      const movSeq = await tx.movementSequence.upsert({
        where: { type: MovementType.SALIDA },
        update: { lastValue: { increment: 1 } },
        create: { type: MovementType.SALIDA, lastValue: 1 },
      });
      const movementCode = `SAL-${String(movSeq.lastValue).padStart(5, '0')}`;

      const eppSeq = await tx.ePPSequence.upsert({
        where: { id: 1 },
        update: { lastValue: { increment: 1 } },
        create: { id: 1, lastValue: 1 },
      });
      const assignmentCode = `EPP-${String(eppSeq.lastValue).padStart(5, '0')}`;

      // 4. Crear Movement SALIDA
      const movement = await tx.movement.create({
        data: {
          code: movementCode,
          type: MovementType.SALIDA,
          source: MovementSource.CONSUMO,
          warehouseId,
          userId,
          notes: replacesId
            ? `Reposición de EPP (${assignmentCode}) · motivo: ${replacementReason}`
            : `Entrega de EPP (${assignmentCode})`,
          items: {
            create: [
              {
                itemId,
                quantity,
                stockBefore,
                stockAfter,
              },
            ],
          },
        },
      });

      // 5. Crear EPPAssignment enlazada al movimiento
      const assignment = await tx.ePPAssignment.create({
        data: {
          code: assignmentCode,
          workerId,
          itemId,
          warehouseId,
          quantity,
          assignedById: userId,
          replacesId,
          replacementReason: replacementReason ?? null,
          movementId: movement.id,
          notes,
        },
        include: EPP_INCLUDE,
      });

      return { assignment, movementItemIds: [itemId] };
    });

    // Emisiones WS fuera de la transacción
    this.realtime.emitToWarehouse(warehouseId, WS_EVENTS.STOCK_CHANGED, {
      warehouseId,
      movementId: result.assignment.movementId,
      type: MovementType.SALIDA,
      itemIds: result.movementItemIds,
    });

    // Check de alertas fire-and-forget
    void this.checkAlerts(warehouseId, [params.itemId]);

    return result.assignment;
  }

  /**
   * Chequeo de stock bajo/crítico después de una salida.
   */
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
      // nunca bloquear el flujo principal
    }
  }
}
