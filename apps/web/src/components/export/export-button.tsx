'use client';

import {
  Download,
  FileSpreadsheet,
  FileText,
  Loader2,
  CheckCircle2,
  XCircle,
} from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import {
  useExportExcel,
  useQueuePdf,
  usePdfJobStatus,
  type ReportType,
} from '@/hooks/use-export';
import { downloadAuthenticated } from '@/lib/download';

interface ExportButtonProps {
  reportType: ReportType;
  filters?: { itemId?: string; warehouseId?: string; type?: string };
  label?: string;
  disabled?: boolean;
}

function PdfStatusModal({ jobId, onClose }: { jobId: string; onClose: () => void }) {
  const { data: status } = usePdfJobStatus(jobId);

  const isDone = status?.status === 'COMPLETED';
  const isFailed = status?.status === 'FAILED';
  const progress = status?.progress ?? 0;

  const handleDownload = async () => {
    try {
      await downloadAuthenticated(
        `/export/pdf/${jobId}/download`,
        `reporte-${jobId}.pdf`,
      );
      onClose();
    } catch {
      toast.error('Error al descargar el PDF');
    }
  };

  return (
    <Dialog open onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Generando PDF</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {!isDone && !isFailed && (
            <>
              <div className="flex items-center gap-3">
                <Loader2 className="h-5 w-5 animate-spin text-primary" />
                <span className="text-sm">
                  {status?.status === 'WAITING'
                    ? 'En cola...'
                    : `Procesando... ${progress}%`}
                </span>
              </div>
              <div className="h-2 rounded-full bg-muted overflow-hidden">
                <div
                  className="h-full bg-primary transition-all duration-500 rounded-full"
                  style={{ width: `${progress}%` }}
                />
              </div>
              <p className="text-xs text-muted-foreground">
                El PDF se está generando en segundo plano. Puedes seguir usando la
                aplicación.
              </p>
            </>
          )}

          {isDone && (
            <div className="flex flex-col items-center gap-3 py-2">
              <CheckCircle2 className="h-10 w-10 text-green-600" />
              <p className="text-sm font-medium">¡PDF listo para descargar!</p>
              <Button onClick={handleDownload} className="gap-2 w-full">
                <Download className="h-4 w-4" />
                Descargar PDF
              </Button>
            </div>
          )}

          {isFailed && (
            <div className="flex flex-col items-center gap-3 py-2">
              <XCircle className="h-10 w-10 text-destructive" />
              <p className="text-sm font-medium text-destructive">
                Error al generar el PDF
              </p>
              <p className="text-xs text-muted-foreground text-center">
                {status?.failedReason ?? 'Error desconocido'}
              </p>
              <Button variant="outline" onClick={onClose} className="w-full">
                Cerrar
              </Button>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

export function ExportButton({
  reportType,
  filters,
  label,
  disabled,
}: ExportButtonProps) {
  const [pdfJobId, setPdfJobId] = useState<string | null>(null);
  const [showModal, setShowModal] = useState(false);

  const excelMutation = useExportExcel();
  const pdfMutation = useQueuePdf();

  const handleExcel = () => {
    toast.promise(excelMutation.mutateAsync({ reportType, filters }), {
      loading: 'Generando Excel...',
      success: 'Excel descargado',
      error: 'Error al generar Excel',
    });
  };

  const handlePdf = async () => {
    const jobId = await pdfMutation.mutateAsync({ reportType, filters });
    setPdfJobId(jobId);
    setShowModal(true);
    toast.info('PDF en proceso. Te avisaremos cuando esté listo.');
  };

  return (
    <>
      <div className="flex items-center gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={handleExcel}
          disabled={disabled || excelMutation.isPending}
          className="gap-2"
        >
          {excelMutation.isPending ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <FileSpreadsheet className="h-3.5 w-3.5 text-green-600" />
          )}
          {label ? `${label} Excel` : 'Excel'}
        </Button>

        <Button
          variant="outline"
          size="sm"
          onClick={handlePdf}
          disabled={disabled || pdfMutation.isPending}
          className="gap-2"
        >
          {pdfMutation.isPending ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <FileText className="h-3.5 w-3.5 text-red-500" />
          )}
          {label ? `${label} PDF` : 'PDF'}
        </Button>
      </div>

      {showModal && pdfJobId && (
        <PdfStatusModal
          jobId={pdfJobId}
          onClose={() => {
            setShowModal(false);
            setPdfJobId(null);
          }}
        />
      )}
    </>
  );
}
