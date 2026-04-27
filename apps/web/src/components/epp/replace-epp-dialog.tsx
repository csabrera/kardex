'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { Loader2, RotateCcw } from 'lucide-react';
import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';

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
  REPLACEMENT_REASON_LABELS,
  useReplaceEPP,
  type EPPAssignment,
  type ReplacementReason,
} from '@/hooks/use-epp';

const schema = z.object({
  quantity: z.coerce.number().min(0.001, 'Debe ser > 0'),
  reason: z.enum(['PERDIDA', 'DANADO', 'DESGASTE', 'OTRO']),
  notes: z.string().max(500).optional(),
});

type FormData = z.infer<typeof schema>;

interface Props {
  assignment: EPPAssignment | null;
  onClose: () => void;
}

export function ReplaceEPPDialog({ assignment, onClose }: Props) {
  const mutation = useReplaceEPP();

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    reset,
    formState: { errors },
  } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { quantity: 1, reason: 'DESGASTE', notes: '' },
  });

  useEffect(() => {
    if (assignment) {
      reset({
        quantity: Number(assignment.quantity),
        reason: 'DESGASTE',
        notes: '',
      });
    }
  }, [assignment, reset]);

  const onSubmit = (data: FormData) => {
    if (!assignment) return;
    mutation.mutate(
      {
        id: assignment.id,
        quantity: data.quantity,
        reason: data.reason,
        warehouseId: assignment.warehouseId,
        notes: data.notes,
      },
      {
        onSuccess: () => {
          reset();
          onClose();
        },
      },
    );
  };

  return (
    <Dialog open={!!assignment} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <RotateCcw className="h-5 w-5 text-amber-600" /> Reponer EPP
          </DialogTitle>
          <DialogDescription>
            Registra el reemplazo de un EPP entregado anteriormente. Se descontará stock
            del mismo almacén de obra.
          </DialogDescription>
        </DialogHeader>

        {assignment && (
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div className="rounded-lg border bg-muted/30 p-3.5 text-sm space-y-1.5">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Asignación original:</span>
                <span className="font-mono text-xs font-semibold">{assignment.code}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Empleado:</span>
                <span className="font-medium">
                  {assignment.worker.firstName} {assignment.worker.lastName}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">EPP:</span>
                <span>
                  <span className="font-mono text-xs mr-1">{assignment.item.code}</span>
                  {assignment.item.name}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Almacén:</span>
                <span>{assignment.warehouse.name}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Cantidad original:</span>
                <span className="font-semibold tabular-nums">
                  {Number(assignment.quantity)} {assignment.item.unit.abbreviation}
                </span>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Cantidad *</Label>
                <Input
                  type="number"
                  step="0.001"
                  min="0.001"
                  autoFocus
                  {...register('quantity')}
                />
                {errors.quantity && (
                  <p className="text-xs text-destructive">{errors.quantity.message}</p>
                )}
              </div>
              <div className="space-y-1.5">
                <Label>Motivo *</Label>
                <Select
                  value={watch('reason')}
                  onValueChange={(v) => setValue('reason', v as ReplacementReason)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {(Object.keys(REPLACEMENT_REASON_LABELS) as ReplacementReason[]).map(
                      (r) => (
                        <SelectItem key={r} value={r}>
                          {REPLACEMENT_REASON_LABELS[r]}
                        </SelectItem>
                      ),
                    )}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label>Observaciones</Label>
              <Input
                {...register('notes')}
                placeholder="Detalle del reemplazo (opcional)"
              />
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t">
              <Button type="button" variant="outline" onClick={onClose}>
                Cancelar
              </Button>
              <Button type="submit" disabled={mutation.isPending} className="gap-2">
                {mutation.isPending ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" /> Registrando...
                  </>
                ) : (
                  <>
                    <RotateCcw className="h-4 w-4" /> Registrar reposición
                  </>
                )}
              </Button>
            </div>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
