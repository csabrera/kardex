import {
  CallHandler,
  ExecutionContext,
  Injectable,
  Logger,
  NestInterceptor,
} from '@nestjs/common';
import type { Request } from 'express';
import { Observable, tap } from 'rxjs';

import { PrismaService } from '../../prisma/prisma.service';
import type { JwtPayload } from '../../modules/auth/strategies/jwt.strategy';

const AUDITED_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

@Injectable()
export class AuditInterceptor implements NestInterceptor {
  private readonly logger = new Logger(AuditInterceptor.name);

  constructor(private readonly prisma: PrismaService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const request = context.switchToHttp().getRequest<Request & { user?: JwtPayload }>();

    if (!AUDITED_METHODS.has(request.method)) return next.handle();

    const user = request.user;
    const resource = this.extractResource(request.path);
    const resourceId = this.extractResourceId(request.path);

    return next.handle().pipe(
      tap({
        next: () => {
          this.writeLog({
            userId: user?.sub,
            userDoc: user ? `${user.documentType}:${user.documentNumber}` : undefined,
            action: request.method,
            resource,
            resourceId,
            ip: request.ip,
            userAgent: request.headers['user-agent'],
          }).catch((err: unknown) => this.logger.error('AuditLog write failed', err));
        },
      }),
    );
  }

  private async writeLog(data: {
    userId?: string;
    userDoc?: string;
    action: string;
    resource: string;
    resourceId?: string;
    ip?: string;
    userAgent?: string;
  }): Promise<void> {
    await this.prisma.auditLog.create({ data });
  }

  private extractResource(path: string): string {
    const parts = path.replace(/^\/api\//, '').split('/');
    return parts[0] ?? 'unknown';
  }

  private extractResourceId(path: string): string | undefined {
    const parts = path.replace(/^\/api\//, '').split('/');
    return parts[1] && !parts[1].includes('?') ? parts[1] : undefined;
  }
}
