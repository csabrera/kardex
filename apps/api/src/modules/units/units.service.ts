import { Injectable, HttpStatus } from '@nestjs/common';

import { BusinessException } from '../../common/exceptions/business.exception';
import { BusinessErrorCode } from '@kardex/types';
import { generateCode } from '../../common/utils/code-generator';
import { PrismaService } from '../../prisma/prisma.service';
import type { PaginationQueryDto } from '../../common/dto/pagination.dto';
import type { CreateUnitDto, UpdateUnitDto } from './dto/unit.dto';

@Injectable()
export class UnitsService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(query: PaginationQueryDto) {
    const { page = 1, pageSize = 20, sortBy = 'code', sortOrder = 'asc', search } = query;
    const skip = (page - 1) * pageSize;

    const where = {
      ...(search && {
        OR: [
          { code: { contains: search, mode: 'insensitive' as const } },
          { name: { contains: search, mode: 'insensitive' as const } },
          { abbreviation: { contains: search, mode: 'insensitive' as const } },
        ],
      }),
    };

    const [items, total] = await Promise.all([
      this.prisma.unit.findMany({
        where,
        orderBy: { [sortBy]: sortOrder },
        skip,
        take: pageSize,
      }),
      this.prisma.unit.count({ where }),
    ]);

    return { items, total, page, pageSize, totalPages: Math.ceil(total / pageSize) };
  }

  async findOne(id: string) {
    const unit = await this.prisma.unit.findUnique({ where: { id } });
    if (!unit) {
      throw new BusinessException(
        BusinessErrorCode.NOT_FOUND,
        'Unidad no encontrada',
        HttpStatus.NOT_FOUND,
      );
    }
    return unit;
  }

  async create(dto: CreateUnitDto) {
    let code = dto.code?.trim().toUpperCase();
    if (code) {
      const existing = await this.prisma.unit.findUnique({ where: { code } });
      if (existing) {
        throw new BusinessException(
          BusinessErrorCode.DUPLICATE_RESOURCE,
          `Ya existe una unidad con el código "${code}"`,
          HttpStatus.CONFLICT,
        );
      }
    } else {
      for (let i = 0; i < 3; i++) {
        const candidate = generateCode('UN');
        const dup = await this.prisma.unit.findUnique({ where: { code: candidate } });
        if (!dup) {
          code = candidate;
          break;
        }
      }
      if (!code) throw new Error('No se pudo generar código único para la unidad');
    }
    return this.prisma.unit.create({ data: { ...dto, code } });
  }

  async update(id: string, dto: UpdateUnitDto) {
    await this.findOne(id);
    if (dto.code) {
      const conflict = await this.prisma.unit.findFirst({
        where: { code: dto.code, id: { not: id } },
      });
      if (conflict) {
        throw new BusinessException(
          BusinessErrorCode.DUPLICATE_RESOURCE,
          `Ya existe una unidad con el código "${dto.code}"`,
          HttpStatus.CONFLICT,
        );
      }
    }
    return this.prisma.unit.update({ where: { id }, data: dto });
  }

  async remove(id: string) {
    await this.findOne(id);
    const hasItems = await this.prisma.item.findFirst({
      where: { unitId: id, deletedAt: null },
    });
    if (hasItems) {
      throw new BusinessException(
        BusinessErrorCode.RESOURCE_IN_USE,
        'No se puede eliminar una unidad asignada a ítems',
        HttpStatus.CONFLICT,
      );
    }
    return this.prisma.unit.delete({ where: { id } });
  }
}
