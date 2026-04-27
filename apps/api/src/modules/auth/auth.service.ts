import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { DocumentType } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { randomBytes, createHash } from 'crypto';
import { HttpStatus } from '@nestjs/common';

import { BusinessException } from '../../common/exceptions/business.exception';
import { BusinessErrorCode } from '@kardex/types';
import type { Configuration } from '../../config/configuration';
import { PrismaService } from '../../prisma/prisma.service';
import type { ChangePasswordDto } from './dto/change-password.dto';
import type { ForgotPasswordDto } from './dto/forgot-password.dto';
import type { LoginDto } from './dto/login.dto';
import type { ResetPasswordDto } from './dto/reset-password.dto';
import type { SetupDto } from './dto/setup.dto';
import type { JwtPayload } from './strategies/jwt.strategy';

const RESET_TOKEN_BYTES = 32;
const RESET_TOKEN_EXPIRY_MS = 60 * 60 * 1000; // 1 hour

const BCRYPT_ROUNDS = 12;
const REFRESH_TOKEN_BYTES = 40;

export interface LoginResult {
  accessToken: string;
  refreshToken: string;
  user: {
    id: string;
    firstName: string;
    lastName: string;
    email: string | null;
    documentType: string;
    documentNumber: string;
    role: { id: string; name: string; permissions: string[] };
    mustChangePassword: boolean;
  };
}

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly config: ConfigService<Configuration, true>,
  ) {}

  async login(dto: LoginDto): Promise<LoginResult> {
    const pattern = dto.getDocumentPattern();
    if (!pattern.test(dto.documentNumber)) {
      throw new BusinessException(
        BusinessErrorCode.INVALID_DOCUMENT_FORMAT,
        `Formato de documento inválido para ${dto.documentType}`,
        HttpStatus.BAD_REQUEST,
      );
    }

    const user = await this.prisma.user.findFirst({
      where: {
        documentType: dto.documentType as DocumentType,
        documentNumber: dto.documentNumber,
        deletedAt: null,
      },
      include: { role: true },
    });

    if (!user) {
      throw new BusinessException(
        BusinessErrorCode.INVALID_CREDENTIALS,
        'Credenciales inválidas',
        HttpStatus.UNAUTHORIZED,
      );
    }

    if (!user.active) {
      throw new BusinessException(
        BusinessErrorCode.USER_INACTIVE,
        'Usuario inactivo',
        HttpStatus.FORBIDDEN,
      );
    }

    const passwordValid = await bcrypt.compare(dto.password, user.passwordHash);
    if (!passwordValid) {
      throw new BusinessException(
        BusinessErrorCode.INVALID_CREDENTIALS,
        'Credenciales inválidas',
        HttpStatus.UNAUTHORIZED,
      );
    }

    await this.prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() },
    });

    this.logger.log(`Login exitoso: ${user.documentType}:${user.documentNumber}`);
    return this.issueTokens(user, { id: user.role.id, name: user.role.name });
  }

  async refresh(rawToken: string): Promise<{ accessToken: string }> {
    const tokenHash = this.hashToken(rawToken);
    const stored = await this.prisma.refreshToken.findUnique({
      where: { tokenHash },
      include: { user: { include: { role: true } } },
    });

    if (!stored || stored.expiresAt < new Date()) {
      throw new BusinessException(
        BusinessErrorCode.REFRESH_TOKEN_EXPIRED,
        'Sesión expirada, vuelve a iniciar sesión',
        HttpStatus.UNAUTHORIZED,
      );
    }

    if (!stored.user.active) {
      throw new BusinessException(
        BusinessErrorCode.USER_INACTIVE,
        'Usuario inactivo',
        HttpStatus.FORBIDDEN,
      );
    }

    const payload: JwtPayload = {
      sub: stored.user.id,
      documentType: stored.user.documentType,
      documentNumber: stored.user.documentNumber,
      role: stored.user.role.name,
      email: stored.user.email ?? undefined,
    };

    const jwtConfig = this.config.get('jwt', { infer: true });
    const accessToken = this.jwtService.sign(payload as object, {
      secret: jwtConfig.secret,
      // ms@3 uses branded StringValue type; cast is safe — value comes from validated config
      expiresIn: jwtConfig.expiresIn as never,
    });

    return { accessToken };
  }

  async logout(rawToken: string): Promise<void> {
    const tokenHash = this.hashToken(rawToken);
    await this.prisma.refreshToken.deleteMany({ where: { tokenHash } });
  }

  async forgotPassword(
    dto: ForgotPasswordDto,
    isDev: boolean,
  ): Promise<{ token?: string; message: string }> {
    const pattern = { DNI: /^\d{8}$/, CE: /^\d{9}$/, PASAPORTE: /^[A-Z0-9]{6,12}$/ }[
      dto.documentType
    ];
    if (!pattern.test(dto.documentNumber)) {
      throw new BusinessException(
        BusinessErrorCode.INVALID_DOCUMENT_FORMAT,
        `Formato de documento inválido para ${dto.documentType}`,
        HttpStatus.BAD_REQUEST,
      );
    }

    const user = await this.prisma.user.findFirst({
      where: {
        documentType: dto.documentType as DocumentType,
        documentNumber: dto.documentNumber,
        deletedAt: null,
        active: true,
      },
    });

    // Always return success to avoid user enumeration
    const genericMessage =
      'Si el documento está registrado, recibirás instrucciones de recuperación';

    if (!user) return { message: genericMessage };

    // Invalidate previous tokens for this user
    await this.prisma.passwordResetToken.deleteMany({ where: { userId: user.id } });

    const rawToken = randomBytes(RESET_TOKEN_BYTES).toString('hex');
    const tokenHash = this.hashToken(rawToken);
    const expiresAt = new Date(Date.now() + RESET_TOKEN_EXPIRY_MS);

    await this.prisma.passwordResetToken.create({
      data: { tokenHash, userId: user.id, expiresAt },
    });

    this.logger.log(`Reset token generado para userId=${user.id}`);

    if (isDev) return { token: rawToken, message: genericMessage };
    return { message: genericMessage };
  }

  async resetPassword(rawToken: string, dto: ResetPasswordDto): Promise<void> {
    if (dto.newPassword !== dto.confirmPassword) {
      throw new BusinessException(
        BusinessErrorCode.INVALID_INPUT,
        'Las contraseñas no coinciden',
        HttpStatus.BAD_REQUEST,
      );
    }

    const tokenHash = this.hashToken(rawToken);
    const stored = await this.prisma.passwordResetToken.findUnique({
      where: { tokenHash },
    });

    if (!stored || stored.used || stored.expiresAt < new Date()) {
      throw new BusinessException(
        BusinessErrorCode.TOKEN_INVALID,
        'Token inválido o expirado',
        HttpStatus.BAD_REQUEST,
      );
    }

    const newHash = await this.hashPassword(dto.newPassword);

    await this.prisma.$transaction([
      this.prisma.user.update({
        where: { id: stored.userId },
        data: { passwordHash: newHash, mustChangePassword: false },
      }),
      this.prisma.passwordResetToken.update({
        where: { tokenHash },
        data: { used: true },
      }),
      // Invalidate all refresh tokens on password reset
      this.prisma.refreshToken.deleteMany({ where: { userId: stored.userId } }),
    ]);

    this.logger.log(`Password reseteado para userId=${stored.userId}`);
  }

  async changePassword(userId: string, dto: ChangePasswordDto): Promise<void> {
    if (dto.newPassword !== dto.confirmPassword) {
      throw new BusinessException(
        BusinessErrorCode.INVALID_INPUT,
        'Las contraseñas no coinciden',
        HttpStatus.BAD_REQUEST,
      );
    }

    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      throw new BusinessException(
        BusinessErrorCode.USER_NOT_FOUND,
        'Usuario no encontrado',
        HttpStatus.NOT_FOUND,
      );
    }

    const valid = await bcrypt.compare(dto.oldPassword, user.passwordHash);
    if (!valid) {
      throw new BusinessException(
        BusinessErrorCode.INVALID_CREDENTIALS,
        'Contraseña actual incorrecta',
        HttpStatus.UNAUTHORIZED,
      );
    }

    const newHash = await this.hashPassword(dto.newPassword);
    await this.prisma.user.update({
      where: { id: userId },
      data: { passwordHash: newHash, mustChangePassword: false },
    });

    this.logger.log(`Password cambiado para userId=${userId}`);
  }

  async getSetupStatus(): Promise<{ setupCompleted: boolean }> {
    const setting = await this.prisma.systemSetting.findUnique({
      where: { key: 'SETUP_COMPLETED' },
    });
    return { setupCompleted: setting?.value === 'true' };
  }

  async setup(dto: SetupDto): Promise<LoginResult> {
    const { setupCompleted } = await this.getSetupStatus();
    if (setupCompleted) {
      throw new BusinessException(
        BusinessErrorCode.SETUP_ALREADY_COMPLETED,
        'El sistema ya fue configurado',
        HttpStatus.FORBIDDEN,
      );
    }

    if (dto.password !== dto.confirmPassword) {
      throw new BusinessException(
        BusinessErrorCode.INVALID_INPUT,
        'Las contraseñas no coinciden',
        HttpStatus.BAD_REQUEST,
      );
    }

    const pattern = { DNI: /^\d{8}$/, CE: /^\d{9}$/, PASAPORTE: /^[A-Z0-9]{6,12}$/ }[
      dto.documentType
    ];
    if (!pattern.test(dto.documentNumber)) {
      throw new BusinessException(
        BusinessErrorCode.INVALID_DOCUMENT_FORMAT,
        `Formato de documento inválido para ${dto.documentType}`,
        HttpStatus.BAD_REQUEST,
      );
    }

    const adminRole = await this.prisma.role.upsert({
      where: { name: 'ADMIN' },
      update: {},
      create: {
        name: 'ADMIN',
        description: 'Administrador del sistema con acceso total',
        systemRole: true,
      },
    });

    const passwordHash = await this.hashPassword(dto.password);

    const user = await this.prisma.user.create({
      data: {
        documentType: dto.documentType as DocumentType,
        documentNumber: dto.documentNumber,
        passwordHash,
        firstName: dto.firstName,
        lastName: dto.lastName,
        email: dto.email,
        roleId: adminRole.id,
        active: true,
        mustChangePassword: false,
      },
      include: { role: true },
    });

    await this.prisma.systemSetting.upsert({
      where: { key: 'SETUP_COMPLETED' },
      update: { value: 'true' },
      create: {
        key: 'SETUP_COMPLETED',
        value: 'true',
        description: 'Setup wizard completed',
      },
    });

    this.logger.log(
      `Setup completado. Admin creado: ${dto.documentType}:${dto.documentNumber}`,
    );

    // Auto-login after setup
    return this.issueTokens(user, { id: adminRole.id, name: adminRole.name });
  }

  async getMe(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: {
        role: {
          include: { permissions: { include: { permission: true } } },
        },
      },
    });

    if (!user) {
      throw new BusinessException(
        BusinessErrorCode.USER_NOT_FOUND,
        'Usuario no encontrado',
        HttpStatus.NOT_FOUND,
      );
    }

    return {
      id: user.id,
      firstName: user.firstName,
      lastName: user.lastName,
      email: user.email,
      documentType: user.documentType,
      documentNumber: user.documentNumber,
      mustChangePassword: user.mustChangePassword,
      role: {
        id: user.role.id,
        name: user.role.name,
        permissions: user.role.permissions.map(
          (rp) => `${rp.permission.resource}:${rp.permission.action}`,
        ),
      },
    };
  }

  async hashPassword(plain: string): Promise<string> {
    return bcrypt.hash(plain, BCRYPT_ROUNDS);
  }

  /**
   * Carga los permisos del rol como strings "resource:action".
   * Usado para que login/setup/getMe devuelvan el mismo shape al frontend.
   */
  private async loadRolePermissions(roleId: string): Promise<string[]> {
    const perms = await this.prisma.rolePermission.findMany({
      where: { roleId },
      include: { permission: true },
    });
    return perms.map((rp) => `${rp.permission.resource}:${rp.permission.action}`);
  }

  private async issueTokens(
    user: {
      id: string;
      firstName: string;
      lastName: string;
      email: string | null;
      documentType: string;
      documentNumber: string;
      mustChangePassword: boolean;
    },
    role: { id: string; name: string },
  ): Promise<LoginResult> {
    const payload: JwtPayload = {
      sub: user.id,
      documentType: user.documentType,
      documentNumber: user.documentNumber,
      role: role.name,
      email: user.email ?? undefined,
    };

    const jwtConfig = this.config.get('jwt', { infer: true });
    const accessToken = this.jwtService.sign(payload as object, {
      secret: jwtConfig.secret,
      expiresIn: jwtConfig.expiresIn as never,
    });

    const rawRefreshToken = randomBytes(REFRESH_TOKEN_BYTES).toString('hex');
    const tokenHash = this.hashToken(rawRefreshToken);
    const expiresAt = this.parseExpiry(jwtConfig.refreshExpiresIn);

    await this.prisma.refreshToken.create({
      data: { tokenHash, userId: user.id, expiresAt },
    });

    const permissions = await this.loadRolePermissions(role.id);

    return {
      accessToken,
      refreshToken: rawRefreshToken,
      user: {
        id: user.id,
        firstName: user.firstName,
        lastName: user.lastName,
        email: user.email,
        documentType: user.documentType,
        documentNumber: user.documentNumber,
        role: { id: role.id, name: role.name, permissions },
        mustChangePassword: user.mustChangePassword,
      },
    };
  }

  private hashToken(raw: string): string {
    return createHash('sha256').update(raw).digest('hex');
  }

  private parseExpiry(expiry: string): Date {
    const now = Date.now();
    const match = /^(\d+)([smhd])$/.exec(expiry);
    if (!match) return new Date(now + 7 * 24 * 60 * 60 * 1000);
    const [, amount, unit] = match;
    const ms: Record<string, number> = { s: 1000, m: 60000, h: 3600000, d: 86400000 };
    return new Date(now + parseInt(amount!, 10) * (ms[unit!] ?? 86400000));
  }
}
