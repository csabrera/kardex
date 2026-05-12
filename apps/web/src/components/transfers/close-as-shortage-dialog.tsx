'use client';

import { AlertTriangle, XCircle } from 'lucide-react';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import {
  SHORTAGE_REASON_LABEL,
  useCloseAsShortage,
  type Transfer,
  type TransferShortageReason,
} from '@/hooks/use-transfers';

interface Props {
  transfer: Transfer;
  open: boolean;
  onClose: () => void;
}

const REASON_OPTIONS: TransferShortageReason[] = [
  'INCUMPLIMIENTO_PROVEEDOR',
  'DANIO_EN_TRANSPORTE',
  'ROBO_O_PERDIDA',
  'ERROR_DE_CONTEO',
  'OTRO',
];

/**
 * Modal admin para cerrar una o varias líneas RECIBIDO_PARCIAL como FALTANTE_DEFINITIVO.
 * Caso B: el proveedor incumplió, las cantidades faltantes no llegarán. El backend
 * crea Movements DEVOLUCION + COMPRA_INCUMPLIDA en el origen para auditoría.
 */
export function CloseAsShortageDialog({ transfer: t, open, onClose }: Props) {
  const partialLines = t.items.filter((i) => i.status === 'RECIBIDO_PARCIAL');

  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [reason, setReason] = useState<TransferShortageReason | ''>('');
  const [notes, setNotes] = useState('');
  const [isSubmitted, setIsSubmitted] = useState(false);

  const mutation = useCloseAsShortage();

  useEffect(() => {
    if (!open) return;
    // Pre-selecciona todas las pendientes por default (caso típico)
    setSelected(new Set(partialLines.map((i) => i.id)));
    setReason('');
    setNotes('');
    setIsSubmitted(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, t.id]);

  const toggle = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleSubmit = () => {
    setIsSubmitted(true);
    if (selected.size === 0) {
      toast.error('Selecciona al menos una línea');
      return;
    }
    if (!reason) {
      toast.error('Selecciona un motivo');
      return;
    }
    mutation.mutate(
      {
        id: t.id,
        transferItemIds: Array.from(selected),
        reason,
        notes: notes.trim() || undefined,
      },
      { onSuccess: () => onClose() },
    );
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <XCircle className="h-5 w-5 text-destructive" /> Cerrar como faltante
            definitivo · <span className="font-mono">{t.code}</span>
          </DialogTitle>
          <DialogDescription>
            Marca las líneas que ya no van a llegar. Se registrará una baja contable en el
            almacén origen con el motivo seleccionado.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Banner advertencia */}
          <div className="rounded-md border border-amber-300 bg-amber-50 dark:bg-amber-950/30 p-3 space-y-1">
            <p className="text-xs font-medium text-amber-900 dark:text-amber-200 flex items-center gap-1.5">
              <AlertTriangle className="h-3.5 w-3.5" />
              Esta acción es irreversible
            </p>
            <p className="text-[11px] text-amber-800 dark:text-amber-200/80">
              El stock pendiente del origen quedará registrado como baja con motivo
              clasificado. Si las unidades pueden llegar después, mejor usa "Recibir lo
              faltante".
            </p>
          </div>

          {/* Tabla de líneas pendientes */}
          <div className="rounded-md border overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 text-xs text-muted-foreground">
                <tr>
                  <th className="px-3 py-2 w-8"></th>
                  <th className="px-3 py-2 text-left font-medium">Ítem</th>
                  <th className="px-3 py-2 text-right font-medium">A dar de baja</th>
                </tr>
              </thead>
              <tbody>
                {partialLines.map((line) => {
                  const sent = Number(line.sentQty ?? line.requestedQty);
                  const recvd = Number(line.receivedQty ?? 0);
                  const pending = sent - recvd;
                  const checked = selected.has(line.id);
                  return (
                    <tr key={line.id} className="border-t">
                      <td className="px-3 py-2">
                        <Checkbox
                          checked={checked}
                          onCheckedChange={() => toggle(line.id)}
                        />
                      </td>
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
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Motivo enum */}
          <div className="space-y-1.5">
            <Label className="text-xs">
              Motivo <span className="text-destructive">*</span>
            </Label>
            <Select
              value={reason}
              onValueChange={(v) => setReason(v as TransferShortageReason)}
            >
              <SelectTrigger>
                <SelectValue placeholder="Seleccionar motivo..." />
              </SelectTrigger>
              <SelectContent>
                {REASON_OPTIONS.map((r) => (
                  <SelectItem key={r} value={r}>
                    {SHORTAGE_REASON_LABEL[r]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {isSubmitted && !reason && (
              <p className="text-xs text-destructive">Selecciona un motivo</p>
            )}
          </div>

          {/* Notas opcionales */}
          <div className="space-y-1.5">
            <Label className="text-xs">Notas (opcional)</Label>
            <Textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value.toUpperCase())}
              placeholder="EJ: PROVEEDOR PRV-X CONFIRMÓ QUE NO ENTREGARÁ EL RESTO"
              rows={2}
              className="text-sm resize-none uppercase placeholder:normal-case placeholder:opacity-60"
            />
          </div>

          <div className="flex justify-end gap-2 pt-2 border-t">
            <Button variant="outline" onClick={onClose}>
              Cancelar
            </Button>
            <Button
              variant="destructive"
              onClick={handleSubmit}
              disabled={mutation.isPending || selected.size === 0 || !reason}
              className="gap-1.5"
            >
              <XCircle className="h-4 w-4" />
              {mutation.isPending ? 'Cerrando...' : 'Confirmar cierre'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
