import axios, { type AxiosInstance, type AxiosResponse } from 'axios';

const API_URL = process.env.API_URL ?? 'http://localhost:4000';

/**
 * Preconfigured axios client for making API calls from tests.
 *
 * - Does NOT throw on 4xx/5xx — lets tests assert on status codes explicitly.
 * - withCredentials is true so httpOnly cookies (refresh token) are sent.
 */
export const apiClient: AxiosInstance = axios.create({
  baseURL: `${API_URL}/api`,
  timeout: 15_000,
  withCredentials: true,
  validateStatus: () => true,
  headers: { 'Content-Type': 'application/json' },
});

export interface ApiCallOptions {
  token?: string;
  headers?: Record<string, string>;
}

export async function apiGet<T = unknown>(
  path: string,
  options: ApiCallOptions = {},
): Promise<AxiosResponse<T>> {
  return apiClient.get<T>(path, {
    headers: buildHeaders(options),
  });
}

export async function apiPost<T = unknown>(
  path: string,
  data?: unknown,
  options: ApiCallOptions = {},
): Promise<AxiosResponse<T>> {
  return apiClient.post<T>(path, data, {
    headers: buildHeaders(options),
  });
}

export async function apiPatch<T = unknown>(
  path: string,
  data?: unknown,
  options: ApiCallOptions = {},
): Promise<AxiosResponse<T>> {
  return apiClient.patch<T>(path, data, {
    headers: buildHeaders(options),
  });
}

export async function apiDelete<T = unknown>(
  path: string,
  options: ApiCallOptions = {},
): Promise<AxiosResponse<T>> {
  return apiClient.delete<T>(path, {
    headers: buildHeaders(options),
  });
}

function buildHeaders(options: ApiCallOptions): Record<string, string> {
  const headers: Record<string, string> = { ...(options.headers ?? {}) };
  if (options.token) {
    headers['Authorization'] = `Bearer ${options.token}`;
  }
  return headers;
}

/**
 * Unwraps the `{ data, meta }` envelope from a successful API response.
 *
 * Throws if the response contains an error.
 */
export function unwrap<T>(response: AxiosResponse<unknown>): T {
  const body = response.data as { data?: T; error?: { code: string; message: string } };
  if (body.error) {
    throw new Error(`API error: ${body.error.code} — ${body.error.message}`);
  }
  if (body.data === undefined) {
    throw new Error('API response had no data field');
  }
  return body.data;
}
