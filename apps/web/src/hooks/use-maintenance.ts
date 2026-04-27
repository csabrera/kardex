import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';

import { apiClient } from '@/lib/api-client';

export type MaintenanceType = 'PREVENTIVO' | 'CORRECTIVO';
export type MaintenanceStatus = 'PROGRAMADO' | 'EN_CURSO' | 'COMPLETADO' | 'CANCELADO';

export const MAINTENANCE_TYPE_LABELS: Record<MaintenanceType, string> = {
  PREVENTIVO: 'Preventivo',
  CORRECTIVO: 'Correctivo',
};

export const MAINTENANCE_STATUS_LABELS: Record<MaintenanceStatus, string> = {
  PROGRAMADO: 'Programado',
  EN_CURSO: 'En curso',
  COMPLETADO: 'Completado',
  CANCELADO: 'Cancelado',
};

export interface MaintenanceItem {
  id: string;
  itemId: string;
  item: {
    id: string;
    code: string;
    name: string;
    type: string;
    unit: { abbreviation: string };
  };
  warehouseId: string;
  warehouse: { id: string; code: string; name: string };
  quantity: number;
  movementId?: string | null;
  movement?: { id: string; code: string } | null;
  notes?: string | null;
  createdAt: string;
}

export interface Maintenance {
  id: string;
  code: string;
  equipmentId: string;
  equipment: {
    id: string;
    code: string;
    name: string;
    type: string;
    status: string;
    currentCount: number;
    countType: string;
  };
  type: MaintenanceType;
  description: string;
  status: MaintenanceStatus;
  scheduledDate?: string | null;
  scheduledCount?: number | null;
  startedAt?: string | null;
  countAtStart?: number | null;
  completedAt?: string | null;
  countAtEnd?: number | null;
  cancelledAt?: string | null;
  cancelReason?: string | null;
  totalCost?: number | null;
  technicianId?: string | null;
  technician?: { id: string; firstName: string; lastName: string } | null;
  notes?: string | null;
  items: MaintenanceItem[];
  createdAt: string;
  updatedAt: string;
}

export interface CreateMaintenanceDto {
  equipmentId: string;
  type: MaintenanceType;
  description: string;
  scheduledDate?: string;
  scheduledCount?: number;
  technicianId?: string;
  notes?: string;
}

interface MaintenanceQuery {
  page?: number;
  pageSize?: number;
  equipmentId?: string;
  status?: MaintenanceStatus;
  type?: MaintenanceType;
  search?: string;
  enabled?: boolean;
}

const BASE = '/maintenance';

export function useMaintenances({ enabled = true, ...params }: MaintenanceQuery = {}) {
  return useQuery<{
    items: Maintenance[];
    total: number;
    page: number;
    pageSize: number;
    totalPages: number;
  }>({
    queryKey: ['maintenance', params],
    enabled,
    queryFn: () => apiClient.get(BASE, { params }).then((r) => r.data.data),
  });
}

export function useMaintenance(id: string) {
  return useQuery<Maintenance>({
    queryKey: ['maintenance', id],
    enabled: !!id,
    queryFn: () => apiClient.get(`${BASE}/${id}`).then((r) => r.data.data),
  });
}

function invalidateMaintenance(qc: ReturnType<typeof useQueryClient>) {
  qc.invalidateQueries({ queryKey: ['maintenance'] });
  qc.invalidateQueries({ queryKey: ['equipment'] });
  qc.invalidateQueries({ queryKey: ['dashboard-stats'] });
}

export function useCreateMaintenance() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (dto: CreateMaintenanceDto) =>
      apiClient.post(BASE, dto).then((r) => r.data.data),
    onSuccess: (data: Maintenance) => {
      invalidateMaintenance(qc);
      toast.success(`Mantenimiento ${data.code} programado`);
    },
    onError: (e: any) =>
      toast.error(e.response?.data?.error?.message ?? 'Error al programar'),
  });
}

export function useStartMaintenance() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, countAtStart }: { id: string; countAtStart: number }) =>
      apiClient.patch(`${BASE}/${id}/start`, { countAtStart }).then((r) => r.data.data),
    onSuccess: () => {
      invalidateMaintenance(qc);
      toast.success('Mantenimiento iniciado');
    },
    onError: (e: any) =>
      toast.error(e.response?.data?.error?.message ?? 'Error al iniciar'),
  });
}

export function useAddMaintenanceItem() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      itemId,
      warehouseId,
      quantity,
      notes,
    }: {
      id: string;
      itemId: string;
      warehouseId: string;
      quantity: number;
      notes?: string;
    }) =>
      apiClient
        .post(`${BASE}/${id}/items`, { itemId, warehouseId, quantity, notes })
        .then((r) => r.data.data),
    onSuccess: () => {
      invalidateMaintenance(qc);
      qc.invalidateQueries({ queryKey: ['stock'] });
      qc.invalidateQueries({ queryKey: ['items'] });
      qc.invalidateQueries({ queryKey: ['movements'] });
      qc.invalidateQueries({ queryKey: ['alerts'] });
      toast.success('Repuesto añadido');
    },
    onError: (e: any) =>
      toast.error(e.response?.data?.error?.message ?? 'Error al añadir repuesto'),
  });
}

export function useCompleteMaintenance() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      countAtEnd,
      totalCost,
      notes,
    }: {
      id: string;
      countAtEnd: number;
      totalCost?: number;
      notes?: string;
    }) =>
      apiClient
        .patch(`${BASE}/${id}/complete`, { countAtEnd, totalCost, notes })
        .then((r) => r.data.data),
    onSuccess: () => {
      invalidateMaintenance(qc);
      toast.success('Mantenimiento completado');
    },
    onError: (e: any) =>
      toast.error(e.response?.data?.error?.message ?? 'Error al completar'),
  });
}

export function useCancelMaintenance() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string }) =>
      apiClient.patch(`${BASE}/${id}/cancel`, { reason }).then((r) => r.data.data),
    onSuccess: () => {
      invalidateMaintenance(qc);
      toast.success('Mantenimiento cancelado');
    },
    onError: (e: any) =>
      toast.error(e.response?.data?.error?.message ?? 'Error al cancelar'),
  });
}
