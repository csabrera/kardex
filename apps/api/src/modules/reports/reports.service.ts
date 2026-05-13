import { Injectable } from '@nestjs/common';
import { MovementType } from '@prisma/client';

import { PrismaService } from '../../prisma/prisma.service';
import type {
  ConsumptionByObraQueryDto,
  MovementsSummaryQueryDto,
  StockValuationQueryDto,
  TopItemsQueryDto,
} from './dto/reports-query.dto';

const DEFAULT_LOOKBACK_DAYS = 30;

function resolveRange(query: { from?: string; to?: string }): {
  from: Date;
  to: Date;
} {
  const to = query.to ? new Date(query.to) : new Date();
  const from = query.from
    ? new Date(query.from)
    : new Date(to.getTime() - DEFAULT_LOOKBACK_DAYS * 24 * 60 * 60 * 1000);
  return { from, to };
}

function bucketKey(date: Date, groupBy: 'day' | 'week' | 'month'): string {
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, '0');
  if (groupBy === 'month') return `${y}-${m}`;
  if (groupBy === 'week') {
    // Lunes de la semana ISO
    const d = new Date(Date.UTC(y, date.getUTCMonth(), date.getUTCDate()));
    const dayNum = d.getUTCDay() || 7;
    d.setUTCDate(d.getUTCDate() - dayNum + 1);
    return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`;
  }
  const day = String(date.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

@Injectable()
export class ReportsService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Consumo por obra = suma de SALIDA (cantidad y valor) en los almacenes de cada obra en el período.
   */
  async consumptionByObra(query: ConsumptionByObraQueryDto) {
    const { from, to } = resolveRange(query);

    const movements = await this.prisma.movement.findMany({
      where: {
        type: MovementType.SALIDA,
        createdAt: { gte: from, lte: to },
        warehouse: { obraId: { not: null } },
      },
      include: {
        warehouse: {
          select: {
            obraId: true,
            obra: { select: { id: true, code: true, name: true, status: true } },
          },
        },
        items: true,
      },
    });

    const agg = new Map<
      string,
      {
        obraId: string;
        code: string;
        name: string;
        status: string;
        totalQuantity: number;
        totalValue: number;
        movementsCount: number;
      }
    >();

    for (const mov of movements) {
      const obra = mov.warehouse.obra;
      if (!obra) continue;
      const entry = agg.get(obra.id) ?? {
        obraId: obra.id,
        code: obra.code,
        name: obra.name,
        status: obra.status,
        totalQuantity: 0,
        totalValue: 0,
        movementsCount: 0,
      };
      entry.movementsCount += 1;
      for (const line of mov.items) {
        const qty = Number(line.quantity);
        entry.totalQuantity += qty;
        if (line.unitCost) entry.totalValue += qty * Number(line.unitCost);
      }
      agg.set(obra.id, entry);
    }

    return {
      from: from.toISOString(),
      to: to.toISOString(),
      items: Array.from(agg.values()).sort((a, b) => b.totalQuantity - a.totalQuantity),
    };
  }

  /**
   * Top ítems por cantidad movida (filtrable por almacén y tipo de movimiento).
   */
  async topItems(query: TopItemsQueryDto) {
    const { from, to } = resolveRange(query);
    const limit = query.limit ?? 20;

    const movements = await this.prisma.movement.findMany({
      where: {
        createdAt: { gte: from, lte: to },
        ...(query.warehouseId && { warehouseId: query.warehouseId }),
        ...(query.type && { type: query.type }),
      },
      include: {
        items: {
          include: {
            item: {
              select: {
                id: true,
                code: true,
                name: true,
                type: true,
                unit: { select: { abbreviation: true } },
              },
            },
          },
        },
      },
    });

    const agg = new Map<
      string,
      {
        itemId: string;
        code: string;
        name: string;
        type: string;
        unit: string;
        totalQuantity: number;
        movementsCount: number;
      }
    >();

    for (const mov of movements) {
      for (const line of mov.items) {
        const entry = agg.get(line.itemId) ?? {
          itemId: line.itemId,
          code: line.item.code,
          name: line.item.name,
          type: line.item.type,
          unit: line.item.unit.abbreviation,
          totalQuantity: 0,
          movementsCount: 0,
        };
        entry.totalQuantity += Number(line.quantity);
        entry.movementsCount += 1;
        agg.set(line.itemId, entry);
      }
    }

    return {
      from: from.toISOString(),
      to: to.toISOString(),
      items: Array.from(agg.values())
        .sort((a, b) => b.totalQuantity - a.totalQuantity)
        .slice(0, limit),
    };
  }

  /**
   * Valorización del stock: para cada ítem con stock > 0, usa el último unitCost conocido
   * de un MovementItem con precio. Si no hay, el ítem se incluye con value=null.
   */
  async stockValuation(query: StockValuationQueryDto) {
    const stocks = await this.prisma.stock.findMany({
      where: {
        quantity: { gt: 0 },
        item: { deletedAt: null },
        ...(query.warehouseId && { warehouseId: query.warehouseId }),
      },
      include: {
        item: {
          select: {
            id: true,
            code: true,
            name: true,
            type: true,
            unit: { select: { abbreviation: true } },
          },
        },
        warehouse: { select: { id: true, code: true, name: true } },
      },
    });

    if (stocks.length === 0) {
      return { items: [], totalValue: 0, itemsWithCost: 0, itemsWithoutCost: 0 };
    }

    const itemIds = Array.from(new Set(stocks.map((s) => s.itemId)));
    const lastCosts = await this.prisma.movementItem.findMany({
      where: { itemId: { in: itemIds }, unitCost: { not: null } },
      orderBy: { movement: { createdAt: 'desc' } },
      select: { itemId: true, unitCost: true },
    });

    const costMap = new Map<string, number>();
    for (const row of lastCosts) {
      if (!costMap.has(row.itemId) && row.unitCost) {
        costMap.set(row.itemId, Number(row.unitCost));
      }
    }

    const items = stocks.map((s) => {
      const qty = Number(s.quantity);
      const unitCost = costMap.get(s.itemId) ?? null;
      const value = unitCost !== null ? qty * unitCost : null;
      return {
        itemId: s.itemId,
        code: s.item.code,
        name: s.item.name,
        type: s.item.type,
        unit: s.item.unit.abbreviation,
        warehouseId: s.warehouseId,
        warehouseName: s.warehouse.name,
        quantity: qty,
        unitCost,
        value,
      };
    });

    items.sort((a, b) => (b.value ?? 0) - (a.value ?? 0));

    const totalValue = items.reduce((acc, i) => acc + (i.value ?? 0), 0);
    const itemsWithCost = items.filter((i) => i.value !== null).length;
    const itemsWithoutCost = items.length - itemsWithCost;

    return { items, totalValue, itemsWithCost, itemsWithoutCost };
  }

  /**
   * Resumen de movimientos agrupado por día/semana/mes, desglosado por tipo.
   */
  async movementsSummary(query: MovementsSummaryQueryDto) {
    const { from, to } = resolveRange(query);
    const groupBy = query.groupBy ?? 'day';

    const movements = await this.prisma.movement.findMany({
      where: {
        createdAt: { gte: from, lte: to },
        ...(query.warehouseId && { warehouseId: query.warehouseId }),
      },
      select: {
        type: true,
        source: true,
        createdAt: true,
        items: { select: { quantity: true } },
      },
    });

    const buckets = new Map<
      string,
      {
        bucket: string;
        entradas: number;
        salidas: number;
        ajustes: number;
        qtyEntradas: number;
        qtySalidas: number;
        qtyAjustes: number;
      }
    >();

    for (const mov of movements) {
      const key = bucketKey(mov.createdAt, groupBy);
      const entry = buckets.get(key) ?? {
        bucket: key,
        entradas: 0,
        salidas: 0,
        ajustes: 0,
        qtyEntradas: 0,
        qtySalidas: 0,
        qtyAjustes: 0,
      };
      const qty = mov.items.reduce((acc, l) => acc + Number(l.quantity), 0);
      if (mov.type === MovementType.ENTRADA) {
        entry.entradas += 1;
        entry.qtyEntradas += qty;
      } else if (mov.type === MovementType.SALIDA) {
        entry.salidas += 1;
        entry.qtySalidas += qty;
      } else {
        entry.ajustes += 1;
        entry.qtyAjustes += qty;
      }
      buckets.set(key, entry);
    }

    const series = Array.from(buckets.values()).sort((a, b) =>
      a.bucket.localeCompare(b.bucket),
    );

    const totals = series.reduce(
      (acc, s) => {
        acc.entradas += s.entradas;
        acc.salidas += s.salidas;
        acc.ajustes += s.ajustes;
        return acc;
      },
      { entradas: 0, salidas: 0, ajustes: 0 },
    );

    return {
      from: from.toISOString(),
      to: to.toISOString(),
      groupBy,
      totals,
      series,
    };
  }
}
