import { Injectable, HttpStatus } from '@nestjs/common';
import { Prisma } from '@prisma/client';

import { BusinessException } from '../../common/exceptions/business.exception';
import { BusinessErrorCode } from '@kardex/types';
import { generateCode } from '../../common/utils/code-generator';
import { PrismaService } from '../../prisma/prisma.service';
import type { PaginationQueryDto } from '../../common/dto/pagination.dto';
import type { CreateCategoryDto, UpdateCategoryDto } from './dto/category.dto';

@Injectable()
export class CategoriesService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(query: PaginationQueryDto) {
    const { page = 1, pageSize = 20, sortBy = 'code', sortOrder = 'asc', search } = query;
    const skip = (page - 1) * pageSize;

    const where: Prisma.CategoryWhereInput = {
      deletedAt: null,
      ...(search && {
        OR: [
          { code: { contains: search, mode: 'insensitive' as const } },
          { name: { contains: search, mode: 'insensitive' as const } },
        ],
      }),
    };

    const [items, total] = await Promise.all([
      this.prisma.category.findMany({
        where,
        include: {
          _count: { select: { items: true } },
        },
        orderBy: { [sortBy]: sortOrder },
        skip,
        take: pageSize,
      }),
      this.prisma.category.count({ where }),
    ]);

    return { items, total, page, pageSize, totalPages: Math.ceil(total / pageSize) };
  }

  async findOne(id: string) {
    const category = await this.prisma.category.findFirst({
      where: { id, deletedAt: null },
      include: {
        _count: { select: { items: true } },
      },
    });
    if (!category) {
      throw new BusinessException(
        BusinessErrorCode.NOT_FOUND,
        'Categoría no encontrada',
        HttpStatus.NOT_FOUND,
      );
    }
    return category;
  }

  async create(dto: CreateCategoryDto) {
    let code = dto.code?.trim().toUpperCase();
    if (code) {
      const existing = await this.prisma.category.findUnique({ where: { code } });
      if (existing) {
        throw new BusinessException(
          BusinessErrorCode.DUPLICATE_RESOURCE,
          `Ya existe una categoría con el código "${code}"`,
          HttpStatus.CONFLICT,
        );
      }
    } else {
      for (let i = 0; i < 3; i++) {
        const candidate = generateCode('CAT');
        const dup = await this.prisma.category.findUnique({ where: { code: candidate } });
        if (!dup) {
          code = candidate;
          break;
        }
      }
      if (!code) throw new Error('No se pudo generar código único para la categoría');
    }
    return this.prisma.category.create({ data: { ...dto, code } });
  }

  async update(id: string, dto: UpdateCategoryDto) {
    await this.findOne(id);
    if (dto.code) {
      const conflict = await this.prisma.category.findFirst({
        where: { code: dto.code, id: { not: id } },
      });
      if (conflict) {
        throw new BusinessException(
          BusinessErrorCode.DUPLICATE_RESOURCE,
          `Ya existe una categoría con el código "${dto.code}"`,
          HttpStatus.CONFLICT,
        );
      }
    }
    return this.prisma.category.update({ where: { id }, data: dto });
  }

  async remove(id: string) {
    await this.findOne(id);
    const hasItems = await this.prisma.item.findFirst({
      where: { categoryId: id, deletedAt: null },
    });
    if (hasItems) {
      throw new BusinessException(
        BusinessErrorCode.RESOURCE_IN_USE,
        'No se puede eliminar una categoría con ítems asignados',
        HttpStatus.CONFLICT,
      );
    }
    return this.prisma.category.update({
      where: { id },
      data: { deletedAt: new Date() },
    });
  }
}
