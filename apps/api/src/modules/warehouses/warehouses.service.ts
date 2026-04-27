import { Injectable, HttpStatus } from '@nestjs/common';
import { WarehouseType } from '@prisma/client';

import { BusinessException } from '../../common/exceptions/business.exception';
import { BusinessErrorCode } from '@kardex/types';
import { generateCode } from '../../common/utils/code-generator';
import { PrismaService } from '../../prisma/prisma.service';
import type { PaginationQueryDto } from '../../common/dto/pagination.dto';
import type { CreateWarehouseDto, UpdateWarehouseDto } from './dto/warehouse.dto';

const WAREHOUSE_INCLUDE = {
  obra: { select: { id: true, code: true, name: true, status: true } },
} as const;

@Injectable()
export class WarehousesService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(query: PaginationQueryDto & { type?: WarehouseType; obraId?: string }) {
    const {
      page = 1,
      pageSize = 20,
      sortBy = 'code',
      sortOrder = 'asc',
      search,
      type,
      obraId,
    } = query;
    const skip = (page - 1) * pageSize;

    const where = {
      deletedAt: null,
      ...(type && { type }),
      ...(obraId && { obraId }),
      ...(search && {
        OR: [
          { code: { contains: search, mode: 'insensitive' as const } },
          { name: { contains: search, mode: 'insensitive' as const } },
          { location: { contains: search, mode: 'insensitive' as const } },
        ],
      }),
    };

    const [items, total] = await Promise.all([
      this.prisma.warehouse.findMany({
        where,
        include: WAREHOUSE_INCLUDE,
        orderBy: { [sortBy]: sortOrder },
        skip,
        take: pageSize,
      }),
      this.prisma.warehouse.count({ where }),
    ]);

    return { items, total, page, pageSize, totalPages: Math.ceil(total / pageSize) };
  }

  async findOne(id: string) {
    const warehouse = await this.prisma.warehouse.findFirst({
      where: { id, deletedAt: null },
      include: WAREHOUSE_INCLUDE,
    });
    if (!warehouse) {
      throw new BusinessException(
        BusinessErrorCode.WAREHOUSE_NOT_FOUND,
        'Almacén no encontrado',
        HttpStatus.NOT_FOUND,
      );
    }
    return warehouse;
  }

  private async validateObraByType(
    type: WarehouseType | undefined,
    obraId: string | undefined,
  ) {
    const effectiveType = type ?? WarehouseType.CENTRAL;
    if (effectiveType === WarehouseType.CENTRAL && obraId) {
      throw new BusinessException(
        BusinessErrorCode.INVALID_INPUT,
        'El Almacén Principal no puede estar asociado a una obra',
        HttpStatus.BAD_REQUEST,
      );
    }
    if (effectiveType === WarehouseType.OBRA && !obraId) {
      throw new BusinessException(
        BusinessErrorCode.INVALID_INPUT,
        'Un almacén tipo OBRA requiere especificar una obra',
        HttpStatus.BAD_REQUEST,
      );
    }
    if (obraId) {
      const obra = await this.prisma.obra.findFirst({
        where: { id: obraId, deletedAt: null },
      });
      if (!obra) {
        throw new BusinessException(
          BusinessErrorCode.NOT_FOUND,
          'Obra no encontrada',
          HttpStatus.NOT_FOUND,
        );
      }
    }
  }

  /**
   * Valida que solo exista UN almacén tipo CENTRAL (el Almacén Principal).
   * El Principal se crea desde el seed; nadie puede crear otro.
   */
  private async ensureUniquePrincipal(type: WarehouseType, excludeId?: string) {
    if (type !== WarehouseType.CENTRAL) return;
    const existing = await this.prisma.warehouse.findFirst({
      where: {
        type: WarehouseType.CENTRAL,
        deletedAt: null,
        ...(excludeId && { id: { not: excludeId } }),
      },
    });
    if (existing) {
      throw new BusinessException(
        BusinessErrorCode.DUPLICATE_RESOURCE,
        `Ya existe el Almacén Principal (${existing.code}). Solo puede haber uno por empresa.`,
        HttpStatus.CONFLICT,
      );
    }
  }

  async findMain() {
    const main = await this.prisma.warehouse.findFirst({
      where: { type: WarehouseType.CENTRAL, deletedAt: null },
      include: WAREHOUSE_INCLUDE,
    });
    if (!main) {
      throw new BusinessException(
        BusinessErrorCode.WAREHOUSE_NOT_FOUND,
        'Almacén Principal no configurado',
        HttpStatus.NOT_FOUND,
      );
    }
    return main;
  }

  async create(dto: CreateWarehouseDto) {
    let code = dto.code?.trim();
    if (code) {
      const existing = await this.prisma.warehouse.findUnique({ where: { code } });
      if (existing) {
        throw new BusinessException(
          BusinessErrorCode.DUPLICATE_RESOURCE,
          `Ya existe un almacén con el código "${code}"`,
          HttpStatus.CONFLICT,
        );
      }
    } else {
      const prefix =
        (dto.type ?? WarehouseType.CENTRAL) === WarehouseType.CENTRAL ? 'ALM' : 'ALO';
      for (let i = 0; i < 3; i++) {
        const candidate = generateCode(prefix);
        const dup = await this.prisma.warehouse.findUnique({
          where: { code: candidate },
        });
        if (!dup) {
          code = candidate;
          break;
        }
      }
      if (!code) throw new Error('No se pudo generar código único para el almacén');
    }
    await this.validateObraByType(dto.type, dto.obraId);
    await this.ensureUniquePrincipal(dto.type ?? WarehouseType.CENTRAL);
    return this.prisma.warehouse.create({
      data: { ...dto, code },
      include: WAREHOUSE_INCLUDE,
    });
  }

  async update(id: string, dto: UpdateWarehouseDto) {
    const current = await this.findOne(id);

    // El Almacén Principal no puede cambiar de tipo
    if (
      current.type === WarehouseType.CENTRAL &&
      dto.type &&
      dto.type !== WarehouseType.CENTRAL
    ) {
      throw new BusinessException(
        BusinessErrorCode.INVALID_INPUT,
        'No se puede cambiar el tipo del Almacén Principal',
        HttpStatus.BAD_REQUEST,
      );
    }

    if (dto.code) {
      const conflict = await this.prisma.warehouse.findFirst({
        where: { code: dto.code, id: { not: id } },
      });
      if (conflict) {
        throw new BusinessException(
          BusinessErrorCode.DUPLICATE_RESOURCE,
          `Ya existe un almacén con el código "${dto.code}"`,
          HttpStatus.CONFLICT,
        );
      }
    }
    if (dto.type !== undefined || dto.obraId !== undefined) {
      const nextType = dto.type ?? current.type;
      const nextObraId = dto.obraId !== undefined ? dto.obraId : current.obraId;
      await this.validateObraByType(nextType, nextObraId ?? undefined);
      if (dto.type && dto.type !== current.type) {
        await this.ensureUniquePrincipal(nextType, id);
      }
    }
    return this.prisma.warehouse.update({
      where: { id },
      data: dto,
      include: WAREHOUSE_INCLUDE,
    });
  }

  async remove(id: string) {
    const warehouse = await this.findOne(id);
    if (warehouse.type === WarehouseType.CENTRAL) {
      throw new BusinessException(
        BusinessErrorCode.RESOURCE_IN_USE,
        'El Almacén Principal no se puede eliminar',
        HttpStatus.CONFLICT,
      );
    }
    const hasStock = await this.prisma.stock.findFirst({
      where: { warehouseId: id, quantity: { gt: 0 } },
    });
    if (hasStock) {
      throw new BusinessException(
        BusinessErrorCode.RESOURCE_IN_USE,
        'No se puede eliminar un almacén con stock registrado',
        HttpStatus.CONFLICT,
      );
    }
    return this.prisma.warehouse.update({
      where: { id },
      data: { deletedAt: new Date() },
    });
  }
}
