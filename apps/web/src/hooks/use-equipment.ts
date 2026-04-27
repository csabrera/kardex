import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';

import { apiClient } from '@/lib/api-client';

export type EquipmentType =
  | 'MAQUINARIA_PESADA'
  | 'VEHICULO'
  | 'EQUIPO_MENOR'
  | 'HERRAMIENTA_ELECTRICA'
  | 'OTRO';
export type CountType = 'HOROMETRO' | 'KILOMETRAJE' | 'NONE';
export type EquipmentStatus = 'OPERATIVO' | 'EN_MANTENIMIENTO' | 'AVERIADO' | 'BAJA';

export const EQUIPMENT_TYPE_LABELS: Record<EquipmentType, string> = {
  MAQUINARIA_PESADA: 'Maquinaria pesada',
  VEHICULO: 'Vehículo',
  EQUIPO_MENOR: 'Equipo menor',
  HERRAMIENTA_ELECTRICA: 'Herramienta eléctrica',
  OTRO: 'Otro',
};

export const COUNT_TYPE_LABELS: Record<CountType, string> = {
  HOROMETRO: 'Horómetro (h)',
  KILOMETRAJE: 'Kilometraje (km)',
  NONE: 'Sin contador',
};

export const EQUIPMENT_STATUS_LABELS: Record<EquipmentStatus, string> = {
  OPERATIVO: 'Operativo',
  EN_MANTENIMIENTO: 'En mantenimiento',
  AVERIADO: 'Averiado',
  BAJA: 'Baja',
};

export interface Equipment {
  id: string;
  code: string;
  name: string;
  type: EquipmentType;
  brand?: string | null;
  model?: string | null;
  serialNumber?: string | null;
  year?: number | null;
  countType: CountType;
  currentCount: number;
  initialCount: number;
  initialCountDate?: string | null;
  acquisitionDate?: string | null;
  acquisitionCost?: number | null;
  status: EquipmentStatus;
  obraId?: string | null;
  obra?: { id: string; code: string; name: string; status: string } | null;
  notes?: string | null;
  active: boolean;
  createdAt: string;
}

export interface EquipmentCountReading {
  id: string;
  equipmentId: string;
  countValue: number;
  source: string;
  sourceId?: string | null;
  notes?: string | null;
  recordedAt: string;
  recordedById?: string | null;
}

interface EquipmentQuery {
  page?: number;
  pageSize?: number;
  type?: EquipmentType;
  status?: EquipmentStatus;
  obraId?: string;
  search?: string;
  enabled?: boolean;
}

export interface CreateEquipmentDto {
  code?: string;
  name: string;
  type?: EquipmentType;
  brand?: string;
  model?: string;
  serialNumber?: string;
  year?: number;
  countType?: CountType;
  initialCount?: number;
  initialCountDate?: string;
  acquisitionDate?: string;
  acquisitionCost?: number;
  obraId?: string;
  notes?: string;
}

const BASE = '/equipment';

export function useEquipmentList({ enabled = true, ...params }: EquipmentQuery = {}) {
  return useQuery<{
    items: Equipment[];
    total: number;
    page: number;
    pageSize: number;
    totalPages: number;
  }>({
    queryKey: ['equipment', params],
    enabled,
    queryFn: () => apiClient.get(BASE, { params }).then((r) => r.data.data),
  });
}

export function useEquipment(id: string) {
  return useQuery<Equipment>({
    queryKey: ['equipment', id],
    enabled: !!id,
    queryFn: () => apiClient.get(`${BASE}/${id}`).then((r) => r.data.data),
  });
}

export function useEquipmentReadings(id: string) {
  return useQuery<EquipmentCountReading[]>({
    queryKey: ['equipment', id, 'readings'],
    enabled: !!id,
    queryFn: () => apiClient.get(`${BASE}/${id}/readings`).then((r) => r.data.data),
  });
}

function invalidateEquipment(qc: ReturnType<typeof useQueryClient>) {
  qc.invalidateQueries({ queryKey: ['equipment'] });
  qc.invalidateQueries({ queryKey: ['dashboard-stats'] });
}

export function useCreateEquipment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (dto: CreateEquipmentDto) =>
      apiClient.post(BASE, dto).then((r) => r.data.data),
    onSuccess: () => {
      invalidateEquipment(qc);
      toast.success('Equipo registrado');
    },
    onError: (e: any) =>
      toast.error(e.response?.data?.error?.message ?? 'Error al registrar equipo'),
  });
}

export function useUpdateEquipment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      ...dto
    }: Partial<CreateEquipmentDto> & { id: string; status?: EquipmentStatus }) =>
      apiClient.patch(`${BASE}/${id}`, dto).then((r) => r.data.data),
    onSuccess: () => {
      invalidateEquipment(qc);
      toast.success('Equipo actualizado');
    },
    onError: (e: any) =>
      toast.error(e.response?.data?.error?.message ?? 'Error al actualizar'),
  });
}

export function useRecordReading() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      countValue,
      notes,
    }: {
      id: string;
      countValue: number;
      notes?: string;
    }) =>
      apiClient
        .post(`${BASE}/${id}/reading`, { countValue, notes })
        .then((r) => r.data.data),
    onSuccess: () => {
      invalidateEquipment(qc);
      toast.success('Lectura registrada');
    },
    onError: (e: any) =>
      toast.error(e.response?.data?.error?.message ?? 'Error al registrar lectura'),
  });
}

export function useDeleteEquipment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      apiClient.delete(`${BASE}/${id}`).then((r) => r.data.data),
    onSuccess: () => {
      invalidateEquipment(qc);
      toast.success('Equipo dado de baja');
    },
    onError: (e: any) =>
      toast.error(e.response?.data?.error?.message ?? 'No se pudo dar de baja'),
  });
}
