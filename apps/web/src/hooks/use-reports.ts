import { useQuery } from '@tanstack/react-query';

import { apiClient } from '@/lib/api-client';

export interface ConsumptionByObraRow {
  obraId: string;
  code: string;
  name: string;
  status: string;
  totalQuantity: number;
  totalValue: number;
  movementsCount: number;
}

export interface TopItemRow {
  itemId: string;
  code: string;
  name: string;
  type: string;
  unit: string;
  totalQuantity: number;
  movementsCount: number;
}

export interface StockValuationRow {
  itemId: string;
  code: string;
  name: string;
  type: string;
  unit: string;
  warehouseId: string;
  warehouseName: string;
  quantity: number;
  unitCost: number | null;
  value: number | null;
}

export interface MovementsSummaryBucket {
  bucket: string;
  entradas: number;
  salidas: number;
  ajustes: number;
  qtyEntradas: number;
  qtySalidas: number;
  qtyAjustes: number;
}

type Range = { from?: string; to?: string };

const BASE = '/reports';

export function useConsumptionByObra(range: Range) {
  return useQuery<{ from: string; to: string; items: ConsumptionByObraRow[] }>({
    queryKey: ['reports', 'consumption-by-obra', range],
    queryFn: () =>
      apiClient
        .get(`${BASE}/consumption-by-obra`, { params: range })
        .then((r) => r.data.data),
  });
}

export function useTopItems(
  params: Range & {
    warehouseId?: string;
    type?: 'ENTRADA' | 'SALIDA' | 'AJUSTE';
    limit?: number;
  },
) {
  return useQuery<{ from: string; to: string; items: TopItemRow[] }>({
    queryKey: ['reports', 'top-items', params],
    queryFn: () =>
      apiClient.get(`${BASE}/top-items`, { params }).then((r) => r.data.data),
  });
}

export function useStockValuation(params: { warehouseId?: string }) {
  return useQuery<{
    items: StockValuationRow[];
    totalValue: number;
    itemsWithCost: number;
    itemsWithoutCost: number;
  }>({
    queryKey: ['reports', 'stock-valuation', params],
    queryFn: () =>
      apiClient.get(`${BASE}/stock-valuation`, { params }).then((r) => r.data.data),
  });
}

export function useMovementsSummary(
  params: Range & { warehouseId?: string; groupBy?: 'day' | 'week' | 'month' },
) {
  return useQuery<{
    from: string;
    to: string;
    groupBy: 'day' | 'week' | 'month';
    totals: { entradas: number; salidas: number; ajustes: number };
    series: MovementsSummaryBucket[];
  }>({
    queryKey: ['reports', 'movements-summary', params],
    queryFn: () =>
      apiClient.get(`${BASE}/movements-summary`, { params }).then((r) => r.data.data),
  });
}
