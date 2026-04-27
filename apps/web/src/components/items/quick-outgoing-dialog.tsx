'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { ArrowUpCircle, Loader2 } from 'lucide-react';
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
import { useCreateMovement } from '@/hooks/use-movements';
import { useMainWarehouse } from '@/hooks/use-warehouses';

import type { Item } from '@/hooks/use-items';

const SOURCES = [
  { value: 'CONSUMO', label: 'Consumo interno' },
  { value: 'BAJA', label: 'Baja / Pérdida' },
  { value: 'AJUSTE', label: 'Ajuste de inventario' },
] as const;

const schema = z.object({
  quantity: z.coerce.number().min(0.001, 'Debe ser > 0'),
  source: z.enum(['CONSUMO', 'BAJA', 'AJUSTE']),
  notes: z.string().max(500).optional().or(z.literal('')),
});

type FormData = z.infer<typeof schema>;

interface Props {
  item: (Item & { principalStock?: number }) | null;
  onClose: () => void;
  /**
   * Si viene, la salida se aplica a este almacén en lugar del Principal.
   * Útil desde /mi-obra para que el RESIDENTE registre salidas en su almacén de obra.
   */
  warehouseId?: string;
  warehouseName?: string;
}

export function QuickOutgoingDialog({
  item,
  onClose,
  warehouseId,
  warehouseName,
}: Props) {
  const { data: mainWarehouse } = useMainWarehouse();
  const createMut = useCreateMovement();
  const effectiveWarehouseId = warehouseId ?? mainWarehouse?.id;
  const effectiveWarehouseName = warehouseName ?? 'Principal';

  const {
    register,
    handleSubmit,
    setValue,
    reset,
    watch,
    formState: { errors },
  } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { quantity: 1, source: 'CONSUMO', notes: '' },
  });

  useEffect(() => {
    if (item) reset({ quantity: 1, source: 'CONSUMO', notes: '' });
  }, [item, reset]);

  const onSubmit = (data: FormData) => {
    if (!item || !effectiveWarehouseId) return;
    createMut.mutate(
      {
        type: 'SALIDA',
        source: data.source,
        warehouseId: effectiveWarehouseId,
        notes: data.notes || undefined,
        items: [{ itemId: item.id, quantity: data.quantity }],
      },
      {
        onSuccess: () => {
          reset();
          onClose();
        },
      },
    );
  };

  const available = Number(item?.principalStock ?? 0);

  return (
    <Dialog open={!!item} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ArrowUpCircle className="h-5 w-5 text-red-500" /> Registrar salida —{' '}
            <span className="uppercase">{effectiveWarehouseName}</span>
          </DialogTitle>
          <DialogDescription>
            Salida rápida de stock (consumo interno, baja o ajuste).
          </DialogDescription>
        </DialogHeader>

        {item && effectiveWarehouseId && (
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div className="rounded-lg border bg-muted/30 p-3.5 text-sm space-y-1">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Ítem:</span>
                <span className="font-medium">
                  <span className="font-mono text-xs mr-1">{item.code}</span>
                  {item.name}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">
                  Disponible en {effectiveWarehouseName}:
                </span>
                <span
                  className={`font-semibold ${available === 0 ? 'text-destructive' : ''}`}
                >
                  {available.toLocaleString('es-PE', { maximumFractionDigits: 3 })}{' '}
                  {item.unit.abbreviation}
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
                  max={available}
                  {...register('quantity')}
                  autoFocus
                />
                {errors.quantity && (
                  <p className="text-xs text-destructive">{errors.quantity.message}</p>
                )}
              </div>
              <div className="space-y-1.5">
                <Label>Motivo *</Label>
                <Select
                  value={watch('source')}
                  onValueChange={(v) => setValue('source', v as FormData['source'])}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {SOURCES.map((s) => (
                      <SelectItem key={s.value} value={s.value}>
                        {s.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label>Notas</Label>
              <Input
                {...register('notes')}
                placeholder="Opcional: motivo específico, responsable..."
              />
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t">
              <Button type="button" variant="outline" onClick={onClose}>
                Cancelar
              </Button>
              <Button
                type="submit"
                disabled={createMut.isPending || available === 0}
                variant="destructive"
                className="gap-2"
              >
                {createMut.isPending ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" /> Registrando...
                  </>
                ) : (
                  <>
                    <ArrowUpCircle className="h-4 w-4" /> Registrar salida
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
