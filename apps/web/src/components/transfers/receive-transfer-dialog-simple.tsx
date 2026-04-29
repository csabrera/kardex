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

/**
 * Diálogo simplificado de confirmación de recepción.
 * - Checkbox grande por línea ("✓ Recibido conforme")
 * - Cantidad recibida pre-llenada con la enviada (se puede ajustar si hay discrepancia)
 * - Botón grande y táctil
 * Usado por RESIDENTE (en /mi-obra) y override por ALMACENERO/ADMIN.
 */
export function ReceiveTransferDialogSimple({ transfer, onClose }: Props) {
  const mutation = useReceiveTransfer();

  type LineState = {
    transferItemId: string;
    itemName: string;
    itemCode: string;
    unit: string;
    sentQty: number;
    receivedQty: number;
    conforme: boolean;
  };

  const [lines, setLines] = useState<LineState[]>([]);
  const [notes, setNotes] = useState('');
  const [overrideReason, setOverrideReason] = useState('');
  const [overrideError, setOverrideError] = useState<string | null>(null);

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
          receivedQty: sentQty,
          conforme: true,
        };
      }),
    );
    setNotes('');
    setOverrideReason('');
    setOverrideError(null);
  }, [transfer]);

  const toggleConforme = (idx: number) => {
    setLines((current) =>
      current.map((l, i) => {
        if (i !== idx) return l;
        // Toggle: si estaba conforme, marcar como no conforme y dejar que ajuste la cantidad
        const newConforme = !l.conforme;
        return {
          ...l,
          conforme: newConforme,
          // Si vuelve a conforme, restablece cantidad enviada
          receivedQty: newConforme ? l.sentQty : l.receivedQty,
        };
      }),
    );
  };

  const setReceivedQty = (idx: number, value: number) => {
    setLines((current) =>
      current.map((l, i) => (i !== idx ? l : { ...l, receivedQty: value })),
    );
  };

  const handleSubmit = () => {
    if (!transfer) return;
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
          receivedQty: l.receivedQty,
        })),
        notes: notes.trim() || undefined,
        overrideReason: needsOverride ? overrideReason.trim() : undefined,
      },
      { onSuccess: onClose },
    );
  };

  const hasDiscrepancy = lines.some((l) => Math.abs(l.sentQty - l.receivedQty) > 0.0001);

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
            <div className="space-y-2 max-h-[40vh] overflow-auto pr-1">
              {lines.map((line, idx) => (
                <div
                  key={line.transferItemId}
                  className={cn(
                    'rounded-lg border p-3 transition-colors',
                    line.conforme
                      ? 'bg-green-50/50 dark:bg-green-950/20 border-green-200/50 dark:border-green-900/40'
                      : 'bg-amber-50/50 dark:bg-amber-950/20 border-amber-200/50 dark:border-amber-900/40',
                  )}
                >
                  <div className="flex items-start gap-3">
                    <button
                      type="button"
                      onClick={() => toggleConforme(idx)}
                      aria-label="Marcar como conforme"
                      className={cn(
                        'flex h-8 w-8 shrink-0 items-center justify-center rounded-md border-2 transition-all',
                        line.conforme
                          ? 'bg-green-600 border-green-600 text-white'
                          : 'bg-background border-amber-400',
                      )}
                    >
                      {line.conforme && <CheckCircle2 className="h-5 w-5" />}
                    </button>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium truncate">{line.itemName}</p>
                      <p className="text-xs text-muted-foreground font-mono">
                        {line.itemCode}
                      </p>
                    </div>
                  </div>

                  <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
                    <div className="flex items-center justify-between bg-background/60 rounded px-2.5 py-1.5">
                      <span className="text-muted-foreground">Enviado</span>
                      <span className="font-semibold tabular-nums">
                        {line.sentQty} {line.unit}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-muted-foreground shrink-0">Recibido</span>
                      <Input
                        type="number"
                        step="0.001"
                        min="0"
                        max={line.sentQty * 2}
                        value={line.receivedQty}
                        onChange={(e) => setReceivedQty(idx, Number(e.target.value))}
                        disabled={line.conforme}
                        className="h-8 text-xs"
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {hasDiscrepancy && (
              <div className="rounded-md border border-amber-300 bg-amber-50 dark:bg-amber-950/30 p-3 text-xs">
                <p className="font-medium text-amber-900 dark:text-amber-200 flex items-center gap-1.5">
                  <Package className="h-3.5 w-3.5" />
                  Hay diferencias entre lo enviado y lo recibido
                </p>
                <p className="text-amber-800 dark:text-amber-200/80 mt-1">
                  Se generará una alerta automática para auditoría. Añade una nota con el
                  motivo si es posible.
                </p>
              </div>
            )}

            <div className="space-y-1.5">
              <Label>Notas</Label>
              <Input
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Opcional — motivo si hay discrepancia"
              />
            </div>

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
                    Motivo de excepción *
                  </Label>
                  <Textarea
                    id="receiveOverrideReason"
                    value={overrideReason}
                    onChange={(e) => setOverrideReason(e.target.value)}
                    placeholder="Ej: Residente ausente — recepción urgente para iniciar obra"
                    rows={2}
                    className="text-sm"
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
                disabled={mutation.isPending}
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
