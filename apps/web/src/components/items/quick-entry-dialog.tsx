'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { ArrowDownCircle, Loader2 } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';

import { QuickCreateSupplierDialog } from '@/components/items/quick-create-dialogs';
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
import { SearchCombobox } from '@/components/ui/search-combobox';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useCreateMovement } from '@/hooks/use-movements';
import { useSuppliers, type Supplier } from '@/hooks/use-suppliers';
import { useMainWarehouse } from '@/hooks/use-warehouses';

import type { Item } from '@/hooks/use-items';

const SOURCES = [
  { value: 'COMPRA', label: 'Compra a proveedor' },
  { value: 'DEVOLUCION', label: 'Devolución de obra' },
  { value: 'AJUSTE', label: 'Ajuste de inventario' },
] as const;

const schema = z
  .object({
    quantity: z.coerce.number().min(0.001, 'Debe ser > 0'),
    unitCost: z.coerce.number().min(0).optional().or(z.literal('')),
    source: z.enum(['COMPRA', 'DEVOLUCION', 'AJUSTE']),
    supplierId: z.string().optional(),
    notes: z.string().max(500).optional().or(z.literal('')),
  })
  .refine((d) => d.source !== 'COMPRA' || !!d.supplierId, {
    message: 'Proveedor requerido cuando el motivo es COMPRA',
    path: ['supplierId'],
  });

type FormData = z.infer<typeof schema>;

interface Props {
  item: Item | null;
  onClose: () => void;
}

export function QuickEntryDialog({ item, onClose }: Props) {
  const { data: mainWarehouse } = useMainWarehouse();
  const createMut = useCreateMovement();

  const {
    register,
    handleSubmit,
    setValue,
    reset,
    watch,
    formState: { errors },
  } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { quantity: 1, unitCost: '', source: 'COMPRA', notes: '' },
  });

  useEffect(() => {
    if (item)
      reset({
        quantity: 1,
        unitCost: '',
        source: 'COMPRA',
        supplierId: '',
        notes: '',
      });
  }, [item, reset]);

  const source = watch('source');
  const supplierId = watch('supplierId') ?? '';

  const [supplierSearch, setSupplierSearch] = useState('');
  const [supplierDialogOpen, setSupplierDialogOpen] = useState(false);
  const { data: suppliersData, isFetching: suppliersLoading } = useSuppliers({
    search: supplierSearch || undefined,
    pageSize: 30,
    enabled: source === 'COMPRA',
  });
  const selectedSupplier = useMemo<Supplier | null>(
    () => (suppliersData?.items ?? []).find((s) => s.id === supplierId) ?? null,
    [suppliersData, supplierId],
  );

  const onSubmit = (data: FormData) => {
    if (!item || !mainWarehouse) return;
    createMut.mutate(
      {
        type: 'ENTRADA',
        source: data.source,
        warehouseId: mainWarehouse.id,
        supplierId: data.source === 'COMPRA' ? data.supplierId : undefined,
        notes: data.notes || undefined,
        items: [
          {
            itemId: item.id,
            quantity: data.quantity,
            unitCost: data.unitCost ? Number(data.unitCost) : undefined,
          },
        ],
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
            <ArrowDownCircle className="h-5 w-5 text-green-600" /> Registrar entrada al
            Principal
          </DialogTitle>
          <DialogDescription>
            Ingreso rápido de stock al Almacén Principal (matriz).
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
                <span className="text-muted-foreground">Almacén:</span>
                <span>{mainWarehouse.name}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Unidad:</span>
                <span>{item.unit.name}</span>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Cantidad *</Label>
                <Input
                  type="number"
                  step="0.001"
                  min="0.001"
                  {...register('quantity')}
                  autoFocus
                />
                {errors.quantity && (
                  <p className="text-xs text-destructive">{errors.quantity.message}</p>
                )}
              </div>
              <div className="space-y-1.5">
                <Label>Costo unitario (opcional)</Label>
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  {...register('unitCost')}
                  placeholder="0.00"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label>Motivo *</Label>
              <Select
                value={source}
                onValueChange={(v) => {
                  setValue('source', v as FormData['source']);
                  // Limpia supplier si se cambia de COMPRA a otro motivo.
                  if (v !== 'COMPRA') setValue('supplierId', '');
                }}
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

            {/* Proveedor condicional — solo si motivo = COMPRA */}
            {source === 'COMPRA' && (
              <div className="space-y-1.5">
                <Label>
                  Proveedor <span className="text-destructive">*</span>
                </Label>
                <SearchCombobox<Supplier>
                  value={supplierId}
                  onChange={(id) => setValue('supplierId', id, { shouldValidate: true })}
                  items={suppliersData?.items ?? []}
                  selectedItem={selectedSupplier}
                  isLoading={suppliersLoading}
                  onSearchChange={setSupplierSearch}
                  getId={(s) => s.id}
                  getLabel={(s) => (s.taxId ? `${s.name} — ${s.taxId}` : s.name)}
                  placeholder="Buscar proveedor..."
                  emptyMessage="Sin coincidencias"
                  error={!!errors.supplierId}
                />
                <button
                  type="button"
                  onClick={() => setSupplierDialogOpen(true)}
                  className="text-xs text-accent hover:underline"
                >
                  + Nuevo proveedor
                </button>
                {errors.supplierId && (
                  <p className="text-xs text-destructive">{errors.supplierId.message}</p>
                )}
              </div>
            )}

            <div className="space-y-1.5">
              <Label>Notas</Label>
              <Input
                {...register('notes')}
                placeholder="Opcional: nº factura, guía, etc."
              />
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t">
              <Button type="button" variant="outline" onClick={onClose}>
                Cancelar
              </Button>
              <Button type="submit" disabled={createMut.isPending} className="gap-2">
                {createMut.isPending ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" /> Registrando...
                  </>
                ) : (
                  <>
                    <ArrowDownCircle className="h-4 w-4" /> Registrar entrada
                  </>
                )}
              </Button>
            </div>
          </form>
        )}
      </DialogContent>

      <QuickCreateSupplierDialog
        open={supplierDialogOpen}
        onClose={() => setSupplierDialogOpen(false)}
        onCreated={(id) => setValue('supplierId', id, { shouldValidate: true })}
      />
    </Dialog>
  );
}
