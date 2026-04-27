import { Injectable } from '@nestjs/common';

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

    return items;
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
