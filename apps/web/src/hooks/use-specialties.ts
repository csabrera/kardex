import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';

import { apiClient } from '@/lib/api-client';

export interface Specialty {
  id: string;
  code: string;
  name: string;
  description?: string | null;
  active: boolean;
}

export interface CreateSpecialtyDto {
  code?: string;
  name: string;
  description?: string;
}

const BASE = '/specialties';

export function useSpecialties(
  params: { search?: string; includeInactive?: boolean } = {},
) {
  return useQuery<Specialty[]>({
    queryKey: ['specialties', params],
    queryFn: () => apiClient.get(BASE, { params }).then((r) => r.data.data),
  });
}

export function useCreateSpecialty() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (dto: CreateSpecialtyDto) =>
      apiClient.post(BASE, dto).then((r) => r.data.data as Specialty),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['specialties'] });
      toast.success('Especialidad creada');
    },
    onError: (e: any) =>
      toast.error(e.response?.data?.error?.message ?? 'Error al crear especialidad'),
  });
}

export function useUpdateSpecialty() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      dto,
    }: {
      id: string;
      dto: Partial<CreateSpecialtyDto> & { active?: boolean };
    }) => apiClient.patch(`${BASE}/${id}`, dto).then((r) => r.data.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['specialties'] });
      toast.success('Especialidad actualizada');
    },
    onError: (e: any) =>
      toast.error(e.response?.data?.error?.message ?? 'Error al actualizar'),
  });
}

export function useDeleteSpecialty() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      apiClient.delete(`${BASE}/${id}`).then((r) => r.data.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['specialties'] });
      toast.success('Especialidad eliminada');
    },
    onError: (e: any) =>
      toast.error(e.response?.data?.error?.message ?? 'No se pudo eliminar'),
  });
}
