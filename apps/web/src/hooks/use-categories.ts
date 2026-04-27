import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';

import { apiClient } from '@/lib/api-client';

export interface Category {
  id: string;
  code: string;
  name: string;
  description?: string | null;
  parentId?: string | null;
  parent?: { id: string; code: string; name: string } | null;
  _count?: { children: number; items: number };
  createdAt: string;
}

interface CategoryPage {
  items: Category[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

interface CategoryQuery {
  page?: number;
  pageSize?: number;
  search?: string;
  parentId?: string;
}

interface CreateCategoryDto {
  code?: string;
  name: string;
  description?: string;
  parentId?: string;
}

const BASE = '/categories';

export function useCategories(params: CategoryQuery = {}) {
  return useQuery<CategoryPage>({
    queryKey: ['categories', params],
    queryFn: () => apiClient.get(BASE, { params }).then((r) => r.data.data),
  });
}

export function useCategory(id: string) {
  return useQuery<Category>({
    queryKey: ['categories', id],
    queryFn: () => apiClient.get(`${BASE}/${id}`).then((r) => r.data.data),
    enabled: !!id,
  });
}

export function useCreateCategory() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (dto: CreateCategoryDto) =>
      apiClient.post(BASE, dto).then((r) => r.data.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['categories'] });
      toast.success('Categoría creada');
    },
    onError: (e: any) =>
      toast.error(e.response?.data?.error?.message ?? 'Error al crear'),
  });
}

export function useUpdateCategory() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...dto }: Partial<CreateCategoryDto> & { id: string }) =>
      apiClient.patch(`${BASE}/${id}`, dto).then((r) => r.data.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['categories'] });
      toast.success('Categoría actualizada');
    },
    onError: (e: any) =>
      toast.error(e.response?.data?.error?.message ?? 'Error al actualizar'),
  });
}

export function useDeleteCategory() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiClient.delete(`${BASE}/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['categories'] });
      toast.success('Categoría eliminada');
    },
    onError: (e: any) =>
      toast.error(e.response?.data?.error?.message ?? 'No se pudo eliminar'),
  });
}
