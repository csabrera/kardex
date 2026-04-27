import { HttpStatus, Injectable } from '@nestjs/common';
import { EquipmentStatus, EquipmentType, Prisma } from '@prisma/client';

import { BusinessException } from '../../common/exceptions/business.exception';
import { BusinessErrorCode } from '@kardex/types';
import { generateCode } from '../../common/utils/code-generator';
import { PrismaService } from '../../prisma/prisma.service';
import type {
  CreateEquipmentDto,
  RecordReadingDto,
  UpdateEquipmentDto,
} from './dto/equipment.dto';

const EQUIPMENT_INCLUDE = {
  obra: { select: { id: true, code: true, name: true, status: true } },
} as const;

@Injectable()
export class EquipmentService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(query: {
    page?: number;
    pageSize?: number;
    type?: EquipmentType;
    status?: EquipmentStatus;
    obraId?: string;
    search?: string;
  }) {
    const { page = 1, pageSize = 20, type, status, obraId, search } = query;
    const skip = (page - 1) * pageSize;

    const and: Prisma.EquipmentWhereInput[] = [{ deletedAt: null }];
    if (type) and.push({ type });
    if (status) and.push({ status });
    if (obraId) and.push({ obraId });
    if (search) {
      and.push({
        OR: [
          { code: { contains: search, mode: 'insensitive' } },
          { name: { contains: search, mode: 'insensitive' } },
          { serialNumber: { contains: search, mode: 'insensitive' } },
          { brand: { contains: search, mode: 'insensitive' } },
          { model: { contains: search, mode: 'insensitive' } },
        ],
      });
    }

    const where: Prisma.EquipmentWhereInput = { AND: and };

    const [items, total] = await Promise.all([
      this.prisma.equipment.findMany({
        where,
        include: EQUIPMENT_INCLUDE,
        orderBy: { createdAt: 'desc' },
        skip,
        take: pageSize,
      }),
      this.prisma.equipment.count({ where }),
    ]);

    return { items, total, page, pageSize, totalPages: Math.ceil(total / pageSize) };
  }

  async findOne(id: string) {
    const equipment = await this.prisma.equipment.findFirst({
      where: { id, deletedAt: null },
      include: EQUIPMENT_INCLUDE,
    });
    if (!equipment) {
      throw new BusinessException(
        BusinessErrorCode.NOT_FOUND,
        'Equipo no encontrado',
        HttpStatus.NOT_FOUND,
      );
    }
    return equipment;
  }

  async getCountReadings(equipmentId: string, limit = 50) {
    await this.findOne(equipmentId);
    return this.prisma.equipmentCountReading.findMany({
      where: { equipmentId },
      orderBy: { recordedAt: 'desc' },
      take: limit,
    });
  }

  async create(dto: CreateEquipmentDto) {
    let code = dto.code?.trim();
    if (code) {
      const existing = await this.prisma.equipment.findFirst({
        where: { code, deletedAt: null },
      });
      if (existing) {
        throw new BusinessException(
          BusinessErrorCode.DUPLICATE_RESOURCE,
          `Ya existe un equipo activo con código "${code}"`,
          HttpStatus.CONFLICT,
        );
      }
    } else {
      for (let i = 0; i < 3; i++) {
        const candidate = generateCode('EQP');
        const dup = await this.prisma.equipment.findFirst({
          where: { code: candidate, deletedAt: null },
        });
        if (!dup) {
          code = candidate;
          break;
        }
      }
      if (!code) throw new Error('No se pudo generar código único para equipo');
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

    const initial = dto.initialCount ?? 0;
    return this.prisma.equipment.create({
      data: {
        code: code!,
        name: dto.name,
        type: dto.type,
        brand: dto.brand,
        model: dto.model,
        serialNumber: dto.serialNumber,
        year: dto.year,
        countType: dto.countType,
        currentCount: initial,
        initialCount: initial,
        initialCountDate: dto.initialCountDate
          ? new Date(dto.initialCountDate)
          : new Date(),
        acquisitionDate: dto.acquisitionDate ? new Date(dto.acquisitionDate) : null,
        acquisitionCost: dto.acquisitionCost,
        obraId: dto.obraId,
        notes: dto.notes,
      },
      include: EQUIPMENT_INCLUDE,
    });
  }

  async update(id: string, dto: UpdateEquipmentDto) {
    const equipment = await this.findOne(id);

    // Regla: una vez en BAJA, el equipo no puede cambiar de estado
    if (equipment.status === EquipmentStatus.BAJA) {
      throw new BusinessException(
        BusinessErrorCode.INVALID_INPUT,
        'Un equipo en estado BAJA no puede modificarse',
        HttpStatus.CONFLICT,
      );
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

    return this.prisma.equipment.update({
      where: { id },
      data: {
        ...(dto.name !== undefined && { name: dto.name }),
        ...(dto.type !== undefined && { type: dto.type }),
        ...(dto.brand !== undefined && { brand: dto.brand }),
        ...(dto.model !== undefined && { model: dto.model }),
        ...(dto.serialNumber !== undefined && { serialNumber: dto.serialNumber }),
        ...(dto.year !== undefined && { year: dto.year }),
        ...(dto.countType !== undefined && { countType: dto.countType }),
        ...(dto.acquisitionDate !== undefined && {
          acquisitionDate: dto.acquisitionDate ? new Date(dto.acquisitionDate) : null,
        }),
        ...(dto.acquisitionCost !== undefined && {
          acquisitionCost: dto.acquisitionCost,
        }),
        ...(dto.obraId !== undefined && { obraId: dto.obraId || null }),
        ...(dto.status !== undefined && { status: dto.status }),
        ...(dto.notes !== undefined && { notes: dto.notes }),
      },
      include: EQUIPMENT_INCLUDE,
    });
  }

  async recordReading(id: string, dto: RecordReadingDto, userId: string) {
    const equipment = await this.findOne(id);
    if (dto.countValue < Number(equipment.currentCount)) {
      throw new BusinessException(
        BusinessErrorCode.INVALID_INPUT,
        `La lectura (${dto.countValue}) no puede ser menor al valor actual (${equipment.currentCount})`,
        HttpStatus.BAD_REQUEST,
      );
    }

    return this.prisma.$transaction(async (tx) => {
      await tx.equipment.update({
        where: { id },
        data: { currentCount: dto.countValue },
      });
      return tx.equipmentCountReading.create({
        data: {
          equipmentId: id,
          countValue: dto.countValue,
          source: 'MANUAL',
          notes: dto.notes,
          recordedById: userId,
        },
      });
    });
  }

  async remove(id: string) {
    const equipment = await this.findOne(id);
    if (equipment.status === EquipmentStatus.BAJA) {
      throw new BusinessException(
        BusinessErrorCode.INVALID_INPUT,
        'Equipo ya está en BAJA',
        HttpStatus.CONFLICT,
      );
    }
    return this.prisma.equipment.update({
      where: { id },
      data: { status: EquipmentStatus.BAJA, deletedAt: new Date() },
    });
  }
}
