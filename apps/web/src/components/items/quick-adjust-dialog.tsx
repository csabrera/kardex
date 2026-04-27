'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { Loader2, SlidersHorizontal } from 'lucide-react';
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
import { useCreateMovement } from '@/hooks/use-movements';
import { useMainWarehouse } from '@/hooks/use-warehouses';

import type { Item } from '@/hooks/use-items';

const schema = z.object({
  quantity: z.coerce.number().min(0, 'Debe ser >= 0'),
  notes: z.string().min(3, 'Explica brevemente el motivo del ajuste').max(500),
});

type FormData = z.infer<typeof schema>;

interface Props {
  item: (Item & { principalStock?: number }) | null;
  onClose: () => void;
  /**
   * Si viene, el ajuste se aplica a este almacén en lugar del Principal.
   * Útil desde /mi-obra para que el RESIDENTE ajuste su almacén de obra.
   */
  warehouseId?: string;
  warehouseName?: string;
}

/**
 * Ajuste de inventario: reemplaza la cantidad actual por la ingresada.
 * Se registra como movimiento AJUSTE (no suma ni resta — establece un valor absoluto).
 */
export function QuickAdjustDialog({ item, onClose, warehouseId, warehouseName }: Props) {
  const { data: mainWarehouse } = useMainWarehouse();
  const createMut = useCreateMovement();
  const effectiveWarehouseId = warehouseId ?? mainWarehouse?.id;
  const effectiveWarehouseName = warehouseName ?? 'Principal';

  const {
    register,
    handleSubmit,
    reset,
    watch,
    formState: { errors },
  } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { quantity: 0, notes: '' },
  });

  useEffect(() => {
    if (item) {
      reset({ quantity: Number(item.principalStock ?? 0), notes: '' });
    }
  }, [item, reset]);

  const current = Number(item?.principalStock ?? 0);
  const proposed = Number(watch('quantity') ?? 0);
  const delta = proposed - current;

  const onSubmit = (data: FormData) => {
    if (!item || !effectiveWarehouseId) return;
    createMut.mutate(
      {
        type: 'AJUSTE',
        source: 'AJUSTE',
        warehouseId: effectiveWarehouseId,
        notes: data.notes,
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

  return (
    <Dialog open={!!item} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <SlidersHorizontal className="h-5 w-5 text-amber-500" /> Ajustar stock —{' '}
            <span className="uppercase">{effectiveWarehouseName}</span>
          </DialogTitle>
          <DialogDescription>
            El ajuste reemplaza el stock actual por la cantidad ingresada. Úsalo solo para
            correcciones por conteo físico o errores históricos.
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
                <span className="text-muted-foreground">Stock actual:</span>
                <span className="font-semibold tabular-nums">
                  {current.toLocaleString('es-PE', { maximumFractionDigits: 3 })}{' '}
                  {item.unit.abbreviation}
                </span>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label>Nueva cantidad *</Label>
              <Input
                type="number"
                step="0.001"
                min="0"
                {...register('quantity')}
                autoFocus
              />
              {errors.quantity && (
                <p className="text-xs text-destructive">{errors.quantity.message}</p>
              )}
              {delta !== 0 && !errors.quantity && (
                <p
                  className={`text-xs tabular-nums ${
                    delta > 0
                      ? 'text-green-600 dark:text-green-400'
                      : 'text-red-600 dark:text-red-400'
                  }`}
                >
                  {delta > 0 ? '+' : ''}
                  {delta.toLocaleString('es-PE', { maximumFractionDigits: 3 })}{' '}
                  {item.unit.abbreviation} respecto al actual
                </p>
              )}
            </div>

            <div className="space-y-1.5">
              <Label>Motivo del ajuste *</Label>
              <Input
                {...register('notes')}
                placeholder="Conteo físico, error de carga, merma, etc."
              />
              {errors.notes && (
                <p className="text-xs text-destructive">{errors.notes.message}</p>
              )}
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t">
              <Button type="button" variant="outline" onClick={onClose}>
                Cancelar
              </Button>
              <Button type="submit" disabled={createMut.isPending} className="gap-2">
                {createMut.isPending ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" /> Ajustando...
                  </>
                ) : (
                  <>
                    <SlidersHorizontal className="h-4 w-4" /> Ajustar stock
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
