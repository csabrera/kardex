import { HttpStatus, Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';

import { PrismaService } from '../../prisma/prisma.service';
import { BusinessException } from '../../common/exceptions/business.exception';
import { BusinessErrorCode } from '@kardex/types';
import { generateCode } from '../../common/utils/code-generator';
import type { CreateSpecialtyDto, UpdateSpecialtyDto } from './dto/specialty.dto';

@Injectable()
export class SpecialtiesService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(query: { search?: string; includeInactive?: boolean }) {
    const { search, includeInactive } = query;
    const where: Prisma.SpecialtyWhereInput = {
      deletedAt: null,
      ...(!includeInactive && { active: true }),
      ...(search && {
        OR: [
          { name: { contains: search, mode: 'insensitive' } },
          { code: { contains: search, mode: 'insensitive' } },
        ],
      }),
    };
    return this.prisma.specialty.findMany({ where, orderBy: { name: 'asc' } });
  }

  async findOne(id: string) {
    const specialty = await this.prisma.specialty.findFirst({
      where: { id, deletedAt: null },
    });
    if (!specialty) {
      throw new BusinessException(
        BusinessErrorCode.NOT_FOUND,
        'Especialidad no encontrada',
        HttpStatus.NOT_FOUND,
      );
    }
    return specialty;
  }

  async create(dto: CreateSpecialtyDto) {
    let code = dto.code?.trim().toUpperCase();
    if (code) {
      const existing = await this.prisma.specialty.findUnique({ where: { code } });
      if (existing) {
        throw new BusinessException(
          BusinessErrorCode.DUPLICATE_RESOURCE,
          `Ya existe una especialidad con código "${code}"`,
          HttpStatus.CONFLICT,
        );
      }
    } else {
      for (let i = 0; i < 3; i++) {
        const candidate = generateCode('ESP');
        const dup = await this.prisma.specialty.findUnique({
          where: { code: candidate },
        });
        if (!dup) {
          code = candidate;
          break;
        }
      }
      if (!code) throw new Error('No se pudo generar código único para la especialidad');
    }
    return this.prisma.specialty.create({
      data: { code, name: dto.name.trim(), description: dto.description?.trim() },
    });
  }

  async update(id: string, dto: UpdateSpecialtyDto) {
    await this.findOne(id);
    return this.prisma.specialty.update({
      where: { id },
      data: {
        ...(dto.name && { name: dto.name.trim() }),
        ...(dto.description !== undefined && { description: dto.description?.trim() }),
        ...(dto.active !== undefined && { active: dto.active }),
      },
    });
  }

  async remove(id: string) {
    await this.findOne(id);
    const workersCount = await this.prisma.worker.count({
      where: { specialtyId: id, deletedAt: null },
    });
    if (workersCount > 0) {
      throw new BusinessException(
        BusinessErrorCode.RESOURCE_IN_USE,
        `No se puede eliminar: ${workersCount} empleado(s) usan esta especialidad`,
        HttpStatus.CONFLICT,
      );
    }
    return this.prisma.specialty.update({
      where: { id },
      data: { deletedAt: new Date() },
    });
  }
}
