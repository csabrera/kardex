import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';

import { apiClient } from '@/lib/api-client';

// Fase 7A: flujo simplificado. Estados terminales: RECIBIDA, RECHAZADA, CANCELADA.
// PARCIALMENTE_RECIBIDA: el residente recibió < sentQty en alguna línea — espera
// completar (caso A) o cerrar como faltante definitivo por el admin (caso B).
export type TransferStatus =
  | 'EN_TRANSITO'
  | 'PARCIALMENTE_RECIBIDA'
  | 'RECIBIDA'
  | 'RECHAZADA'
  | 'CANCELADA';

export type TransferItemStatus =
  | 'PENDIENTE'
  | 'RECIBIDO_COMPLETO'
  | 'RECIBIDO_PARCIAL'
  | 'FALTANTE_DEFINITIVO';

export type TransferShortageReason =
  | 'INCUMPLIMIENTO_PROVEEDOR'
  | 'DANIO_EN_TRANSPORTE'
  | 'ROBO_O_PERDIDA'
  | 'ERROR_DE_CONTEO'
  | 'OTRO';

export const SHORTAGE_REASON_LABEL: Record<TransferShortageReason, string> = {
  INCUMPLIMIENTO_PROVEEDOR: 'Incumplimiento del proveedor',
  DANIO_EN_TRANSPORTE: 'Daño en transporte',
  ROBO_O_PERDIDA: 'Robo o pérdida',
  ERROR_DE_CONTEO: 'Error de conteo',
  OTRO: 'Otro',
};

export interface TransferItemData {
  id: string;
  itemId: string;
  requestedQty: number;
  sentQty?: number | null;
  receivedQty?: number | null;
  status: TransferItemStatus;
  shortageReason?: TransferShortageReason | null;
  shortageNotes?: string | null;
  closedAt?: string | null;
  closedBy?: { id: string; firstName: string; lastName: string } | null;
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
  receiveOverrideReason?: string | null;
  rejectOverrideReason?: string | null;
  cancelOverrideReason?: string | null;
  requiresRecipientDocument: boolean;
  attachments?: AttachmentData[];
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

export interface AttachmentInput {
  filename: string;
  originalName: string;
  mimetype: string;
  size: number;
}

export interface AttachmentData extends AttachmentInput {
  id: string;
  uploadedById: string;
  createdAt: string;
}

export interface CreateTransferDto {
  fromWarehouseId: string;
  toWarehouseId: string;
  notes?: string;
  items: { itemId: string; requestedQty: number }[];
  requiresRecipientDocument?: boolean;
  attachments?: AttachmentInput[];
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
      overrideReason,
      attachments,
    }: {
      id: string;
      items: { transferItemId: string; receivedQty: number }[];
      notes?: string;
      overrideReason?: string;
      attachments?: AttachmentInput[];
    }) =>
      apiClient
        .patch(`${BASE}/${id}/receive`, {
          items,
          notes,
          overrideReason,
          attachments,
        })
        .then((r) => r.data.data),
    onSuccess: () => {
      invalidateTransfers(qc);
    },
    onError: (e: any) =>
      toast.error(e.response?.data?.error?.message ?? 'Error al confirmar recepción'),
  });
}

export function useRejectTransfer() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      reason,
      overrideReason,
    }: {
      id: string;
      reason: string;
      overrideReason?: string;
    }) =>
      apiClient
        .patch(`${BASE}/${id}/reject`, { reason, overrideReason })
        .then((r) => r.data.data),
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
    mutationFn: ({ id, overrideReason }: { id: string; overrideReason?: string }) =>
      apiClient
        .patch(`${BASE}/${id}/cancel`, { overrideReason })
        .then((r) => r.data.data),
    onSuccess: () => {
      invalidateTransfers(qc);
      toast.success('Transferencia cancelada · stock devuelto al origen');
    },
    onError: (e: any) =>
      toast.error(e.response?.data?.error?.message ?? 'Error al cancelar'),
  });
}

/** Recibir la segunda remesa (o siguientes) sobre una TRF PARCIALMENTE_RECIBIDA. */
export function useReceiveAdditional() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      items,
      notes,
      overrideReason,
      attachments,
    }: {
      id: string;
      items: { transferItemId: string; additionalQty: number }[];
      notes?: string;
      overrideReason?: string;
      attachments?: AttachmentInput[];
    }) =>
      apiClient
        .patch(`${BASE}/${id}/receive-additional`, {
          items,
          notes,
          overrideReason,
          attachments,
        })
        .then((r) => r.data.data),
    onSuccess: () => {
      invalidateTransfers(qc);
    },
    onError: (e: any) =>
      toast.error(
        e.response?.data?.error?.message ?? 'Error al recibir cantidad adicional',
      ),
  });
}

/** Cerrar una o varias líneas pendientes como faltante definitivo (solo admin). */
export function useCloseAsShortage() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      transferItemIds,
      reason,
      notes,
    }: {
      id: string;
      transferItemIds: string[];
      reason: TransferShortageReason;
      notes?: string;
    }) =>
      apiClient
        .patch(`${BASE}/${id}/close-shortage`, { transferItemIds, reason, notes })
        .then((r) => r.data.data),
    onSuccess: () => {
      invalidateTransfers(qc);
      toast.success('Líneas cerradas como faltante definitivo · baja registrada');
    },
    onError: (e: any) =>
      toast.error(e.response?.data?.error?.message ?? 'Error al cerrar líneas'),
  });
}
