import { HttpStatus, Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';

import { PrismaService } from '../../prisma/prisma.service';
import { BusinessException } from '../../common/exceptions/business.exception';
import { BusinessErrorCode } from '@kardex/types';
import type { CreateWorkerDto, UpdateWorkerDto } from './dto/worker.dto';

const WORKER_INCLUDE = {
  specialty: { select: { id: true, code: true, name: true } },
  obra: { select: { id: true, code: true, name: true } },
} as const;

@Injectable()
export class WorkersService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(query: {
    page?: number;
    pageSize?: number;
    search?: string;
    specialtyId?: string;
    obraId?: string;
    active?: boolean;
  }) {
    const { page = 1, pageSize = 20, search, specialtyId, obraId, active } = query;
    const skip = (page - 1) * pageSize;

    const andConditions: Prisma.WorkerWhereInput[] = [{ deletedAt: null }];
    if (specialtyId) andConditions.push({ specialtyId });
    if (obraId) andConditions.push({ obraId });
    if (active !== undefined) andConditions.push({ active });
    if (search) {
      andConditions.push({
        OR: [
          { firstName: { contains: search, mode: 'insensitive' } },
          { lastName: { contains: search, mode: 'insensitive' } },
          { documentNumber: { contains: search, mode: 'insensitive' } },
          { phone: { contains: search } },
        ],
      });
    }

    const where: Prisma.WorkerWhereInput = { AND: andConditions };

    const [items, total] = await Promise.all([
      this.prisma.worker.findMany({
        where,
        include: WORKER_INCLUDE,
        orderBy: [{ active: 'desc' }, { firstName: 'asc' }],
        skip,
        take: pageSize,
      }),
      this.prisma.worker.count({ where }),
    ]);

    return { items, total, page, pageSize, totalPages: Math.ceil(total / pageSize) };
  }

  async findOne(id: string) {
    const worker = await this.prisma.worker.findFirst({
      where: { id, deletedAt: null },
      include: WORKER_INCLUDE,
    });
    if (!worker) {
      throw new BusinessException(
        BusinessErrorCode.WORKER_NOT_FOUND,
        'Empleado no encontrado',
        HttpStatus.NOT_FOUND,
      );
    }
    return worker;
  }

  async create(dto: CreateWorkerDto) {
    const existing = await this.prisma.worker.findFirst({
      where: {
        documentType: dto.documentType,
        documentNumber: dto.documentNumber,
        deletedAt: null,
      },
    });
    if (existing) {
      throw new BusinessException(
        BusinessErrorCode.DOCUMENT_ALREADY_REGISTERED,
        'Ya existe un empleado con este documento',
        HttpStatus.CONFLICT,
      );
    }

    const specialty = await this.prisma.specialty.findFirst({
      where: { id: dto.specialtyId, deletedAt: null, active: true },
    });
    if (!specialty) {
      throw new BusinessException(
        BusinessErrorCode.NOT_FOUND,
        'Especialidad no encontrada o inactiva',
        HttpStatus.NOT_FOUND,
      );
    }

    if (dto.obraId) {
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
    }

    // Regla peruana: DNI requiere apellido materno. CE/Pasaporte pueden no tenerlo.
    if (dto.documentType === 'DNI' && !dto.maternalLastName?.trim()) {
      throw new BusinessException(
        BusinessErrorCode.INVALID_INPUT,
        'El apellido materno es obligatorio para empleados con DNI',
        HttpStatus.BAD_REQUEST,
      );
    }

    const paternal = dto.paternalLastName.trim();
    const maternal = dto.maternalLastName?.trim();
    const lastName = maternal ? `${paternal} ${maternal}` : paternal;

    return this.prisma.worker.create({
      data: {
        documentType: dto.documentType,
        documentNumber: dto.documentNumber.trim(),
        firstName: dto.firstName.trim(),
        paternalLastName: paternal,
        maternalLastName: maternal || null,
        lastName,
        phone: dto.phone.trim(),
        address: dto.address?.trim(),
        birthDate: dto.birthDate ? new Date(dto.birthDate) : undefined,
        hireDate: dto.hireDate ? new Date(dto.hireDate) : undefined,
        notes: dto.notes?.trim(),
        specialtyId: dto.specialtyId,
        obraId: dto.obraId,
      },
      include: WORKER_INCLUDE,
    });
  }

  async update(id: string, dto: UpdateWorkerDto) {
    await this.findOne(id);

    if (dto.specialtyId) {
      const specialty = await this.prisma.specialty.findFirst({
        where: { id: dto.specialtyId, deletedAt: null, active: true },
      });
      if (!specialty) {
        throw new BusinessException(
          BusinessErrorCode.NOT_FOUND,
          'Especialidad no encontrada',
          HttpStatus.NOT_FOUND,
        );
      }
    }

    if (dto.obraId !== undefined && dto.obraId) {
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
    }

    // Recompute lastName si se tocan paterno o materno.
    const current = await this.findOne(id);
    const willTouchNames =
      dto.paternalLastName !== undefined || dto.maternalLastName !== undefined;
    const finalPaternal = (dto.paternalLastName ?? current.paternalLastName ?? '').trim();
    const finalMaternal = (dto.maternalLastName ?? current.maternalLastName ?? '').trim();

    if (willTouchNames && current.documentType === 'DNI' && !finalMaternal) {
      throw new BusinessException(
        BusinessErrorCode.INVALID_INPUT,
        'El apellido materno es obligatorio para empleados con DNI',
        HttpStatus.BAD_REQUEST,
      );
    }

    return this.prisma.worker.update({
      where: { id },
      data: {
        ...(dto.firstName && { firstName: dto.firstName.trim() }),
        ...(dto.paternalLastName !== undefined && { paternalLastName: finalPaternal }),
        ...(dto.maternalLastName !== undefined && {
          maternalLastName: finalMaternal || null,
        }),
        ...(willTouchNames && {
          lastName: finalMaternal ? `${finalPaternal} ${finalMaternal}` : finalPaternal,
        }),
        ...(dto.phone && { phone: dto.phone.trim() }),
        ...(dto.address !== undefined && { address: dto.address?.trim() }),
        ...(dto.birthDate !== undefined && {
          birthDate: dto.birthDate ? new Date(dto.birthDate) : null,
        }),
        ...(dto.hireDate !== undefined && {
          hireDate: dto.hireDate ? new Date(dto.hireDate) : null,
        }),
        ...(dto.notes !== undefined && { notes: dto.notes?.trim() }),
        ...(dto.specialtyId && { specialtyId: dto.specialtyId }),
        ...(dto.obraId !== undefined && { obraId: dto.obraId || null }),
        ...(dto.active !== undefined && { active: dto.active }),
      },
      include: WORKER_INCLUDE,
    });
  }

  async remove(id: string) {
    await this.findOne(id);
    const activeLoans = await this.prisma.toolLoan.count({
      where: { borrowerWorkerId: id, status: 'ACTIVE' },
    });
    if (activeLoans > 0) {
      throw new BusinessException(
        BusinessErrorCode.RESOURCE_IN_USE,
        `No se puede eliminar: ${activeLoans} préstamo(s) activos a nombre de este empleado`,
        HttpStatus.CONFLICT,
      );
    }
    return this.prisma.worker.update({
      where: { id },
      data: { deletedAt: new Date() },
    });
  }
}
