import { useQuery } from '@tanstack/react-query';

import { apiClient } from '@/lib/api-client';

export interface AuditLog {
  id: string;
  userId: string | null;
  userDoc: string | null;
  action: string;
  resource: string;
  resourceId: string | null;
  changes: unknown | null;
  ip: string | null;
  userAgent: string | null;
  createdAt: string;
  user: {
    id: string;
    firstName: string;
    lastName: string;
    documentType: string;
    documentNumber: string;
  } | null;
}

interface AuditLogsQuery {
  userId?: string;
  resource?: string;
  action?: string;
  from?: string;
  to?: string;
  page?: number;
  pageSize?: number;
  enabled?: boolean;
}

const BASE = '/audit-logs';

export function useAuditLogs({ enabled = true, ...params }: AuditLogsQuery = {}) {
  return useQuery<{
    items: AuditLog[];
    total: number;
    page: number;
    pageSize: number;
    totalPages: number;
  }>({
    queryKey: ['audit-logs', params],
    queryFn: () => apiClient.get(BASE, { params }).then((r) => r.data.data),
    enabled,
  });
}

export function useAuditLogResources() {
  return useQuery<string[]>({
    queryKey: ['audit-logs', 'resources'],
    queryFn: () => apiClient.get(`${BASE}/resources`).then((r) => r.data.data),
    staleTime: 5 * 60 * 1000,
  });
}
