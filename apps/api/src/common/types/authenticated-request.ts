import type { Request } from 'express';

import type { JwtPayload } from '../../modules/auth/strategies/jwt.strategy';

/**
 * Express Request con el payload del JWT inyectado por JwtAuthGuard.
 * Usar en todos los @Controller con @Req() en vez de castear `(req as any)`.
 */
export type AuthenticatedRequest = Request & { user: JwtPayload };
