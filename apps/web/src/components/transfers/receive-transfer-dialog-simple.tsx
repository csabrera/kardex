'use client';

import { AlertCircle, CheckCircle2, Loader2, Package } from 'lucide-react';
import { useEffect, useState } from 'react';

import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useReceiveTransfer, type Transfer } from '@/hooks/use-transfers';
import { cn } from '@/lib/cn';
import { useAuthStore } from '@/stores/use-auth-store';

interface Props {
  transfer: Transfer | null;
  onClose: () => void;
}

type LineState = {
  transferItemId: string;
  itemName: string;
  itemCode: string;
  unit: string;
  sentQty: number;
  receivedQty: string;
};

const toUpper = (v: string) => v.toUpperCase();

export function ReceiveTransferDialogSimple({ transfer, onClose }: Props) {
  const mutation = useReceiveTransfer();

  const [lines, setLines] = useState<LineState[]>([]);
  const [notes, setNotes] = useState('');
  const [overrideReason, setOverrideReason] = useState('');
  const [overrideError, setOverrideError] = useState<string | null>(null);
  const [isSubmitted, setIsSubmitted] = useState(false);

  const user = useAuthStore((s) => s.user);
  const needsOverride = user?.role?.name === 'ADMIN';

  useEffect(() => {
    if (!transfer) return;
    setLines(
      transfer.items.map((ti) => {
        const sentQty = Number(ti.sentQty ?? ti.requestedQty);
        return {
          transferItemId: ti.id,
          itemName: ti.item.name,
          itemCode: ti.item.code,
          unit: ti.item.unit.abbreviation,
          sentQty,
          receivedQty: String(sentQty),
        };
      }),
    );
    setNotes('');
    setOverrideReason('');
    setOverrideError(null);
    setIsSubmitted(false);
  }, [transfer]);

  const setReceivedQty = (idx: number, value: string) =>
    setLines((cur) => cur.map((l, i) => (i !== idx ? l : { ...l, receivedQty: value })));

  const getLineError = (line: LineState): string | null => {
    const qty = Number(line.receivedQty);
    if (isNaN(qty) || qty <= 0) return 'La cantidad debe ser mayor a 0';
    if (qty > line.sentQty)
      return `No puede superar lo enviado (${line.sentQty} ${line.unit})`;
    return null;
  };

  const isLineDiscrepancy = (line: LineState) => {
    const qty = Number(line.receivedQty);
    return !isNaN(qty) && Math.abs(line.sentQty - qty) > 0.0001;
  };

  const hasDiscrepancy = lines.some(isLineDiscrepancy);
  const hasLineErrors = lines.some((l) => getLineError(l) !== null);

  const handleSubmit = () => {
    setIsSubmitted(true);
    if (!transfer || hasLineErrors) return;
    if (needsOverride) {
      const trimmed = overrideReason.trim();
      if (trimmed.length < 5) {
        setOverrideError('Requerido como administrador (mínimo 5 caracteres)');
        return;
      }
    }
    setOverrideError(null);
    mutation.mutate(
      {
        id: transfer.id,
        items: lines.map((l) => ({
          transferItemId: l.transferItemId,
          receivedQty: Number(l.receivedQty),
        })),
        notes: notes.trim() || undefined,
        overrideReason: needsOverride ? overrideReason.trim() : undefined,
      },
      { onSuccess: onClose },
    );
  };

  return (
    <Dialog open={!!transfer} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CheckCircle2 className="h-5 w-5 text-green-600" /> Confirmar recepción
          </DialogTitle>
          <DialogDescription>
            {transfer && (
              <>
                <span className="font-mono font-semibold">{transfer.code}</span> desde{' '}
                <span className="font-medium">{transfer.fromWarehouse.name}</span>
              </>
            )}
          </DialogDescription>
        </DialogHeader>

        {transfer && (
          <div className="space-y-3">
            {/* Líneas de ítems */}
            <div className="space-y-2 max-h-[40vh] overflow-auto pr-1">
              {lines.map((line, idx) => {
                const discrepancy = isLineDiscrepancy(line);
                const lineError = isSubmitted ? getLineError(line) : null;

                return (
                  <div
                    key={line.transferItemId}
                    className={cn(
                      'rounded-lg border p-3 transition-colors',
                      lineError
                        ? 'bg-destructive/5 border-destructive/30'
                        : discrepancy
                          ? 'bg-amber-50/50 dark:bg-amber-950/20 border-amber-200/50 dark:border-amber-900/40'
                          : 'bg-green-50/50 dark:bg-green-950/20 border-green-200/50 dark:border-green-900/40',
                    )}
                  >
                    {/* Nombre + badge estado */}
                    <div className="flex items-start justify-between gap-2 mb-3">
                      <div className="min-w-0">
                        <p className="font-medium truncate">{line.itemName}</p>
                        <p className="text-xs text-muted-foreground font-mono">
                          {line.itemCode}
                        </p>
                      </div>
                      {!lineError && (
                        <span
                          className={cn(
                            'shrink-0 text-[11px] font-semibold px-2 py-0.5 rounded-full',
                            discrepancy
                              ? 'text-amber-700 bg-amber-100 dark:bg-amber-900/40 dark:text-amber-300'
                              : 'text-green-700 bg-green-100 dark:bg-green-900/40 dark:text-green-300',
                          )}
                        >
                          {discrepancy ? '⚠ Discrepancia' : '✓ Conforme'}
                        </span>
                      )}
                    </div>

                    {/* Enviado / Recibido */}
                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <div className="flex items-center justify-between bg-background/60 rounded px-2.5 py-1.5">
                        <span className="text-muted-foreground">Enviado</span>
                        <span className="font-semibold tabular-nums">
                          {line.sentQty} {line.unit}
                        </span>
                      </div>
                      <div className="space-y-1">
                        <span className="text-muted-foreground">
                          Recibido <span className="text-destructive">*</span>
                        </span>
                        <Input
                          type="number"
                          step="0.001"
                          min="0.001"
                          max={line.sentQty}
                          value={line.receivedQty}
                          onChange={(e) => setReceivedQty(idx, e.target.value)}
                          className={cn(
                            'h-8 text-xs font-semibold tabular-nums',
                            lineError &&
                              'border-destructive focus-visible:ring-destructive/30',
                            discrepancy && !lineError && 'border-amber-400',
                          )}
                        />
                        {lineError && (
                          <p className="text-[11px] text-destructive">{lineError}</p>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Banner discrepancia */}
            {hasDiscrepancy && !hasLineErrors && (
              <div className="rounded-md border border-amber-300 bg-amber-50 dark:bg-amber-950/30 p-3 text-xs">
                <p className="font-medium text-amber-900 dark:text-amber-200 flex items-center gap-1.5">
                  <Package className="h-3.5 w-3.5" />
                  Hay diferencias entre lo enviado y lo recibido
                </p>
                <p className="text-amber-800 dark:text-amber-200/80 mt-1">
                  Se notificará al administrador automáticamente. Añade una nota con el
                  motivo si es posible.
                </p>
              </div>
            )}

            {/* Notas */}
            <div className="space-y-1.5">
              <Label htmlFor="receiveNotes">
                Notas{' '}
                <span className="text-muted-foreground font-normal text-xs">
                  — opcional
                </span>
              </Label>
              <Textarea
                id="receiveNotes"
                value={notes}
                onChange={(e) => setNotes(toUpper(e.target.value))}
                placeholder="OBSERVACIONES DE LA RECEPCIÓN"
                rows={2}
                className="text-sm resize-none"
              />
            </div>

            {/* Banner + campo admin override */}
            {needsOverride && (
              <div className="rounded-md border border-amber-300 bg-amber-50/70 dark:bg-amber-950/30 p-3 space-y-2">
                <div className="flex items-start gap-2">
                  <AlertCircle className="h-4 w-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
                  <div className="text-xs text-amber-900 dark:text-amber-100 space-y-1">
                    <p className="font-medium">
                      Estás recibiendo esta transferencia como administrador
                    </p>
                    <p className="text-amber-800 dark:text-amber-200/90">
                      Solo el residente verifica que la mercadería llegó correctamente al
                      almacén de la obra. Deja constancia del motivo.
                    </p>
                  </div>
                </div>
                <div className="space-y-1.5 pl-6">
                  <Label htmlFor="receiveOverrideReason" className="text-xs">
                    Motivo de excepción <span className="text-destructive">*</span>
                  </Label>
                  <Textarea
                    id="receiveOverrideReason"
                    value={overrideReason}
                    onChange={(e) => {
                      setOverrideReason(toUpper(e.target.value));
                      setOverrideError(null);
                    }}
                    placeholder="EJ: RESIDENTE AUSENTE — RECEPCIÓN URGENTE PARA INICIAR OBRA"
                    rows={2}
                    className="text-sm resize-none"
                  />
                  {overrideError && (
                    <p className="text-xs text-destructive">{overrideError}</p>
                  )}
                </div>
              </div>
            )}

            {/* Acciones */}
            <div className="flex justify-end gap-2 pt-2 border-t">
              <Button variant="outline" onClick={onClose}>
                Cancelar
              </Button>
              <Button
                onClick={handleSubmit}
                disabled={mutation.isPending || (isSubmitted && hasLineErrors)}
                className="gap-2"
              >
                {mutation.isPending ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" /> Confirmando...
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="h-4 w-4" /> Confirmar recepción
                  </>
                )}
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
