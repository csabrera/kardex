import type { BusinessErrorCode } from './business-error-code';

export interface ApiError {
  error: {
    code: BusinessErrorCode | string;
    message: string;
    details?: Record<string, unknown>;
    timestamp?: string;
    path?: string;
    requestId?: string;
  };
}

export interface ApiSuccessResponse<T> {
  data: T;
  meta?: {
    timestamp: string;
    requestId?: string;
    pagination?: PaginationMeta;
  };
}

export interface PaginationMeta {
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
  hasNext: boolean;
  hasPrev: boolean;
}

export type ApiResponse<T> = ApiSuccessResponse<T> | ApiError;

export function isApiError(response: unknown): response is ApiError {
  return (
    typeof response === 'object' &&
    response !== null &&
    'error' in response &&
    typeof (response as ApiError).error === 'object'
  );
}
