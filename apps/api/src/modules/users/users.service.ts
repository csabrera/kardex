import { Injectable, HttpStatus } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { Prisma } from '@prisma/client';

import { PrismaService } from '../../prisma/prisma.service';
import { BusinessException } from '../../common/exceptions/business.exception';
import { BusinessErrorCode } from '@kardex/types';
import type { CreateUserDto, UpdateUserDto } from './dto/user.dto';

const BCRYPT_ROUNDS = 12;

const USER_SELECT = {
  id: true,
  documentType: true,
  documentNumber: true,
  firstName: true,
  lastName: true,
  email: true,
  phone: true,
  active: true,
  mustChangePassword: true,
  lastLoginAt: true,
  createdAt: true,
  role: { select: { id: true, name: true, description: true } },
} satisfies Prisma.UserSelect;

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

    const role = await this.prisma.role.findUnique({ where: { id: dto.roleId } });
    if (!role) {
      throw new BusinessException(
        BusinessErrorCode.NOT_FOUND,
        'Rol no encontrado',
        HttpStatus.NOT_FOUND,
      );
    }

    const passwordHash = await bcrypt.hash(dto.password, BCRYPT_ROUNDS);

    return this.prisma.user.create({
      data: {
        documentType: dto.documentType,
        documentNumber: dto.documentNumber,
        passwordHash,
        firstName: dto.firstName,
        lastName: dto.lastName,
        email: dto.email,
        phone: dto.phone,
        roleId: dto.roleId,
        mustChangePassword: true,
      },
      select: USER_SELECT,
    });
  }

  async update(id: string, dto: UpdateUserDto) {
    await this.findOne(id);

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

    return this.prisma.user.update({
      where: { id },
      data: {
        ...(dto.firstName && { firstName: dto.firstName }),
        ...(dto.lastName && { lastName: dto.lastName }),
        ...(dto.email !== undefined && { email: dto.email }),
        ...(dto.phone !== undefined && { phone: dto.phone }),
        ...(dto.roleId && { roleId: dto.roleId }),
      },
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

  async getRoles() {
    return this.prisma.role.findMany({ orderBy: { name: 'asc' } });
  }
}
