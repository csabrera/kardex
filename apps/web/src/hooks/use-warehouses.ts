import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';

import { apiClient } from '@/lib/api-client';

export type WarehouseType = 'CENTRAL' | 'OBRA';

export interface Warehouse {
  id: string;
  code: string;
  name: string;
  type: WarehouseType;
  obraId?: string | null;
  obra?: { id: string; code: string; name: string; status: string } | null;
  location?: string | null;
  description?: string | null;
  active: boolean;
  createdAt: string;
}

interface WarehousePage {
  items: Warehouse[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

interface WarehouseQuery {
  page?: number;
  pageSize?: number;
  search?: string;
  type?: WarehouseType;
  obraId?: string;
  enabled?: boolean;
}

interface CreateWarehouseDto {
  code?: string;
  name: string;
  type?: WarehouseType;
  obraId?: string;
  location?: string;
  description?: string;
}

const BASE = '/warehouses';

export function useWarehouses({ enabled = true, ...params }: WarehouseQuery = {}) {
  return useQuery<WarehousePage>({
    queryKey: ['warehouses', params],
    queryFn: () => apiClient.get(BASE, { params }).then((r) => r.data.data),
    enabled,
  });
}

export function useMainWarehouse() {
  return useQuery<Warehouse>({
    queryKey: ['warehouses', 'main'],
    queryFn: () => apiClient.get(`${BASE}/main`).then((r) => r.data.data),
  });
}

export function useWarehouse(id: string) {
  return useQuery<Warehouse>({
    queryKey: ['warehouses', id],
    queryFn: () => apiClient.get(`${BASE}/${id}`).then((r) => r.data.data),
    enabled: !!id,
  });
}

export function useCreateWarehouse() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (dto: CreateWarehouseDto) =>
      apiClient.post(BASE, dto).then((r) => r.data.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['warehouses'] });
      toast.success('Almacén creado');
    },
    onError: (e: any) =>
      toast.error(e.response?.data?.error?.message ?? 'Error al crear almacén'),
  });
}

export function useUpdateWarehouse() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      ...dto
    }: Partial<CreateWarehouseDto> & { id: string; active?: boolean }) =>
      apiClient.patch(`${BASE}/${id}`, dto).then((r) => r.data.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['warehouses'] });
      toast.success('Almacén actualizado');
    },
    onError: (e: any) =>
      toast.error(e.response?.data?.error?.message ?? 'Error al actualizar'),
  });
}

export function useDeleteWarehouse() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiClient.delete(`${BASE}/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['warehouses'] });
      toast.success('Almacén eliminado');
    },
    onError: (e: any) =>
      toast.error(e.response?.data?.error?.message ?? 'No se pudo eliminar'),
  });
}
