import { Injectable, HttpStatus } from '@nestjs/common';

import { BusinessException } from '../../common/exceptions/business.exception';
import { BusinessErrorCode } from '@kardex/types';
import { generateCode } from '../../common/utils/code-generator';
import { PrismaService } from '../../prisma/prisma.service';
import type { PaginationQueryDto } from '../../common/dto/pagination.dto';
import type { CreateCategoryDto, UpdateCategoryDto } from './dto/category.dto';

@Injectable()
export class CategoriesService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(query: PaginationQueryDto & { parentId?: string | 'root' }) {
    const {
      page = 1,
      pageSize = 20,
      sortBy = 'code',
      sortOrder = 'asc',
      search,
      parentId,
    } = query;
    const skip = (page - 1) * pageSize;

    const where = {
      deletedAt: null,
      ...(parentId === 'root' ? { parentId: null } : parentId ? { parentId } : {}),
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
          parent: { select: { id: true, code: true, name: true } },
          _count: { select: { children: true, items: true } },
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
        parent: { select: { id: true, code: true, name: true } },
        children: {
          where: { deletedAt: null },
          select: { id: true, code: true, name: true },
        },
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
    if (dto.parentId) {
      await this.findOne(dto.parentId);
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
    if (dto.parentId === id) {
      throw new BusinessException(
        BusinessErrorCode.INVALID_INPUT,
        'Una categoría no puede ser su propio padre',
        HttpStatus.BAD_REQUEST,
      );
    }
    return this.prisma.category.update({ where: { id }, data: dto });
  }

  async remove(id: string) {
    await this.findOne(id);
    const hasChildren = await this.prisma.category.findFirst({
      where: { parentId: id, deletedAt: null },
    });
    if (hasChildren) {
      throw new BusinessException(
        BusinessErrorCode.RESOURCE_IN_USE,
        'No se puede eliminar una categoría con subcategorías activas',
        HttpStatus.CONFLICT,
      );
    }
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
