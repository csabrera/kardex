import { Injectable, HttpStatus } from '@nestjs/common';
import {
  TransferStatus,
  TransferItemStatus,
  TransferShortageReason,
  MovementType,
  MovementSource,
  Prisma,
} from '@prisma/client';

import { PrismaService } from '../../prisma/prisma.service';
import { BusinessException } from '../../common/exceptions/business.exception';
import { BusinessErrorCode, WS_EVENTS } from '@kardex/types';
import { RealtimeService } from '../realtime/realtime.service';
import { assertOverrideReasonIfNeeded } from '../../common/utils/scope';
import type {
  CancelTransferDto,
  CloseShortageDto,
  CreateTransferDto,
  ReceiveAdditionalTransferDto,
  ReceiveTransferDto,
  RejectTransferDto,
} from './dto/transfer.dto';

/** Determina el estado de una línea según cuánto se recibió contra lo enviado. */
function computeLineStatus(receivedQty: number, sentQty: number): TransferItemStatus {
  if (receivedQty <= 0.0001) return TransferItemStatus.PENDIENTE;
  if (Math.abs(receivedQty - sentQty) < 0.0001)
    return TransferItemStatus.RECIBIDO_COMPLETO;
  return TransferItemStatus.RECIBIDO_PARCIAL;
}

/** Etiqueta legible para incluir en las notas del Movement de baja contable. */
const SHORTAGE_REASON_LABELS: Record<TransferShortageReason, string> = {
  INCUMPLIMIENTO_PROVEEDOR: 'Incumplimiento del proveedor',
  DANIO_EN_TRANSPORTE: 'Daño en transporte',
  ROBO_O_PERDIDA: 'Robo o pérdida',
  ERROR_DE_CONTEO: 'Error de conteo',
  OTRO: 'Otro',
};

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
          requiresRecipientDocument: dto.requiresRecipientDocument ?? false,
          documentUrl: dto.documentUrl ?? null,
          documentName: dto.documentName ?? null,
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

  /**
   * Recepción inicial. Si todas las líneas reciben qty=sentQty → TRF a RECIBIDA.
   * Si alguna línea recibe qty<sentQty → TRF a PARCIALMENTE_RECIBIDA (el resto
   * llegará en otra remesa o se cerrará como faltante por el admin).
   */
  async receive(id: string, dto: ReceiveTransferDto, userId: string) {
    const t = await this.findOne(id);
    if (t.status !== TransferStatus.EN_TRANSITO) {
      throw new BusinessException(
        BusinessErrorCode.TRANSFER_INVALID_STATE,
        `No se puede recibir una transferencia en estado ${t.status}`,
        HttpStatus.CONFLICT,
      );
    }

    // Validar scope (residente responsable o admin/almacenero) + override + guía
    await this.validateRecipientScope(t, dto.overrideReason, userId);
    if (t.requiresRecipientDocument && !t.documentUrl && !dto.documentUrl) {
      throw new BusinessException(
        BusinessErrorCode.INVALID_INPUT,
        'DOCUMENT_REQUIRED',
        HttpStatus.BAD_REQUEST,
      );
    }

    // Validar que no se reciba más de lo enviado por línea
    for (const rec of dto.items) {
      const ti = t.items.find((i) => i.id === rec.transferItemId);
      if (!ti) continue;
      const sentQty = Number(ti.sentQty ?? ti.requestedQty);
      if (Number(rec.receivedQty) > sentQty + 0.0001) {
        throw new BusinessException(
          BusinessErrorCode.INVALID_INPUT,
          `Cantidad recibida de "${ti.item.name}" (${rec.receivedQty}) supera lo enviado (${sentQty})`,
          HttpStatus.BAD_REQUEST,
        );
      }
    }

    return this.prisma
      .$transaction(async (tx) => {
        for (const rec of dto.items) {
          const ti = t.items.find((i) => i.id === rec.transferItemId);
          if (!ti) continue;

          const sentQty = Number(ti.sentQty ?? ti.requestedQty);
          const receivedQty = Number(rec.receivedQty);
          const status = computeLineStatus(receivedQty, sentQty);

          await tx.transferItem.update({
            where: { id: rec.transferItemId },
            data: { receivedQty, status },
          });
        }

        // Sumar stock al almacén destino (solo qty > 0)
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

        const newStatus = await this.computeTransferStatus(tx, id);

        const updated = await tx.transfer.update({
          where: { id },
          data: {
            status: newStatus,
            ...(newStatus !== TransferStatus.EN_TRANSITO && {
              receivedById: userId,
              receivedAt: new Date(),
            }),
            ...(dto.notes && { notes: dto.notes }),
            receiveOverrideReason: dto.overrideReason?.trim() || null,
            ...(dto.documentUrl && {
              documentUrl: dto.documentUrl,
              documentName: dto.documentName ?? null,
              requiresRecipientDocument: false,
            }),
          },
          include: TRANSFER_INCLUDE,
        });

        return updated;
      })
      .then((updated) => {
        this.notify(WS_EVENTS.TRANSFER_RECEIVED, updated);
        return updated;
      });
  }

  /**
   * Recepción adicional sobre TRF PARCIALMENTE_RECIBIDA — el resto llegó después.
   * Acumula `receivedQty` por línea, recalcula estado por línea y de la TRF.
   * La guía adicional es OPCIONAL (la primera ya está vinculada).
   */
  async receiveAdditional(id: string, dto: ReceiveAdditionalTransferDto, userId: string) {
    const t = await this.findOne(id);
    if (t.status !== TransferStatus.PARCIALMENTE_RECIBIDA) {
      throw new BusinessException(
        BusinessErrorCode.TRANSFER_INVALID_STATE,
        `Solo se puede recibir adicional sobre una transferencia PARCIALMENTE_RECIBIDA (actual: ${t.status})`,
        HttpStatus.CONFLICT,
      );
    }

    await this.validateRecipientScope(t, dto.overrideReason, userId);

    // Validar que cada línea esté en RECIBIDO_PARCIAL y que additionalQty no exceda lo pendiente
    for (const rec of dto.items) {
      const ti = t.items.find((i) => i.id === rec.transferItemId);
      if (!ti) {
        throw new BusinessException(
          BusinessErrorCode.INVALID_INPUT,
          'Línea de transferencia no encontrada',
          HttpStatus.BAD_REQUEST,
        );
      }
      if (ti.status !== TransferItemStatus.RECIBIDO_PARCIAL) {
        throw new BusinessException(
          BusinessErrorCode.INVALID_INPUT,
          `La línea "${ti.item.name}" no está pendiente de completar (estado ${ti.status})`,
          HttpStatus.BAD_REQUEST,
        );
      }
      const sentQty = Number(ti.sentQty ?? ti.requestedQty);
      const alreadyReceived = Number(ti.receivedQty ?? 0);
      const pending = sentQty - alreadyReceived;
      if (Number(rec.additionalQty) > pending + 0.0001) {
        throw new BusinessException(
          BusinessErrorCode.INVALID_INPUT,
          `Cantidad adicional de "${ti.item.name}" (${rec.additionalQty}) supera lo pendiente (${pending})`,
          HttpStatus.BAD_REQUEST,
        );
      }
    }

    return this.prisma
      .$transaction(async (tx) => {
        for (const rec of dto.items) {
          const ti = t.items.find((i) => i.id === rec.transferItemId)!;
          const sentQty = Number(ti.sentQty ?? ti.requestedQty);
          const newReceived = Number(ti.receivedQty ?? 0) + Number(rec.additionalQty);
          const status = computeLineStatus(newReceived, sentQty);

          await tx.transferItem.update({
            where: { id: rec.transferItemId },
            data: { receivedQty: newReceived, status },
          });
        }

        // Sumar stock al destino con la qty adicional
        await this.createMovementForTransfer(
          tx,
          t.toWarehouseId,
          MovementType.ENTRADA,
          MovementSource.TRANSFERENCIA,
          dto.items.map((ri) => {
            const ti = t.items.find((i) => i.id === ri.transferItemId)!;
            return { itemId: ti.itemId, quantity: ri.additionalQty };
          }),
          userId,
          `Recepción adicional de transferencia ${t.code}`,
        );

        const newStatus = await this.computeTransferStatus(tx, id);

        const updated = await tx.transfer.update({
          where: { id },
          data: {
            status: newStatus,
            ...(dto.notes && { notes: dto.notes }),
            // Si llegó nueva guía con esta remesa, la actualiza (la última gana —
            // el caso típico es: primera guía sin documento, segunda con guía formal).
            ...(dto.documentUrl && {
              documentUrl: dto.documentUrl,
              documentName: dto.documentName ?? null,
              requiresRecipientDocument: false,
            }),
          },
          include: TRANSFER_INCLUDE,
        });
        return updated;
      })
      .then((updated) => {
        this.notify(WS_EVENTS.TRANSFER_RECEIVED, updated);
        return updated;
      });
  }

  /**
   * Cierra una o varias líneas RECIBIDO_PARCIAL como FALTANTE_DEFINITIVO.
   * Solo ADMIN. Por cada línea cerrada crea un par ENTRADA(DEVOLUCION) +
   * SALIDA(COMPRA_INCUMPLIDA) en el almacén origen para reflejar la baja
   * contable. Si quedan todas las líneas en estado terminal → TRF a RECIBIDA.
   */
  async closeAsShortage(id: string, dto: CloseShortageDto, userId: string) {
    const t = await this.findOne(id);
    if (t.status !== TransferStatus.PARCIALMENTE_RECIBIDA) {
      throw new BusinessException(
        BusinessErrorCode.TRANSFER_INVALID_STATE,
        `Solo se pueden cerrar como faltante líneas de transferencias PARCIALMENTE_RECIBIDA (actual: ${t.status})`,
        HttpStatus.CONFLICT,
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
    if (user.role.name !== 'ADMIN') {
      throw new BusinessException(
        BusinessErrorCode.PERMISSION_DENIED,
        'Solo un administrador puede cerrar líneas como faltante definitivo',
        HttpStatus.FORBIDDEN,
      );
    }

    // Validar líneas seleccionadas
    const linesToClose: { ti: (typeof t.items)[number]; pendingQty: number }[] = [];
    for (const lineId of dto.transferItemIds) {
      const ti = t.items.find((i) => i.id === lineId);
      if (!ti) {
        throw new BusinessException(
          BusinessErrorCode.INVALID_INPUT,
          'Línea de transferencia no encontrada',
          HttpStatus.BAD_REQUEST,
        );
      }
      if (ti.status !== TransferItemStatus.RECIBIDO_PARCIAL) {
        throw new BusinessException(
          BusinessErrorCode.INVALID_INPUT,
          `La línea "${ti.item.name}" no está en estado pendiente (actual: ${ti.status})`,
          HttpStatus.BAD_REQUEST,
        );
      }
      const sentQty = Number(ti.sentQty ?? ti.requestedQty);
      const received = Number(ti.receivedQty ?? 0);
      const pending = sentQty - received;
      if (pending <= 0) {
        throw new BusinessException(
          BusinessErrorCode.INVALID_INPUT,
          `La línea "${ti.item.name}" no tiene cantidad pendiente`,
          HttpStatus.BAD_REQUEST,
        );
      }
      linesToClose.push({ ti, pendingQty: pending });
    }

    const reasonLabel = SHORTAGE_REASON_LABELS[dto.reason];
    const notesSuffix = dto.notes ? ` · ${dto.notes}` : '';

    return this.prisma
      .$transaction(async (tx) => {
        const closedAt = new Date();
        for (const { ti } of linesToClose) {
          await tx.transferItem.update({
            where: { id: ti.id },
            data: {
              status: TransferItemStatus.FALTANTE_DEFINITIVO,
              shortageReason: dto.reason,
              shortageNotes: dto.notes ?? null,
              closedAt,
              closedById: userId,
            },
          });
        }

        // Par de Movements en el almacén origen, uno por cada línea cerrada.
        // Primero ENTRADA(DEVOLUCION): devuelve contablemente las pending unidades
        // que ya habían salido al crear la transferencia. Luego SALIDA(COMPRA_INCUMPLIDA):
        // las da de baja con motivo clasificado para reporte.
        await this.createMovementForTransfer(
          tx,
          t.fromWarehouseId,
          MovementType.ENTRADA,
          MovementSource.DEVOLUCION,
          linesToClose.map(({ ti, pendingQty }) => ({
            itemId: ti.itemId,
            quantity: pendingQty,
          })),
          userId,
          `Cierre TRF ${t.code} — devolución contable previa a baja`,
        );

        await this.createMovementForTransfer(
          tx,
          t.fromWarehouseId,
          MovementType.SALIDA,
          MovementSource.COMPRA_INCUMPLIDA,
          linesToClose.map(({ ti, pendingQty }) => ({
            itemId: ti.itemId,
            quantity: pendingQty,
          })),
          userId,
          `Baja TRF ${t.code} — ${reasonLabel}${notesSuffix}`,
        );

        const newStatus = await this.computeTransferStatus(tx, id);

        const updated = await tx.transfer.update({
          where: { id },
          data: { status: newStatus },
          include: TRANSFER_INCLUDE,
        });
        return updated;
      })
      .then((updated) => {
        this.notify(WS_EVENTS.TRANSFER_RECEIVED, updated);
        return updated;
      });
  }

  /**
   * Valida que el receptor sea residente responsable de la obra destino
   * o admin/almacenero (override). Devuelve el warehouse destino con la obra cargada.
   */
  private async validateRecipientScope(
    t: { toWarehouseId: string },
    overrideReason: string | undefined,
    userId: string,
  ) {
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
    await assertOverrideReasonIfNeeded(this.prisma, userId, toWh.obra.id, overrideReason);
    return toWh;
  }

  /**
   * Calcula el estado de la transferencia a partir de los estados de sus líneas.
   * - Todas COMPLETO o FALTANTE_DEFINITIVO → RECIBIDA (cerrada)
   * - Alguna recibida (COMPLETO/PARCIAL/FALTANTE) y alguna PENDIENTE → PARCIALMENTE_RECIBIDA
   * - Alguna PARCIAL → PARCIALMENTE_RECIBIDA
   * - Todas PENDIENTE → EN_TRANSITO (edge: receivedQty=0 en todas)
   */
  private async computeTransferStatus(
    tx: Prisma.TransactionClient,
    transferId: string,
  ): Promise<TransferStatus> {
    const items = await tx.transferItem.findMany({
      where: { transferId },
      select: { status: true },
    });
    const allTerminal = items.every(
      (i) =>
        i.status === TransferItemStatus.RECIBIDO_COMPLETO ||
        i.status === TransferItemStatus.FALTANTE_DEFINITIVO,
    );
    if (allTerminal) return TransferStatus.RECIBIDA;
    const anyReceived = items.some(
      (i) =>
        i.status === TransferItemStatus.RECIBIDO_COMPLETO ||
        i.status === TransferItemStatus.RECIBIDO_PARCIAL ||
        i.status === TransferItemStatus.FALTANTE_DEFINITIVO,
    );
    if (anyReceived) return TransferStatus.PARCIALMENTE_RECIBIDA;
    return TransferStatus.EN_TRANSITO;
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
