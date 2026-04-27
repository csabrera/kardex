import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';

import { RolesGuard } from './roles.guard';

function makeContext(
  role: string | undefined,
  handlerMeta: Record<string, unknown> = {},
): ExecutionContext {
  return {
    getHandler: () => ({}),
    getClass: () => ({}),
    switchToHttp: () => ({
      getRequest: () => ({ user: role ? { role } : undefined }),
    }),
  } as unknown as ExecutionContext;
}

describe('RolesGuard', () => {
  let guard: RolesGuard;
  let reflector: Reflector;

  beforeEach(() => {
    reflector = new Reflector();
    guard = new RolesGuard(reflector);
  });

  it('allows when no roles required', () => {
    jest
      .spyOn(reflector, 'getAllAndOverride')
      .mockReturnValueOnce(false)
      .mockReturnValueOnce([]);
    expect(guard.canActivate(makeContext('ALMACENERO'))).toBe(true);
  });

  it('allows matching role', () => {
    jest
      .spyOn(reflector, 'getAllAndOverride')
      .mockReturnValueOnce(false)
      .mockReturnValueOnce(['ADMIN', 'ALMACENERO']);
    expect(guard.canActivate(makeContext('ADMIN'))).toBe(true);
  });

  it('throws ForbiddenException for wrong role', () => {
    jest
      .spyOn(reflector, 'getAllAndOverride')
      .mockReturnValueOnce(false)
      .mockReturnValueOnce(['ADMIN']);
    expect(() => guard.canActivate(makeContext('RESIDENTE'))).toThrow(ForbiddenException);
  });

  it('allows public routes regardless of role', () => {
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValueOnce(true);
    expect(guard.canActivate(makeContext(undefined))).toBe(true);
  });
});
