import axios, {
  AxiosError,
  type AxiosInstance,
  type InternalAxiosRequestConfig,
} from 'axios';

// In the browser all requests go to /api/* (same origin → Next.js proxy → NestJS).
// This keeps the refresh_token cookie on the same origin as the frontend so the
// Next.js middleware can always read it reliably.
const API_BASE =
  typeof window !== 'undefined'
    ? '/api'
    : `${process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000'}/api`;

export const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';

export const apiClient: AxiosInstance = axios.create({
  baseURL: API_BASE,
  timeout: 30_000,
  withCredentials: true,
  headers: { 'Content-Type': 'application/json' },
});

// Attach Bearer token from Zustand store on every request.
apiClient.interceptors.request.use((config: InternalAxiosRequestConfig) => {
  if (typeof window !== 'undefined') {
    const { useAuthStore } =
      require('@/stores/use-auth-store') as typeof import('@/stores/use-auth-store');
    const token = useAuthStore.getState().accessToken;
    if (token) config.headers['Authorization'] = `Bearer ${token}`;
  }
  return config;
});

// Mid-session 401 handler: silently refresh the access token and retry once.
// Page-refresh session restoration is handled by SessionInitializer (not here).
let isRefreshing = false;
let refreshQueue: Array<(token: string) => void> = [];

apiClient.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const originalRequest = error.config as InternalAxiosRequestConfig & {
      _retry?: boolean;
    };

    if (error.response?.status !== 401 || originalRequest._retry) {
      return Promise.reject(error);
    }

    // Never retry auth endpoints — avoids infinite refresh loops
    if (originalRequest.url?.includes('/auth/')) {
      return Promise.reject(error);
    }

    originalRequest._retry = true;

    if (isRefreshing) {
      return new Promise((resolve, reject) => {
        refreshQueue.push((token) => {
          originalRequest.headers['Authorization'] = `Bearer ${token}`;
          resolve(apiClient(originalRequest));
        });
        setTimeout(() => reject(error), 10_000);
      });
    }

    isRefreshing = true;

    try {
      const { data } = await apiClient.post<{ data: { accessToken: string } }>(
        '/auth/refresh',
      );
      const newToken = data.data.accessToken;

      if (typeof window !== 'undefined') {
        const { useAuthStore } =
          require('@/stores/use-auth-store') as typeof import('@/stores/use-auth-store');
        useAuthStore.getState().setAccessToken(newToken);
      }

      refreshQueue.forEach((cb) => cb(newToken));
      refreshQueue = [];
      originalRequest.headers['Authorization'] = `Bearer ${newToken}`;
      return apiClient(originalRequest);
    } catch {
      // Refresh token also expired mid-session — clear and redirect
      refreshQueue = [];
      if (typeof window !== 'undefined') {
        const { useAuthStore } =
          require('@/stores/use-auth-store') as typeof import('@/stores/use-auth-store');
        useAuthStore.getState().clearSession();
        try {
          await fetch('/api/auth/logout', { method: 'POST' });
        } catch {
          /* ignore */
        }
        window.location.replace('/login');
      }
      return Promise.reject(error);
    } finally {
      isRefreshing = false;
    }
  },
);

export function getErrorCode(error: unknown): string | null {
  if (error instanceof AxiosError && error.response?.data) {
    const data = error.response.data as { error?: { code?: string } };
    return data.error?.code ?? null;
  }
  return null;
}

export function getErrorMessage(error: unknown): string {
  if (error instanceof AxiosError && error.response?.data) {
    const data = error.response.data as { error?: { message?: string } };
    if (data.error?.message) return data.error.message;
  }
  if (error instanceof Error) return error.message;
  return 'Error desconocido';
}
