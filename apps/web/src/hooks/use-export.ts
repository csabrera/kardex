import { useMutation, useQuery } from '@tanstack/react-query';
import { toast } from 'sonner';

import { apiClient } from '@/lib/api-client';

export type ReportType = 'kardex' | 'stock' | 'movements';

interface ExportFilters {
  itemId?: string;
  warehouseId?: string;
  type?: string;
}

interface PdfJobStatus {
  jobId: string;
  status: 'WAITING' | 'ACTIVE' | 'COMPLETED' | 'FAILED' | 'DELAYED' | string;
  progress: number;
  failedReason?: string;
  downloadUrl?: string;
}

const BASE = '/export';

export function useExportExcel() {
  return useMutation({
    mutationFn: async ({
      reportType,
      filters,
    }: {
      reportType: ReportType;
      filters?: ExportFilters;
    }) => {
      const params = new URLSearchParams({
        reportType,
        ...Object.fromEntries(
          Object.entries(filters ?? {}).filter(([, v]) => v != null) as [
            string,
            string,
          ][],
        ),
      });
      const response = await apiClient.post(`${BASE}/excel?${params}`, null, {
        responseType: 'blob',
      });

      const url = window.URL.createObjectURL(new Blob([response.data]));
      const a = document.createElement('a');
      const filename =
        response.headers['content-disposition']?.match(/filename="(.+)"/)?.[1] ??
        `${reportType}.xlsx`;
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
    },
    onError: () => toast.error('Error al generar Excel'),
  });
}

export function useQueuePdf() {
  return useMutation({
    mutationFn: async ({
      reportType,
      filters,
    }: {
      reportType: ReportType;
      filters?: ExportFilters;
    }) => {
      const params = new URLSearchParams({
        reportType,
        ...Object.fromEntries(
          Object.entries(filters ?? {}).filter(([, v]) => v != null) as [
            string,
            string,
          ][],
        ),
      });
      const res = await apiClient.post<{ data: { jobId: string } }>(
        `${BASE}/pdf?${params}`,
      );
      return res.data.data.jobId;
    },
    onError: () => toast.error('Error al encolar PDF'),
  });
}

export function usePdfJobStatus(jobId: string | null, enabled = true) {
  return useQuery<PdfJobStatus>({
    queryKey: ['pdf-job', jobId],
    queryFn: () => apiClient.get(`${BASE}/pdf/${jobId}`).then((r) => r.data.data),
    enabled: !!jobId && enabled,
    refetchInterval: (query) => {
      const status = query.state.data?.status;
      if (status === 'COMPLETED' || status === 'FAILED') return false;
      return 3000;
    },
  });
}
