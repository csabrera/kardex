import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';

import { apiClient } from '@/lib/api-client';

export interface Role {
  id: string;
  name: string;
  description?: string;
}

export interface User {
  id: string;
  documentType: string;
  documentNumber: string;
  firstName: string;
  lastName: string;
  email?: string | null;
  phone?: string | null;
  active: boolean;
  mustChangePassword: boolean;
  lastLoginAt?: string | null;
  createdAt: string;
  role: Role;
}

interface UsersQuery {
  page?: number;
  pageSize?: number;
  search?: string;
  active?: boolean;
}

interface CreateUserDto {
  documentType: string;
  documentNumber: string;
  password: string;
  firstName: string;
  lastName: string;
  email?: string;
  phone?: string;
  roleId: string;
}

interface UpdateUserDto {
  firstName?: string;
  lastName?: string;
  email?: string;
  phone?: string;
  roleId?: string;
}

const BASE = '/users';

export function useUsers(params: UsersQuery = {}) {
  return useQuery<{
    items: User[];
    total: number;
    page: number;
    pageSize: number;
    totalPages: number;
  }>({
    queryKey: ['users', params],
    queryFn: () => apiClient.get(BASE, { params }).then((r) => r.data.data),
  });
}

export function useRoles() {
  return useQuery<Role[]>({
    queryKey: ['roles'],
    queryFn: () => apiClient.get(`${BASE}/roles`).then((r) => r.data.data),
  });
}

export function useCreateUser() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (dto: CreateUserDto) =>
      apiClient.post(BASE, dto).then((r) => r.data.data as User),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['users'] });
      // Toast de éxito lo muestra el componente para incluir el documento como
      // contraseña inicial — info accionable que el admin debe comunicar.
    },
    // Error toast lo muestra el componente: distingue duplicados (inline) de
    // errores genéricos (toast).
  });
}

export function useUpdateUser() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, dto }: { id: string; dto: UpdateUserDto }) =>
      apiClient.patch(`${BASE}/${id}`, dto).then((r) => r.data.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['users'] });
      toast.success('Usuario actualizado');
    },
    onError: () => toast.error('Error al actualizar usuario'),
  });
}

export function useSetUserActive() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, active }: { id: string; active: boolean }) =>
      apiClient
        .patch(`${BASE}/${id}/${active ? 'activate' : 'deactivate'}`)
        .then((r) => r.data.data),
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ['users'] });
      toast.success(vars.active ? 'Usuario activado' : 'Usuario desactivado');
    },
    onError: () => toast.error('Error al cambiar estado del usuario'),
  });
}
