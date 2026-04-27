import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';

import { IS_PUBLIC_KEY } from '../decorators/public.decorator';
import type { JwtPayload } from '../strategies/jwt.strategy';

export const WAREHOUSE_SCOPE_KEY = 'warehouseScope';

/**
 * Stub for Fase 3A when warehouses exist.
 * ADMIN and JEFE bypass scope checks; ALMACENERO/RESIDENTE are validated
 * against their assigned warehouses once that data is available.
 */
@Injectable()
export class WarehouseScopeGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;

    const requiresScope = this.reflector.getAllAndOverride<boolean>(WAREHOUSE_SCOPE_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!requiresScope) return true;

    const request = context.switchToHttp().getRequest<Request & { user: JwtPayload }>();
    const user = request.user;

    // ADMIN tiene acceso sin restricciones
    if (!user || user.role === 'ADMIN') return true;

    // Warehouse scope validation implemented in Fase 3A
    // when warehouse assignments are added to the User model
    throw new ForbiddenException('Acceso restringido al almacén');
  }
}
