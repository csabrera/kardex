'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { AlertCircle, ArrowRight, Building, Wrench } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { z } from 'zod';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { DatePicker } from '@/components/ui/date-picker';
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
import { useItems, type Item } from '@/hooks/use-items';
import { useObra, useObras } from '@/hooks/use-obras';
import { useStock } from '@/hooks/use-stock';
import { useCreateToolLoan } from '@/hooks/use-tool-loans';
import { useWarehouses } from '@/hooks/use-warehouses';
import { useWorkStations } from '@/hooks/use-work-stations';
import { useWorkers } from '@/hooks/use-workers';
import { useAuthStore } from '@/stores/use-auth-store';

function defaultReturnDate() {
  return new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10);
}

const schema = z.object({
  obraId: z.string().min(1, 'Requerida'),
  warehouseId: z.string().min(1, 'Requerido'),
  workStationId: z.string().min(1, 'Requerida'),
  borrowerWorkerId: z.string().min(1, 'Requerido'),
  itemId: z.string().min(1, 'Requerido'),
  quantity: z.coerce.number().min(0.001, 'Debe ser mayor a 0'),
  expectedReturnAt: z
    .string()
    .min(1, 'Requerida')
    .refine(
      (v) => {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const [y, m, d] = v.split('-').map(Number) as [number, number, number];
        return new Date(y, m - 1, d) >= today;
      },
      { message: 'La fecha de devolución no puede ser en el pasado' },
    ),
  borrowerNotes: z.string().max(500).optional(),
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
  /** Si viene, fija la herramienta (no se muestra combobox) */
  defaultItem?: {
    id: string;
    name: string;
    code: string;
    unit?: { abbreviation: string };
  };
}

export function NewLoanDialog({
  open,
  onClose,
  lockedObraId,
  defaultWarehouseId,
  defaultItem,
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

  const { control, register, handleSubmit, setValue, watch, reset, setError, formState } =
    useForm<FormData>({
      resolver: zodResolver(schema),
      mode: 'onBlur',
      defaultValues: {
        obraId: lockedObraId ?? '',
        warehouseId: defaultWarehouseId ?? '',
        workStationId: '',
        borrowerWorkerId: '',
        itemId: '',
        quantity: 1,
        expectedReturnAt: defaultReturnDate(),
        borrowerNotes: '',
        overrideReason: '',
      },
    });

  const { errors, isSubmitted, isValid } = formState;

  const obraId = watch('obraId');
  const warehouseId = watch('warehouseId');
  const itemId = watch('itemId');

  useEffect(() => {
    if (!open) return;
    if (lockedObraId) setValue('obraId', lockedObraId);
    if (defaultWarehouseId) setValue('warehouseId', defaultWarehouseId);
    if (defaultItem) setValue('itemId', defaultItem.id);
  }, [open, lockedObraId, defaultWarehouseId, defaultItem, setValue]);

  const { data: warehousesData } = useWarehouses({
    pageSize: 50,
    type: 'OBRA',
    obraId,
    enabled: !!obraId,
  } as any);
  const obraWarehouses = warehousesData?.items ?? [];

  const { data: stations } = useWorkStations({ obraId, enabled: !!obraId });

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
    pageSize: 30,
  });
  const filteredItems: Item[] = useMemo(
    () => (itemsData?.items ?? []).filter((i) => i.type === 'PRESTAMO'),
    [itemsData],
  );
  const selectedItem = (itemsData?.items ?? []).find((i) => i.id === itemId);

  const mutation = useCreateToolLoan();

  useEffect(() => {
    setValue('warehouseId', defaultWarehouseId ?? '');
    setValue('workStationId', '');
    setValue('borrowerWorkerId', '');
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
    if (!entry) return 0;
    const avail = (entry as any).availableQty;
    return avail !== undefined ? Number(avail) : Number(entry.quantity);
  }, [itemStock, itemId, warehouseId]);

  const totalQty = useMemo(() => {
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
    // Convierte fecha (YYYY-MM-DD) al fin del día en hora local → ISO UTC.
    const returnDate = new Date(`${data.expectedReturnAt}T23:59:59`).toISOString();
    mutation.mutate(
      {
        itemId: data.itemId,
        warehouseId: data.warehouseId,
        workStationId: data.workStationId,
        borrowerWorkerId: data.borrowerWorkerId,
        quantity: data.quantity,
        expectedReturnAt: returnDate,
        borrowerNotes: data.borrowerNotes?.trim() || undefined,
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
      workStationId: '',
      borrowerWorkerId: '',
      itemId: defaultItem?.id ?? '',
      quantity: 1,
      expectedReturnAt: defaultReturnDate(),
      borrowerNotes: '',
      overrideReason: '',
    });
    if (!defaultItem) setItemSearch('');
  };

  const handleClose = () => {
    resetForm();
    onClose();
  };

  const noActiveObras = !lockedObraId && activeObras.length === 0;
  const today = useMemo(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  }, []);

  return (
    <Dialog open={open} onOpenChange={(v) => !v && handleClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Nuevo préstamo de herramienta</DialogTitle>
          <DialogDescription>
            El stock <strong>no se descuenta</strong> — el préstamo solo registra que la
            herramienta está en uso. Al devolver, el sistema la devuelve al pool
            disponible.
          </DialogDescription>
        </DialogHeader>

        {noActiveObras && (
          <div className="rounded-md border border-amber-300 bg-amber-50 dark:bg-amber-950/30 p-3 text-xs">
            <p className="font-medium text-amber-900 dark:text-amber-200 flex items-center gap-1.5">
              <AlertCircle className="h-3.5 w-3.5" /> No hay obras activas
            </p>
            <p className="text-amber-800 dark:text-amber-200/80 mt-1">
              Crea una obra en{' '}
              <a href="/dashboard/obras" className="underline font-medium">
                Maestros → Obras
              </a>{' '}
              con estado ACTIVA antes de prestar herramientas.
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
              Obra constructora donde se usa la herramienta
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
                      Esta obra no tiene almacenes tipo OBRA. Crea uno en{' '}
                      <a href="/dashboard/almacenes" className="underline">
                        Maestros → Almacenes
                      </a>
                      .
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
                  Almacén OBRA de donde sale la herramienta prestada
                </p>
                {errors.warehouseId && (
                  <p className="text-xs text-destructive">{errors.warehouseId.message}</p>
                )}
              </div>

              {/* 3. Estación */}
              <div className="space-y-1.5">
                <Label>
                  Estación de trabajo <span className="text-destructive">*</span>
                </Label>
                {(stations?.length ?? 0) === 0 ? (
                  <div className="rounded-md border border-amber-300 bg-amber-50/70 dark:bg-amber-950/20 p-2 text-xs">
                    <p className="text-amber-800 dark:text-amber-200">
                      Esta obra no tiene estaciones. Crea estaciones en la tab{' '}
                      <strong>Estaciones</strong> de Mi Obra.
                    </p>
                  </div>
                ) : (
                  <Select
                    value={watch('workStationId')}
                    onValueChange={(v) =>
                      setValue('workStationId', v, { shouldValidate: isSubmitted })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Seleccionar estación..." />
                    </SelectTrigger>
                    <SelectContent>
                      {stations?.map((s) => (
                        <SelectItem key={s.id} value={s.id}>
                          {s.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
                <p className="text-[11px] text-muted-foreground">
                  Zona o punto de trabajo donde se usa la herramienta
                </p>
                {errors.workStationId && (
                  <p className="text-xs text-destructive">
                    {errors.workStationId.message}
                  </p>
                )}
              </div>

              {/* 4. Empleado */}
              <div className="space-y-1.5">
                <Label>
                  Empleado responsable <span className="text-destructive">*</span>
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
                    value={watch('borrowerWorkerId')}
                    onValueChange={(v) =>
                      setValue('borrowerWorkerId', v, { shouldValidate: isSubmitted })
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
                  Empleado que recibe y es responsable de la herramienta
                </p>
                {errors.borrowerWorkerId && (
                  <p className="text-xs text-destructive">
                    {errors.borrowerWorkerId.message}
                  </p>
                )}
              </div>

              {/* 5. Herramienta */}
              <div className="space-y-1.5">
                <Label>
                  Herramienta <span className="text-destructive">*</span>
                </Label>
                {defaultItem ? (
                  <div className="flex items-center gap-3 rounded-md border bg-muted/30 p-2.5">
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-accent/10 text-accent ring-1 ring-accent/20">
                      <Wrench className="h-4 w-4" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{defaultItem.name}</p>
                      <p className="text-[11px] font-mono text-muted-foreground">
                        {defaultItem.code}
                      </p>
                    </div>
                    <Badge variant="outline" className="text-[10px]">
                      Fijada
                    </Badge>
                  </div>
                ) : (
                  <SearchCombobox<Item>
                    value={itemId}
                    onChange={(id) =>
                      setValue('itemId', id, { shouldValidate: isSubmitted })
                    }
                    items={filteredItems}
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
                      </>
                    )}
                    placeholder="Buscar herramienta por código o nombre..."
                    emptyMessage="No se encontraron herramientas o equipos."
                    error={!!errors.itemId}
                  />
                )}
                <p className="text-[11px] text-muted-foreground">
                  Solo ítems de tipo Préstamo (herramientas y equipos)
                </p>
                {!defaultItem && errors.itemId && (
                  <p className="text-xs text-destructive">{errors.itemId.message}</p>
                )}
                {itemId && warehouseId && availableQty !== null && totalQty !== null && (
                  <p
                    className={`text-[11px] tabular-nums ${
                      availableQty === 0 ? 'text-destructive' : 'text-muted-foreground'
                    }`}
                  >
                    Disponible:{' '}
                    <span className="font-semibold">
                      {availableQty.toLocaleString('es-PE', { maximumFractionDigits: 3 })}
                    </span>
                    <span className="ml-1">
                      {selectedItem?.unit.abbreviation ?? defaultItem?.unit?.abbreviation}
                    </span>
                    {totalQty > availableQty && (
                      <span className="ml-2 text-muted-foreground/70">
                        (de{' '}
                        {totalQty.toLocaleString('es-PE', { maximumFractionDigits: 3 })}{' '}
                        totales ·{' '}
                        {(totalQty - availableQty).toLocaleString('es-PE', {
                          maximumFractionDigits: 3,
                        })}{' '}
                        en préstamo)
                      </span>
                    )}
                  </p>
                )}
              </div>

              {/* 6. Cantidad + fecha */}
              <div className="grid grid-cols-2 gap-3">
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
                  <p className="text-[11px] text-muted-foreground">Unidades a prestar</p>
                  {errors.quantity && (
                    <p className="text-xs text-destructive">{errors.quantity.message}</p>
                  )}
                </div>
                <div className="space-y-1.5">
                  <Label>
                    Devolver antes de <span className="text-destructive">*</span>
                  </Label>
                  <Controller
                    control={control}
                    name="expectedReturnAt"
                    render={({ field }) => (
                      <DatePicker
                        value={field.value}
                        onChange={(v) => field.onChange(v)}
                        fromDate={today}
                        placeholder="Seleccionar fecha..."
                        clearable={false}
                      />
                    )}
                  />
                  <p className="text-[11px] text-muted-foreground">
                    Fecha límite de devolución
                  </p>
                  {errors.expectedReturnAt && (
                    <p className="text-xs text-destructive">
                      {errors.expectedReturnAt.message}
                    </p>
                  )}
                </div>
              </div>

              {/* 7. Observaciones */}
              <div className="space-y-1.5">
                <Label>Observaciones</Label>
                <Textarea
                  {...register('borrowerNotes')}
                  onChange={(e) =>
                    setValue('borrowerNotes', e.target.value.toUpperCase(), {
                      shouldValidate: isSubmitted,
                    })
                  }
                  placeholder="OPCIONAL · ESTADO DE ENTREGA, ACCESORIOS INCLUIDOS..."
                  rows={2}
                  className="text-sm uppercase placeholder:normal-case placeholder:opacity-60"
                />
                <p className="text-[11px] text-muted-foreground">
                  Opcional · estado de la herramienta al entregar, accesorios, etc.
                </p>
              </div>

              {/* Override para admin */}
              {needsOverride && (
                <div className="rounded-md border border-amber-300 bg-amber-50/70 dark:bg-amber-950/30 p-3 space-y-2">
                  <div className="flex items-start gap-2">
                    <AlertCircle className="h-4 w-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
                    <div className="text-xs text-amber-900 dark:text-amber-100 space-y-1">
                      <p className="font-medium">
                        Estás registrando este préstamo como administrador
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
              <ArrowRight className="h-4 w-4" />
              {mutation.isPending ? 'Registrando...' : 'Registrar préstamo'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
