import { Injectable, HttpStatus } from '@nestjs/common';
import { ItemType, MovementSource, MovementType, WarehouseType } from '@prisma/client';

import { BusinessException } from '../../common/exceptions/business.exception';
import { BusinessErrorCode } from '@kardex/types';
import { generateCode } from '../../common/utils/code-generator';
import { PrismaService } from '../../prisma/prisma.service';
import type { PaginationQueryDto } from '../../common/dto/pagination.dto';
import type { CreateItemDto, UpdateItemDto } from './dto/item.dto';

@Injectable()
export class ItemsService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(query: PaginationQueryDto & { type?: ItemType; categoryId?: string }) {
    const {
      page = 1,
      pageSize = 20,
      sortBy = 'code',
      sortOrder = 'asc',
      search,
      type,
      categoryId,
    } = query;
    const skip = (page - 1) * pageSize;

    const where = {
      deletedAt: null,
      ...(type && { type }),
      ...(categoryId && { categoryId }),
      ...(search && {
        OR: [
          { code: { contains: search, mode: 'insensitive' as const } },
          { name: { contains: search, mode: 'insensitive' as const } },
          { description: { contains: search, mode: 'insensitive' as const } },
        ],
      }),
    };

    // Obtener el Almacén Principal para poder incluir su stock por ítem
    const mainWarehouse = await this.prisma.warehouse.findFirst({
      where: { type: WarehouseType.CENTRAL, deletedAt: null },
      select: { id: true },
    });

    const [items, total] = await Promise.all([
      this.prisma.item.findMany({
        where,
        include: {
          category: { select: { id: true, code: true, name: true } },
          unit: { select: { id: true, code: true, name: true, abbreviation: true } },
          ...(mainWarehouse && {
            stocks: {
              where: { warehouseId: mainWarehouse.id },
              select: { quantity: true, warehouseId: true },
            },
          }),
        },
        orderBy: { [sortBy]: sortOrder },
        skip,
        take: pageSize,
      }),
      this.prisma.item.count({ where }),
    ]);

    // Aplanar: agregar `principalStock` a cada item
    const itemsWithStock = items.map((item: any) => {
      const principalStock = mainWarehouse ? Number(item.stocks?.[0]?.quantity ?? 0) : 0;
      const { stocks, ...rest } = item;
      return { ...rest, principalStock };
    });

    return {
      items: itemsWithStock,
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    };
  }

  async findOne(id: string) {
    const item = await this.prisma.item.findFirst({
      where: { id, deletedAt: null },
      include: {
        category: { select: { id: true, code: true, name: true } },
        unit: { select: { id: true, code: true, name: true, abbreviation: true } },
        stocks: {
          include: { warehouse: { select: { id: true, code: true, name: true } } },
        },
      },
    });
    if (!item) {
      throw new BusinessException(
        BusinessErrorCode.ITEM_NOT_FOUND,
        'Ítem no encontrado',
        HttpStatus.NOT_FOUND,
      );
    }

    // Para items PRESTAMO, anotar cada stock con loanedQty/availableQty/damagedReturnedQty.
    if (item.type === 'PRESTAMO' && item.stocks.length > 0) {
      const warehouseIds = item.stocks.map((s) => s.warehouseId);
      const [activeLoans, damagedReturns] = await Promise.all([
        this.prisma.toolLoan.groupBy({
          by: ['warehouseId'],
          where: { itemId: id, warehouseId: { in: warehouseIds }, status: 'ACTIVE' },
          _sum: { quantity: true },
        }),
        this.prisma.toolLoan.groupBy({
          by: ['warehouseId'],
          where: {
            itemId: id,
            warehouseId: { in: warehouseIds },
            status: 'RETURNED',
            returnCondition: 'DAMAGED',
          },
          _sum: { quantity: true },
        }),
      ]);
      const loanedMap = new Map(
        activeLoans.map((r) => [r.warehouseId, Number(r._sum.quantity ?? 0)]),
      );
      const damagedMap = new Map(
        damagedReturns.map((r) => [r.warehouseId, Number(r._sum.quantity ?? 0)]),
      );
      const stocks = item.stocks.map((s) => {
        const loaned = loanedMap.get(s.warehouseId) ?? 0;
        const damaged = damagedMap.get(s.warehouseId) ?? 0;
        return {
          ...s,
          loanedQty: loaned,
          availableQty: Math.max(0, Number(s.quantity) - loaned),
          damagedReturnedQty: damaged,
        };
      });
      return { ...item, stocks };
    }

    // Otros tipos: anotar campos en 0 para consistencia de shape en el frontend.
    const stocks = item.stocks.map((s) => ({
      ...s,
      loanedQty: 0,
      availableQty: Number(s.quantity),
      damagedReturnedQty: 0,
    }));
    return { ...item, stocks };
  }

  async create(dto: CreateItemDto, userId?: string) {
    // Auto-generar code si no se provee
    let code = dto.code?.trim();
    if (code) {
      const existing = await this.prisma.item.findUnique({ where: { code } });
      if (existing) {
        throw new BusinessException(
          BusinessErrorCode.ITEM_ALREADY_EXISTS,
          `Ya existe un ítem con el código "${code}"`,
          HttpStatus.CONFLICT,
        );
      }
    } else {
      // Retry hasta 3 veces por si hay colisión (muy improbable con nanoid)
      for (let i = 0; i < 3; i++) {
        const candidate = generateCode('ITM');
        const dup = await this.prisma.item.findUnique({ where: { code: candidate } });
        if (!dup) {
          code = candidate;
          break;
        }
      }
      if (!code) throw new Error('No se pudo generar código único para el ítem');
    }

    const category = await this.prisma.category.findFirst({
      where: { id: dto.categoryId, deletedAt: null },
    });
    if (!category) {
      throw new BusinessException(
        BusinessErrorCode.NOT_FOUND,
        'Categoría no encontrada',
        HttpStatus.NOT_FOUND,
      );
    }

    const unit = await this.prisma.unit.findUnique({ where: { id: dto.unitId } });
    if (!unit) {
      throw new BusinessException(
        BusinessErrorCode.NOT_FOUND,
        'Unidad no encontrada',
        HttpStatus.NOT_FOUND,
      );
    }

    const wantsInitialStock = (dto.initialStock ?? 0) > 0;

    // Si piden stock inicial necesitamos el Almacén Principal y un userId autenticado
    const mainWarehouse = wantsInitialStock
      ? await this.prisma.warehouse.findFirst({
          where: { type: WarehouseType.CENTRAL, deletedAt: null, active: true },
          select: { id: true },
        })
      : null;

    if (wantsInitialStock && !mainWarehouse) {
      throw new BusinessException(
        BusinessErrorCode.WAREHOUSE_NOT_FOUND,
        'No se encontró el Almacén Principal para cargar el stock inicial',
        HttpStatus.NOT_FOUND,
      );
    }

    if (wantsInitialStock && !userId) {
      throw new BusinessException(
        BusinessErrorCode.INVALID_INPUT,
        'Se requiere usuario autenticado para registrar el stock inicial',
        HttpStatus.BAD_REQUEST,
      );
    }

    return this.prisma.$transaction(async (tx) => {
      const item = await tx.item.create({
        data: {
          code: code!,
          name: dto.name,
          description: dto.description,
          type: dto.type ?? ItemType.CONSUMO,
          categoryId: dto.categoryId,
          unitId: dto.unitId,
          minStock: dto.minStock ?? 0,
          maxStock: dto.maxStock,
        },
      });

      // Create stock entry for every active warehouse
      const warehouses = await tx.warehouse.findMany({
        where: { deletedAt: null, active: true },
        select: { id: true },
      });

      if (warehouses.length > 0) {
        await tx.stock.createMany({
          data: warehouses.map((w) => ({
            itemId: item.id,
            warehouseId: w.id,
            quantity: 0,
          })),
          skipDuplicates: true,
        });
      }

      // Stock inicial → genera ENTRADA automática al Principal (mismo patrón que import Excel)
      if (wantsInitialStock && mainWarehouse && userId) {
        const quantity = Number(dto.initialStock);
        const initialSource = dto.initialSource ?? MovementSource.COMPRA;

        // Resolver supplierId según source:
        //   - COMPRA → usa el que llegó o fallback a PRV-EVENTUAL
        //   - Otros → null (no se persiste)
        let supplierId: string | null = null;
        if (initialSource === MovementSource.COMPRA) {
          if (dto.initialSupplierId) {
            const supplier = await tx.supplier.findFirst({
              where: { id: dto.initialSupplierId, deletedAt: null, active: true },
            });
            if (!supplier) {
              throw new BusinessException(
                BusinessErrorCode.NOT_FOUND,
                'Proveedor no encontrado o inactivo',
                HttpStatus.NOT_FOUND,
              );
            }
            supplierId = supplier.id;
          } else {
            // Fallback al "Proveedor eventual - Efectivo" (sembrado en seed.ts)
            const fallback = await tx.supplier.findUnique({
              where: { code: 'PRV-EVENTUAL' },
            });
            if (!fallback) {
              throw new BusinessException(
                BusinessErrorCode.NOT_FOUND,
                'No hay proveedor eventual sembrado (PRV-EVENTUAL). Corre el seed.',
                HttpStatus.INTERNAL_SERVER_ERROR,
              );
            }
            supplierId = fallback.id;
          }
        }

        // Actualizar stock del Principal desde 0
        const updated = await tx.stock.updateMany({
          where: { itemId: item.id, warehouseId: mainWarehouse.id, version: 0 },
          data: { quantity, version: { increment: 1 } },
        });
        if (updated.count === 0) {
          throw new BusinessException(
            BusinessErrorCode.STOCK_CONFLICT,
            'Conflicto al inicializar el stock del Principal',
            HttpStatus.CONFLICT,
          );
        }

        const seq = await tx.movementSequence.upsert({
          where: { type: MovementType.ENTRADA },
          update: { lastValue: { increment: 1 } },
          create: { type: MovementType.ENTRADA, lastValue: 1 },
        });
        const movementCode = `ENT-${String(seq.lastValue).padStart(5, '0')}`;

        await tx.movement.create({
          data: {
            code: movementCode,
            type: MovementType.ENTRADA,
            source: initialSource,
            warehouseId: mainWarehouse.id,
            userId,
            supplierId,
            notes: dto.initialNotes ?? `Carga inicial al crear el ítem ${item.code}`,
            items: {
              create: [
                {
                  itemId: item.id,
                  quantity,
                  unitCost: dto.initialUnitCost,
                  stockBefore: 0,
                  stockAfter: quantity,
                },
              ],
            },
          },
        });
      }

      return item;
    });
  }

  async update(id: string, dto: UpdateItemDto) {
    await this.findOne(id);
    if (dto.code) {
      const conflict = await this.prisma.item.findFirst({
        where: { code: dto.code, id: { not: id } },
      });
      if (conflict) {
        throw new BusinessException(
          BusinessErrorCode.ITEM_ALREADY_EXISTS,
          `Ya existe un ítem con el código "${dto.code}"`,
          HttpStatus.CONFLICT,
        );
      }
    }
    return this.prisma.item.update({
      where: { id },
      data: {
        ...(dto.code && { code: dto.code }),
        ...(dto.name && { name: dto.name }),
        ...(dto.description !== undefined && { description: dto.description }),
        ...(dto.type && { type: dto.type }),
        ...(dto.categoryId && { categoryId: dto.categoryId }),
        ...(dto.unitId && { unitId: dto.unitId }),
        ...(dto.minStock !== undefined && { minStock: dto.minStock }),
        ...(dto.maxStock !== undefined && { maxStock: dto.maxStock }),
        ...(dto.active !== undefined && { active: dto.active }),
      },
    });
  }

  async remove(id: string) {
    await this.findOne(id);
    // Soft delete — keep stock records for history
    return this.prisma.item.update({ where: { id }, data: { deletedAt: new Date() } });
  }
}
