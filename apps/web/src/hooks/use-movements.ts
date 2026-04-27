import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';

import { apiClient } from '@/lib/api-client';

export type MovementType = 'ENTRADA' | 'SALIDA' | 'AJUSTE';
export type MovementSource =
  | 'COMPRA'
  | 'CONSUMO'
  | 'TRANSFERENCIA'
  | 'AJUSTE'
  | 'DEVOLUCION'
  | 'BAJA';

export interface MovementItem {
  id: string;
  itemId: string;
  quantity: number;
  unitCost?: number | null;
  stockBefore: number;
  stockAfter: number;
  item: { id: string; code: string; name: string; unit: { abbreviation: string } };
}

export interface Movement {
  id: string;
  code: string;
  type: MovementType;
  source: MovementSource;
  warehouseId: string;
  warehouse: { id: string; code: string; name: string };
  userId: string;
  user: { id: string; firstName: string; lastName: string };
  notes?: string | null;
  items: MovementItem[];
  createdAt: string;
}

export interface KardexEntry {
  id: string;
  quantity: number;
  unitCost?: number | null;
  stockBefore: number;
  stockAfter: number;
  item: { code: string; name: string; unit: { abbreviation: string } };
  movement: {
    id: string;
    code: string;
    type: MovementType;
    source: MovementSource;
    notes?: string | null;
    createdAt: string;
    warehouse: { id: string; code: string; name: string };
    user: { firstName: string; lastName: string };
  };
}

interface MovementQuery {
  page?: number;
  pageSize?: number;
  type?: MovementType;
  warehouseId?: string;
  itemId?: string;
  search?: string;
  enabled?: boolean;
}

export interface CreateMovementDto {
  type: MovementType;
  source: MovementSource;
  warehouseId: string;
  /** Requerido cuando source=COMPRA, prohibido en otras (validado en backend). */
  supplierId?: string;
  notes?: string;
  items: { itemId: string; quantity: number; unitCost?: number }[];
}

const BASE = '/movements';

export function useMovements({ enabled = true, ...params }: MovementQuery = {}) {
  return useQuery<{
    items: Movement[];
    total: number;
    page: number;
    pageSize: number;
    totalPages: number;
  }>({
    queryKey: ['movements', params],
    enabled,
    queryFn: () => apiClient.get(BASE, { params }).then((r) => r.data.data),
  });
}

export function useMovement(id: string) {
  return useQuery<Movement>({
    queryKey: ['movements', id],
    queryFn: () => apiClient.get(`${BASE}/${id}`).then((r) => r.data.data),
    enabled: !!id,
  });
}

export function useKardex(itemId: string, warehouseId?: string) {
  return useQuery<KardexEntry[]>({
    queryKey: ['kardex', itemId, warehouseId],
    queryFn: () =>
      apiClient
        .get(`${BASE}/kardex/${itemId}`, { params: warehouseId ? { warehouseId } : {} })
        .then((r) => r.data.data),
    enabled: !!itemId,
  });
}

export function useCreateMovement() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (dto: CreateMovementDto) =>
      apiClient.post(BASE, dto).then((r) => r.data.data),
    onSuccess: (data: Movement) => {
      qc.invalidateQueries({ queryKey: ['movements'] });
      qc.invalidateQueries({ queryKey: ['stock'] });
      qc.invalidateQueries({ queryKey: ['kardex'] });
      qc.invalidateQueries({ queryKey: ['alerts'] });
      // La tabla de ítems muestra principalStock por ítem: refrescarla tras cualquier movimiento
      qc.invalidateQueries({ queryKey: ['items'] });
      // Dashboard agrega KPIs + gráficas basadas en movimientos
      qc.invalidateQueries({ queryKey: ['dashboard-stats'] });
      toast.success(`Movimiento ${data.code} registrado`);
    },
    onError: (e: any) =>
      toast.error(e.response?.data?.error?.message ?? 'Error al registrar movimiento'),
  });
}
