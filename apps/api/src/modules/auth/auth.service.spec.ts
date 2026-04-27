import { HttpStatus } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { Test, TestingModule } from '@nestjs/testing';
import * as bcrypt from 'bcrypt';

import { BusinessException } from '../../common/exceptions/business.exception';
import { PrismaService } from '../../prisma/prisma.service';
import { AuthService } from './auth.service';
import { DocumentTypeDto, LoginDto } from './dto/login.dto';

// ─── Minimal Prisma mock ──────────────────────────────────────────────────────

const mockRole = { id: 'role-1', name: 'ADMIN' };
const mockUser = {
  id: 'user-1',
  documentType: 'DNI',
  documentNumber: '12345678',
  passwordHash: '',
  firstName: 'Juan',
  lastName: 'Pérez',
  email: 'juan@test.com',
  active: true,
  mustChangePassword: false,
  deletedAt: null,
  role: mockRole,
};

const prismaMock = {
  user: {
    findFirst: jest.fn(),
    update: jest.fn().mockResolvedValue(mockUser),
  },
  refreshToken: {
    create: jest.fn().mockResolvedValue({}),
    findUnique: jest.fn(),
    deleteMany: jest.fn().mockResolvedValue({}),
  },
  rolePermission: {
    findMany: jest.fn().mockResolvedValue([]),
  },
};

const jwtMock = {
  sign: jest.fn().mockReturnValue('access.token.here'),
};

const configMock = {
  get: jest.fn().mockReturnValue({
    secret: 'test-secret',
    refreshSecret: 'test-refresh-secret',
    expiresIn: '15m',
    refreshExpiresIn: '7d',
  }),
};

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('AuthService', () => {
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
    // Default: user exists with correct password
    mockUser.passwordHash = await bcrypt.hash('Password123!', 10);
    prismaMock.user.findFirst.mockResolvedValue(mockUser);
    prismaMock.user.update.mockResolvedValue(mockUser);
    prismaMock.refreshToken.create.mockResolvedValue({});
    configMock.get.mockReturnValue({
      secret: 'test-secret',
      refreshSecret: 'test-refresh-secret',
      expiresIn: '15m',
      refreshExpiresIn: '7d',
    });
    jwtMock.sign.mockReturnValue('access.token.here');
  });

  describe('hashPassword', () => {
    it('produces a bcrypt hash that verifies correctly', async () => {
      const hash = await service.hashPassword('MyPassword123!');
      const valid = await bcrypt.compare('MyPassword123!', hash);
      expect(valid).toBe(true);
    });

    it('produces different hashes for same input (salt randomness)', async () => {
      const h1 = await service.hashPassword('same');
      const h2 = await service.hashPassword('same');
      expect(h1).not.toBe(h2);
    });
  });

  describe('login', () => {
    const buildDto = (overrides: Partial<LoginDto> = {}): LoginDto => {
      const dto = new LoginDto();
      dto.documentType = DocumentTypeDto.DNI;
      dto.documentNumber = '12345678';
      dto.password = 'Password123!';
      return Object.assign(dto, overrides);
    };

    it('returns accessToken + user on valid credentials', async () => {
      const result = await service.login(buildDto());
      expect(result.accessToken).toBe('access.token.here');
      expect(result.user.id).toBe('user-1');
      expect(result.user.role).toMatchObject({ id: 'role-1', name: 'ADMIN' });
      expect(Array.isArray(result.user.role.permissions)).toBe(true);
      expect(result.refreshToken).toBeDefined();
      expect(result.refreshToken.length).toBeGreaterThan(40);
    });

    it('rejects invalid DNI format (7 digits) without hitting DB', async () => {
      await expect(
        service.login(buildDto({ documentNumber: '1234567' })),
      ).rejects.toMatchObject({
        errorCode: 'INVALID_DOCUMENT_FORMAT',
      });
      expect(prismaMock.user.findFirst).not.toHaveBeenCalled();
    });

    it('rejects CE with wrong length', async () => {
      await expect(
        service.login(
          buildDto({ documentType: DocumentTypeDto.CE, documentNumber: '12345678' }),
        ),
      ).rejects.toMatchObject({ errorCode: 'INVALID_DOCUMENT_FORMAT' });
    });

    it('rejects when user not found', async () => {
      prismaMock.user.findFirst.mockResolvedValueOnce(null);
      await expect(service.login(buildDto())).rejects.toMatchObject({
        errorCode: 'INVALID_CREDENTIALS',
      });
    });

    it('rejects inactive user', async () => {
      prismaMock.user.findFirst.mockResolvedValueOnce({ ...mockUser, active: false });
      await expect(service.login(buildDto())).rejects.toMatchObject({
        errorCode: 'USER_INACTIVE',
      });
    });

    it('rejects wrong password', async () => {
      await expect(
        service.login(buildDto({ password: 'WrongPassword!' })),
      ).rejects.toMatchObject({ errorCode: 'INVALID_CREDENTIALS' });
    });

    it('stores a hashed refresh token in DB (not the raw token)', async () => {
      const result = await service.login(buildDto());
      const storedCall = prismaMock.refreshToken.create.mock.calls[0]?.[0] as {
        data: { tokenHash: string };
      };
      expect(storedCall.data.tokenHash).not.toBe(result.refreshToken);
      expect(storedCall.data.tokenHash).toHaveLength(64); // sha256 hex
    });
  });

  describe('refresh', () => {
    it('returns new accessToken for valid refresh token', async () => {
      prismaMock.refreshToken.findUnique.mockResolvedValueOnce({
        tokenHash: 'hash',
        expiresAt: new Date(Date.now() + 10000),
        user: { ...mockUser, role: mockRole },
      });
      const result = await service.refresh('some-raw-token');
      expect(result.accessToken).toBe('access.token.here');
    });

    it('throws REFRESH_TOKEN_EXPIRED when token not found', async () => {
      prismaMock.refreshToken.findUnique.mockResolvedValueOnce(null);
      await expect(service.refresh('bad-token')).rejects.toMatchObject({
        errorCode: 'REFRESH_TOKEN_EXPIRED',
      });
    });

    it('throws REFRESH_TOKEN_EXPIRED when token is expired', async () => {
      prismaMock.refreshToken.findUnique.mockResolvedValueOnce({
        tokenHash: 'hash',
        expiresAt: new Date(Date.now() - 1000),
        user: { ...mockUser, role: mockRole },
      });
      await expect(service.refresh('expired-token')).rejects.toMatchObject({
        errorCode: 'REFRESH_TOKEN_EXPIRED',
      });
    });
  });

  describe('logout', () => {
    it('deletes the refresh token from DB', async () => {
      await service.logout('some-raw-token');
      expect(prismaMock.refreshToken.deleteMany).toHaveBeenCalledWith({
        where: { tokenHash: expect.any(String) as string },
      });
    });

    it('is idempotent (token not found does not throw)', async () => {
      prismaMock.refreshToken.deleteMany.mockResolvedValueOnce({ count: 0 });
      await expect(service.logout('nonexistent')).resolves.toBeUndefined();
    });
  });

  describe('BusinessException shape', () => {
    it('has the correct HTTP status on INVALID_CREDENTIALS', async () => {
      prismaMock.user.findFirst.mockResolvedValueOnce(null);
      try {
        await service.login(
          Object.assign(new LoginDto(), {
            documentType: DocumentTypeDto.DNI,
            documentNumber: '12345678',
            password: 'x',
          }),
        );
        fail('should have thrown');
      } catch (e) {
        const ex = e as BusinessException;
        expect(ex.getStatus()).toBe(HttpStatus.UNAUTHORIZED);
      }
    });
  });
});
