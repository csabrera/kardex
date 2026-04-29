'use client';

import { AlertCircle, CheckCircle2 } from 'lucide-react';
import { useState } from 'react';

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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import {
  useReturnToolLoan,
  type ToolLoan,
  type ToolLoanCondition,
} from '@/hooks/use-tool-loans';
import { useAuthStore } from '@/stores/use-auth-store';

const CONDITIONS: { value: ToolLoanCondition; label: string; color: string }[] = [
  { value: 'BUENO', label: 'Bueno — sin daños', color: 'text-green-600' },
  { value: 'REGULAR', label: 'Regular — desgaste normal', color: 'text-amber-500' },
  {
    value: 'DAMAGED',
    label: 'Dañado — requiere baja/reparación',
    color: 'text-destructive',
  },
];

export function ReturnLoanDialog({
  loan,
  onClose,
}: {
  loan: ToolLoan | null;
  onClose: () => void;
}) {
  const user = useAuthStore((s) => s.user);
  const needsOverride = user?.role?.name === 'ADMIN';

  const [condition, setCondition] = useState<ToolLoanCondition | ''>('');
  const [notes, setNotes] = useState('');
  const [overrideReason, setOverrideReason] = useState('');
  const [overrideError, setOverrideError] = useState<string | null>(null);
  const mutation = useReturnToolLoan();

  const handleSubmit = () => {
    if (!loan || !condition) return;
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
        id: loan.id,
        condition,
        notes: notes || undefined,
        overrideReason: needsOverride ? overrideReason.trim() : undefined,
      },
      {
        onSuccess: () => {
          setCondition('');
          setNotes('');
          setOverrideReason('');
          onClose();
        },
      },
    );
  };

  return (
    <Dialog open={!!loan} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Devolver herramienta</DialogTitle>
          <DialogDescription>
            Registra la devolución y el estado en que se recibe la herramienta.
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
              <div className="flex justify-between">
                <span className="text-muted-foreground">Estación:</span>
                <span>{loan.workStation.name}</span>
              </div>
              {loan.warehouse.obra && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Obra:</span>
                  <span>{loan.warehouse.obra.name}</span>
                </div>
              )}
            </div>

            <div className="space-y-1.5">
              <Label>Condición de devolución *</Label>
              <Select
                value={condition}
                onValueChange={(v) => setCondition(v as ToolLoanCondition)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Seleccionar condición..." />
                </SelectTrigger>
                <SelectContent>
                  {CONDITIONS.map((c) => (
                    <SelectItem key={c.value} value={c.value}>
                      <span className={c.color}>{c.label}</span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label>Observaciones de devolución</Label>
              <Input
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Opcional"
              />
            </div>

            {needsOverride && (
              <div className="rounded-md border border-amber-300 bg-amber-50/70 dark:bg-amber-950/30 p-3 space-y-2">
                <div className="flex items-start gap-2">
                  <AlertCircle className="h-4 w-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
                  <div className="text-xs text-amber-900 dark:text-amber-100 space-y-1">
                    <p className="font-medium">
                      Estás cerrando este préstamo como administrador
                    </p>
                    <p className="text-amber-800 dark:text-amber-200/90">
                      Solo el residente o almacenero conoce de primera mano la condición
                      en que volvió la herramienta. Deja constancia del motivo.
                    </p>
                  </div>
                </div>
                <div className="space-y-1.5 pl-6">
                  <Label htmlFor="returnOverrideReason" className="text-xs">
                    Motivo de excepción *
                  </Label>
                  <Textarea
                    id="returnOverrideReason"
                    value={overrideReason}
                    onChange={(e) => setOverrideReason(e.target.value)}
                    placeholder="Ej: Residente ausente — albañil García devolvió ahora"
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
                disabled={!condition || mutation.isPending}
                className="gap-2"
              >
                <CheckCircle2 className="h-4 w-4" />
                {mutation.isPending ? 'Procesando...' : 'Confirmar devolución'}
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
