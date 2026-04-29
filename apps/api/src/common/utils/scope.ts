import { HttpStatus } from '@nestjs/common';

import { BusinessException } from '../exceptions/business.exception';
import { BusinessErrorCode } from '@kardex/types';
import type { PrismaService } from '../../prisma/prisma.service';

/**
 * Valida que el usuario, si es RESIDENTE, tenga acceso al almacén dado
 * (el almacén debe pertenecer a una de sus obras asignadas).
 *
 * ADMIN y ALMACENERO operan sobre todos los almacenes del sistema, no hay chequeo.
 *
 * Llamar al inicio de cualquier método de servicio que muta datos sobre
 * un almacén (préstamos, EPP, movimientos, ajustes).
 */
export async function assertWarehouseScope(
  prisma: PrismaService,
  userId: string,
  warehouseId: string,
): Promise<void> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { role: { select: { name: true } } },
  });
  if (!user) {
    throw new BusinessException(
      BusinessErrorCode.USER_NOT_FOUND,
      'Usuario no encontrado',
      HttpStatus.NOT_FOUND,
    );
  }

  // Sin restricción para roles privilegiados
  if (user.role.name !== 'RESIDENTE') return;

  const warehouse = await prisma.warehouse.findFirst({
    where: {
      id: warehouseId,
      deletedAt: null,
      obra: {
        responsibleUserId: userId,
        deletedAt: null,
      },
    },
    select: { id: true },
  });

  if (!warehouse) {
    throw new BusinessException(
      BusinessErrorCode.PERMISSION_DENIED,
      'No tienes acceso a este almacén (pertenece a otra obra)',
      HttpStatus.FORBIDDEN,
    );
  }
}

/**
 * Valida que el usuario, si es RESIDENTE, sea responsable de la obra dada.
 * Usar para acciones sobre la obra directamente (estaciones de trabajo,
 * workers asignados, etc.).
 */
export async function assertObraScope(
  prisma: PrismaService,
  userId: string,
  obraId: string,
): Promise<void> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { role: { select: { name: true } } },
  });
  if (!user) {
    throw new BusinessException(
      BusinessErrorCode.USER_NOT_FOUND,
      'Usuario no encontrado',
      HttpStatus.NOT_FOUND,
    );
  }

  if (user.role.name !== 'RESIDENTE') return;

  const obra = await prisma.obra.findFirst({
    where: {
      id: obraId,
      deletedAt: null,
      responsibleUserId: userId,
    },
    select: { id: true },
  });

  if (!obra) {
    throw new BusinessException(
      BusinessErrorCode.PERMISSION_DENIED,
      'No tienes acceso a esta obra (no eres el responsable)',
      HttpStatus.FORBIDDEN,
    );
  }
}

/**
 * Operaciones operacionales (préstamos, EPP) sobre un almacén de obra:
 * — Se permiten sin justificación a ALMACENERO o al RESIDENTE responsable de esa obra (flujo normal).
 * — Cualquier otro rol con permiso (típicamente ADMIN actuando por excepción) DEBE proporcionar
 *   `overrideReason` para dejar trazabilidad de por qué actúa fuera del flujo normal.
 *
 * Devuelve `true` si la operación es un override (se usó overrideReason),
 * o `false` si es flujo normal — el caller puede persistirlo si quiere.
 *
 * Llamar después de `assertWarehouseScope`. El warehouseId debe ser de tipo OBRA con obraId.
 */
export async function assertOverrideReasonIfNeeded(
  prisma: PrismaService,
  userId: string,
  obraId: string,
  overrideReason: string | null | undefined,
): Promise<boolean> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, role: { select: { name: true } } },
  });
  if (!user) {
    throw new BusinessException(
      BusinessErrorCode.USER_NOT_FOUND,
      'Usuario no encontrado',
      HttpStatus.NOT_FOUND,
    );
  }

  // Almacenero: flujo normal sin justificación
  if (user.role.name === 'ALMACENERO') return false;

  // Residente responsable de esta obra: flujo normal sin justificación
  if (user.role.name === 'RESIDENTE') {
    const obra = await prisma.obra.findUnique({
      where: { id: obraId },
      select: { responsibleUserId: true },
    });
    if (obra?.responsibleUserId === userId) return false;
  }

  // Cualquier otro caso (admin, residente no responsable): debe justificar
  const trimmed = overrideReason?.trim();
  if (!trimmed || trimmed.length < 5) {
    throw new BusinessException(
      BusinessErrorCode.INVALID_INPUT,
      'Esta operación está fuera del flujo normal. Como administrador, debes proporcionar un motivo de excepción (mínimo 5 caracteres).',
      HttpStatus.BAD_REQUEST,
    );
  }
  return true;
}
