import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';

import { apiClient } from '@/lib/api-client';

// Fase 7A: flujo simplificado. Estados terminales: RECIBIDA, RECHAZADA, CANCELADA.
export type TransferStatus = 'EN_TRANSITO' | 'RECIBIDA' | 'RECHAZADA' | 'CANCELADA';

export interface TransferItemData {
  id: string;
  itemId: string;
  requestedQty: number;
  sentQty?: number | null;
  receivedQty?: number | null;
  item: { id: string; code: string; name: string; unit: { abbreviation: string } };
}

export interface Transfer {
  id: string;
  code: string;
  status: TransferStatus;
  fromWarehouse: { id: string; code: string; name: string };
  toWarehouse: { id: string; code: string; name: string };
  requestedBy: { id: string; firstName: string; lastName: string };
  approvedBy?: { id: string; firstName: string; lastName: string } | null;
  sentBy?: { id: string; firstName: string; lastName: string } | null;
  receivedBy?: { id: string; firstName: string; lastName: string } | null;
  rejectedBy?: { id: string; firstName: string; lastName: string } | null;
  notes?: string | null;
  rejectionReason?: string | null;
  items: TransferItemData[];
  createdAt: string;
  approvedAt?: string | null;
  sentAt?: string | null;
  receivedAt?: string | null;
  rejectedAt?: string | null;
}

interface TransferQuery {
  page?: number;
  pageSize?: number;
  status?: TransferStatus;
  warehouseId?: string;
  itemId?: string;
  search?: string;
  enabled?: boolean;
}

export interface CreateTransferDto {
  fromWarehouseId: string;
  toWarehouseId: string;
  notes?: string;
  items: { itemId: string; requestedQty: number }[];
}

const BASE = '/transfers';

export function useTransfers({ enabled = true, ...params }: TransferQuery = {}) {
  return useQuery<{
    items: Transfer[];
    total: number;
    page: number;
    pageSize: number;
    totalPages: number;
  }>({
    queryKey: ['transfers', params],
    queryFn: () => apiClient.get(BASE, { params }).then((r) => r.data.data),
    enabled,
  });
}

export function useTransfer(id: string) {
  return useQuery<Transfer>({
    queryKey: ['transfers', id],
    queryFn: () => apiClient.get(`${BASE}/${id}`).then((r) => r.data.data),
    enabled: !!id,
  });
}

/** Transferencias EN_TRANSITO pendientes de confirmar para el usuario actual.
 *  Se invalida vía WebSocket: socket-provider escucha TRANSFER_* y llama
 *  queryClient.invalidateQueries({ queryKey: ['transfers'] }), que matchea
 *  este queryKey por prefijo y dispara el refetch automático. */
export function usePendingTransfersForMe() {
  return useQuery<{ items: Transfer[] }>({
    queryKey: ['transfers', 'pending-for-me'],
    queryFn: () => apiClient.get(`${BASE}/pending-for-me`).then((r) => r.data.data),
  });
}

function invalidateTransfers(qc: ReturnType<typeof useQueryClient>) {
  qc.invalidateQueries({ queryKey: ['transfers'] });
  qc.invalidateQueries({ queryKey: ['stock'] });
  qc.invalidateQueries({ queryKey: ['items'] });
  qc.invalidateQueries({ queryKey: ['movements'] });
  qc.invalidateQueries({ queryKey: ['alerts'] });
  qc.invalidateQueries({ queryKey: ['dashboard-stats'] });
}

export function useCreateTransfer() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (dto: CreateTransferDto) =>
      apiClient.post(BASE, dto).then((r) => r.data.data),
    onSuccess: (data: Transfer) => {
      invalidateTransfers(qc);
      toast.success(`Transferencia ${data.code} creada · en tránsito`);
    },
    onError: (e: any) =>
      toast.error(e.response?.data?.error?.message ?? 'Error al crear transferencia'),
  });
}

export function useReceiveTransfer() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      items,
      notes,
    }: {
      id: string;
      items: { transferItemId: string; receivedQty: number }[];
      notes?: string;
    }) =>
      apiClient.patch(`${BASE}/${id}/receive`, { items, notes }).then((r) => r.data.data),
    onSuccess: () => {
      invalidateTransfers(qc);
      toast.success('Recepción confirmada · stock destino actualizado');
    },
    onError: (e: any) =>
      toast.error(e.response?.data?.error?.message ?? 'Error al confirmar recepción'),
  });
}

export function useRejectTransfer() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string }) =>
      apiClient.patch(`${BASE}/${id}/reject`, { reason }).then((r) => r.data.data),
    onSuccess: () => {
      invalidateTransfers(qc);
      toast.success('Transferencia rechazada · stock devuelto al origen');
    },
    onError: (e: any) =>
      toast.error(e.response?.data?.error?.message ?? 'Error al rechazar'),
  });
}

export function useCancelTransfer() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      apiClient.patch(`${BASE}/${id}/cancel`).then((r) => r.data.data),
    onSuccess: () => {
      invalidateTransfers(qc);
      toast.success('Transferencia cancelada · stock devuelto al origen');
    },
    onError: (e: any) =>
      toast.error(e.response?.data?.error?.message ?? 'Error al cancelar'),
  });
}
