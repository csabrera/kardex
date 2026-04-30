import { useQuery } from '@tanstack/react-query';

import { apiClient } from '@/lib/api-client';

export interface StockEntry {
  id: string;
  itemId: string;
  warehouseId: string;
  quantity: number;
  version: number;
  /** Para items PRESTAMO: cantidad actualmente en préstamo activo. Para otros tipos: 0. */
  loanedQty: number;
  /** quantity - loanedQty. Para items no-PRESTAMO == quantity. */
  availableQty: number;
  /** Para items PRESTAMO: cantidad devuelta con condición DAMAGED (cuenta en quantity pero "no utilizable"). */
  damagedReturnedQty: number;
  item: {
    id: string;
    code: string;
    name: string;
    type: string;
    minStock: number;
    maxStock?: number | null;
    unit: { abbreviation: string };
  };
  warehouse: {
    id: string;
    code: string;
    name: string;
    type: string;
  };
}

interface StockQuery {
  warehouseId?: string;
  itemId?: string;
  search?: string;
  enabled?: boolean;
}

const BASE = '/stock';

export function useStock({ enabled = true, ...params }: StockQuery = {}) {
  return useQuery<StockEntry[]>({
    queryKey: ['stock', params],
    queryFn: () => apiClient.get(BASE, { params }).then((r) => r.data.data),
    enabled,
  });
}

export function useStockSummary(warehouseId?: string) {
  return useQuery<{
    total: number;
    belowMin: number;
    totalQuantity: number;
    items: StockEntry[];
  }>({
    queryKey: ['stock', 'summary', warehouseId],
    queryFn: () =>
      apiClient
        .get(`${BASE}/summary`, { params: warehouseId ? { warehouseId } : {} })
        .then((r) => r.data.data),
  });
}
