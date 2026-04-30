import { Injectable } from '@nestjs/common';
import { ToolLoanCondition, ToolLoanStatus } from '@prisma/client';

import { PrismaService } from '../../prisma/prisma.service';

interface StockQuery {
  warehouseId?: string;
  itemId?: string;
  search?: string;
}

@Injectable()
export class StockService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(query: StockQuery = {}) {
    const { warehouseId, itemId, search } = query;

    const items = await this.prisma.stock.findMany({
      where: {
        ...(warehouseId && { warehouseId }),
        ...(itemId && { itemId }),
        item: {
          deletedAt: null,
          ...(search && {
            OR: [
              { code: { contains: search, mode: 'insensitive' } },
              { name: { contains: search, mode: 'insensitive' } },
            ],
          }),
        },
        warehouse: { deletedAt: null },
      },
      include: {
        item: {
          select: {
            id: true,
            code: true,
            name: true,
            type: true,
            minStock: true,
            maxStock: true,
            unit: { select: { abbreviation: true } },
          },
        },
        warehouse: { select: { id: true, code: true, name: true, type: true } },
      },
      orderBy: [{ warehouse: { code: 'asc' } }, { item: { code: 'asc' } }],
    });

    // Para items tipo PRESTAMO, calcular loanedQty (préstamos ACTIVE) y
    // damagedReturnedQty (préstamos RETURNED con condición DAMAGED).
    // Para los demás tipos availableQty == quantity (no aplica el concepto).
    const prestamoStocks = items.filter((s) => s.item.type === 'PRESTAMO');
    const loanAggregates = await this.aggregateLoans(prestamoStocks);

    return items.map((s) => {
      const key = `${s.itemId}:${s.warehouseId}`;
      const agg = loanAggregates.get(key);
      const loanedQty = agg?.loaned ?? 0;
      const damagedReturnedQty = agg?.damaged ?? 0;
      const totalQty = Number(s.quantity);
      return {
        ...s,
        loanedQty,
        availableQty: Math.max(0, totalQty - loanedQty),
        damagedReturnedQty,
      };
    });
  }

  /**
   * Para los stocks pasados, devuelve un map (itemId:warehouseId) → {loaned, damaged}.
   * Hace 2 aggregates groupBy en paralelo para minimizar round-trips.
   */
  private async aggregateLoans(
    stocks: Array<{ itemId: string; warehouseId: string }>,
  ): Promise<Map<string, { loaned: number; damaged: number }>> {
    const map = new Map<string, { loaned: number; damaged: number }>();
    if (stocks.length === 0) return map;

    const itemIds = Array.from(new Set(stocks.map((s) => s.itemId)));
    const warehouseIds = Array.from(new Set(stocks.map((s) => s.warehouseId)));

    const [activeLoans, damagedReturns] = await Promise.all([
      this.prisma.toolLoan.groupBy({
        by: ['itemId', 'warehouseId'],
        where: {
          itemId: { in: itemIds },
          warehouseId: { in: warehouseIds },
          status: ToolLoanStatus.ACTIVE,
        },
        _sum: { quantity: true },
      }),
      this.prisma.toolLoan.groupBy({
        by: ['itemId', 'warehouseId'],
        where: {
          itemId: { in: itemIds },
          warehouseId: { in: warehouseIds },
          status: ToolLoanStatus.RETURNED,
          returnCondition: ToolLoanCondition.DAMAGED,
        },
        _sum: { quantity: true },
      }),
    ]);

    for (const row of activeLoans) {
      const key = `${row.itemId}:${row.warehouseId}`;
      const entry = map.get(key) ?? { loaned: 0, damaged: 0 };
      entry.loaned = Number(row._sum.quantity ?? 0);
      map.set(key, entry);
    }
    for (const row of damagedReturns) {
      const key = `${row.itemId}:${row.warehouseId}`;
      const entry = map.get(key) ?? { loaned: 0, damaged: 0 };
      entry.damaged = Number(row._sum.quantity ?? 0);
      map.set(key, entry);
    }

    return map;
  }

  async summary(warehouseId?: string) {
    const stocks = await this.findAll({ warehouseId });

    const belowMin = stocks.filter(
      (s) => Number(s.quantity) < Number(s.item.minStock),
    ).length;

    const total = stocks.length;
    const totalQuantity = stocks.reduce((acc, s) => acc + Number(s.quantity), 0);

    return { total, belowMin, totalQuantity, items: stocks };
  }
}
