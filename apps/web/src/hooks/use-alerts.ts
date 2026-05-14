import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';

import { apiClient } from '@/lib/api-client';

export type AlertType =
  | 'STOCK_BAJO'
  | 'STOCK_CRITICO'
  | 'TRANSFER_DISCREPANCIA'
  | 'LOAN_VENCIDO';

export interface Alert {
  id: string;
  type: AlertType;
  message: string;
  // quantity/threshold son obligatorios para alertas de stock y de
  // discrepancia, NULL para LOAN_VENCIDO.
  quantity: number | null;
  threshold: number | null;
  read: boolean;
  createdAt: string;
  item: { id: string; code: string; name: string; unit: { abbreviation: string } };
  warehouse: { id: string; code: string; name: string };
  // Presente solo cuando type === 'LOAN_VENCIDO'.
  toolLoan?: {
    id: string;
    code: string;
    expectedReturnAt: string;
    borrowerWorker: {
      firstName: string;
      paternalLastName: string | null;
      maternalLastName: string | null;
    };
  } | null;
}

const BASE = '/alerts';

interface AlertsQuery {
  read?: boolean;
  warehouseId?: string;
  type?: AlertType;
  enabled?: boolean;
}

export function useAlerts({ enabled = true, ...params }: AlertsQuery = {}) {
  return useQuery<Alert[]>({
    queryKey: ['alerts', params],
    queryFn: () => apiClient.get(BASE, { params }).then((r) => r.data.data),
    enabled,
  });
}

export function useUnreadAlertCount() {
  return useQuery<{ count: number }>({
    queryKey: ['alerts', 'count'],
    queryFn: () => apiClient.get(`${BASE}/unread-count`).then((r) => r.data.data),
    refetchInterval: 60_000,
  });
}

export function useMarkAlertRead() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiClient.patch(`${BASE}/${id}/read`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['alerts'] }),
  });
}

export function useMarkAllAlertsRead() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => apiClient.patch(`${BASE}/read-all`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['alerts'] });
      toast.success('Todas las alertas marcadas como leídas');
    },
  });
}
