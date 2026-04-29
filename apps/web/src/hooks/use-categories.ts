import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';

import { apiClient } from '@/lib/api-client';

export interface Category {
  id: string;
  code: string;
  name: string;
  description?: string | null;
  _count?: { items: number };
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
}

interface CreateCategoryDto {
  code?: string;
  name: string;
  description?: string;
}

type UpdateCategoryDto = Partial<CreateCategoryDto>;

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
      apiClient.post(BASE, dto).then((r) => r.data.data as Category),
    onSuccess: (created) => {
      // Update optimista del cache para que la nueva categoría aparezca inmediatamente
      // en cualquier listado activo (sin esperar el refetch). El predicate matchea todos
      // los queries cuyo prefijo es ['categories'] independiente de los params (search,
      // type, page, etc.) — incluimos la nueva categoría si su tipo es compatible
      // con el filtro del query (NULL = global aplica a cualquier filtro).
      qc.setQueriesData<CategoryPage>(
        { queryKey: ['categories'], exact: false },
        (old) => {
          if (!old || !old.items) return old;
          // Evitar duplicar si por algún race ya está
          if (old.items.some((c) => c.id === created.id)) return old;
          return {
            ...old,
            items: [created, ...old.items],
            total: old.total + 1,
          };
        },
      );
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
    mutationFn: ({ id, ...dto }: UpdateCategoryDto & { id: string }) =>
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
