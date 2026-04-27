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
