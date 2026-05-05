'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { AlertCircle, Building, Shield } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';
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
import { SearchCombobox } from '@/components/ui/search-combobox';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useAssignEPP } from '@/hooks/use-epp';
import { useItems, type Item } from '@/hooks/use-items';
import { useObra, useObras } from '@/hooks/use-obras';
import { useStock } from '@/hooks/use-stock';
import { useWarehouses } from '@/hooks/use-warehouses';
import { useWorkers } from '@/hooks/use-workers';
import { useAuthStore } from '@/stores/use-auth-store';

const schema = z.object({
  obraId: z.string().min(1, 'Requerida'),
  warehouseId: z.string().min(1, 'Requerido'),
  workerId: z.string().min(1, 'Requerido'),
  itemId: z.string().min(1, 'Requerido'),
  quantity: z.coerce.number().min(0.001, 'Debe ser mayor a 0'),
  notes: z.string().max(500).optional(),
  overrideReason: z.string().max(500).optional(),
});

type FormData = z.infer<typeof schema>;

interface Props {
  open: boolean;
  onClose: () => void;
  /** Si viene, fija la obra (no se muestra dropdown de obras) */
  lockedObraId?: string;
  /** Pre-selecciona el almacén (editable si hay varios) */
  defaultWarehouseId?: string;
}

export function NewEPPAssignmentDialog({
  open,
  onClose,
  lockedObraId,
  defaultWarehouseId,
}: Props) {
  const user = useAuthStore((s) => s.user);
  const isResidente = user?.role?.name === 'RESIDENTE';
  const isAdmin = user?.role?.name === 'ADMIN';
  const needsOverride = isAdmin;

  const { data: obrasData } = useObras({
    pageSize: 100,
    status: 'ACTIVA',
    responsibleUserId: isResidente ? user?.id : undefined,
    enabled: !lockedObraId,
  });
  const activeObras = obrasData?.items ?? [];

  const { data: lockedObra } = useObra(lockedObraId ?? null);

  const { register, handleSubmit, setValue, watch, reset, setError, formState } =
    useForm<FormData>({
      resolver: zodResolver(schema),
      mode: 'onBlur',
      defaultValues: {
        obraId: lockedObraId ?? '',
        warehouseId: defaultWarehouseId ?? '',
        workerId: '',
        itemId: '',
        quantity: 1,
        notes: '',
        overrideReason: '',
      },
    });

  const { errors, isSubmitted, isValid } = formState;

  const obraId = watch('obraId');
  const warehouseId = watch('warehouseId');
  const workerId = watch('workerId');
  const itemId = watch('itemId');

  useEffect(() => {
    if (!open) return;
    if (lockedObraId) setValue('obraId', lockedObraId);
    if (defaultWarehouseId) setValue('warehouseId', defaultWarehouseId);
  }, [open, lockedObraId, defaultWarehouseId, setValue]);

  const { data: warehousesData } = useWarehouses({
    pageSize: 50,
    type: 'OBRA',
    obraId,
    enabled: !!obraId,
  } as any);
  const obraWarehouses = warehousesData?.items ?? [];

  const { data: workersData } = useWorkers({
    pageSize: 100,
    obraId,
    active: true,
    enabled: !!obraId,
  });
  const obraWorkers = workersData?.items ?? [];

  const [itemSearch, setItemSearch] = useState('');
  const { data: itemsData, isFetching: itemsLoading } = useItems({
    search: itemSearch || undefined,
    type: 'ASIGNACION',
    pageSize: 30,
  });
  const eppItems: Item[] = useMemo(() => itemsData?.items ?? [], [itemsData]);
  const selectedItem = eppItems.find((i) => i.id === itemId);

  const mutation = useAssignEPP();

  useEffect(() => {
    setValue('warehouseId', defaultWarehouseId ?? '');
    setValue('workerId', '');
    setValue('itemId', '');
    setItemSearch('');
  }, [obraId, defaultWarehouseId, setValue]);

  const { data: itemStock } = useStock({
    itemId: itemId || undefined,
    warehouseId: warehouseId || undefined,
    enabled: !!(itemId && warehouseId),
  } as any);
  const availableQty = useMemo(() => {
    if (!itemId || !warehouseId) return null;
    const entry = (itemStock ?? []).find(
      (s) => s.itemId === itemId && s.warehouseId === warehouseId,
    );
    return entry ? Number(entry.quantity) : 0;
  }, [itemStock, itemId, warehouseId]);

  const onSubmit = (data: FormData) => {
    if (needsOverride) {
      const trimmed = data.overrideReason?.trim() ?? '';
      if (trimmed.length < 5) {
        setError('overrideReason', {
          message: 'Requerido como administrador (mínimo 5 caracteres)',
        });
        return;
      }
    }
    mutation.mutate(
      {
        workerId: data.workerId,
        itemId: data.itemId,
        warehouseId: data.warehouseId,
        quantity: data.quantity,
        notes: data.notes?.trim() || undefined,
        overrideReason: needsOverride ? data.overrideReason?.trim() : undefined,
      },
      {
        onSuccess: () => {
          resetForm();
          onClose();
        },
      },
    );
  };

  const resetForm = () => {
    reset({
      obraId: lockedObraId ?? '',
      warehouseId: defaultWarehouseId ?? '',
      workerId: '',
      itemId: '',
      quantity: 1,
      notes: '',
      overrideReason: '',
    });
    setItemSearch('');
  };

  const handleClose = () => {
    resetForm();
    onClose();
  };

  const noActiveObras = !lockedObraId && activeObras.length === 0;

  return (
    <Dialog open={open} onOpenChange={(v) => !v && handleClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5 text-accent" /> Nueva asignación de EPP
          </DialogTitle>
          <DialogDescription>
            El EPP se entrega de forma individual y <strong>descuenta el stock</strong>{' '}
            del almacén de obra. A diferencia de los préstamos, no se devuelve.
          </DialogDescription>
        </DialogHeader>

        {noActiveObras && (
          <div className="rounded-md border border-amber-300 bg-amber-50 dark:bg-amber-950/30 p-3 text-xs">
            <p className="font-medium text-amber-900 dark:text-amber-200 flex items-center gap-1.5">
              <AlertCircle className="h-3.5 w-3.5" /> No hay obras activas
            </p>
            <p className="text-amber-800 dark:text-amber-200/80 mt-1">
              Crea una obra con estado ACTIVA antes de entregar EPP.
            </p>
          </div>
        )}

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-3">
          {/* 1. Obra */}
          <div className="space-y-1.5">
            <Label>
              Obra <span className="text-destructive">*</span>
            </Label>
            {lockedObraId ? (
              <div className="flex items-center gap-3 rounded-md border bg-muted/30 p-2.5">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-accent/10 text-accent ring-1 ring-accent/20">
                  <Building className="h-4 w-4" />
                </div>
                <div className="flex-1 min-w-0">
                  {lockedObra ? (
                    <>
                      <p className="text-sm font-medium truncate">{lockedObra.name}</p>
                      <p className="text-[11px] font-mono text-muted-foreground">
                        {lockedObra.code}
                      </p>
                    </>
                  ) : (
                    <p className="text-xs text-muted-foreground">Cargando obra...</p>
                  )}
                </div>
                <Badge variant="outline" className="text-[10px]">
                  Fijada
                </Badge>
              </div>
            ) : (
              <Select
                value={obraId}
                onValueChange={(v) =>
                  setValue('obraId', v, { shouldValidate: isSubmitted })
                }
                disabled={noActiveObras}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Seleccionar obra activa..." />
                </SelectTrigger>
                <SelectContent>
                  {activeObras.map((o) => (
                    <SelectItem key={o.id} value={o.id}>
                      [{o.code}] {o.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
            <p className="text-[11px] text-muted-foreground">
              Obra constructora donde trabaja el empleado
            </p>
            {errors.obraId && (
              <p className="text-xs text-destructive">{errors.obraId.message}</p>
            )}
          </div>

          {obraId && (
            <>
              {/* 2. Almacén */}
              <div className="space-y-1.5">
                <Label>
                  Almacén de obra <span className="text-destructive">*</span>
                </Label>
                {obraWarehouses.length === 0 ? (
                  <div className="rounded-md border border-amber-300 bg-amber-50/70 dark:bg-amber-950/20 p-2 text-xs">
                    <p className="text-amber-800 dark:text-amber-200">
                      Esta obra no tiene almacenes tipo OBRA.
                    </p>
                  </div>
                ) : (
                  <Select
                    value={warehouseId}
                    onValueChange={(v) =>
                      setValue('warehouseId', v, { shouldValidate: isSubmitted })
                    }
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
                <p className="text-[11px] text-muted-foreground">
                  Almacén OBRA del que se descuenta el EPP
                </p>
                {errors.warehouseId && (
                  <p className="text-xs text-destructive">{errors.warehouseId.message}</p>
                )}
              </div>

              {/* 3. Empleado */}
              <div className="space-y-1.5">
                <Label>
                  Empleado <span className="text-destructive">*</span>
                </Label>
                {obraWorkers.length === 0 ? (
                  <div className="rounded-md border border-amber-300 bg-amber-50/70 dark:bg-amber-950/20 p-2 text-xs">
                    <p className="text-amber-800 dark:text-amber-200">
                      Esta obra no tiene empleados activos. Agrega empleados en{' '}
                      <a href="/dashboard/empleados" className="underline">
                        Maestros → Empleados
                      </a>
                      .
                    </p>
                  </div>
                ) : (
                  <Select
                    value={workerId}
                    onValueChange={(v) =>
                      setValue('workerId', v, { shouldValidate: isSubmitted })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue
                        placeholder={`Seleccionar empleado... (${obraWorkers.length})`}
                      />
                    </SelectTrigger>
                    <SelectContent>
                      {obraWorkers.map((w) => (
                        <SelectItem key={w.id} value={w.id}>
                          {w.firstName} {w.lastName} · {w.specialty.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
                <p className="text-[11px] text-muted-foreground">
                  Empleado que recibe y usará el EPP
                </p>
                {errors.workerId && (
                  <p className="text-xs text-destructive">{errors.workerId.message}</p>
                )}
              </div>

              {/* 4. EPP */}
              <div className="space-y-1.5">
                <Label>
                  EPP a entregar <span className="text-destructive">*</span>
                </Label>
                <SearchCombobox<Item>
                  value={itemId}
                  onChange={(id) =>
                    setValue('itemId', id, { shouldValidate: isSubmitted })
                  }
                  items={eppItems}
                  selectedItem={selectedItem ?? null}
                  isLoading={itemsLoading}
                  onSearchChange={setItemSearch}
                  getId={(i) => i.id}
                  getLabel={(i) => `[${i.code}] ${i.name}`}
                  renderItem={(i) => (
                    <>
                      <span className="font-mono text-xs text-muted-foreground mr-2">
                        {i.code}
                      </span>
                      {i.name}
                      <span className="ml-1 text-[10px] text-muted-foreground">
                        ({i.unit.abbreviation})
                      </span>
                    </>
                  )}
                  placeholder="Buscar EPP por código o nombre..."
                  emptyMessage="No se encontraron EPP que coincidan."
                  error={!!errors.itemId}
                />
                <p className="text-[11px] text-muted-foreground">
                  Solo ítems de tipo Asignación (casco, arnés, guantes, lentes, etc.)
                </p>
                {errors.itemId && (
                  <p className="text-xs text-destructive">{errors.itemId.message}</p>
                )}
                {itemId && warehouseId && availableQty !== null && (
                  <p
                    className={`text-[11px] tabular-nums ${
                      availableQty === 0 ? 'text-destructive' : 'text-muted-foreground'
                    }`}
                  >
                    Stock disponible:{' '}
                    <span className="font-semibold">
                      {availableQty.toLocaleString('es-PE', { maximumFractionDigits: 3 })}
                    </span>
                    {selectedItem && (
                      <span className="ml-1">{selectedItem.unit.abbreviation}</span>
                    )}
                    {availableQty === 0 && (
                      <span className="ml-2">— Sin stock en este almacén</span>
                    )}
                  </p>
                )}
              </div>

              {/* 5. Cantidad + notas */}
              <div className="space-y-1.5">
                <Label>
                  Cantidad <span className="text-destructive">*</span>
                </Label>
                <input
                  type="number"
                  step="0.001"
                  min="0.001"
                  className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
                  {...register('quantity')}
                />
                <p className="text-[11px] text-muted-foreground">
                  Unidades a entregar — descuenta del stock del almacén
                </p>
                {errors.quantity && (
                  <p className="text-xs text-destructive">{errors.quantity.message}</p>
                )}
              </div>

              <div className="space-y-1.5">
                <Label>Observaciones</Label>
                <Textarea
                  {...register('notes')}
                  onChange={(e) =>
                    setValue('notes', e.target.value.toUpperCase(), {
                      shouldValidate: isSubmitted,
                    })
                  }
                  placeholder="OPCIONAL · TALLA, CONDICIÓN DE ENTREGA, ACCESORIOS..."
                  rows={2}
                  className="text-sm uppercase placeholder:normal-case placeholder:opacity-60"
                />
                <p className="text-[11px] text-muted-foreground">
                  Opcional · talla, condición al momento de la entrega, etc.
                </p>
              </div>

              {needsOverride && (
                <div className="rounded-md border border-amber-300 bg-amber-50/70 dark:bg-amber-950/30 p-3 space-y-2">
                  <div className="flex items-start gap-2">
                    <AlertCircle className="h-4 w-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
                    <div className="text-xs text-amber-900 dark:text-amber-100 space-y-1">
                      <p className="font-medium">
                        Estás registrando esta entrega como administrador
                      </p>
                      <p className="text-amber-800 dark:text-amber-200/90">
                        El flujo normal lo realiza el residente o almacenero. Como
                        excepción, debes dejar constancia del motivo (queda en auditoría).
                      </p>
                    </div>
                  </div>
                  <div className="space-y-1.5 pl-6">
                    <Label htmlFor="overrideReason" className="text-xs">
                      Motivo de excepción <span className="text-destructive">*</span>
                    </Label>
                    <Textarea
                      id="overrideReason"
                      {...register('overrideReason')}
                      onChange={(e) =>
                        setValue('overrideReason', e.target.value.toUpperCase(), {
                          shouldValidate: isSubmitted,
                        })
                      }
                      placeholder="EJ: RESIDENTE AUSENTE — ENTREGA URGENTE ALBAÑIL GARCÍA"
                      rows={2}
                      className="text-sm uppercase placeholder:normal-case placeholder:opacity-60"
                    />
                    {errors.overrideReason && (
                      <p className="text-xs text-destructive">
                        {errors.overrideReason.message}
                      </p>
                    )}
                  </div>
                </div>
              )}
            </>
          )}

          <div className="flex justify-end gap-2 pt-2 border-t">
            <Button type="button" variant="outline" onClick={handleClose}>
              Cancelar
            </Button>
            <Button
              type="submit"
              disabled={!obraId || mutation.isPending || (isSubmitted && !isValid)}
              className="gap-2"
            >
              <Shield className="h-4 w-4" />
              {mutation.isPending ? 'Registrando...' : 'Registrar entrega'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
