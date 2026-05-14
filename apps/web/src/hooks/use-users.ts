import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';

import { apiClient } from '@/lib/api-client';

export interface Role {
  id: string;
  name: string;
  description?: string;
}

export type ContractDuration = 3 | 6 | 12;

export interface User {
  id: string;
  documentType: string;
  documentNumber: string;
  firstName: string;
  paternalLastName?: string | null;
  maternalLastName?: string | null;
  /** Apellido completo derivado (paterno + materno). Backend lo computa. */
  lastName: string;
  email?: string | null;
  phone?: string | null;
  active: boolean;
  mustChangePassword: boolean;
  lastLoginAt?: string | null;
  contractEndDate?: string | null;
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
  paternalLastName: string;
  maternalLastName?: string;
  email?: string;
  phone?: string;
  roleId: string;
  contractDurationMonths?: ContractDuration;
}

interface UpdateUserDto {
  firstName?: string;
  paternalLastName?: string;
  maternalLastName?: string;
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
      apiClient.patch(`${BASE}/${id}`, dto).then((r) => r.data.data as User),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['users'] });
      // Toast lo muestra el componente para permitir errores backend inline.
    },
  });
}

/**
 * Resetea la contraseña del usuario al número de documento + fuerza cambio
 * en el siguiente login. Usado cuando el usuario olvida la contraseña y no
 * tiene email para auto-recuperar.
 */
/**
 * Renueva el contrato del usuario: setea `contractEndDate = hoy + N meses`.
 * No extiende desde la fecha anterior — redefine desde hoy. Evita back-dating.
 */
export function useRenewContract() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, months }: { id: string; months: ContractDuration }) =>
      apiClient
        .patch(`${BASE}/${id}/renew-contract`, { months })
        .then((r) => r.data.data as User),
    onSuccess: (user) => {
      qc.invalidateQueries({ queryKey: ['users'] });
      const newDate = user.contractEndDate
        ? new Date(user.contractEndDate).toLocaleDateString('es-PE')
        : '—';
      toast.success(`Contrato renovado · Nueva fecha de fin: ${newDate}`);
    },
    onError: () => toast.error('Error al renovar contrato'),
  });
}

export function useResetUserPassword() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      apiClient.patch(`${BASE}/${id}/reset-password`).then((r) => r.data.data as User),
    onSuccess: (user) => {
      qc.invalidateQueries({ queryKey: ['users'] });
      toast.success(
        `Contraseña restablecida. Nueva contraseña: ${user.documentNumber}. Comunícale al usuario que se le pedirá cambiarla al ingresar.`,
        { duration: 10000 },
      );
    },
    onError: () => toast.error('Error al restablecer contraseña'),
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
