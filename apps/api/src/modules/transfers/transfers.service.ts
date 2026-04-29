import { Injectable, HttpStatus } from '@nestjs/common';
import {
  TransferStatus,
  MovementType,
  MovementSource,
  AlertType,
  Prisma,
} from '@prisma/client';

import { PrismaService } from '../../prisma/prisma.service';
import { BusinessException } from '../../common/exceptions/business.exception';
import { BusinessErrorCode, WS_EVENTS } from '@kardex/types';
import { RealtimeService } from '../realtime/realtime.service';
import { assertOverrideReasonIfNeeded } from '../../common/utils/scope';
import type {
  CancelTransferDto,
  CreateTransferDto,
  ReceiveTransferDto,
  RejectTransferDto,
} from './dto/transfer.dto';

const TRANSFER_INCLUDE = {
  fromWarehouse: { select: { id: true, code: true, name: true } },
  toWarehouse: { select: { id: true, code: true, name: true } },
  requestedBy: { select: { id: true, firstName: true, lastName: true } },
  approvedBy: { select: { id: true, firstName: true, lastName: true } },
  sentBy: { select: { id: true, firstName: true, lastName: true } },
  receivedBy: { select: { id: true, firstName: true, lastName: true } },
  rejectedBy: { select: { id: true, firstName: true, lastName: true } },
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
} as const;

@Injectable()
export class TransfersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly realtime: RealtimeService,
  ) {}

  private notify(
    event: (typeof WS_EVENTS)[keyof typeof WS_EVENTS],
    transfer: { fromWarehouseId: string; toWarehouseId: string; [k: string]: unknown },
  ) {
    this.realtime.emitToWarehouse(transfer.fromWarehouseId, event, transfer);
    if (transfer.toWarehouseId !== transfer.fromWarehouseId) {
      this.realtime.emitToWarehouse(transfer.toWarehouseId, event, transfer);
    }
    this.realtime.emitToRole('ADMIN', event, transfer);
  }

  async findAll(query: {
    page?: number;
    pageSize?: number;
    status?: TransferStatus;
    warehouseId?: string;
    itemId?: string;
    search?: string;
  }) {
    const { page = 1, pageSize = 20, status, warehouseId, itemId, search } = query;
    const skip = (page - 1) * pageSize;

    const andConditions: Prisma.TransferWhereInput[] = [];
    if (status) andConditions.push({ status });
    if (warehouseId)
      andConditions.push({
        OR: [{ fromWarehouseId: warehouseId }, { toWarehouseId: warehouseId }],
      });
    if (itemId) andConditions.push({ items: { some: { itemId } } });
    if (search)
      andConditions.push({
        OR: [
          { code: { contains: search, mode: 'insensitive' } },
          { notes: { contains: search, mode: 'insensitive' } },
        ],
      });
    const where: Prisma.TransferWhereInput =
      andConditions.length > 0 ? { AND: andConditions } : {};

    const [items, total] = await Promise.all([
      this.prisma.transfer.findMany({
        where,
        include: TRANSFER_INCLUDE,
        orderBy: { createdAt: 'desc' },
        skip,
        take: pageSize,
      }),
      this.prisma.transfer.count({ where }),
    ]);

    return { items, total, page, pageSize, totalPages: Math.ceil(total / pageSize) };
  }

  async findOne(id: string) {
    const transfer = await this.prisma.transfer.findUnique({
      where: { id },
      include: TRANSFER_INCLUDE,
    });
    if (!transfer) {
      throw new BusinessException(
        BusinessErrorCode.TRANSFER_NOT_FOUND,
        'Transferencia no encontrada',
        HttpStatus.NOT_FOUND,
      );
    }
    return transfer;
  }

  /**
   * Crea y envía la transferencia en un solo paso.
   * Descuenta el stock del almacén origen inmediatamente y pasa a EN_TRANSITO.
   * El flujo es: CREATE (en tránsito) → RECEIVE (recibida).
   */
  async create(dto: CreateTransferDto, userId: string) {
    if (dto.fromWarehouseId === dto.toWarehouseId) {
      throw new BusinessException(
        BusinessErrorCode.DUPLICATE_RESOURCE,
        'El almacén origen y destino no pueden ser el mismo',
        HttpStatus.BAD_REQUEST,
      );
    }

    const [from, to] = await Promise.all([
      this.prisma.warehouse.findFirst({
        where: { id: dto.fromWarehouseId, deletedAt: null },
      }),
      this.prisma.warehouse.findFirst({
        where: { id: dto.toWarehouseId, deletedAt: null },
      }),
    ]);

    if (!from)
      throw new BusinessException(
        BusinessErrorCode.WAREHOUSE_NOT_FOUND,
        'Almacén origen no encontrado',
        HttpStatus.NOT_FOUND,
      );
    if (!to)
      throw new BusinessException(
        BusinessErrorCode.WAREHOUSE_NOT_FOUND,
        'Almacén destino no encontrado',
        HttpStatus.NOT_FOUND,
      );

    return this.prisma.$transaction(async (tx) => {
      const seq = await tx.transferSequence.upsert({
        where: { id: 1 },
        update: { lastValue: { increment: 1 } },
        create: { id: 1, lastValue: 1 },
      });
      const code = `TRF-${String(seq.lastValue).padStart(5, '0')}`;

      // Crear transferencia directamente en EN_TRANSITO con sentQty = requestedQty
      const transfer = await tx.transfer.create({
        data: {
          code,
          fromWarehouseId: dto.fromWarehouseId,
          toWarehouseId: dto.toWarehouseId,
          requestedById: userId,
          approvedById: userId,
          approvedAt: new Date(),
          sentById: userId,
          sentAt: new Date(),
          status: TransferStatus.EN_TRANSITO,
          notes: dto.notes,
          items: {
            create: dto.items.map((i) => ({
              itemId: i.itemId,
              requestedQty: i.requestedQty,
              sentQty: i.requestedQty,
            })),
          },
        },
        include: TRANSFER_INCLUDE,
      });

      // Descontar stock del origen (SALIDA TRANSFERENCIA)
      await this.createMovementForTransfer(
        tx,
        dto.fromWarehouseId,
        MovementType.SALIDA,
        MovementSource.TRANSFERENCIA,
        dto.items.map((i) => ({ itemId: i.itemId, quantity: i.requestedQty })),
        userId,
        `Transferencia ${code} → ${to.name}`,
      );

      this.notify(WS_EVENTS.TRANSFER_IN_TRANSIT, transfer);
      return transfer;
    });
  }

  /**
   * Transferencias pendientes de confirmar para un usuario.
   * Si es RESIDENTE → devuelve transferencias EN_TRANSITO hacia almacenes cuyas obras él encabeza.
   * Si es ADMIN/ALMACENERO → devuelve todas las transferencias EN_TRANSITO (override).
   */
  async findPendingForUser(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: { role: true },
    });
    if (!user) return { items: [] };

    const isPrivileged = user.role.name === 'ADMIN' || user.role.name === 'ALMACENERO';

    const where: Prisma.TransferWhereInput = {
      status: TransferStatus.EN_TRANSITO,
      ...(isPrivileged
        ? {}
        : {
            toWarehouse: { obra: { responsibleUserId: userId } },
          }),
    };

    const items = await this.prisma.transfer.findMany({
      where,
      include: TRANSFER_INCLUDE,
      orderBy: { sentAt: 'asc' },
    });
    return { items };
  }

  async receive(id: string, dto: ReceiveTransferDto, userId: string) {
    const t = await this.findOne(id);
    if (t.status !== TransferStatus.EN_TRANSITO) {
      throw new BusinessException(
        BusinessErrorCode.TRANSFER_INVALID_STATE,
        `No se puede recibir una transferencia en estado ${t.status}`,
        HttpStatus.CONFLICT,
      );
    }

    // Regla Fase 7A: si el usuario es RESIDENTE, debe ser el responsable de la obra destino.
    // ADMIN y ALMACENERO pueden recibir por él (override).
    const toWh = await this.prisma.warehouse.findUnique({
      where: { id: t.toWarehouseId },
      include: { obra: { select: { id: true, responsibleUserId: true } } },
    });
    if (!toWh?.obra) {
      throw new BusinessException(
        BusinessErrorCode.INVALID_INPUT,
        'El almacén destino no tiene obra asociada',
        HttpStatus.BAD_REQUEST,
      );
    }
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: { role: true },
    });
    if (!user) {
      throw new BusinessException(
        BusinessErrorCode.NOT_FOUND,
        'Usuario no encontrado',
        HttpStatus.NOT_FOUND,
      );
    }
    if (user.role.name === 'RESIDENTE' && toWh.obra.responsibleUserId !== userId) {
      throw new BusinessException(
        BusinessErrorCode.PERMISSION_DENIED,
        'Solo el residente responsable de la obra puede recibir esta transferencia',
        HttpStatus.FORBIDDEN,
      );
    }
    // Almacenero o residente responsable: sin motivo. Admin: requiere motivo.
    await assertOverrideReasonIfNeeded(
      this.prisma,
      userId,
      toWh.obra.id,
      dto.overrideReason,
    );

    // Detectar discrepancia (cantidad recibida ≠ enviada en alguna línea)
    const discrepancias: {
      itemId: string;
      itemName: string;
      sent: number;
      received: number;
    }[] = [];

    return this.prisma
      .$transaction(async (tx) => {
        for (const recItem of dto.items) {
          const ti = t.items.find((i) => i.id === recItem.transferItemId);
          if (!ti) continue;

          await tx.transferItem.update({
            where: { id: recItem.transferItemId },
            data: { receivedQty: recItem.receivedQty },
          });

          const sentQty = Number(ti.sentQty ?? ti.requestedQty);
          const receivedQty = Number(recItem.receivedQty);
          if (Math.abs(sentQty - receivedQty) > 0.0001) {
            discrepancias.push({
              itemId: ti.itemId,
              itemName: ti.item.name,
              sent: sentQty,
              received: receivedQty,
            });
          }
        }

        // Sumar stock al almacén destino
        await this.createMovementForTransfer(
          tx,
          t.toWarehouseId,
          MovementType.ENTRADA,
          MovementSource.TRANSFERENCIA,
          dto.items
            .map((ri) => {
              const ti = t.items.find((i) => i.id === ri.transferItemId)!;
              return { itemId: ti.itemId, quantity: ri.receivedQty };
            })
            .filter((i) => i.quantity > 0),
          userId,
          `Recepción de transferencia ${t.code} desde ${t.fromWarehouse.name}`,
        );

        // Crear alerta de discrepancia si aplica
        if (discrepancias.length > 0) {
          await tx.alert.create({
            data: {
              type: AlertType.TRANSFER_DISCREPANCIA,
              warehouseId: t.toWarehouseId,
              // Usamos el primer item como referencia; el mensaje resume todo
              itemId: discrepancias[0]!.itemId,
              quantity: discrepancias[0]!.received,
              threshold: discrepancias[0]!.sent,
              message: `Discrepancia en transferencia ${t.code}: ${discrepancias
                .map((d) => `${d.itemName} enviado=${d.sent}, recibido=${d.received}`)
                .join(' · ')}`,
            },
          });
        }

        const updated = await tx.transfer.update({
          where: { id },
          data: {
            status: TransferStatus.RECIBIDA,
            receivedById: userId,
            receivedAt: new Date(),
            ...(dto.notes && { notes: dto.notes }),
            receiveOverrideReason: dto.overrideReason?.trim() || null,
          },
          include: TRANSFER_INCLUDE,
        });

        return updated;
      })
      .then((updated) => {
        this.notify(WS_EVENTS.TRANSFER_RECEIVED, updated);
        if (discrepancias.length > 0) {
          this.realtime.emitToRole('ADMIN', WS_EVENTS.ALERT_CREATED, {
            type: AlertType.TRANSFER_DISCREPANCIA,
            transferCode: t.code,
            warehouseId: t.toWarehouseId,
            discrepancias,
          });
        }
        return updated;
      });
  }

  async reject(id: string, dto: RejectTransferDto, userId: string) {
    const t = await this.findOne(id);
    if (
      t.status === TransferStatus.RECIBIDA ||
      t.status === TransferStatus.RECHAZADA ||
      t.status === TransferStatus.CANCELADA
    ) {
      throw new BusinessException(
        BusinessErrorCode.TRANSFER_INVALID_STATE,
        `No se puede rechazar una transferencia en estado ${t.status}`,
        HttpStatus.CONFLICT,
      );
    }

    const toWh = await this.prisma.warehouse.findUnique({
      where: { id: t.toWarehouseId },
      include: { obra: { select: { id: true } } },
    });
    if (!toWh?.obra) {
      throw new BusinessException(
        BusinessErrorCode.INVALID_INPUT,
        'El almacén destino no tiene obra asociada',
        HttpStatus.BAD_REQUEST,
      );
    }
    await assertOverrideReasonIfNeeded(
      this.prisma,
      userId,
      toWh.obra.id,
      dto.overrideReason,
    );

    return this.prisma.$transaction(async (tx) => {
      // Si ya estaba EN_TRANSITO, devolver stock al origen
      if (t.status === TransferStatus.EN_TRANSITO) {
        const itemsToReturn = t.items
          .filter((ti) => ti.sentQty && Number(ti.sentQty) > 0)
          .map((ti) => ({ itemId: ti.itemId, quantity: Number(ti.sentQty!) }));

        if (itemsToReturn.length > 0) {
          await this.createMovementForTransfer(
            tx,
            t.fromWarehouseId,
            MovementType.ENTRADA,
            MovementSource.DEVOLUCION,
            itemsToReturn,
            userId,
            `Devolución por rechazo de ${t.code}`,
          );
        }
      }

      const updated = await tx.transfer.update({
        where: { id },
        data: {
          status: TransferStatus.RECHAZADA,
          rejectedById: userId,
          rejectedAt: new Date(),
          rejectionReason: dto.reason,
          rejectOverrideReason: dto.overrideReason?.trim() || null,
        },
        include: TRANSFER_INCLUDE,
      });
      this.notify(WS_EVENTS.TRANSFER_REJECTED, updated);
      return updated;
    });
  }

  /**
   * Cancela una transferencia EN_TRANSITO. Devuelve el stock al almacén origen.
   * Caso típico: el almacenero se equivocó al crear la transferencia y la cancela antes
   * de que el residente la reciba.
   */
  async cancel(id: string, dto: CancelTransferDto, userId: string) {
    const t = await this.findOne(id);
    if (t.status !== TransferStatus.EN_TRANSITO) {
      throw new BusinessException(
        BusinessErrorCode.TRANSFER_INVALID_STATE,
        `Solo se pueden cancelar transferencias en estado EN_TRANSITO (actual: ${t.status})`,
        HttpStatus.CONFLICT,
      );
    }

    const toWh = await this.prisma.warehouse.findUnique({
      where: { id: t.toWarehouseId },
      include: { obra: { select: { id: true } } },
    });
    if (!toWh?.obra) {
      throw new BusinessException(
        BusinessErrorCode.INVALID_INPUT,
        'El almacén destino no tiene obra asociada',
        HttpStatus.BAD_REQUEST,
      );
    }
    await assertOverrideReasonIfNeeded(
      this.prisma,
      userId,
      toWh.obra.id,
      dto.overrideReason,
    );

    return this.prisma.$transaction(async (tx) => {
      // Devolver stock al almacén origen basado en lo que se envió (sentQty) o solicitó
      const itemsToReturn = t.items
        .map((ti) => ({
          itemId: ti.itemId,
          quantity: Number(ti.sentQty ?? ti.requestedQty),
        }))
        .filter((i) => i.quantity > 0);

      if (itemsToReturn.length > 0) {
        await this.createMovementForTransfer(
          tx,
          t.fromWarehouseId,
          MovementType.ENTRADA,
          MovementSource.DEVOLUCION,
          itemsToReturn,
          userId,
          `Cancelación de transferencia ${t.code} — devolución al origen`,
        );
      }

      const updated = await tx.transfer.update({
        where: { id },
        data: {
          status: TransferStatus.CANCELADA,
          rejectedById: userId,
          rejectedAt: new Date(),
          cancelOverrideReason: dto.overrideReason?.trim() || null,
        },
        include: TRANSFER_INCLUDE,
      });
      this.notify(WS_EVENTS.TRANSFER_CANCELLED, updated);
      return updated;
    });
  }

  // ─── Helper: crea movimiento dentro de una transacción ───────────────────

  private async createMovementForTransfer(
    tx: Prisma.TransactionClient,
    warehouseId: string,
    type: MovementType,
    source: MovementSource,
    items: { itemId: string; quantity: number }[],
    userId: string,
    notes: string,
  ) {
    if (items.length === 0) return;

    const prefix = type === MovementType.ENTRADA ? 'ENT' : 'SAL';
    const seq = await tx.movementSequence.upsert({
      where: { type },
      update: { lastValue: { increment: 1 } },
      create: { type, lastValue: 1 },
    });
    const code = `${prefix}-${String(seq.lastValue).padStart(5, '0')}`;

    const processedItems: {
      itemId: string;
      quantity: number;
      stockBefore: number;
      stockAfter: number;
    }[] = [];

    for (const line of items) {
      const stock = await tx.stock.findUnique({
        where: { itemId_warehouseId: { itemId: line.itemId, warehouseId } },
      });

      const currentQty = Number(stock?.quantity ?? 0);
      const version = stock?.version ?? 0;
      const newQty =
        type === MovementType.ENTRADA
          ? currentQty + line.quantity
          : currentQty - line.quantity;

      if (type === MovementType.SALIDA && newQty < 0) {
        const item = await tx.item.findUnique({
          where: { id: line.itemId },
          select: { name: true },
        });
        throw new BusinessException(
          BusinessErrorCode.STOCK_INSUFFICIENT,
          `Stock insuficiente para "${item?.name}": disponible ${currentQty}, requerido ${line.quantity}`,
          HttpStatus.CONFLICT,
        );
      }

      if (!stock) {
        await tx.stock.create({
          data: { itemId: line.itemId, warehouseId, quantity: 0 },
        });
      }

      const updated = await tx.stock.updateMany({
        where: { itemId: line.itemId, warehouseId, version },
        data: { quantity: newQty, version: { increment: 1 } },
      });

      if (updated.count === 0) {
        throw new BusinessException(
          BusinessErrorCode.STOCK_CONFLICT,
          'Conflicto de concurrencia. Intente nuevamente.',
          HttpStatus.CONFLICT,
        );
      }

      processedItems.push({
        itemId: line.itemId,
        quantity: line.quantity,
        stockBefore: currentQty,
        stockAfter: newQty,
      });
    }

    await tx.movement.create({
      data: {
        code,
        type,
        source,
        warehouseId,
        userId,
        notes,
        items: {
          create: processedItems.map((p) => ({
            itemId: p.itemId,
            quantity: p.quantity,
            stockBefore: p.stockBefore,
            stockAfter: p.stockAfter,
          })),
        },
      },
    });
  }
}
