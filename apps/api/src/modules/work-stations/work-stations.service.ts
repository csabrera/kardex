import { HttpStatus, Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';

import { PrismaService } from '../../prisma/prisma.service';
import { BusinessException } from '../../common/exceptions/business.exception';
import { BusinessErrorCode } from '@kardex/types';
import { assertObraScope } from '../../common/utils/scope';
import type { CreateWorkStationDto, UpdateWorkStationDto } from './dto/work-station.dto';

@Injectable()
export class WorkStationsService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(query: { obraId?: string; search?: string; includeInactive?: boolean }) {
    const { obraId, search, includeInactive } = query;
    const where: Prisma.WorkStationWhereInput = {
      deletedAt: null,
      ...(!includeInactive && { active: true }),
      ...(obraId && { obraId }),
      ...(search && { name: { contains: search, mode: 'insensitive' } }),
    };
    return this.prisma.workStation.findMany({
      where,
      include: {
        obra: { select: { id: true, code: true, name: true } },
      },
      orderBy: { name: 'asc' },
    });
  }

  async findOne(id: string) {
    const station = await this.prisma.workStation.findFirst({
      where: { id, deletedAt: null },
      include: { obra: { select: { id: true, code: true, name: true } } },
    });
    if (!station) {
      throw new BusinessException(
        BusinessErrorCode.NOT_FOUND,
        'Estación de trabajo no encontrada',
        HttpStatus.NOT_FOUND,
      );
    }
    return station;
  }

  async create(dto: CreateWorkStationDto, userId: string) {
    await assertObraScope(this.prisma, userId, dto.obraId);

    const obra = await this.prisma.obra.findFirst({
      where: { id: dto.obraId, deletedAt: null },
    });
    if (!obra) {
      throw new BusinessException(
        BusinessErrorCode.NOT_FOUND,
        'Obra no encontrada',
        HttpStatus.NOT_FOUND,
      );
    }

    const name = dto.name.trim();

    // Check unique name within obra (considering soft-deleted)
    const existing = await this.prisma.workStation.findFirst({
      where: { obraId: dto.obraId, name, deletedAt: null },
    });
    if (existing) {
      throw new BusinessException(
        BusinessErrorCode.DUPLICATE_RESOURCE,
        `Ya existe una estación "${name}" en esta obra`,
        HttpStatus.CONFLICT,
      );
    }

    return this.prisma.workStation.create({
      data: { obraId: dto.obraId, name, description: dto.description?.trim() },
      include: { obra: { select: { id: true, code: true, name: true } } },
    });
  }

  async update(id: string, dto: UpdateWorkStationDto, userId: string) {
    const station = await this.findOne(id);
    await assertObraScope(this.prisma, userId, station.obraId);

    if (dto.name && dto.name.trim() !== station.name) {
      const existing = await this.prisma.workStation.findFirst({
        where: {
          obraId: station.obraId,
          name: dto.name.trim(),
          deletedAt: null,
          NOT: { id },
        },
      });
      if (existing) {
        throw new BusinessException(
          BusinessErrorCode.DUPLICATE_RESOURCE,
          `Ya existe otra estación con ese nombre en esta obra`,
          HttpStatus.CONFLICT,
        );
      }
    }

    return this.prisma.workStation.update({
      where: { id },
      data: {
        ...(dto.name && { name: dto.name.trim() }),
        ...(dto.description !== undefined && { description: dto.description?.trim() }),
        ...(dto.active !== undefined && { active: dto.active }),
      },
      include: { obra: { select: { id: true, code: true, name: true } } },
    });
  }

  async remove(id: string, userId: string) {
    const station = await this.findOne(id);
    await assertObraScope(this.prisma, userId, station.obraId);
    const activeLoans = await this.prisma.toolLoan.count({
      where: { workStationId: id, status: 'ACTIVE' },
    });
    if (activeLoans > 0) {
      throw new BusinessException(
        BusinessErrorCode.RESOURCE_IN_USE,
        `No se puede eliminar: ${activeLoans} préstamo(s) activos en esta estación`,
        HttpStatus.CONFLICT,
      );
    }
    return this.prisma.workStation.update({
      where: { id },
      data: { deletedAt: new Date() },
    });
  }
}
