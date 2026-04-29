import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';

import { apiClient } from '@/lib/api-client';

export type ItemType = 'MATERIAL' | 'HERRAMIENTA' | 'EPP' | 'EQUIPO' | 'REPUESTO';

export interface Item {
  id: string;
  code: string;
  name: string;
  description?: string | null;
  type: ItemType;
  categoryId: string;
  category: { id: string; code: string; name: string };
  unitId: string;
  unit: { id: string; code: string; name: string; abbreviation: string };
  minStock: number;
  maxStock?: number | null;
  active: boolean;
  createdAt: string;
  /** Stock actual en el Almacén Principal (inyectado por el backend en el listado) */
  principalStock?: number;
}

/** Shape extendida devuelta por GET /items/:id — incluye stock por almacén */
export interface ItemDetail extends Item {
  stocks?: {
    id: string;
    quantity: number;
    version: number;
    warehouseId: string;
    warehouse: { id: string; code: string; name: string; type?: string };
  }[];
}

interface ItemPage {
  items: Item[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

interface ItemQuery {
  page?: number;
  pageSize?: number;
  search?: string;
  type?: ItemType;
  categoryId?: string;
}

export interface CreateItemDto {
  code?: string;
  name: string;
  description?: string;
  type?: ItemType;
  categoryId: string;
  unitId: string;
  minStock?: number;
  maxStock?: number;
  /** Cantidad inicial en el Almacén Principal (opcional). Si > 0, crea ENTRADA automática. */
  initialStock?: number;
  /** Costo unitario opcional asociado a la ENTRADA inicial. */
  initialUnitCost?: number;
  /** Motivo del movimiento inicial (default COMPRA en backend). */
  initialSource?: 'COMPRA' | 'DEVOLUCION' | 'AJUSTE';
  /** Proveedor para la carga inicial (requerido si initialSource=COMPRA). */
  initialSupplierId?: string;
  /** Notas libres para el movimiento inicial. */
  initialNotes?: string;
}

const BASE = '/items';

export function useItems(params: ItemQuery = {}) {
  return useQuery<ItemPage>({
    queryKey: ['items', params],
    queryFn: () => apiClient.get(BASE, { params }).then((r) => r.data.data),
  });
}

export function useItem(id: string) {
  return useQuery<ItemDetail>({
    queryKey: ['items', id],
    queryFn: () => apiClient.get(`${BASE}/${id}`).then((r) => r.data.data),
    enabled: !!id,
  });
}

export function useCreateItem() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (dto: CreateItemDto) =>
      apiClient.post(BASE, dto).then((r) => r.data.data),
    onSuccess: (_data, dto) => {
      qc.invalidateQueries({ queryKey: ['items'] });
      qc.invalidateQueries({ queryKey: ['dashboard-stats'] });
      // Si hubo stock inicial también refrescamos stock/movements/alerts
      if ((dto.initialStock ?? 0) > 0) {
        qc.invalidateQueries({ queryKey: ['stock'] });
        qc.invalidateQueries({ queryKey: ['movements'] });
        qc.invalidateQueries({ queryKey: ['alerts'] });
        toast.success('Ítem creado con stock inicial');
      } else {
        toast.success('Ítem creado');
      }
    },
    onError: (e: any) =>
      toast.error(e.response?.data?.error?.message ?? 'Error al crear'),
  });
}

export function useUpdateItem() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      ...dto
    }: Partial<CreateItemDto> & { id: string; active?: boolean }) =>
      apiClient.patch(`${BASE}/${id}`, dto).then((r) => r.data.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['items'] });
      toast.success('Ítem actualizado');
    },
    onError: (e: any) =>
      toast.error(e.response?.data?.error?.message ?? 'Error al actualizar'),
  });
}

export function useDeleteItem() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiClient.delete(`${BASE}/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['items'] });
      toast.success('Ítem eliminado');
    },
    onError: (e: any) =>
      toast.error(e.response?.data?.error?.message ?? 'No se pudo eliminar'),
  });
}

// ---- Import ----

export interface ImportPreviewRow {
  row: number;
  code: string;
  name: string;
  type: string;
  categoryCode: string;
  unitCode: string;
  minStock?: number;
  maxStock?: number;
  stockInicial?: number;
  description?: string;
  valid: boolean;
  errors: string[];
}

export interface ImportPreviewResult {
  rows: ImportPreviewRow[];
  totalValid: number;
  totalErrors: number;
}

export interface ImportItemRowDto {
  row: number;
  code: string;
  name: string;
  type: ItemType;
  categoryCode: string;
  unitCode: string;
  minStock?: number;
  maxStock?: number;
  stockInicial?: number;
  description?: string;
}

export function useImportPreview() {
  return useMutation({
    mutationFn: (file: File) => {
      const form = new FormData();
      form.append('file', file);
      return apiClient
        .post<{ data: ImportPreviewResult }>(`${BASE}/import/preview`, form, {
          headers: { 'Content-Type': 'multipart/form-data' },
        })
        .then((r) => r.data.data);
    },
    onError: (e: any) =>
      toast.error(e.response?.data?.error?.message ?? 'Error al procesar el archivo'),
  });
}

export function useConfirmImport() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (rows: ImportItemRowDto[]) =>
      apiClient
        .post<{
          data: { imported: number; stockInitialized: number };
        }>(`${BASE}/import/confirm`, { rows })
        .then((r) => r.data.data),
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ['items'] });
      qc.invalidateQueries({ queryKey: ['stock'] });
      qc.invalidateQueries({ queryKey: ['movements'] });
      const stockMsg =
        data.stockInitialized > 0
          ? ` · ${data.stockInitialized} con stock inicial cargado al Principal`
          : '';
      toast.success(`${data.imported} ítems importados${stockMsg}`);
    },
    onError: (e: any) =>
      toast.error(e.response?.data?.error?.message ?? 'Error al importar'),
  });
}
