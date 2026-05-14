import { Injectable, HttpStatus } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { DocumentType, Prisma } from '@prisma/client';

import { PrismaService } from '../../prisma/prisma.service';
import { BusinessException } from '../../common/exceptions/business.exception';
import { BusinessErrorCode } from '@kardex/types';
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
  constructor(private readonly prisma: PrismaService) {}

  async findAll(query: {
    page?: number;
    pageSize?: number;
    search?: string;
    active?: boolean;
  }) {
    const { page = 1, pageSize = 20, search, active } = query;
    const skip = (page - 1) * pageSize;

    const where: Prisma.UserWhereInput = {
      deletedAt: null,
      ...(active !== undefined && { active }),
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

  async setActive(id: string, active: boolean) {
    await this.findOne(id);
    return this.prisma.user.update({
      where: { id },
      data: { active },
      select: USER_SELECT,
    });
  }

  /**
   * Resetea la contraseña al número de documento del usuario + marca
   * mustChangePassword=true para forzar cambio en el siguiente login.
   * Pensado para que un admin recupere acceso de un usuario que olvidó la
   * contraseña y no tiene email registrado (no puede usar /forgot-password).
   */
  async resetPassword(id: string) {
    const user = await this.findOne(id);
    const passwordHash = await bcrypt.hash(user.documentNumber, BCRYPT_ROUNDS);
    return this.prisma.user.update({
      where: { id },
      data: { passwordHash, mustChangePassword: true },
      select: USER_SELECT,
    });
  }

  async getRoles() {
    return this.prisma.role.findMany({ orderBy: { name: 'asc' } });
  }
}
