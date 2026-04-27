import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';

import { apiClient } from '@/lib/api-client';

export interface Supplier {
  id: string;
  code: string;
  name: string;
  taxId?: string | null;
  contactName?: string | null;
  phone?: string | null;
  email?: string | null;
  address?: string | null;
  notes?: string | null;
  active: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CreateSupplierDto {
  code?: string;
  name: string;
  taxId?: string;
  contactName?: string;
  phone?: string;
  email?: string;
  address?: string;
  notes?: string;
}

interface SuppliersQuery {
  page?: number;
  pageSize?: number;
  search?: string;
  includeInactive?: boolean;
  enabled?: boolean;
}

const BASE = '/suppliers';

export function useSuppliers({ enabled = true, ...params }: SuppliersQuery = {}) {
  return useQuery<{
    items: Supplier[];
    total: number;
    page: number;
    pageSize: number;
    totalPages: number;
  }>({
    queryKey: ['suppliers', params],
    enabled,
    queryFn: () => apiClient.get(BASE, { params }).then((r) => r.data.data),
  });
}

export function useSupplier(id: string | null) {
  return useQuery<Supplier>({
    queryKey: ['suppliers', id],
    queryFn: () => apiClient.get(`${BASE}/${id}`).then((r) => r.data.data),
    enabled: !!id,
  });
}

export function useCreateSupplier() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (dto: CreateSupplierDto) =>
      apiClient.post(BASE, dto).then((r) => r.data.data as Supplier),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['suppliers'] });
      toast.success('Proveedor creado');
    },
    onError: (e: any) =>
      toast.error(e.response?.data?.error?.message ?? 'Error al crear proveedor'),
  });
}

export function useUpdateSupplier() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      dto,
    }: {
      id: string;
      dto: Partial<CreateSupplierDto> & { active?: boolean };
    }) => apiClient.patch(`${BASE}/${id}`, dto).then((r) => r.data.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['suppliers'] });
      toast.success('Proveedor actualizado');
    },
    onError: (e: any) =>
      toast.error(e.response?.data?.error?.message ?? 'Error al actualizar'),
  });
}

export function useDeleteSupplier() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      apiClient.delete(`${BASE}/${id}`).then((r) => r.data.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['suppliers'] });
      toast.success('Proveedor eliminado');
    },
    onError: (e: any) =>
      toast.error(e.response?.data?.error?.message ?? 'No se pudo eliminar'),
  });
}
