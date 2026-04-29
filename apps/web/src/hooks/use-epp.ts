import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';

import { apiClient } from '@/lib/api-client';

export type ReplacementReason = 'PERDIDA' | 'DANADO' | 'DESGASTE' | 'OTRO';

export const REPLACEMENT_REASON_LABELS: Record<ReplacementReason, string> = {
  PERDIDA: 'Pérdida',
  DANADO: 'Dañado',
  DESGASTE: 'Desgaste',
  OTRO: 'Otro motivo',
};

export interface EPPAssignment {
  id: string;
  code: string;
  workerId: string;
  worker: {
    id: string;
    firstName: string;
    lastName: string;
    documentType: string;
    documentNumber: string;
    phone: string;
    specialty: { id: string; code: string; name: string };
    obra?: { id: string; code: string; name: string } | null;
  };
  itemId: string;
  item: {
    id: string;
    code: string;
    name: string;
    type: string;
    unit: { abbreviation: string };
  };
  warehouseId: string;
  warehouse: {
    id: string;
    code: string;
    name: string;
    type: string;
    obra?: { id: string; code: string; name: string } | null;
  };
  quantity: number;
  assignedAt: string;
  assignedById: string;
  assignedBy: { id: string; firstName: string; lastName: string };
  replacesId?: string | null;
  replaces?: {
    id: string;
    code: string;
    assignedAt: string;
    replacementReason: ReplacementReason | null;
  } | null;
  replacementReason?: ReplacementReason | null;
  movementId?: string | null;
  movement?: { id: string; code: string } | null;
  notes?: string | null;
  overrideReason?: string | null;
  createdAt: string;
}

interface EPPQuery {
  page?: number;
  pageSize?: number;
  workerId?: string;
  itemId?: string;
  warehouseId?: string;
  obraId?: string;
  dateFrom?: string;
  dateTo?: string;
  search?: string;
  enabled?: boolean;
}

export interface AssignEPPDto {
  workerId: string;
  itemId: string;
  warehouseId: string;
  quantity: number;
  notes?: string;
  overrideReason?: string;
}

export interface ReplaceEPPDto {
  quantity: number;
  reason: ReplacementReason;
  warehouseId: string;
  notes?: string;
  overrideReason?: string;
}

const BASE = '/epp';

export function useEPPAssignments({ enabled = true, ...params }: EPPQuery = {}) {
  return useQuery<{
    items: EPPAssignment[];
    total: number;
    page: number;
    pageSize: number;
    totalPages: number;
  }>({
    queryKey: ['epp', params],
    enabled,
    queryFn: () => apiClient.get(BASE, { params }).then((r) => r.data.data),
  });
}

export function useEPPByWorker(workerId: string) {
  return useQuery<EPPAssignment[]>({
    queryKey: ['epp', 'by-worker', workerId],
    enabled: !!workerId,
    queryFn: () => apiClient.get(`${BASE}/worker/${workerId}`).then((r) => r.data.data),
  });
}

function invalidateAllAffectedByEPP(qc: ReturnType<typeof useQueryClient>) {
  qc.invalidateQueries({ queryKey: ['epp'] });
  qc.invalidateQueries({ queryKey: ['stock'] });
  qc.invalidateQueries({ queryKey: ['items'] });
  qc.invalidateQueries({ queryKey: ['movements'] });
  qc.invalidateQueries({ queryKey: ['alerts'] });
  qc.invalidateQueries({ queryKey: ['dashboard-stats'] });
}

export function useAssignEPP() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (dto: AssignEPPDto) =>
      apiClient.post(`${BASE}/assign`, dto).then((r) => r.data.data),
    onSuccess: (data: EPPAssignment) => {
      invalidateAllAffectedByEPP(qc);
      toast.success(`EPP asignado · ${data.code}`);
    },
    onError: (e: any) =>
      toast.error(e.response?.data?.error?.message ?? 'Error al asignar EPP'),
  });
}

export function useReplaceEPP() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...dto }: ReplaceEPPDto & { id: string }) =>
      apiClient.post(`${BASE}/${id}/replace`, dto).then((r) => r.data.data),
    onSuccess: (data: EPPAssignment) => {
      invalidateAllAffectedByEPP(qc);
      toast.success(`Reposición registrada · ${data.code}`);
    },
    onError: (e: any) =>
      toast.error(e.response?.data?.error?.message ?? 'Error al registrar reposición'),
  });
}
