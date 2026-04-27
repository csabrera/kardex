import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';

import { apiClient } from '@/lib/api-client';

export type ToolLoanStatus = 'ACTIVE' | 'RETURNED' | 'LOST';
export type ToolLoanCondition = 'BUENO' | 'REGULAR' | 'DAMAGED';

export interface ToolLoan {
  id: string;
  code: string;
  status: ToolLoanStatus;
  quantity: number;
  item: {
    id: string;
    code: string;
    name: string;
    type: string;
    unit: { abbreviation: string };
  };
  warehouse: {
    id: string;
    code: string;
    name: string;
    type: string;
    obra?: { id: string; code: string; name: string } | null;
  };
  workStation: { id: string; name: string; obraId: string };
  borrowerWorker: {
    id: string;
    firstName: string;
    lastName: string;
    documentType: string;
    documentNumber: string;
    phone: string;
    specialty: { id: string; code: string; name: string };
  };
  loanedBy: { id: string; firstName: string; lastName: string };
  returnedBy?: { id: string; firstName: string; lastName: string } | null;
  loanedAt: string;
  expectedReturnAt: string;
  returnedAt?: string | null;
  returnCondition?: ToolLoanCondition | null;
  borrowerNotes?: string | null;
  returnNotes?: string | null;
}

interface ToolLoansQuery {
  page?: number;
  pageSize?: number;
  status?: ToolLoanStatus;
  warehouseId?: string;
  borrowerId?: string;
  borrowerWorkerId?: string;
  overdueOnly?: boolean;
  search?: string;
  enabled?: boolean;
}

export interface CreateToolLoanDto {
  itemId: string;
  warehouseId: string;
  workStationId: string;
  borrowerWorkerId: string;
  quantity: number;
  expectedReturnAt: string;
  borrowerNotes?: string;
}

const BASE = '/tool-loans';

export function useToolLoans({ enabled = true, ...params }: ToolLoansQuery = {}) {
  return useQuery<{
    items: ToolLoan[];
    total: number;
    page: number;
    pageSize: number;
    totalPages: number;
  }>({
    queryKey: ['tool-loans', params],
    enabled,
    queryFn: () => apiClient.get(BASE, { params }).then((r) => r.data.data),
  });
}

export function useToolLoansSummary(warehouseId?: string) {
  return useQuery<{ active: number; overdue: number; returned: number; lost: number }>({
    queryKey: ['tool-loans', 'summary', warehouseId],
    queryFn: () =>
      apiClient
        .get(`${BASE}/summary`, { params: warehouseId ? { warehouseId } : {} })
        .then((r) => r.data.data),
  });
}

export function useCreateToolLoan() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (dto: CreateToolLoanDto) =>
      apiClient.post(BASE, dto).then((r) => r.data.data),
    onSuccess: (data: ToolLoan) => {
      qc.invalidateQueries({ queryKey: ['tool-loans'] });
      qc.invalidateQueries({ queryKey: ['dashboard-stats'] });
      toast.success(`Préstamo ${data.code} registrado`);
    },
    onError: (e: any) =>
      toast.error(e.response?.data?.error?.message ?? 'Error al registrar préstamo'),
  });
}

export function useReturnToolLoan() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      condition,
      notes,
    }: {
      id: string;
      condition: ToolLoanCondition;
      notes?: string;
    }) =>
      apiClient
        .patch(`${BASE}/${id}/return`, { condition, notes })
        .then((r) => r.data.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['tool-loans'] });
      qc.invalidateQueries({ queryKey: ['dashboard-stats'] });
      toast.success('Herramienta devuelta');
    },
    onError: (e: any) =>
      toast.error(e.response?.data?.error?.message ?? 'Error al procesar devolución'),
  });
}

export function useMarkToolLoanLost() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      apiClient.patch(`${BASE}/${id}/mark-lost`).then((r) => r.data.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['tool-loans'] });
      qc.invalidateQueries({ queryKey: ['dashboard-stats'] });
      toast.success('Préstamo marcado como pérdida');
    },
    onError: (e: any) => toast.error(e.response?.data?.error?.message ?? 'Error'),
  });
}
