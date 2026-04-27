import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';

import { apiClient } from '@/lib/api-client';

export interface WorkStation {
  id: string;
  obraId: string;
  name: string;
  description?: string | null;
  active: boolean;
  obra?: { id: string; code: string; name: string };
}

interface WorkStationQuery {
  obraId?: string;
  search?: string;
  includeInactive?: boolean;
  enabled?: boolean;
}

const BASE = '/work-stations';

export function useWorkStations({ enabled = true, ...params }: WorkStationQuery = {}) {
  return useQuery<WorkStation[]>({
    queryKey: ['work-stations', params],
    queryFn: () => apiClient.get(BASE, { params }).then((r) => r.data.data),
    enabled,
  });
}

export function useCreateWorkStation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (dto: { obraId: string; name: string; description?: string }) =>
      apiClient.post(BASE, dto).then((r) => r.data.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['work-stations'] });
      qc.invalidateQueries({ queryKey: ['obras'] });
      toast.success('Estación de trabajo creada');
    },
    onError: (e: any) =>
      toast.error(e.response?.data?.error?.message ?? 'Error al crear estación'),
  });
}

export function useUpdateWorkStation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      dto,
    }: {
      id: string;
      dto: { name?: string; description?: string; active?: boolean };
    }) => apiClient.patch(`${BASE}/${id}`, dto).then((r) => r.data.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['work-stations'] });
      toast.success('Estación actualizada');
    },
    onError: (e: any) => toast.error(e.response?.data?.error?.message ?? 'Error'),
  });
}

export function useDeleteWorkStation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      apiClient.delete(`${BASE}/${id}`).then((r) => r.data.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['work-stations'] });
      qc.invalidateQueries({ queryKey: ['obras'] });
      toast.success('Estación eliminada');
    },
    onError: (e: any) =>
      toast.error(e.response?.data?.error?.message ?? 'No se pudo eliminar'),
  });
}
