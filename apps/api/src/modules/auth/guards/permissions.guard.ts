import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';

import { PrismaService } from '../../../prisma/prisma.service';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';
import { PERMISSIONS_KEY } from '../decorators/permissions.decorator';
import type { JwtPayload } from '../strategies/jwt.strategy';

@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(
    private reflector: Reflector,
    private prisma: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;

    const required = this.reflector.getAllAndOverride<string[]>(PERMISSIONS_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!required || required.length === 0) return true;

    const request = context.switchToHttp().getRequest<Request & { user: JwtPayload }>();
    const user = request.user;
    if (!user) return false;

    const role = await this.prisma.role.findUnique({
      where: { name: user.role },
      include: { permissions: { include: { permission: true } } },
    });

    if (!role) return false;

    const userPerms = new Set(
      role.permissions.map((rp) => `${rp.permission.resource}:${rp.permission.action}`),
    );

    const hasAll = required.every((p) => userPerms.has(p));
    if (!hasAll) {
      throw new ForbiddenException('No tienes los permisos requeridos para esta acción');
    }

    return true;
  }
}
