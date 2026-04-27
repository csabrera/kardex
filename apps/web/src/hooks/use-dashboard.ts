import { useQuery } from '@tanstack/react-query';

import { apiClient } from '@/lib/api-client';

export interface DashboardStats {
  kpis: {
    obrasActivas: { value: number; recent: number };
    empleadosActivos: { value: number; recent: number };
    itemsCatalogo: { value: number; recent: number };
    prestamosActivos: { value: number; overdue: number };
    alertasPendientes: { value: number; critical: number };
    movimientos7d: { value: number; delta: number; deltaPct: number | null };
  };
  movementsByDay: {
    date: string;
    entradas: number;
    salidas: number;
    ajustes: number;
  }[];
  topItems: {
    itemId: string;
    code: string;
    name: string;
    unit: string;
    totalQuantity: number;
    movementsCount: number;
  }[];
  stockByStatus: {
    optimo: number;
    bajo: number;
    sinStock: number;
  };
  topObras: {
    obraId: string;
    code: string;
    name: string;
    totalQuantity: number;
    movementsCount: number;
  }[];
}

export function useDashboardStats({ enabled = true }: { enabled?: boolean } = {}) {
  return useQuery<DashboardStats>({
    queryKey: ['dashboard-stats'],
    queryFn: () => apiClient.get('/dashboard/stats').then((r) => r.data.data),
    staleTime: 30_000, // cache 30s para evitar refetch en cada tab-switch
    enabled,
  });
}
