import { Test, TestingModule } from '@nestjs/testing';

import { BusinessException } from '../../common/exceptions/business.exception';
import { PrismaService } from '../../prisma/prisma.service';
import { RealtimeService } from '../realtime/realtime.service';
import { UsersService } from './users.service';

const makeUser = (overrides: any = {}) => ({
  id: 'user-target',
  documentType: 'DNI',
  documentNumber: '99887766',
  firstName: 'PEDRO',
  paternalLastName: 'GÓMEZ',
  maternalLastName: null,
  lastName: 'GÓMEZ',
  email: null,
  phone: null,
  active: true,
  mustChangePassword: false,
  lastLoginAt: null,
  contractEndDate: null,
  createdAt: new Date(),
  role: { id: 'role-1', name: 'ALMACENERO', description: null },
  ...overrides,
});

describe('UsersService — SESSION_KILLED + self-protect', () => {
  let service: UsersService;
  let prismaMock: any;
  let realtimeMock: jest.Mocked<RealtimeService>;

  beforeEach(async () => {
    const userState = makeUser();
    prismaMock = {
      user: {
        findFirst: jest.fn().mockResolvedValue(userState),
        update: jest
          .fn()
          .mockImplementation((args: any) =>
            Promise.resolve({ ...userState, ...args.data }),
          ),
      },
      refreshToken: {
        deleteMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
    };

    realtimeMock = {
      emitToUser: jest.fn(),
      emitToRole: jest.fn(),
      emitToWarehouse: jest.fn(),
      emitToAll: jest.fn(),
    } as unknown as jest.Mocked<RealtimeService>;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UsersService,
        { provide: PrismaService, useValue: prismaMock },
        { provide: RealtimeService, useValue: realtimeMock },
      ],
    }).compile();

    service = module.get(UsersService);
  });

  describe('setActive', () => {
    it('al desactivar: invalida refresh tokens + emite SESSION_KILLED', async () => {
      await service.setActive('user-target', false, 'admin-1');

      expect(prismaMock.refreshToken.deleteMany).toHaveBeenCalledWith({
        where: { userId: 'user-target' },
      });
      expect(realtimeMock.emitToUser).toHaveBeenCalledWith(
        'user-target',
        'session.killed',
        { reason: 'USER_DISABLED' },
      );
    });

    it('al activar: NO invalida tokens y NO emite SESSION_KILLED', async () => {
      await service.setActive('user-target', true, 'admin-1');

      expect(prismaMock.refreshToken.deleteMany).not.toHaveBeenCalled();
      expect(realtimeMock.emitToUser).not.toHaveBeenCalled();
    });

    it('self-deactivate → INVALID_INPUT 400', async () => {
      await expect(
        service.setActive('user-target', false, 'user-target'),
      ).rejects.toBeInstanceOf(BusinessException);

      expect(prismaMock.refreshToken.deleteMany).not.toHaveBeenCalled();
      expect(prismaMock.user.update).not.toHaveBeenCalled();
      expect(realtimeMock.emitToUser).not.toHaveBeenCalled();
    });

    it('self-activate sí permitido (no hay riesgo de lock-out)', async () => {
      await expect(
        service.setActive('user-target', true, 'user-target'),
      ).resolves.toBeDefined();
    });

    it('sin actorUserId no aplica self-protect (compat legacy callers)', async () => {
      await expect(service.setActive('user-target', false)).resolves.toBeDefined();
    });
  });

  describe('resetPassword', () => {
    it('emite SESSION_KILLED con razón PASSWORD_RESET', async () => {
      await service.resetPassword('user-target', 'admin-1');

      expect(realtimeMock.emitToUser).toHaveBeenCalledWith(
        'user-target',
        'session.killed',
        { reason: 'PASSWORD_RESET' },
      );
    });

    it('invalida refresh tokens del usuario reseteado', async () => {
      await service.resetPassword('user-target', 'admin-1');

      expect(prismaMock.refreshToken.deleteMany).toHaveBeenCalledWith({
        where: { userId: 'user-target' },
      });
    });

    it('self-reset → INVALID_INPUT 400', async () => {
      await expect(
        service.resetPassword('user-target', 'user-target'),
      ).rejects.toBeInstanceOf(BusinessException);

      expect(prismaMock.user.update).not.toHaveBeenCalled();
      expect(realtimeMock.emitToUser).not.toHaveBeenCalled();
    });
  });

  it('un fallo del emit no rompe el flujo principal (best-effort)', async () => {
    realtimeMock.emitToUser.mockImplementationOnce(() => {
      throw new Error('socket gateway down');
    });

    await expect(
      service.setActive('user-target', false, 'admin-1'),
    ).resolves.toBeDefined();
  });
});
