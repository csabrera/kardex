'use client';

import {
  AlertCircle,
  Download,
  FileUp,
  Upload,
  XCircle,
  CheckCircle2,
} from 'lucide-react';
import { useMemo, useRef, useState } from 'react';
import { toast } from 'sonner';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  type ImportPreviewRow,
  type ImportItemRowDto,
  useImportPreview,
  useConfirmImport,
} from '@/hooks/use-items';
import { downloadAuthenticated } from '@/lib/download';

interface ImportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ImportDialog({ open, onOpenChange }: ImportDialogProps) {
  const [step, setStep] = useState<'upload' | 'preview'>('upload');
  const [previewRows, setPreviewRows] = useState<ImportPreviewRow[]>([]);
  const [totalValid, setTotalValid] = useState(0);
  const [totalErrors, setTotalErrors] = useState(0);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  const previewMutation = useImportPreview();
  const confirmMutation = useConfirmImport();

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) setSelectedFile(file);
  };

  const handlePreview = async () => {
    if (!selectedFile) return;
    const result = await previewMutation.mutateAsync(selectedFile);
    setPreviewRows(result.rows);
    setTotalValid(result.totalValid);
    setTotalErrors(result.totalErrors);
    setStep('preview');
  };

  const handleConfirm = async () => {
    const validRows = previewRows
      .filter((r) => r.valid)
      .map(
        (r): ImportItemRowDto => ({
          row: r.row,
          code: r.code,
          name: r.name,
          type: r.type as ImportItemRowDto['type'],
          categoryCode: r.categoryCode,
          unitCode: r.unitCode,
          minStock: r.minStock,
          maxStock: r.maxStock,
          stockInicial: r.stockInicial,
          description: r.description,
        }),
      );

    await confirmMutation.mutateAsync(validRows);
    handleClose();
  };

  const handleClose = () => {
    setStep('upload');
    setPreviewRows([]);
    setTotalValid(0);
    setTotalErrors(0);
    setSelectedFile(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
    onOpenChange(false);
  };

  const handleDownloadTemplate = async () => {
    try {
      await downloadAuthenticated('/items/import/template', 'plantilla-items.xlsx');
    } catch {
      toast.error('Error al descargar la plantilla');
    }
  };

  // Agrupa errores únicos que sugieren un prerequisito faltante (ej. categoría no existe)
  const missingResources = useMemo(() => {
    const categories = new Set<string>();
    const units = new Set<string>();
    for (const row of previewRows) {
      for (const err of row.errors) {
        const catMatch = err.match(/Categor[ií]a\s+"([^"]+)"\s+no existe/i);
        if (catMatch?.[1]) categories.add(catMatch[1]);
        const unitMatch = err.match(/Unidad\s+"([^"]+)"\s+no existe/i);
        if (unitMatch?.[1]) units.add(unitMatch[1]);
      }
    }
    return { categories: [...categories], units: [...units] };
  }, [previewRows]);

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className={step === 'preview' ? 'max-w-5xl' : 'max-w-md'}>
        <DialogHeader>
          <DialogTitle>
            {step === 'upload'
              ? 'Importar ítems desde Excel'
              : 'Vista previa de importación'}
          </DialogTitle>
          <DialogDescription>
            {step === 'upload'
              ? 'Sube un archivo Excel para crear varios ítems de inventario a la vez.'
              : `Revisa las filas antes de confirmar la importación. Solo las filas válidas se guardarán.`}
          </DialogDescription>
        </DialogHeader>

        {step === 'upload' && (
          <div className="space-y-4">
            <div className="rounded-md border border-amber-200 dark:border-amber-900/50 bg-amber-50/60 dark:bg-amber-950/20 p-3 text-xs space-y-1">
              <p className="font-medium text-amber-900 dark:text-amber-200">
                Antes de importar:
              </p>
              <ul className="list-disc ml-4 text-amber-800 dark:text-amber-200/80 space-y-0.5">
                <li>
                  Verifica que las <strong>categorías</strong> y <strong>unidades</strong>{' '}
                  usadas ya existan en el sistema.
                </li>
                <li>
                  Los códigos (<code>categoria</code>, <code>unidad</code>) deben
                  coincidir EXACTAMENTE con los registrados.
                </li>
                <li>
                  Columna <code>stockinicial</code>: cantidad de migración. Se carga
                  directo al <strong>Almacén Principal</strong> como una entrada
                  automática.
                </li>
                <li>
                  Descarga la plantilla — incluye ejemplos y una pestaña con los
                  tipos/unidades válidos.
                </li>
              </ul>
            </div>

            <Button
              variant="outline"
              size="sm"
              onClick={handleDownloadTemplate}
              className="gap-2"
            >
              <Download className="h-4 w-4" />
              Descargar plantilla
            </Button>

            <div
              className="flex flex-col items-center justify-center gap-3 rounded-lg border-2 border-dashed border-muted-foreground/25 p-8 cursor-pointer hover:border-muted-foreground/50 transition-colors"
              onClick={() => fileInputRef.current?.click()}
            >
              <FileUp className="h-10 w-10 text-muted-foreground/50" />
              <div className="text-center">
                <p className="text-sm font-medium">
                  {selectedFile
                    ? selectedFile.name
                    : 'Haz clic para seleccionar un archivo'}
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  Solo archivos .xlsx (máx. 5MB)
                </p>
              </div>
              <input
                ref={fileInputRef}
                type="file"
                accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                className="hidden"
                onChange={handleFileChange}
              />
            </div>

            <div className="flex gap-2 justify-end">
              <Button variant="outline" onClick={handleClose}>
                Cancelar
              </Button>
              <Button
                onClick={handlePreview}
                disabled={!selectedFile || previewMutation.isPending}
                className="gap-2"
              >
                <Upload className="h-4 w-4" />
                {previewMutation.isPending ? 'Procesando...' : 'Previsualizar'}
              </Button>
            </div>
          </div>
        )}

        {step === 'preview' && (
          <div className="space-y-4">
            <div className="flex items-center gap-4 text-sm">
              <span className="flex items-center gap-1.5 text-green-600 font-medium">
                <CheckCircle2 className="h-4 w-4" />
                {totalValid} válidos
              </span>
              {totalErrors > 0 && (
                <span className="flex items-center gap-1.5 text-destructive font-medium">
                  <XCircle className="h-4 w-4" />
                  {totalErrors} con errores
                </span>
              )}
              <span className="text-muted-foreground ml-auto">
                {previewRows.length} filas totales
              </span>
            </div>

            <div className="max-h-[50vh] overflow-auto rounded-md border">
              <table className="w-full text-xs">
                <thead className="sticky top-0 bg-muted/80 backdrop-blur-sm">
                  <tr>
                    <th className="px-3 py-2 text-left font-medium text-muted-foreground w-12">
                      #
                    </th>
                    <th className="px-3 py-2 text-left font-medium text-muted-foreground">
                      Código
                    </th>
                    <th className="px-3 py-2 text-left font-medium text-muted-foreground">
                      Nombre
                    </th>
                    <th className="px-3 py-2 text-left font-medium text-muted-foreground">
                      Tipo
                    </th>
                    <th className="px-3 py-2 text-left font-medium text-muted-foreground">
                      Categoría
                    </th>
                    <th className="px-3 py-2 text-left font-medium text-muted-foreground">
                      Unidad
                    </th>
                    <th className="px-3 py-2 text-right font-medium text-muted-foreground">
                      Stock inicial
                    </th>
                    <th className="px-3 py-2 text-left font-medium text-muted-foreground">
                      Estado
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {previewRows.map((row) => (
                    <tr
                      key={row.row}
                      className={
                        row.valid
                          ? 'bg-green-50/50 dark:bg-green-950/20'
                          : 'bg-red-50/50 dark:bg-red-950/20'
                      }
                    >
                      <td className="px-3 py-2 text-muted-foreground align-top">
                        {row.row}
                      </td>
                      <td className="px-3 py-2 font-mono align-top">{row.code || '—'}</td>
                      <td className="px-3 py-2 max-w-[200px] truncate align-top">
                        {row.name || '—'}
                      </td>
                      <td className="px-3 py-2 align-top">{row.type || '—'}</td>
                      <td className="px-3 py-2 font-mono align-top">
                        {row.categoryCode || '—'}
                      </td>
                      <td className="px-3 py-2 font-mono align-top">
                        {row.unitCode || '—'}
                      </td>
                      <td className="px-3 py-2 align-top text-right tabular-nums">
                        {row.stockInicial && row.stockInicial > 0 ? (
                          <span className="font-semibold text-green-600 dark:text-green-400">
                            {row.stockInicial}
                          </span>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </td>
                      <td className="px-3 py-2 align-top">
                        {row.valid ? (
                          <Badge variant="success" className="text-[10px]">
                            OK
                          </Badge>
                        ) : (
                          <ul className="text-destructive leading-snug list-disc ml-4 space-y-0.5">
                            {row.errors.map((err, i) => (
                              <li key={i}>{err}</li>
                            ))}
                          </ul>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {totalErrors > 0 && totalValid > 0 && (
              <p className="text-xs text-muted-foreground">
                Solo se importarán las {totalValid} filas válidas. Las {totalErrors} filas
                con errores serán ignoradas.
              </p>
            )}

            {(missingResources.categories.length > 0 ||
              missingResources.units.length > 0) && (
              <div className="rounded-md border border-amber-300 dark:border-amber-900/60 bg-amber-50 dark:bg-amber-950/30 p-3 text-xs space-y-2">
                <div className="flex items-start gap-2">
                  <AlertCircle className="h-4 w-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
                  <div className="space-y-1">
                    <p className="font-medium text-amber-900 dark:text-amber-200">
                      Recursos no encontrados en el sistema
                    </p>
                    {missingResources.categories.length > 0 && (
                      <p className="text-amber-800 dark:text-amber-200/80">
                        <strong>Categorías faltantes:</strong>{' '}
                        {missingResources.categories.map((c) => `"${c}"`).join(', ')}.
                        Créalas primero en{' '}
                        <a href="/dashboard/categorias" className="underline font-medium">
                          Maestros → Categorías
                        </a>
                        .
                      </p>
                    )}
                    {missingResources.units.length > 0 && (
                      <p className="text-amber-800 dark:text-amber-200/80">
                        <strong>Unidades faltantes:</strong>{' '}
                        {missingResources.units.map((u) => `"${u}"`).join(', ')}. Créalas
                        primero en{' '}
                        <a href="/dashboard/unidades" className="underline font-medium">
                          Maestros → Unidades
                        </a>
                        .
                      </p>
                    )}
                  </div>
                </div>
              </div>
            )}

            {totalValid === 0 && (
              <div className="rounded-md border border-destructive/30 bg-destructive/10 p-3 text-sm">
                <p className="font-medium text-destructive">
                  No hay filas válidas para importar
                </p>
                <p className="text-xs text-destructive/80 mt-1">
                  Corrige los errores en el archivo Excel y vuelve a intentarlo. Los
                  códigos de categoría y unidad son sensibles a mayúsculas.
                </p>
              </div>
            )}

            <div className="flex gap-2 justify-end">
              <Button variant="outline" onClick={() => setStep('upload')}>
                Volver
              </Button>
              <Button
                onClick={handleConfirm}
                disabled={totalValid === 0 || confirmMutation.isPending}
                className="gap-2"
              >
                <CheckCircle2 className="h-4 w-4" />
                {confirmMutation.isPending
                  ? 'Importando...'
                  : `Confirmar importación (${totalValid})`}
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
