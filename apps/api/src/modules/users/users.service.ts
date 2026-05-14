import { Injectable, Logger, HttpStatus } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { DocumentType, Prisma } from '@prisma/client';

import { PrismaService } from '../../prisma/prisma.service';
import { BusinessException } from '../../common/exceptions/business.exception';
import { BusinessErrorCode, WS_EVENTS, type SessionKilledPayload } from '@kardex/types';
import { RealtimeService } from '../realtime/realtime.service';
import type { ContractDuration, CreateUserDto, UpdateUserDto } from './dto/user.dto';

const BCRYPT_ROUNDS = 12;

const USER_SELECT = {
  id: true,
  documentType: true,
  documentNumber: true,
  firstName: true,
  paternalLastName: true,
  maternalLastName: true,
  lastName: true,
  email: true,
  phone: true,
  active: true,
  mustChangePassword: true,
  lastLoginAt: true,
  contractEndDate: true,
  createdAt: true,
  role: { select: { id: true, name: true, description: true } },
} satisfies Prisma.UserSelect;

/** Computa el `lastName` derivado a partir de paterno + materno. */
function composeLastName(paternal: string, maternal?: string | null): string {
  const p = paternal.trim();
  const m = (maternal ?? '').trim();
  return m ? `${p} ${m}` : p;
}

/** Suma N meses a una fecha respetando fin de mes (ej. 31 ene + 1 mes = 28/29 feb). */
function addMonths(date: Date, months: number): Date {
  const d = new Date(date);
  const targetMonth = d.getMonth() + months;
  d.setMonth(targetMonth);
  // Si el día desbordó (31 ene → mar), JavaScript ya lo ajusta automáticamente.
  return d;
}

@Injectable()
export class UsersService {
  private readonly logger = new Logger(UsersService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly realtime: RealtimeService,
  ) {}

  async findAll(query: {
    page?: number;
    pageSize?: number;
    search?: string;
    active?: boolean;
    roleId?: string;
    contractStatus?: 'NONE' | 'VALID' | 'EXPIRING_30D' | 'EXPIRING_7D' | 'EXPIRED';
  }) {
    const { page = 1, pageSize = 20, search, active, roleId, contractStatus } = query;
    const skip = (page - 1) * pageSize;

    // Filtro de contrato — compone where según proximidad a contractEndDate.
    const now = new Date();
    const in7d = new Date(now);
    in7d.setDate(in7d.getDate() + 7);
    const in30d = new Date(now);
    in30d.setDate(in30d.getDate() + 30);

    const contractWhere: Prisma.UserWhereInput | null = (() => {
      switch (contractStatus) {
        case 'NONE':
          return { contractEndDate: null };
        case 'EXPIRED':
          return { contractEndDate: { lt: now } };
        case 'EXPIRING_7D':
          return { contractEndDate: { gte: now, lte: in7d } };
        case 'EXPIRING_30D':
          return { contractEndDate: { gte: now, lte: in30d } };
        case 'VALID':
          return { contractEndDate: { gt: in30d } };
        default:
          return null;
      }
    })();

    const where: Prisma.UserWhereInput = {
      deletedAt: null,
      ...(active !== undefined && { active }),
      ...(roleId && { roleId }),
      ...(contractWhere ?? {}),
      ...(search && {
        OR: [
          { firstName: { contains: search, mode: 'insensitive' } },
          { lastName: { contains: search, mode: 'insensitive' } },
          { documentNumber: { contains: search, mode: 'insensitive' } },
          { email: { contains: search, mode: 'insensitive' } },
        ],
      }),
    };

    const [users, total] = await Promise.all([
      this.prisma.user.findMany({
        where,
        select: USER_SELECT,
        orderBy: [{ active: 'desc' }, { firstName: 'asc' }],
        skip,
        take: pageSize,
      }),
      this.prisma.user.count({ where }),
    ]);

    return {
      items: users,
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    };
  }

  async findOne(id: string) {
    const user = await this.prisma.user.findFirst({
      where: { id, deletedAt: null },
      select: USER_SELECT,
    });
    if (!user) {
      throw new BusinessException(
        BusinessErrorCode.USER_NOT_FOUND,
        'Usuario no encontrado',
        HttpStatus.NOT_FOUND,
      );
    }
    return user;
  }

  async create(dto: CreateUserDto) {
    const existing = await this.prisma.user.findFirst({
      where: {
        documentType: dto.documentType,
        documentNumber: dto.documentNumber,
        deletedAt: null,
      },
    });
    if (existing) {
      throw new BusinessException(
        BusinessErrorCode.DOCUMENT_ALREADY_REGISTERED,
        'Ya existe un usuario con este documento',
        HttpStatus.CONFLICT,
      );
    }

    if (dto.email) {
      const emailUsed = await this.prisma.user.findFirst({
        where: { email: dto.email, deletedAt: null },
      });
      if (emailUsed) {
        throw new BusinessException(
          BusinessErrorCode.USER_ALREADY_EXISTS,
          'El email ya está registrado',
          HttpStatus.CONFLICT,
        );
      }
    }

    // Regla peruana: si DNI, el apellido materno es obligatorio. CE/Pasaporte
    // pueden no tener apellido materno (extranjeros).
    if (dto.documentType === DocumentType.DNI && !dto.maternalLastName?.trim()) {
      throw new BusinessException(
        BusinessErrorCode.INVALID_INPUT,
        'El apellido materno es obligatorio para usuarios con DNI',
        HttpStatus.BAD_REQUEST,
      );
    }

    const role = await this.prisma.role.findUnique({ where: { id: dto.roleId } });
    if (!role) {
      throw new BusinessException(
        BusinessErrorCode.NOT_FOUND,
        'Rol no encontrado',
        HttpStatus.NOT_FOUND,
      );
    }

    const passwordHash = await bcrypt.hash(dto.password, BCRYPT_ROUNDS);
    const lastName = composeLastName(dto.paternalLastName, dto.maternalLastName);
    const contractEndDate = dto.contractDurationMonths
      ? addMonths(new Date(), dto.contractDurationMonths)
      : null;

    return this.prisma.user.create({
      data: {
        documentType: dto.documentType,
        documentNumber: dto.documentNumber,
        passwordHash,
        firstName: dto.firstName,
        paternalLastName: dto.paternalLastName,
        maternalLastName: dto.maternalLastName || null,
        lastName,
        email: dto.email,
        phone: dto.phone,
        roleId: dto.roleId,
        contractEndDate,
        mustChangePassword: true,
      },
      select: USER_SELECT,
    });
  }

  async update(id: string, dto: UpdateUserDto) {
    const current = await this.findOne(id);

    if (dto.email) {
      const emailUsed = await this.prisma.user.findFirst({
        where: { email: dto.email, deletedAt: null, NOT: { id } },
      });
      if (emailUsed) {
        throw new BusinessException(
          BusinessErrorCode.USER_ALREADY_EXISTS,
          'El email ya está registrado',
          HttpStatus.CONFLICT,
        );
      }
    }

    // Si tocan paterno o materno, recomputamos lastName con los valores resultantes.
    const willTouchNames =
      dto.paternalLastName !== undefined || dto.maternalLastName !== undefined;
    const finalPaternal = dto.paternalLastName ?? current.paternalLastName ?? '';
    const finalMaternal = dto.maternalLastName ?? current.maternalLastName ?? '';

    // Misma regla peruana en update: si DNI y se vacía el materno, rechazar.
    if (
      willTouchNames &&
      current.documentType === DocumentType.DNI &&
      !finalMaternal.trim()
    ) {
      throw new BusinessException(
        BusinessErrorCode.INVALID_INPUT,
        'El apellido materno es obligatorio para usuarios con DNI',
        HttpStatus.BAD_REQUEST,
      );
    }

    return this.prisma.user.update({
      where: { id },
      data: {
        ...(dto.firstName && { firstName: dto.firstName }),
        ...(dto.paternalLastName !== undefined && {
          paternalLastName: dto.paternalLastName,
        }),
        ...(dto.maternalLastName !== undefined && {
          maternalLastName: dto.maternalLastName || null,
        }),
        ...(willTouchNames && {
          lastName: composeLastName(finalPaternal, finalMaternal),
        }),
        ...(dto.email !== undefined && { email: dto.email }),
        ...(dto.phone !== undefined && { phone: dto.phone }),
        ...(dto.roleId && { roleId: dto.roleId }),
      },
      select: USER_SELECT,
    });
  }

  /** Renueva la ventana de contrato del usuario desde HOY + N meses. */
  async renewContract(id: string, months: ContractDuration) {
    await this.findOne(id);
    const contractEndDate = addMonths(new Date(), months);
    return this.prisma.user.update({
      where: { id },
      data: { contractEndDate },
      select: USER_SELECT,
    });
  }

  async setActive(id: string, active: boolean, actorUserId?: string) {
    await this.findOne(id);

    // Self-protect: bloquear que un admin se auto-desactive (lock-out).
    if (!active && actorUserId && actorUserId === id) {
      throw new BusinessException(
        BusinessErrorCode.INVALID_INPUT,
        'No puedes desactivar tu propia cuenta',
        HttpStatus.BAD_REQUEST,
      );
    }

    // Al desactivar, invalidar TODOS los refresh tokens del usuario: en su
    // próximo intento de refrescar la sesión será rechazado. El access token
    // actual sigue válido hasta JWT_EXPIRES_IN (15m), pero el WebSocket
    // SESSION_KILLED de abajo cierra la sesión activa al instante.
    if (!active) {
      await this.prisma.refreshToken.deleteMany({ where: { userId: id } });
    }

    const updated = await this.prisma.user.update({
      where: { id },
      data: { active },
      select: USER_SELECT,
    });

    if (!active) {
      this.killSession(id, 'USER_DISABLED');
    }

    return updated;
  }

  /**
   * Resetea la contraseña al número de documento del usuario + marca
   * mustChangePassword=true para forzar cambio en el siguiente login.
   * Pensado para que un admin recupere acceso de un usuario que olvidó la
   * contraseña y no tiene email registrado (no puede usar /forgot-password).
   */
  async resetPassword(id: string, actorUserId?: string) {
    // Self-protect: si olvidaste tu propia pass, usa el flujo regular o pídele
    // a otro admin que la resetee (evita el caso "me reseteo a mi mismo,
    // pierdo el access token actual y me quedo afuera").
    if (actorUserId && actorUserId === id) {
      throw new BusinessException(
        BusinessErrorCode.INVALID_INPUT,
        'No puedes resetear tu propia contraseña — pídele a otro administrador',
        HttpStatus.BAD_REQUEST,
      );
    }

    const user = await this.findOne(id);
    const passwordHash = await bcrypt.hash(user.documentNumber, BCRYPT_ROUNDS);

    // Mismo patrón que desactivar: invalidar refresh tokens + emitir
    // SESSION_KILLED para que el usuario sea expulsado inmediatamente.
    await this.prisma.refreshToken.deleteMany({ where: { userId: id } });

    const updated = await this.prisma.user.update({
      where: { id },
      data: { passwordHash, mustChangePassword: true },
      select: USER_SELECT,
    });

    this.killSession(id, 'PASSWORD_RESET');

    return updated;
  }

  /**
   * Cierra inmediatamente la sesión activa del usuario emitiendo
   * SESSION_KILLED por WebSocket. Best-effort: si el gateway falla, el flujo
   * principal (deactivate/reset) sigue siendo válido — el usuario será
   * expulsado al máximo en JWT_EXPIRES_IN (15m) cuando el access token caduque.
   */
  private killSession(userId: string, reason: SessionKilledPayload['reason']): void {
    try {
      this.realtime.emitToUser(userId, WS_EVENTS.SESSION_KILLED, {
        reason,
      } satisfies SessionKilledPayload);
    } catch (err) {
      this.logger.warn(`SESSION_KILLED emit failed for ${userId}: ${String(err)}`);
    }
  }

  async getRoles() {
    return this.prisma.role.findMany({ orderBy: { name: 'asc' } });
  }
}
