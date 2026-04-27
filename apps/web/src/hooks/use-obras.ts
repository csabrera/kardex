import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';

import { apiClient } from '@/lib/api-client';

export type ObraStatus = 'PLANIFICACION' | 'ACTIVA' | 'SUSPENDIDA' | 'FINALIZADA';

export interface Obra {
  id: string;
  code: string;
  name: string;
  address?: string | null;
  client?: string | null;
  description?: string | null;
  startDate?: string | null;
  endDate?: string | null;
  status: ObraStatus;
  responsibleUserId: string;
  responsibleUser?: { id: string; firstName: string; lastName: string } | null;
  createdAt: string;
  _count?: { warehouses: number; workers: number; workStations: number };
  warehouses?: {
    id: string;
    code: string;
    name: string;
    type: string;
    active: boolean;
  }[];
  workStations?: {
    id: string;
    name: string;
    description?: string | null;
    active: boolean;
  }[];
}

interface ObrasQuery {
  page?: number;
  pageSize?: number;
  search?: string;
  status?: ObraStatus;
  responsibleUserId?: string;
  enabled?: boolean;
}

export interface CreateObraDto {
  code?: string;
  name: string;
  address?: string;
  client?: string;
  description?: string;
  startDate?: string;
  endDate?: string;
  status?: ObraStatus;
  responsibleUserId: string;
}

const BASE = '/obras';

export function useObras({ enabled = true, ...params }: ObrasQuery = {}) {
  return useQuery<{
    items: Obra[];
    total: number;
    page: number;
    pageSize: number;
    totalPages: number;
  }>({
    queryKey: ['obras', params],
    enabled,
    queryFn: () => apiClient.get(BASE, { params }).then((r) => r.data.data),
  });
}

export function useObra(id: string | null) {
  return useQuery<Obra>({
    queryKey: ['obras', id],
    queryFn: () => apiClient.get(`${BASE}/${id}`).then((r) => r.data.data),
    enabled: !!id,
  });
}

export function useCreateObra() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (dto: CreateObraDto) =>
      apiClient.post(BASE, dto).then((r) => r.data.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['obras'] });
      toast.success('Obra creada');
    },
    onError: (e: any) =>
      toast.error(e.response?.data?.error?.message ?? 'Error al crear obra'),
  });
}

export function useUpdateObra() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, dto }: { id: string; dto: Partial<CreateObraDto> }) =>
      apiClient.patch(`${BASE}/${id}`, dto).then((r) => r.data.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['obras'] });
      toast.success('Obra actualizada');
    },
    onError: (e: any) =>
      toast.error(e.response?.data?.error?.message ?? 'Error al actualizar'),
  });
}

export function useDeleteObra() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      apiClient.delete(`${BASE}/${id}`).then((r) => r.data.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['obras'] });
      toast.success('Obra eliminada');
    },
    onError: (e: any) =>
      toast.error(e.response?.data?.error?.message ?? 'No se pudo eliminar'),
  });
}
