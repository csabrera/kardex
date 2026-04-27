import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';

import { apiClient } from '@/lib/api-client';

export interface Unit {
  id: string;
  code: string;
  name: string;
  abbreviation: string;
  createdAt: string;
}

interface UnitPage {
  items: Unit[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

interface UnitQuery {
  page?: number;
  pageSize?: number;
  search?: string;
}

interface CreateUnitDto {
  code?: string;
  name: string;
  abbreviation: string;
}

const BASE = '/units';

export function useUnits(params: UnitQuery = {}) {
  return useQuery<UnitPage>({
    queryKey: ['units', params],
    queryFn: () => apiClient.get(BASE, { params }).then((r) => r.data.data),
  });
}

export function useUnit(id: string) {
  return useQuery<Unit>({
    queryKey: ['units', id],
    queryFn: () => apiClient.get(`${BASE}/${id}`).then((r) => r.data.data),
    enabled: !!id,
  });
}

export function useCreateUnit() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (dto: CreateUnitDto) =>
      apiClient.post(BASE, dto).then((r) => r.data.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['units'] });
      toast.success('Unidad creada');
    },
    onError: (e: any) =>
      toast.error(e.response?.data?.error?.message ?? 'Error al crear'),
  });
}

export function useUpdateUnit() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...dto }: Partial<CreateUnitDto> & { id: string }) =>
      apiClient.patch(`${BASE}/${id}`, dto).then((r) => r.data.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['units'] });
      toast.success('Unidad actualizada');
    },
    onError: (e: any) =>
      toast.error(e.response?.data?.error?.message ?? 'Error al actualizar'),
  });
}

export function useDeleteUnit() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiClient.delete(`${BASE}/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['units'] });
      toast.success('Unidad eliminada');
    },
    onError: (e: any) =>
      toast.error(e.response?.data?.error?.message ?? 'No se pudo eliminar'),
  });
}
