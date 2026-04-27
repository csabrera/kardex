import { HttpStatus } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { Test, TestingModule } from '@nestjs/testing';

import { BusinessException } from '../../common/exceptions/business.exception';
import { PrismaService } from '../../prisma/prisma.service';
import { AuthService } from './auth.service';
import { DocumentTypeDto } from './dto/login.dto';
import type { SetupDto } from './dto/setup.dto';

const adminRole = { id: 'role-admin', name: 'ADMIN' };

const prismaMock = {
  systemSetting: {
    findUnique: jest.fn(),
    upsert: jest.fn().mockResolvedValue({}),
  },
  role: {
    findUnique: jest.fn().mockResolvedValue(adminRole),
    upsert: jest.fn().mockResolvedValue(adminRole),
  },
  user: {
    findFirst: jest.fn(),
    findUnique: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
  },
  refreshToken: { create: jest.fn().mockResolvedValue({}) },
  rolePermission: {
    findMany: jest.fn().mockResolvedValue([]),
  },
};

const jwtMock = { sign: jest.fn().mockReturnValue('token') };
const configMock = {
  get: jest.fn().mockReturnValue({
    secret: 's',
    refreshSecret: 'r',
    expiresIn: '15m',
    refreshExpiresIn: '7d',
  }),
};

describe('AuthService — Setup', () => {
  let service: AuthService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: PrismaService, useValue: prismaMock },
        { provide: JwtService, useValue: jwtMock },
        { provide: ConfigService, useValue: configMock },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
    jest.clearAllMocks();
    jwtMock.sign.mockReturnValue('token');
    configMock.get.mockReturnValue({
      secret: 's',
      refreshSecret: 'r',
      expiresIn: '15m',
      refreshExpiresIn: '7d',
    });
    prismaMock.refreshToken.create.mockResolvedValue({});
    prismaMock.role.findUnique.mockResolvedValue(adminRole);
    prismaMock.role.upsert.mockResolvedValue(adminRole);
    prismaMock.systemSetting.upsert.mockResolvedValue({});
  });

  describe('getSetupStatus', () => {
    it('returns false when setting is missing', async () => {
      prismaMock.systemSetting.findUnique.mockResolvedValueOnce(null);
      expect(await service.getSetupStatus()).toEqual({ setupCompleted: false });
    });

    it('returns false when value is "false"', async () => {
      prismaMock.systemSetting.findUnique.mockResolvedValueOnce({ value: 'false' });
      expect(await service.getSetupStatus()).toEqual({ setupCompleted: false });
    });

    it('returns true when value is "true"', async () => {
      prismaMock.systemSetting.findUnique.mockResolvedValueOnce({ value: 'true' });
      expect(await service.getSetupStatus()).toEqual({ setupCompleted: true });
    });
  });

  describe('setup', () => {
    const validDto: SetupDto = {
      documentType: DocumentTypeDto.DNI,
      documentNumber: '87654321',
      firstName: 'Ana',
      lastName: 'Torres',
      password: 'Admin123!',
      confirmPassword: 'Admin123!',
    };

    beforeEach(() => {
      // Setup not completed
      prismaMock.systemSetting.findUnique.mockResolvedValue(null);
      prismaMock.user.create.mockResolvedValue({
        id: 'u1',
        firstName: 'Ana',
        lastName: 'Torres',
        email: null,
        documentType: 'DNI',
        documentNumber: '87654321',
        mustChangePassword: false,
        role: adminRole,
      });
    });

    it('creates admin and returns tokens', async () => {
      const result = await service.setup(validDto);
      expect(result.accessToken).toBe('token');
      expect(result.user.role).toMatchObject({ name: 'ADMIN' });
      expect(Array.isArray(result.user.role.permissions)).toBe(true);
      expect(prismaMock.systemSetting.upsert).toHaveBeenCalledWith(
        expect.objectContaining({ update: { value: 'true' } }),
      );
    });

    it('throws SETUP_ALREADY_COMPLETED when setup is done', async () => {
      prismaMock.systemSetting.findUnique.mockResolvedValueOnce({ value: 'true' });
      await expect(service.setup(validDto)).rejects.toMatchObject({
        errorCode: 'SETUP_ALREADY_COMPLETED',
      });
    });

    it('throws INVALID_INPUT when passwords do not match', async () => {
      await expect(
        service.setup({ ...validDto, confirmPassword: 'Different1!' }),
      ).rejects.toMatchObject({ errorCode: 'INVALID_INPUT' });
    });

    it('throws INVALID_DOCUMENT_FORMAT for bad DNI', async () => {
      await expect(
        service.setup({ ...validDto, documentNumber: '123' }),
      ).rejects.toMatchObject({ errorCode: 'INVALID_DOCUMENT_FORMAT' });
    });
  });
});
