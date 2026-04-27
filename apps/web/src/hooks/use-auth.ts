'use client';

import { useMutation } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';

import { apiClient, getErrorMessage } from '@/lib/api-client';
import { useAuthStore } from '@/stores/use-auth-store';

import type { UserPublic } from '@kardex/types';

interface LoginPayload {
  documentType: string;
  documentNumber: string;
  password: string;
}

interface LoginResponse {
  data: {
    accessToken: string;
    user: UserPublic;
  };
}

interface ForgotPasswordPayload {
  documentType: string;
  documentNumber: string;
}

interface ResetPasswordPayload {
  token: string;
  newPassword: string;
  confirmPassword: string;
}

interface ChangePasswordPayload {
  oldPassword: string;
  newPassword: string;
  confirmPassword: string;
}

export function useLogin() {
  const setSession = useAuthStore((s) => s.setSession);
  const router = useRouter();

  return useMutation({
    mutationFn: async (payload: LoginPayload) => {
      const res = await apiClient.post<LoginResponse>('/auth/login', payload);
      return res.data.data;
    },
    onSuccess: (data) => {
      setSession(data.user, data.accessToken);
      if (data.user.mustChangePassword) {
        router.replace('/cambiar-password');
        return;
      }
      // Landing por rol — cada perfil tiene su propio hub operativo:
      //   ADMIN       → /dashboard (KPIs del sistema, supervisión)
      //   ALMACENERO  → /almacen-principal (su hub con tabs operativas)
      //   RESIDENTE   → /mi-obra (su única página)
      const roleName = data.user.role?.name;
      if (roleName === 'RESIDENTE') {
        router.replace('/dashboard/mi-obra');
      } else if (roleName === 'ALMACENERO') {
        router.replace('/dashboard/almacen-principal');
      } else {
        router.replace('/dashboard');
      }
    },
    onError: (error) => {
      toast.error(getErrorMessage(error));
    },
  });
}

export function useLogout() {
  const clearSession = useAuthStore((s) => s.clearSession);
  const router = useRouter();

  return useMutation({
    mutationFn: () => apiClient.post('/auth/logout'),
    onSettled: () => {
      clearSession();
      router.replace('/login');
    },
  });
}

export function useForgotPassword() {
  return useMutation({
    mutationFn: (payload: ForgotPasswordPayload) =>
      apiClient.post<{ data: { token?: string; message: string } }>(
        '/auth/forgot-password',
        payload,
      ),
    onError: (error) => {
      toast.error(getErrorMessage(error));
    },
  });
}

export function useResetPassword() {
  const router = useRouter();

  return useMutation({
    mutationFn: ({ token, ...body }: ResetPasswordPayload) =>
      apiClient.post(`/auth/reset-password/${token}`, body),
    onSuccess: () => {
      toast.success('Contraseña actualizada. Inicia sesión con tu nueva contraseña.');
      router.replace('/login');
    },
    onError: (error) => {
      toast.error(getErrorMessage(error));
    },
  });
}

interface SetupPayload {
  documentType: string;
  documentNumber: string;
  firstName: string;
  lastName: string;
  email?: string;
  password: string;
  confirmPassword: string;
}

export function useSetup() {
  const setSession = useAuthStore((s) => s.setSession);
  const router = useRouter();

  return useMutation({
    mutationFn: async (payload: SetupPayload) => {
      const res = await apiClient.post<LoginResponse>('/auth/setup', payload);
      return res.data.data;
    },
    onSuccess: (data) => {
      setSession(data.user, data.accessToken);
      toast.success('Sistema configurado. Bienvenido.');
      router.replace('/dashboard');
    },
    onError: (error) => {
      toast.error(getErrorMessage(error));
    },
  });
}

export function useChangePassword() {
  const router = useRouter();

  return useMutation({
    mutationFn: (payload: ChangePasswordPayload) =>
      apiClient.post('/auth/change-password', payload),
    onSuccess: () => {
      toast.success('Contraseña actualizada correctamente.');
      router.replace('/dashboard');
    },
    onError: (error) => {
      toast.error(getErrorMessage(error));
    },
  });
}
