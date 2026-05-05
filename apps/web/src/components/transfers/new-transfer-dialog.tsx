'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { AlertCircle, ArrowRight, Minus, Plus, Star } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { useFieldArray, useForm } from 'react-hook-form';
import { z } from 'zod';

import { Badge } from '@/components/ui/badge';
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
import { SearchCombobox } from '@/components/ui/search-combobox';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useDebounce } from '@/hooks/use-debounce';
import { useItems, type Item } from '@/hooks/use-items';
import { useStock } from '@/hooks/use-stock';
import { useCreateTransfer } from '@/hooks/use-transfers';
import { useMainWarehouse, useWarehouses } from '@/hooks/use-warehouses';

const schema = z.object({
  toWarehouseId: z.string().min(1, 'Requerido'),
  notes: z.string().max(500).optional(),
  items: z
    .array(
      z.object({
        itemId: z.string().min(1, 'Selecciona un ítem'),
        requestedQty: z.coerce.number().min(0.001, 'Debe ser > 0'),
      }),
    )
    .min(1, 'Agrega al menos un ítem'),
});

type FormData = z.infer<typeof schema>;

interface Props {
  open: boolean;
  onClose: () => void;
}

export function NewTransferDialog({ open, onClose }: Props) {
  const main = useMainWarehouse();
  const fromWarehouseId = main.data?.id ?? '';

  // Almacenes destino: solo OBRA, activos.
  const { data: warehousesData } = useWarehouses({ pageSize: 100, type: 'OBRA' });
  const obraWarehouses = warehousesData?.items ?? [];

  const mutation = useCreateTransfer();

  const { register, handleSubmit, setValue, watch, control, reset, setError, formState } =
    useForm<FormData>({
      resolver: zodResolver(schema),
      mode: 'onBlur',
      defaultValues: {
        toWarehouseId: '',
        notes: '',
        items: [{ itemId: '', requestedQty: 0 }],
      },
    });

  const { errors, isSubmitted, isValid } = formState;

  const { fields, append, remove } = useFieldArray({ control, name: 'items' });

  const watchedItems = watch('items');
  const watchedToWarehouseId = watch('toWarehouseId');

  // Reset al cerrar
  useEffect(() => {
    if (!open) return;
    reset({
      toWarehouseId: '',
      notes: '',
      items: [{ itemId: '', requestedQty: 0 }],
    });
  }, [open, reset]);

  const onSubmit = (data: FormData) => {
    if (!fromWarehouseId) return;

    // Validación cruzada cantidad vs stock disponible (cliente).
    // El backend igual lo valida, pero damos feedback temprano.
    let hasOverflow = false;
    data.items.forEach((it, idx) => {
      const stock = stockMap.get(it.itemId);
      if (stock != null && Number(it.requestedQty) > stock) {
        setError(`items.${idx}.requestedQty`, {
          message: `Excede stock disponible (${stock})`,
        });
        hasOverflow = true;
      }
    });
    if (hasOverflow) return;

    mutation.mutate(
      { ...data, fromWarehouseId },
      {
        onSuccess: () => {
          onClose();
        },
      },
    );
  };

  // Cargar stock del Principal para todos los ítems seleccionados (validación + hint visual)
  const { data: principalStock } = useStock({
    warehouseId: fromWarehouseId,
    enabled: !!fromWarehouseId,
  });

  const stockMap = useMemo(() => {
    const m = new Map<string, number>();
    (principalStock ?? []).forEach((s) => {
      if (s.itemId) m.set(s.itemId, Number(s.quantity));
    });
    return m;
  }, [principalStock]);

  const totalRequested = (watchedItems ?? []).reduce(
    (acc, i) => acc + (Number(i.requestedQty) || 0),
    0,
  );

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ArrowRight className="h-5 w-5 text-accent" /> Nueva transferencia
          </DialogTitle>
          <DialogDescription>
            Traslado de stock del Almacén Principal a un almacén de obra. La cantidad sale
            del Principal al confirmar y se acredita al destino cuando el residente
            recibe.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          {/* Origen — locked al Principal */}
          <div className="space-y-1.5">
            <Label>Origen</Label>
            <div className="flex items-center gap-3 rounded-md border bg-muted/30 p-2.5">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-accent/10 text-accent ring-1 ring-accent/20">
                <Star className="h-4 w-4 fill-current" />
              </div>
              <div className="flex-1 min-w-0">
                {main.data ? (
                  <>
                    <p className="text-sm font-medium truncate">{main.data.name}</p>
                    <p className="text-[11px] font-mono text-muted-foreground">
                      {main.data.code}
                    </p>
                  </>
                ) : (
                  <p className="text-xs text-muted-foreground">Cargando...</p>
                )}
              </div>
              <Badge variant="outline" className="text-[10px]">
                Principal
              </Badge>
            </div>
            <p className="text-[11px] text-muted-foreground">
              Las transferencias siempre salen del Almacén Principal.
            </p>
          </div>

          {/* Destino — solo obras */}
          <div className="space-y-1.5">
            <Label>
              Destino <span className="text-destructive">*</span>
            </Label>
            {obraWarehouses.length === 0 ? (
              <div className="rounded-md border border-amber-300 bg-amber-50 dark:bg-amber-950/30 p-3 text-xs">
                <p className="font-medium text-amber-900 dark:text-amber-200 flex items-center gap-1.5">
                  <AlertCircle className="h-3.5 w-3.5" />
                  No hay almacenes de obra activos
                </p>
                <p className="text-amber-800 dark:text-amber-200/80 mt-1">
                  Crea un almacén tipo OBRA en{' '}
                  <a href="/dashboard/almacenes" className="underline font-medium">
                    Maestros → Almacenes
                  </a>
                  .
                </p>
              </div>
            ) : (
              <Select
                value={watchedToWarehouseId}
                onValueChange={(v) =>
                  setValue('toWarehouseId', v, { shouldValidate: isSubmitted })
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Seleccionar almacén de obra..." />
                </SelectTrigger>
                <SelectContent>
                  {obraWarehouses.map((w) => (
                    <SelectItem key={w.id} value={w.id}>
                      [{w.code}] {w.name}
                      {w.obra?.name ? ` · ${w.obra.name}` : ''}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
            <p className="text-[11px] text-muted-foreground">
              Almacén de obra que recibirá el stock transferido
            </p>
            {errors.toWarehouseId && (
              <p className="text-xs text-destructive">{errors.toWarehouseId.message}</p>
            )}
          </div>

          {/* Ítems */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>
                Ítems a transferir <span className="text-destructive">*</span>
              </Label>
              <span className="text-[11px] text-muted-foreground tabular-nums">
                {fields.length} {fields.length === 1 ? 'ítem' : 'ítems'} ·{' '}
                {totalRequested.toLocaleString('es-PE', { maximumFractionDigits: 3 })}{' '}
                unid. totales
              </span>
            </div>

            <div className="space-y-3">
              {fields.map((field, index) => (
                <ItemRow
                  key={field.id}
                  index={index}
                  setValue={setValue}
                  watch={watch}
                  errors={errors}
                  register={register}
                  stockMap={stockMap}
                  isSubmitted={isSubmitted}
                  onRemove={() => fields.length > 1 && remove(index)}
                  canRemove={fields.length > 1}
                />
              ))}
            </div>

            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => append({ itemId: '', requestedQty: 0 })}
              className="gap-1"
            >
              <Plus className="h-3.5 w-3.5" /> Agregar ítem
            </Button>
          </div>

          {/* Notas */}
          <div className="space-y-1.5">
            <Label>Observaciones</Label>
            <Textarea
              {...register('notes')}
              onChange={(e) =>
                setValue('notes', e.target.value.toUpperCase(), {
                  shouldValidate: isSubmitted,
                })
              }
              placeholder="OPCIONAL · URGENCIA, INSTRUCCIONES DE ENTREGA, REFERENCIAS..."
              rows={2}
              className="text-sm uppercase placeholder:normal-case placeholder:opacity-60"
            />
            <p className="text-[11px] text-muted-foreground">
              Opcional · instrucciones para el residente al recibir
            </p>
          </div>

          {/* Footer */}
          <div className="flex justify-end gap-2 pt-2 border-t">
            <Button type="button" variant="outline" onClick={onClose}>
              Cancelar
            </Button>
            <Button
              type="submit"
              disabled={
                mutation.isPending ||
                !fromWarehouseId ||
                obraWarehouses.length === 0 ||
                (isSubmitted && !isValid)
              }
              className="gap-2"
            >
              <ArrowRight className="h-4 w-4" />
              {mutation.isPending ? 'Enviando...' : 'Crear transferencia'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ─── Sub-componente: fila de ítem con SearchCombobox + stock visible ─────────

function ItemRow({
  index,
  setValue,
  watch,
  errors,
  register,
  stockMap,
  isSubmitted,
  onRemove,
  canRemove,
}: {
  index: number;
  setValue: any;
  watch: any;
  errors: any;
  register: any;
  stockMap: Map<string, number>;
  isSubmitted: boolean;
  onRemove: () => void;
  canRemove: boolean;
}) {
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebounce(search, 300);

  const { data: itemsData, isFetching: itemsLoading } = useItems({
    search: debouncedSearch || undefined,
    pageSize: 30,
  });

  const itemId: string = watch(`items.${index}.itemId`) ?? '';
  const requestedQty = Number(watch(`items.${index}.requestedQty`)) || 0;

  const allItems = itemsData?.items ?? [];
  const selectedItem = allItems.find((i) => i.id === itemId) ?? null;

  const availableStock = itemId ? (stockMap.get(itemId) ?? 0) : null;
  const overflow = availableStock !== null && requestedQty > availableStock;
  const noStock = availableStock === 0;

  const itemError = errors?.items?.[index];

  return (
    <div className="rounded-md border bg-background p-3 space-y-2">
      <div className="flex gap-2 items-start">
        <div className="flex-1 min-w-0">
          <SearchCombobox<Item>
            value={itemId}
            onChange={(id) => {
              setValue(`items.${index}.itemId`, id, { shouldValidate: isSubmitted });
            }}
            items={allItems}
            selectedItem={selectedItem}
            isLoading={itemsLoading}
            onSearchChange={setSearch}
            getId={(i) => i.id}
            getLabel={(i) => i.name}
            renderItem={(i) => (
              <>
                <span>{i.name}</span>
                <span className="ml-1 text-[10px] text-muted-foreground">
                  ({i.unit.abbreviation})
                </span>
              </>
            )}
            placeholder="Buscar ítem..."
            emptyMessage="Sin coincidencias"
            error={!!itemError?.itemId}
          />
          {itemError?.itemId && (
            <p className="text-xs text-destructive mt-0.5">{itemError.itemId.message}</p>
          )}
        </div>
        <div className="w-32 shrink-0">
          <input
            type="number"
            step="0.001"
            min="0.001"
            placeholder="Cantidad"
            {...register(`items.${index}.requestedQty`)}
            className={`flex h-9 w-full rounded-md border bg-transparent px-3 py-1 text-sm shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 ${overflow ? 'border-destructive' : 'border-input'}`}
          />
          {itemError?.requestedQty && (
            <p className="text-xs text-destructive mt-0.5">
              {itemError.requestedQty.message}
            </p>
          )}
        </div>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={onRemove}
          disabled={!canRemove}
          aria-label="Quitar ítem"
        >
          <Minus className="h-3.5 w-3.5 text-destructive" />
        </Button>
      </div>

      {/* Hint de stock disponible */}
      {itemId && availableStock !== null && (
        <p
          className={`text-[11px] tabular-nums pl-1 ${
            noStock || overflow ? 'text-destructive font-medium' : 'text-muted-foreground'
          }`}
        >
          {noStock ? (
            <>Sin stock disponible en el Principal</>
          ) : overflow ? (
            <>
              Solo hay{' '}
              <span className="font-semibold">
                {availableStock.toLocaleString('es-PE', { maximumFractionDigits: 3 })}
              </span>
              {selectedItem ? ` ${selectedItem.unit.abbreviation}` : ''} disponibles —
              reduce la cantidad
            </>
          ) : (
            <>
              Stock disponible en el Principal:{' '}
              <span className="font-semibold text-foreground">
                {availableStock.toLocaleString('es-PE', { maximumFractionDigits: 3 })}
              </span>
              {selectedItem ? ` ${selectedItem.unit.abbreviation}` : ''}
            </>
          )}
        </p>
      )}
    </div>
  );
}
