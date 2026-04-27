import { HttpStatus, Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';

import { BusinessErrorCode } from '@kardex/types';
import { BusinessException } from '../../common/exceptions/business.exception';
import { generateCode } from '../../common/utils/code-generator';
import { PrismaService } from '../../prisma/prisma.service';
import type { CreateSupplierDto, UpdateSupplierDto } from './dto/supplier.dto';

interface SupplierQuery {
  search?: string;
  includeInactive?: boolean;
  page?: number;
  pageSize?: number;
}

@Injectable()
export class SuppliersService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(query: SupplierQuery) {
    const { search, includeInactive, page = 1, pageSize = 20 } = query;
    const where: Prisma.SupplierWhereInput = {
      deletedAt: null,
      ...(!includeInactive && { active: true }),
      ...(search && {
        OR: [
          { name: { contains: search, mode: 'insensitive' } },
          { code: { contains: search, mode: 'insensitive' } },
          { taxId: { contains: search, mode: 'insensitive' } },
          { contactName: { contains: search, mode: 'insensitive' } },
        ],
      }),
    };

    const [items, total] = await this.prisma.$transaction([
      this.prisma.supplier.findMany({
        where,
        orderBy: { name: 'asc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.supplier.count({ where }),
    ]);

    return {
      items,
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    };
  }

  async findOne(id: string) {
    const supplier = await this.prisma.supplier.findFirst({
      where: { id, deletedAt: null },
    });
    if (!supplier) {
      throw new BusinessException(
        BusinessErrorCode.NOT_FOUND,
        'Proveedor no encontrado',
        HttpStatus.NOT_FOUND,
      );
    }
    return supplier;
  }

  async create(dto: CreateSupplierDto) {
    let code = dto.code?.trim().toUpperCase();
    if (code) {
      const existing = await this.prisma.supplier.findUnique({ where: { code } });
      if (existing) {
        throw new BusinessException(
          BusinessErrorCode.DUPLICATE_RESOURCE,
          `Ya existe un proveedor con código "${code}"`,
          HttpStatus.CONFLICT,
        );
      }
    } else {
      for (let i = 0; i < 3; i++) {
        const candidate = generateCode('PRV');
        const dup = await this.prisma.supplier.findUnique({ where: { code: candidate } });
        if (!dup) {
          code = candidate;
          break;
        }
      }
      if (!code) throw new Error('No se pudo generar código único para el proveedor');
    }

    if (dto.taxId) {
      const dupTax = await this.prisma.supplier.findFirst({
        where: { taxId: dto.taxId.trim(), deletedAt: null },
      });
      if (dupTax) {
        throw new BusinessException(
          BusinessErrorCode.DUPLICATE_RESOURCE,
          `Ya existe un proveedor con documento "${dto.taxId}"`,
          HttpStatus.CONFLICT,
        );
      }
    }

    return this.prisma.supplier.create({
      data: {
        code,
        name: dto.name.trim(),
        taxId: dto.taxId?.trim(),
        contactName: dto.contactName?.trim(),
        phone: dto.phone?.trim(),
        email: dto.email?.trim().toLowerCase(),
        address: dto.address?.trim(),
        notes: dto.notes?.trim(),
      },
    });
  }

  async update(id: string, dto: UpdateSupplierDto) {
    await this.findOne(id);

    if (dto.taxId) {
      const dupTax = await this.prisma.supplier.findFirst({
        where: {
          taxId: dto.taxId.trim(),
          deletedAt: null,
          NOT: { id },
        },
      });
      if (dupTax) {
        throw new BusinessException(
          BusinessErrorCode.DUPLICATE_RESOURCE,
          `Ya existe otro proveedor con documento "${dto.taxId}"`,
          HttpStatus.CONFLICT,
        );
      }
    }

    return this.prisma.supplier.update({
      where: { id },
      data: {
        ...(dto.name && { name: dto.name.trim() }),
        ...(dto.taxId !== undefined && { taxId: dto.taxId?.trim() ?? null }),
        ...(dto.contactName !== undefined && {
          contactName: dto.contactName?.trim() ?? null,
        }),
        ...(dto.phone !== undefined && { phone: dto.phone?.trim() ?? null }),
        ...(dto.email !== undefined && {
          email: dto.email?.trim().toLowerCase() ?? null,
        }),
        ...(dto.address !== undefined && { address: dto.address?.trim() ?? null }),
        ...(dto.notes !== undefined && { notes: dto.notes?.trim() ?? null }),
        ...(dto.active !== undefined && { active: dto.active }),
      },
    });
  }

  async remove(id: string) {
    await this.findOne(id);

    // Si hay movimientos vinculados, bloquear eliminación (soft delete de supplier
    // rompería el histórico de compras).
    const movementsCount = await this.prisma.movement.count({
      where: { supplierId: id },
    });
    if (movementsCount > 0) {
      throw new BusinessException(
        BusinessErrorCode.RESOURCE_IN_USE,
        `No se puede eliminar: ${movementsCount} movimiento(s) de compra vinculados. Desactivarlo preserva el histórico.`,
        HttpStatus.CONFLICT,
      );
    }

    return this.prisma.supplier.update({
      where: { id },
      data: { deletedAt: new Date() },
    });
  }
}
