import { HttpStatus, Injectable } from '@nestjs/common';
import { ObraStatus, Prisma } from '@prisma/client';

import { PrismaService } from '../../prisma/prisma.service';
import { BusinessException } from '../../common/exceptions/business.exception';
import { BusinessErrorCode } from '@kardex/types';
import { generateCode } from '../../common/utils/code-generator';
import type { CreateObraDto, UpdateObraDto } from './dto/obra.dto';

const OBRA_INCLUDE = {
  responsibleUser: { select: { id: true, firstName: true, lastName: true } },
  _count: { select: { warehouses: true, workers: true, workStations: true } },
} as const;

@Injectable()
export class ObrasService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(query: {
    page?: number;
    pageSize?: number;
    search?: string;
    status?: ObraStatus;
    responsibleUserId?: string;
  }) {
    const { page = 1, pageSize = 20, search, status, responsibleUserId } = query;
    const skip = (page - 1) * pageSize;

    const andConditions: Prisma.ObraWhereInput[] = [{ deletedAt: null }];
    if (status) andConditions.push({ status });
    if (responsibleUserId) andConditions.push({ responsibleUserId });
    if (search) {
      andConditions.push({
        OR: [
          { code: { contains: search, mode: 'insensitive' } },
          { name: { contains: search, mode: 'insensitive' } },
          { address: { contains: search, mode: 'insensitive' } },
          { client: { contains: search, mode: 'insensitive' } },
        ],
      });
    }

    const where: Prisma.ObraWhereInput = { AND: andConditions };

    const [items, total] = await Promise.all([
      this.prisma.obra.findMany({
        where,
        include: OBRA_INCLUDE,
        orderBy: [{ status: 'asc' }, { name: 'asc' }],
        skip,
        take: pageSize,
      }),
      this.prisma.obra.count({ where }),
    ]);

    return { items, total, page, pageSize, totalPages: Math.ceil(total / pageSize) };
  }

  async findOne(id: string) {
    const obra = await this.prisma.obra.findFirst({
      where: { id, deletedAt: null },
      include: {
        ...OBRA_INCLUDE,
        warehouses: {
          where: { deletedAt: null },
          select: { id: true, code: true, name: true, type: true, active: true },
        },
        workStations: {
          where: { deletedAt: null },
          select: { id: true, name: true, description: true, active: true },
          orderBy: { name: 'asc' },
        },
      },
    });
    if (!obra) {
      throw new BusinessException(
        BusinessErrorCode.NOT_FOUND,
        'Obra no encontrada',
        HttpStatus.NOT_FOUND,
      );
    }
    return obra;
  }

  async create(dto: CreateObraDto) {
    let code = dto.code?.trim().toUpperCase();
    if (code) {
      const existing = await this.prisma.obra.findUnique({ where: { code } });
      if (existing) {
        throw new BusinessException(
          BusinessErrorCode.DUPLICATE_RESOURCE,
          `Ya existe una obra con código "${code}"`,
          HttpStatus.CONFLICT,
        );
      }
    } else {
      for (let i = 0; i < 3; i++) {
        const candidate = generateCode('OBR');
        const dup = await this.prisma.obra.findUnique({ where: { code: candidate } });
        if (!dup) {
          code = candidate;
          break;
        }
      }
      if (!code) throw new Error('No se pudo generar código único para la obra');
    }

    const responsibleUser = await this.prisma.user.findFirst({
      where: { id: dto.responsibleUserId, deletedAt: null, active: true },
    });
    if (!responsibleUser) {
      throw new BusinessException(
        BusinessErrorCode.USER_NOT_FOUND,
        'Usuario responsable no encontrado o inactivo',
        HttpStatus.NOT_FOUND,
      );
    }

    return this.prisma.obra.create({
      data: {
        code,
        name: dto.name.trim(),
        address: dto.address?.trim(),
        client: dto.client?.trim(),
        description: dto.description?.trim(),
        startDate: dto.startDate ? new Date(dto.startDate) : undefined,
        endDate: dto.endDate ? new Date(dto.endDate) : undefined,
        status: dto.status ?? ObraStatus.PLANIFICACION,
        responsibleUserId: dto.responsibleUserId,
      },
      include: OBRA_INCLUDE,
    });
  }

  async update(id: string, dto: UpdateObraDto) {
    await this.findOne(id);

    if (dto.responsibleUserId) {
      const user = await this.prisma.user.findFirst({
        where: { id: dto.responsibleUserId, deletedAt: null, active: true },
      });
      if (!user) {
        throw new BusinessException(
          BusinessErrorCode.USER_NOT_FOUND,
          'Usuario responsable no encontrado o inactivo',
          HttpStatus.NOT_FOUND,
        );
      }
    }

    return this.prisma.obra.update({
      where: { id },
      data: {
        ...(dto.name && { name: dto.name.trim() }),
        ...(dto.address !== undefined && { address: dto.address?.trim() }),
        ...(dto.client !== undefined && { client: dto.client?.trim() }),
        ...(dto.description !== undefined && { description: dto.description?.trim() }),
        ...(dto.startDate !== undefined && {
          startDate: dto.startDate ? new Date(dto.startDate) : null,
        }),
        ...(dto.endDate !== undefined && {
          endDate: dto.endDate ? new Date(dto.endDate) : null,
        }),
        ...(dto.status && { status: dto.status }),
        ...(dto.responsibleUserId && { responsibleUserId: dto.responsibleUserId }),
      },
      include: OBRA_INCLUDE,
    });
  }

  async remove(id: string) {
    await this.findOne(id);

    const [activeWarehouses, activeWorkers, activeLoans] = await Promise.all([
      this.prisma.warehouse.count({ where: { obraId: id, deletedAt: null } }),
      this.prisma.worker.count({ where: { obraId: id, deletedAt: null } }),
      this.prisma.toolLoan.count({
        where: { warehouse: { obraId: id }, status: 'ACTIVE' },
      }),
    ]);

    if (activeLoans > 0) {
      throw new BusinessException(
        BusinessErrorCode.RESOURCE_IN_USE,
        `No se puede eliminar: ${activeLoans} préstamo(s) activos en esta obra`,
        HttpStatus.CONFLICT,
      );
    }
    if (activeWarehouses > 0) {
      throw new BusinessException(
        BusinessErrorCode.RESOURCE_IN_USE,
        `No se puede eliminar: ${activeWarehouses} almacén(es) activos en esta obra`,
        HttpStatus.CONFLICT,
      );
    }
    if (activeWorkers > 0) {
      throw new BusinessException(
        BusinessErrorCode.RESOURCE_IN_USE,
        `No se puede eliminar: ${activeWorkers} empleado(s) asignados a esta obra`,
        HttpStatus.CONFLICT,
      );
    }

    return this.prisma.obra.update({
      where: { id },
      data: { deletedAt: new Date() },
    });
  }
}
