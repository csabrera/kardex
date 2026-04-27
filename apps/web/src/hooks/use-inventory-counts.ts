import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';

import { apiClient } from '@/lib/api-client';

export type InventoryCountStatus = 'IN_PROGRESS' | 'CLOSED' | 'CANCELLED';

export interface InventoryCountLine {
  id: string;
  itemId: string;
  expectedQty: number;
  countedQty: number | null;
  variance: number | null;
  notes: string | null;
  item: {
    id: string;
    code: string;
    name: string;
    type: string;
    unit: { abbreviation: string };
  };
}

export interface InventoryCount {
  id: string;
  code: string;
  status: InventoryCountStatus;
  notes: string | null;
  startedAt: string;
  closedAt: string | null;
  cancelledAt: string | null;
  warehouse: { id: string; code: string; name: string; type?: string };
  startedBy: { id: string; firstName: string; lastName: string };
  closedBy: { id: string; firstName: string; lastName: string } | null;
  cancelledBy: { id: string; firstName: string; lastName: string } | null;
  adjustmentMovement: { id: string; code: string } | null;
  items: InventoryCountLine[];
  _count?: { items: number };
}

export interface InventoryCountListItem extends Omit<
  InventoryCount,
  'items' | 'closedBy' | 'cancelledBy' | 'adjustmentMovement'
> {
  _count: { items: number };
}

interface QueryParams {
  status?: InventoryCountStatus;
  warehouseId?: string;
  page?: number;
  pageSize?: number;
  enabled?: boolean;
}

const BASE = '/inventory-counts';

export function useInventoryCounts({ enabled = true, ...params }: QueryParams = {}) {
  return useQuery<{
    items: InventoryCountListItem[];
    total: number;
    page: number;
    pageSize: number;
    totalPages: number;
  }>({
    queryKey: ['inventory-counts', params],
    queryFn: () => apiClient.get(BASE, { params }).then((r) => r.data.data),
    enabled,
  });
}

export function useInventoryCount(id: string | null) {
  return useQuery<InventoryCount>({
    queryKey: ['inventory-counts', id],
    queryFn: () => apiClient.get(`${BASE}/${id}`).then((r) => r.data.data),
    enabled: !!id,
  });
}

function invalidate(qc: ReturnType<typeof useQueryClient>) {
  qc.invalidateQueries({ queryKey: ['inventory-counts'] });
  qc.invalidateQueries({ queryKey: ['stock'] });
  qc.invalidateQueries({ queryKey: ['movements'] });
  qc.invalidateQueries({ queryKey: ['items'] });
  qc.invalidateQueries({ queryKey: ['dashboard-stats'] });
}

export function useCreateInventoryCount() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (dto: { warehouseId: string; notes?: string }) =>
      apiClient.post(BASE, dto).then((r) => r.data.data as InventoryCount),
    onSuccess: (count) => {
      invalidate(qc);
      toast.success(`Conteo ${count.code} iniciado · ${count.items?.length ?? 0} ítems`);
    },
    onError: (e: any) =>
      toast.error(e.response?.data?.error?.message ?? 'Error al crear conteo'),
  });
}

export function useUpdateCountItem(countId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      itemId,
      countedQty,
      notes,
    }: {
      itemId: string;
      countedQty: number;
      notes?: string;
    }) =>
      apiClient
        .patch(`${BASE}/${countId}/items/${itemId}`, { countedQty, notes })
        .then((r) => r.data.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['inventory-counts', countId] });
    },
    onError: (e: any) =>
      toast.error(e.response?.data?.error?.message ?? 'Error al guardar línea'),
  });
}

export function useCloseInventoryCount() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, notes }: { id: string; notes?: string }) =>
      apiClient
        .patch(`${BASE}/${id}/close`, { notes })
        .then((r) => r.data.data as InventoryCount),
    onSuccess: (count) => {
      invalidate(qc);
      toast.success(
        count.adjustmentMovement
          ? `Conteo ${count.code} cerrado · ajuste ${count.adjustmentMovement.code} generado`
          : `Conteo ${count.code} cerrado · sin diferencias`,
      );
    },
    onError: (e: any) =>
      toast.error(e.response?.data?.error?.message ?? 'Error al cerrar conteo'),
  });
}

export function useCancelInventoryCount() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, reason }: { id: string; reason?: string }) =>
      apiClient.patch(`${BASE}/${id}/cancel`, { reason }).then((r) => r.data.data),
    onSuccess: () => {
      invalidate(qc);
      toast.success('Conteo cancelado');
    },
    onError: (e: any) =>
      toast.error(e.response?.data?.error?.message ?? 'Error al cancelar'),
  });
}
