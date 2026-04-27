'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { ArrowRight, Loader2 } from 'lucide-react';
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
import { useObras } from '@/hooks/use-obras';
import { useCreateTransfer } from '@/hooks/use-transfers';
import { useMainWarehouse, useWarehouses } from '@/hooks/use-warehouses';

import type { Item } from '@/hooks/use-items';

const schema = z.object({
  obraId: z.string().min(1, 'Requerida'),
  warehouseId: z.string().min(1, 'Requerido'),
  quantity: z.coerce.number().min(0.001, 'Debe ser > 0'),
  notes: z.string().max(500).optional().or(z.literal('')),
});

type FormData = z.infer<typeof schema>;

interface Props {
  item: (Item & { principalStock?: number }) | null;
  onClose: () => void;
}

export function QuickTransferDialog({ item, onClose }: Props) {
  const { data: mainWarehouse } = useMainWarehouse();
  const { data: obrasData } = useObras({ pageSize: 100, status: 'ACTIVA' });
  const createMut = useCreateTransfer();

  const {
    register,
    handleSubmit,
    setValue,
    reset,
    watch,
    formState: { errors },
  } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { obraId: '', warehouseId: '', quantity: 1, notes: '' },
  });

  const obraId = watch('obraId');
  const { data: warehousesData } = useWarehouses({
    pageSize: 50,
    type: 'OBRA',
    obraId,
    enabled: !!obraId,
  } as any);

  useEffect(() => {
    if (item) reset({ obraId: '', warehouseId: '', quantity: 1, notes: '' });
  }, [item, reset]);

  // Reset warehouse cuando cambia la obra
  useEffect(() => {
    setValue('warehouseId', '');
  }, [obraId, setValue]);

  const onSubmit = (data: FormData) => {
    if (!item || !mainWarehouse) return;
    createMut.mutate(
      {
        fromWarehouseId: mainWarehouse.id,
        toWarehouseId: data.warehouseId,
        notes: data.notes || undefined,
        items: [{ itemId: item.id, requestedQty: data.quantity }],
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
  const obraWarehouses = warehousesData?.items ?? [];

  return (
    <Dialog open={!!item} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ArrowRight className="h-5 w-5 text-blue-600" /> Transferir a obra
          </DialogTitle>
          <DialogDescription>
            Envía stock del Almacén Principal al almacén de una obra. La transferencia
            queda en estado <strong>EN TRÁNSITO</strong>.
          </DialogDescription>
        </DialogHeader>

        {item && mainWarehouse && (
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
                <span className="text-muted-foreground">Origen:</span>
                <span>{mainWarehouse.name}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Disponible:</span>
                <span
                  className={`font-semibold ${available === 0 ? 'text-destructive' : ''}`}
                >
                  {available.toLocaleString('es-PE', { maximumFractionDigits: 3 })}{' '}
                  {item.unit.abbreviation}
                </span>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label>Obra destino *</Label>
              <Select value={obraId} onValueChange={(v) => setValue('obraId', v)}>
                <SelectTrigger>
                  <SelectValue placeholder="Seleccionar obra activa..." />
                </SelectTrigger>
                <SelectContent>
                  {obrasData?.items.length === 0 ? (
                    <div className="px-2 py-2 text-xs text-muted-foreground">
                      No hay obras activas. Crea una en Maestros → Obras.
                    </div>
                  ) : (
                    obrasData?.items.map((o) => (
                      <SelectItem key={o.id} value={o.id}>
                        [{o.code}] {o.name}
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
              {errors.obraId && (
                <p className="text-xs text-destructive">{errors.obraId.message}</p>
              )}
            </div>

            {obraId && (
              <div className="space-y-1.5">
                <Label>Almacén de obra *</Label>
                {obraWarehouses.length === 0 ? (
                  <p className="text-xs text-amber-600 dark:text-amber-400">
                    Esta obra no tiene almacenes. Crea uno en Maestros → Almacenes.
                  </p>
                ) : (
                  <Select
                    value={watch('warehouseId')}
                    onValueChange={(v) => setValue('warehouseId', v)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Seleccionar almacén..." />
                    </SelectTrigger>
                    <SelectContent>
                      {obraWarehouses.map((w) => (
                        <SelectItem key={w.id} value={w.id}>
                          [{w.code}] {w.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
                {errors.warehouseId && (
                  <p className="text-xs text-destructive">{errors.warehouseId.message}</p>
                )}
              </div>
            )}

            <div className="space-y-1.5">
              <Label>Cantidad a enviar *</Label>
              <Input
                type="number"
                step="0.001"
                min="0.001"
                max={available}
                {...register('quantity')}
              />
              {errors.quantity && (
                <p className="text-xs text-destructive">{errors.quantity.message}</p>
              )}
            </div>

            <div className="space-y-1.5">
              <Label>Notas</Label>
              <Input {...register('notes')} placeholder="Opcional" />
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t">
              <Button type="button" variant="outline" onClick={onClose}>
                Cancelar
              </Button>
              <Button
                type="submit"
                disabled={createMut.isPending || available === 0}
                className="gap-2"
              >
                {createMut.isPending ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" /> Enviando...
                  </>
                ) : (
                  <>
                    <ArrowRight className="h-4 w-4" /> Enviar transferencia
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
