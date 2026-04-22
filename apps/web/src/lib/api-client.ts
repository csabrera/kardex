import axios, { AxiosError, type AxiosInstance } from 'axios';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';

/**
 * Shared Axios instance for API calls.
 *
 * - Automatically sends cookies (httpOnly refresh token)
 * - Adds Bearer token from Zustand auth store (will be wired up in Fase 2)
 * - Handles 401 → refresh flow (wired up in Fase 2)
 */
export const apiClient: AxiosInstance = axios.create({
  baseURL: `${API_URL}/api`,
  timeout: 30_000,
  withCredentials: true,
  headers: {
    'Content-Type': 'application/json',
  },
});

/**
 * Helper to extract the error code from an API error response.
 *
 * The API always returns errors in this shape:
 *   { error: { code, message, details?, timestamp, path } }
 */
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
