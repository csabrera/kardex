'use client';

import { AlertCircle, XCircle } from 'lucide-react';
import { useState } from 'react';

import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useMarkToolLoanLost, type ToolLoan } from '@/hooks/use-tool-loans';

/**
 * Dialog para que un administrador marque un préstamo como perdido y deje
 * constancia del motivo (excepción al flujo normal residente/almacenero).
 */
export function MarkLostLoanDialog({
  loan,
  onClose,
}: {
  loan: ToolLoan | null;
  onClose: () => void;
}) {
  const [overrideReason, setOverrideReason] = useState('');
  const [error, setError] = useState<string | null>(null);
  const mutation = useMarkToolLoanLost();

  const handleSubmit = () => {
    if (!loan) return;
    const trimmed = overrideReason.trim();
    if (trimmed.length < 5) {
      setError('Requerido como administrador (mínimo 5 caracteres)');
      return;
    }
    setError(null);
    mutation.mutate(
      { id: loan.id, overrideReason: trimmed },
      {
        onSuccess: () => {
          setOverrideReason('');
          onClose();
        },
      },
    );
  };

  const handleCancel = () => {
    setOverrideReason('');
    setError(null);
    onClose();
  };

  return (
    <Dialog open={!!loan} onOpenChange={(v) => !v && handleCancel()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-destructive">
            <XCircle className="h-5 w-5" /> Marcar herramienta como perdida
          </DialogTitle>
          <DialogDescription>
            Esta acción es <strong>irreversible</strong> y afecta el control de stock.
          </DialogDescription>
        </DialogHeader>

        {loan && (
          <div className="space-y-4">
            <div className="rounded-md border bg-muted/30 p-3 text-sm space-y-1">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Préstamo:</span>
                <span className="font-mono font-semibold">{loan.code}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Herramienta:</span>
                <span>{loan.item.name}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Cantidad:</span>
                <span>
                  {Number(loan.quantity)} {loan.item.unit.abbreviation}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Responsable:</span>
                <span>
                  {loan.borrowerWorker.firstName} {loan.borrowerWorker.lastName}
                </span>
              </div>
            </div>

            <div className="rounded-md border border-amber-300 bg-amber-50/70 dark:bg-amber-950/30 p-3 space-y-2">
              <div className="flex items-start gap-2">
                <AlertCircle className="h-4 w-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
                <div className="text-xs text-amber-900 dark:text-amber-100 space-y-1">
                  <p className="font-medium">
                    Estás marcando como perdido como administrador
                  </p>
                  <p className="text-amber-800 dark:text-amber-200/90">
                    Solo el residente o almacenero conoce de primera mano si la
                    herramienta efectivamente se perdió. Deja constancia del motivo.
                  </p>
                </div>
              </div>
              <div className="space-y-1.5 pl-6">
                <Label htmlFor="markLostReason" className="text-xs">
                  Motivo de excepción *
                </Label>
                <Textarea
                  id="markLostReason"
                  value={overrideReason}
                  onChange={(e) => setOverrideReason(e.target.value)}
                  placeholder="Ej: Residente reportó pérdida en obra X — albañil García"
                  rows={2}
                  className="text-sm"
                />
                {error && <p className="text-xs text-destructive">{error}</p>}
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t">
              <Button variant="outline" onClick={handleCancel}>
                Cancelar
              </Button>
              <Button
                variant="destructive"
                onClick={handleSubmit}
                disabled={mutation.isPending}
                className="gap-2"
              >
                <XCircle className="h-4 w-4" />
                {mutation.isPending ? 'Procesando...' : 'Marcar como perdida'}
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
