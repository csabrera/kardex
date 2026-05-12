'use client';

import { AlertCircle, PackagePlus } from 'lucide-react';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { FileUpload } from '@/components/ui/file-upload';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useReceiveAdditional, type Transfer } from '@/hooks/use-transfers';
import { useAuthStore } from '@/stores/use-auth-store';

interface Props {
  transfer: Transfer;
  open: boolean;
  onClose: () => void;
}

/**
 * Modal para registrar una recepción adicional sobre una TRF PARCIALMENTE_RECIBIDA.
 * Caso A: el resto del pedido llegó días después en una segunda remesa.
 * Solo muestra líneas en estado RECIBIDO_PARCIAL. La guía adicional es OPCIONAL.
 */
export function ReceiveAdditionalDialog({ transfer: t, open, onClose }: Props) {
  const partialLines = t.items.filter((i) => i.status === 'RECIBIDO_PARCIAL');

  const [qtys, setQtys] = useState<Record<string, string>>({});
  const [recipientDoc, setRecipientDoc] = useState<{
    filename: string;
    originalName: string;
  } | null>(null);
  const [overrideReason, setOverrideReason] = useState('');
  const [overrideError, setOverrideError] = useState<string | null>(null);
  const [isSubmitted, setIsSubmitted] = useState(false);

  const user = useAuthStore((s) => s.user);
  const needsOverride = user?.role?.name === 'ADMIN';

  const mutation = useReceiveAdditional();

  useEffect(() => {
    if (!open) return;
    // Pre-llenar con la qty pendiente de cada línea como sugerencia
    const init: Record<string, string> = {};
    partialLines.forEach((i) => {
      const sent = Number(i.sentQty ?? i.requestedQty);
      const recvd = Number(i.receivedQty ?? 0);
      init[i.id] = String(sent - recvd);
    });
    setQtys(init);
    setRecipientDoc(null);
    setOverrideReason('');
    setOverrideError(null);
    setIsSubmitted(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, t.id]);

  const getPending = (lineId: string) => {
    const line = partialLines.find((i) => i.id === lineId);
    if (!line) return 0;
    const sent = Number(line.sentQty ?? line.requestedQty);
    const recvd = Number(line.receivedQty ?? 0);
    return sent - recvd;
  };

  const getLineError = (lineId: string): string | null => {
    const raw = qtys[lineId];
    if (raw === undefined || raw === '') return null; // permite skip
    const qty = Number(raw);
    if (isNaN(qty) || qty < 0) return 'Cantidad inválida';
    if (qty === 0) return null; // 0 = no recibir esta línea ahora
    const pending = getPending(lineId);
    if (qty > pending) return `Pendiente: ${pending}`;
    return null;
  };

  const hasErrors = partialLines.some((i) => getLineError(i.id) !== null);

  const itemsToSubmit = partialLines
    .map((i) => ({ transferItemId: i.id, additionalQty: Number(qtys[i.id] ?? 0) }))
    .filter((i) => i.additionalQty > 0);

  const validateOverride = () => {
    if (!needsOverride) return true;
    if (overrideReason.trim().length < 5) {
      setOverrideError('Requerido como administrador (mínimo 5 caracteres)');
      return false;
    }
    setOverrideError(null);
    return true;
  };

  const handleSubmit = () => {
    setIsSubmitted(true);
    if (hasErrors) return;
    if (itemsToSubmit.length === 0) {
      toast.error('Indica al menos una cantidad mayor a cero');
      return;
    }
    if (!validateOverride()) return;
    mutation.mutate(
      {
        id: t.id,
        items: itemsToSubmit,
        overrideReason: needsOverride ? overrideReason.trim() : undefined,
        documentUrl: recipientDoc?.filename ?? undefined,
        documentName: recipientDoc?.originalName ?? undefined,
      },
      {
        onSuccess: () => {
          toast.success('Recepción adicional registrada · stock actualizado');
          onClose();
        },
      },
    );
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <PackagePlus className="h-5 w-5 text-accent" /> Recibir lo faltante ·{' '}
            <span className="font-mono">{t.code}</span>
          </DialogTitle>
          <DialogDescription>
            Registra la cantidad adicional que llegó. Solo aparecen las líneas con saldo
            pendiente.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="rounded-md border overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 text-xs text-muted-foreground">
                <tr>
                  <th className="px-3 py-2 text-left font-medium">Ítem</th>
                  <th className="px-3 py-2 text-right font-medium">Pendiente</th>
                  <th className="px-3 py-2 text-center font-medium">
                    Cantidad adicional
                  </th>
                </tr>
              </thead>
              <tbody>
                {partialLines.map((line) => {
                  const pending = getPending(line.id);
                  const lineError = isSubmitted ? getLineError(line.id) : null;
                  return (
                    <tr key={line.id} className="border-t">
                      <td className="px-3 py-2">
                        <div className="flex flex-col">
                          <span>{line.item.name}</span>
                          <span className="font-mono text-[10px] text-muted-foreground">
                            {line.item.code}
                          </span>
                        </div>
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums font-medium">
                        {pending.toLocaleString('es-PE', { maximumFractionDigits: 3 })}{' '}
                        <span className="text-muted-foreground text-[11px]">
                          {line.item.unit.abbreviation}
                        </span>
                      </td>
                      <td className="px-3 py-2">
                        <div className="space-y-1">
                          <Input
                            type="number"
                            step="0.001"
                            min="0"
                            max={pending}
                            value={qtys[line.id] ?? ''}
                            onChange={(e) =>
                              setQtys((p) => ({ ...p, [line.id]: e.target.value }))
                            }
                            className={`h-8 text-sm text-right w-28 ml-auto ${
                              lineError ? 'border-destructive' : ''
                            }`}
                          />
                          {lineError && (
                            <p className="text-[11px] text-destructive text-right">
                              {lineError}
                            </p>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Guía OPCIONAL */}
          <div className="space-y-1.5">
            <Label className="text-xs">Guía de remisión adicional (opcional)</Label>
            <FileUpload
              value={recipientDoc}
              onChange={setRecipientDoc}
              disabled={mutation.isPending}
            />
            <p className="text-[11px] text-muted-foreground">
              Si llegó con una guía nueva, adjúntala. Si no, deja vacío.
            </p>
          </div>

          {/* Override admin */}
          {needsOverride && (
            <div className="rounded-md border border-amber-300 bg-amber-50/70 dark:bg-amber-950/30 p-3 space-y-2">
              <div className="flex items-start gap-2">
                <AlertCircle className="h-4 w-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
                <div className="text-xs text-amber-900 dark:text-amber-100">
                  Estás recibiendo como administrador. Deja constancia del motivo.
                </div>
              </div>
              <div className="space-y-1 pl-6">
                <Label className="text-xs">Motivo de excepción *</Label>
                <Textarea
                  value={overrideReason}
                  onChange={(e) => {
                    setOverrideReason(e.target.value.toUpperCase());
                    setOverrideError(null);
                  }}
                  placeholder="EJ: RESIDENTE AUSENTE — RECEPCIÓN URGENTE"
                  rows={2}
                  className="text-sm resize-none"
                />
                {overrideError && (
                  <p className="text-xs text-destructive">{overrideError}</p>
                )}
              </div>
            </div>
          )}

          <div className="flex justify-end gap-2 pt-2 border-t">
            <Button variant="outline" onClick={onClose}>
              Cancelar
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={mutation.isPending || (isSubmitted && hasErrors)}
              className="gap-1.5"
            >
              <PackagePlus className="h-4 w-4" />
              {mutation.isPending ? 'Procesando...' : 'Registrar recepción'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
