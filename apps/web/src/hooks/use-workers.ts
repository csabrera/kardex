import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';

import { apiClient } from '@/lib/api-client';

export interface Worker {
  id: string;
  documentType: string;
  documentNumber: string;
  firstName: string;
  lastName: string;
  phone: string;
  address?: string | null;
  birthDate?: string | null;
  hireDate?: string | null;
  notes?: string | null;
  active: boolean;
  specialty: { id: string; code: string; name: string };
  obra?: { id: string; code: string; name: string } | null;
  createdAt: string;
}

interface WorkersQuery {
  page?: number;
  pageSize?: number;
  search?: string;
  specialtyId?: string;
  obraId?: string;
  active?: boolean;
  enabled?: boolean;
}

export interface CreateWorkerDto {
  documentType: string;
  documentNumber: string;
  firstName: string;
  lastName: string;
  phone: string;
  address?: string;
  birthDate?: string;
  hireDate?: string;
  notes?: string;
  specialtyId: string;
  obraId?: string;
}

const BASE = '/workers';

export function useWorker(id: string) {
  return useQuery<Worker>({
    queryKey: ['workers', id],
    enabled: !!id,
    queryFn: () => apiClient.get(`${BASE}/${id}`).then((r) => r.data.data),
  });
}

export function useWorkers({ enabled = true, ...params }: WorkersQuery = {}) {
  return useQuery<{
    items: Worker[];
    total: number;
    page: number;
    pageSize: number;
    totalPages: number;
  }>({
    queryKey: ['workers', params],
    queryFn: () => apiClient.get(BASE, { params }).then((r) => r.data.data),
    enabled,
  });
}

export function useCreateWorker() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (dto: CreateWorkerDto) =>
      apiClient.post(BASE, dto).then((r) => r.data.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['workers'] });
      qc.invalidateQueries({ queryKey: ['dashboard-stats'] });
      toast.success('Empleado creado');
    },
    onError: (e: any) =>
      toast.error(e.response?.data?.error?.message ?? 'Error al crear empleado'),
  });
}

export function useUpdateWorker() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      dto,
    }: {
      id: string;
      dto: Partial<CreateWorkerDto> & { active?: boolean };
    }) => apiClient.patch(`${BASE}/${id}`, dto).then((r) => r.data.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['workers'] });
      qc.invalidateQueries({ queryKey: ['dashboard-stats'] });
      toast.success('Empleado actualizado');
    },
    onError: (e: any) =>
      toast.error(e.response?.data?.error?.message ?? 'Error al actualizar'),
  });
}

export function useDeleteWorker() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      apiClient.delete(`${BASE}/${id}`).then((r) => r.data.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['workers'] });
      qc.invalidateQueries({ queryKey: ['dashboard-stats'] });
      toast.success('Empleado eliminado');
    },
    onError: (e: any) =>
      toast.error(e.response?.data?.error?.message ?? 'No se pudo eliminar'),
  });
}
