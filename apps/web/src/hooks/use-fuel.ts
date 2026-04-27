import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';

import { apiClient } from '@/lib/api-client';

export interface FuelDispatch {
  id: string;
  code: string;
  equipmentId: string;
  equipment: {
    id: string;
    code: string;
    name: string;
    type: string;
    countType: string;
    currentCount: number;
  };
  itemId: string;
  item: {
    id: string;
    code: string;
    name: string;
    type: string;
    unit: { abbreviation: string };
  };
  warehouseId: string;
  warehouse: {
    id: string;
    code: string;
    name: string;
    type: string;
    obra?: { id: string; code: string; name: string } | null;
  };
  quantity: number;
  countReading: number;
  operatorWorkerId?: string | null;
  operatorWorker?: { id: string; firstName: string; lastName: string } | null;
  dispatchedById: string;
  dispatchedBy: { id: string; firstName: string; lastName: string };
  movementId?: string | null;
  movement?: { id: string; code: string } | null;
  notes?: string | null;
  createdAt: string;
}

export interface DispatchFuelDto {
  equipmentId: string;
  itemId: string;
  warehouseId: string;
  quantity: number;
  countReading: number;
  operatorWorkerId?: string;
  notes?: string;
}

interface FuelQuery {
  page?: number;
  pageSize?: number;
  equipmentId?: string;
  warehouseId?: string;
  dateFrom?: string;
  dateTo?: string;
  search?: string;
  enabled?: boolean;
}

const BASE = '/fuel';

export function useFuelDispatches({ enabled = true, ...params }: FuelQuery = {}) {
  return useQuery<{
    items: FuelDispatch[];
    total: number;
    page: number;
    pageSize: number;
    totalPages: number;
  }>({
    queryKey: ['fuel', params],
    enabled,
    queryFn: () => apiClient.get(BASE, { params }).then((r) => r.data.data),
  });
}

export function useFuelSummary(days = 30) {
  return useQuery<{
    days: number;
    total: number;
    byEquipment: {
      equipmentId: string;
      code: string;
      name: string;
      totalQuantity: number;
      unit: string;
      count: number;
    }[];
  }>({
    queryKey: ['fuel', 'summary', days],
    queryFn: () =>
      apiClient.get(`${BASE}/summary`, { params: { days } }).then((r) => r.data.data),
  });
}

export function useDispatchFuel() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (dto: DispatchFuelDto) =>
      apiClient.post(`${BASE}/dispatch`, dto).then((r) => r.data.data),
    onSuccess: (data: FuelDispatch) => {
      qc.invalidateQueries({ queryKey: ['fuel'] });
      qc.invalidateQueries({ queryKey: ['stock'] });
      qc.invalidateQueries({ queryKey: ['items'] });
      qc.invalidateQueries({ queryKey: ['movements'] });
      qc.invalidateQueries({ queryKey: ['alerts'] });
      qc.invalidateQueries({ queryKey: ['equipment'] });
      qc.invalidateQueries({ queryKey: ['dashboard-stats'] });
      toast.success(`Despacho ${data.code} registrado`);
    },
    onError: (e: any) =>
      toast.error(e.response?.data?.error?.message ?? 'Error al despachar combustible'),
  });
}
