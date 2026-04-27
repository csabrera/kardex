'use client';

import { CheckCircle2 } from 'lucide-react';
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
import {
  useReturnToolLoan,
  type ToolLoan,
  type ToolLoanCondition,
} from '@/hooks/use-tool-loans';

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
  const [condition, setCondition] = useState<ToolLoanCondition | ''>('');
  const [notes, setNotes] = useState('');
  const mutation = useReturnToolLoan();

  const handleSubmit = () => {
    if (!loan || !condition) return;
    mutation.mutate(
      { id: loan.id, condition, notes: notes || undefined },
      {
        onSuccess: () => {
          setCondition('');
          setNotes('');
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
