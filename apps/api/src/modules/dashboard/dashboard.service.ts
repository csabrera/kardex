import { Injectable } from '@nestjs/common';
import { MovementType, WarehouseType } from '@prisma/client';

import { PrismaService } from '../../prisma/prisma.service';

export interface DashboardStats {
  kpis: {
    obrasActivas: { value: number; recent: number };
    empleadosActivos: { value: number; recent: number };
    itemsCatalogo: { value: number; recent: number };
    prestamosActivos: { value: number; overdue: number };
    alertasPendientes: { value: number; critical: number };
    movimientos7d: { value: number; delta: number; deltaPct: number | null };
  };
  movementsByDay: {
    date: string;
    entradas: number;
    salidas: number;
    ajustes: number;
  }[];
  topItems: {
    itemId: string;
    code: string;
    name: string;
    unit: string;
    totalQuantity: number;
    movementsCount: number;
  }[];
  stockByStatus: {
    optimo: number;
    bajo: number;
    sinStock: number;
  };
  topObras: {
    obraId: string;
    code: string;
    name: string;
    totalQuantity: number;
    movementsCount: number;
  }[];
}

@Injectable()
export class DashboardService {
  constructor(private readonly prisma: PrismaService) {}

  async getStats(): Promise<DashboardStats> {
    const now = new Date();
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const fourteenDaysAgo = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);

    const [
      obrasActivas,
      obrasNuevas,
      empleadosActivos,
      empleadosNuevos,
      itemsCatalogo,
      itemsNuevos,
      prestamosActivos,
      prestamosOverdue,
      alertasUnread,
      alertasCritical,
      movimientos7d,
      movimientosPrev7d,
      movementsLast7d,
      stockPrincipal,
      topObrasMovs,
    ] = await Promise.all([
      this.prisma.obra.count({ where: { status: 'ACTIVA', deletedAt: null } }),
      this.prisma.obra.count({
        where: { status: 'ACTIVA', deletedAt: null, createdAt: { gte: sevenDaysAgo } },
      }),
      this.prisma.worker.count({ where: { active: true, deletedAt: null } }),
      this.prisma.worker.count({
        where: { active: true, deletedAt: null, createdAt: { gte: sevenDaysAgo } },
      }),
      this.prisma.item.count({ where: { deletedAt: null } }),
      this.prisma.item.count({
        where: { deletedAt: null, createdAt: { gte: sevenDaysAgo } },
      }),
      this.prisma.toolLoan.count({ where: { status: 'ACTIVE' } }),
      this.prisma.toolLoan.count({
        where: { status: 'ACTIVE', expectedReturnAt: { lt: now } },
      }),
      this.prisma.alert.count({ where: { read: false } }),
      this.prisma.alert.count({ where: { read: false, type: 'STOCK_CRITICO' } }),
      this.prisma.movement.count({ where: { createdAt: { gte: sevenDaysAgo } } }),
      this.prisma.movement.count({
        where: { createdAt: { gte: fourteenDaysAgo, lt: sevenDaysAgo } },
      }),
      // Movimientos últimos 7d para: (a) serie por día, (b) top items, (c) top obras
      this.prisma.movement.findMany({
        where: { createdAt: { gte: sevenDaysAgo } },
        include: {
          items: {
            include: {
              item: {
                select: {
                  id: true,
                  code: true,
                  name: true,
                  unit: { select: { abbreviation: true } },
                },
              },
            },
          },
          warehouse: {
            select: {
              id: true,
              type: true,
              obra: { select: { id: true, code: true, name: true } },
            },
          },
        },
        orderBy: { createdAt: 'asc' },
      }),
      // Stock del Almacén Principal para la distribución por estado
      this.prisma.stock.findMany({
        where: { warehouse: { type: WarehouseType.CENTRAL, deletedAt: null } },
        include: { item: { select: { minStock: true, deletedAt: true } } },
      }),
      // (placeholder — se computa abajo a partir de movementsLast7d) — no-op query
      this.prisma.$queryRaw`SELECT 1`,
    ]);
    void topObrasMovs;

    // ---- Serie movimientos por día últimos 7 días ----
    const dayMap = new Map<
      string,
      { entradas: number; salidas: number; ajustes: number }
    >();
    for (let i = 6; i >= 0; i--) {
      const d = new Date(now.getTime() - i * 24 * 60 * 60 * 1000);
      const key = d.toISOString().slice(0, 10);
      dayMap.set(key, { entradas: 0, salidas: 0, ajustes: 0 });
    }
    for (const m of movementsLast7d) {
      const key = new Date(m.createdAt).toISOString().slice(0, 10);
      const bucket = dayMap.get(key);
      if (!bucket) continue;
      if (m.type === MovementType.ENTRADA) bucket.entradas += 1;
      else if (m.type === MovementType.SALIDA) bucket.salidas += 1;
      else bucket.ajustes += 1;
    }
    const movementsByDay = Array.from(dayMap.entries()).map(([date, counts]) => ({
      date,
      ...counts,
    }));

    // ---- Top 5 ítems por rotación últimos 7d ----
    const itemStats = new Map<
      string,
      {
        code: string;
        name: string;
        unit: string;
        totalQuantity: number;
        movementsCount: number;
      }
    >();
    for (const m of movementsLast7d) {
      if (m.type === MovementType.AJUSTE) continue; // los ajustes no son rotación real
      for (const line of m.items) {
        const existing = itemStats.get(line.itemId) ?? {
          code: line.item.code,
          name: line.item.name,
          unit: line.item.unit.abbreviation,
          totalQuantity: 0,
          movementsCount: 0,
        };
        existing.totalQuantity += Number(line.quantity);
        existing.movementsCount += 1;
        itemStats.set(line.itemId, existing);
      }
    }
    const topItems = Array.from(itemStats.entries())
      .map(([itemId, v]) => ({ itemId, ...v }))
      .sort((a, b) => b.totalQuantity - a.totalQuantity)
      .slice(0, 5);

    // ---- Stock por estado (solo Almacén Principal) ----
    let optimo = 0;
    let bajo = 0;
    let sinStock = 0;
    for (const s of stockPrincipal) {
      if (s.item.deletedAt) continue;
      const qty = Number(s.quantity);
      const min = Number(s.item.minStock);
      if (qty === 0 && min > 0) sinStock += 1;
      else if (min > 0 && qty < min) bajo += 1;
      else optimo += 1;
    }

    // ---- Top 5 obras por consumo (movimientos en almacenes de obra) ----
    const obraStats = new Map<
      string,
      {
        code: string;
        name: string;
        totalQuantity: number;
        movementsCount: number;
      }
    >();
    for (const m of movementsLast7d) {
      const obra = m.warehouse?.obra;
      if (!obra) continue;
      const existing = obraStats.get(obra.id) ?? {
        code: obra.code,
        name: obra.name,
        totalQuantity: 0,
        movementsCount: 0,
      };
      existing.movementsCount += 1;
      for (const line of m.items) {
        existing.totalQuantity += Number(line.quantity);
      }
      obraStats.set(obra.id, existing);
    }
    const topObras = Array.from(obraStats.entries())
      .map(([obraId, v]) => ({ obraId, ...v }))
      .sort((a, b) => b.totalQuantity - a.totalQuantity)
      .slice(0, 5);

    // ---- Delta de movimientos ----
    const delta = movimientos7d - movimientosPrev7d;
    const deltaPct =
      movimientosPrev7d > 0
        ? Math.round((delta / movimientosPrev7d) * 100)
        : movimientos7d > 0
          ? null
          : 0;

    return {
      kpis: {
        obrasActivas: { value: obrasActivas, recent: obrasNuevas },
        empleadosActivos: { value: empleadosActivos, recent: empleadosNuevos },
        itemsCatalogo: { value: itemsCatalogo, recent: itemsNuevos },
        prestamosActivos: { value: prestamosActivos, overdue: prestamosOverdue },
        alertasPendientes: { value: alertasUnread, critical: alertasCritical },
        movimientos7d: { value: movimientos7d, delta, deltaPct },
      },
      movementsByDay,
      topItems,
      stockByStatus: { optimo, bajo, sinStock },
      topObras,
    };
  }
}
