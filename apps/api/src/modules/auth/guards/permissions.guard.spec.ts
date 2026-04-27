import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';

import { PrismaService } from '../../../prisma/prisma.service';
import { PermissionsGuard } from './permissions.guard';

function makeContext(role: string): ExecutionContext {
  return {
    getHandler: () => ({}),
    getClass: () => ({}),
    switchToHttp: () => ({
      getRequest: () => ({ user: { sub: 'u1', role } }),
    }),
  } as unknown as ExecutionContext;
}

const prismaMock = {
  role: {
    findUnique: jest.fn(),
  },
};

describe('PermissionsGuard', () => {
  let guard: PermissionsGuard;
  let reflector: Reflector;

  beforeEach(() => {
    reflector = new Reflector();
    guard = new PermissionsGuard(reflector, prismaMock as unknown as PrismaService);
    jest.clearAllMocks();
  });

  const mockRolePerms = (perms: string[]) => {
    prismaMock.role.findUnique.mockResolvedValue({
      name: 'ALMACENERO',
      permissions: perms.map((p) => {
        const [resource, action] = p.split(':');
        return { permission: { resource, action } };
      }),
    });
  };

  it('allows when no permissions required', async () => {
    jest
      .spyOn(reflector, 'getAllAndOverride')
      .mockReturnValueOnce(false)
      .mockReturnValueOnce([]);
    expect(await guard.canActivate(makeContext('ALMACENERO'))).toBe(true);
  });

  it('allows when user has all required permissions', async () => {
    jest
      .spyOn(reflector, 'getAllAndOverride')
      .mockReturnValueOnce(false)
      .mockReturnValueOnce(['movements:create', 'stock:read']);
    mockRolePerms(['movements:create', 'stock:read', 'items:read']);
    expect(await guard.canActivate(makeContext('ALMACENERO'))).toBe(true);
  });

  it('throws ForbiddenException when missing a permission', async () => {
    jest
      .spyOn(reflector, 'getAllAndOverride')
      .mockReturnValueOnce(false)
      .mockReturnValueOnce(['movements:delete']);
    mockRolePerms(['movements:create', 'movements:read']);
    await expect(guard.canActivate(makeContext('ALMACENERO'))).rejects.toThrow(
      ForbiddenException,
    );
  });

  it('allows public routes', async () => {
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValueOnce(true);
    expect(await guard.canActivate(makeContext('RESIDENTE'))).toBe(true);
  });
});
