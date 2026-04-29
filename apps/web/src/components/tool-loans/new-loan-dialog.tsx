'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { AlertCircle, ArrowRight, Building } from 'lucide-react';
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
import { Input } from '@/components/ui/input';
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

const schema = z.object({
  obraId: z.string().min(1, 'Requerida'),
  warehouseId: z.string().min(1, 'Requerido'),
  workStationId: z.string().min(1, 'Requerida'),
  borrowerWorkerId: z.string().min(1, 'Requerido'),
  itemId: z.string().min(1, 'Requerido'),
  quantity: z.coerce.number().min(0.001, 'Debe ser > 0'),
  expectedReturnAt: z
    .string()
    .min(1, 'Requerida')
    .refine((v) => new Date(v).getTime() > Date.now(), {
      message: 'La fecha de devolución debe ser futura',
    }),
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
}

export function NewLoanDialog({
  open,
  onClose,
  lockedObraId,
  defaultWarehouseId,
}: Props) {
  const user = useAuthStore((s) => s.user);
  const isResidente = user?.role?.name === 'RESIDENTE';
  const isAdmin = user?.role?.name === 'ADMIN';
  // Admin actuando por excepción debe justificar (residente y almacenero son flujo normal).
  const needsOverride = isAdmin;

  // Si es RESIDENTE, limita las obras a las que él lidera.
  // En modo lockedObraId no hace falta listar nada (cargamos solo la obra única).
  const { data: obrasData } = useObras({
    pageSize: 100,
    status: 'ACTIVA',
    responsibleUserId: isResidente ? user?.id : undefined,
    enabled: !lockedObraId,
  });
  const activeObras = obrasData?.items ?? [];

  // Cargamos la obra bloqueada (si aplica) para mostrarla en la card read-only.
  const { data: lockedObra } = useObra(lockedObraId ?? null);

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    reset,
    setError,
    formState: { errors },
  } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      obraId: lockedObraId ?? '',
      warehouseId: defaultWarehouseId ?? '',
      workStationId: '',
      borrowerWorkerId: '',
      itemId: '',
      quantity: 1,
      expectedReturnAt: new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 16),
      borrowerNotes: '',
      overrideReason: '',
    },
  });

  const obraId = watch('obraId');
  const warehouseId = watch('warehouseId');
  const itemId = watch('itemId');

  // Cuando el diálogo abre con obraId/warehouseId pre-cargados, sincroniza el form.
  useEffect(() => {
    if (!open) return;
    if (lockedObraId) setValue('obraId', lockedObraId);
    if (defaultWarehouseId) setValue('warehouseId', defaultWarehouseId);
  }, [open, lockedObraId, defaultWarehouseId, setValue]);

  // 1. Almacenes tipo OBRA de esa obra
  const { data: warehousesData } = useWarehouses({
    pageSize: 50,
    type: 'OBRA',
    obraId,
    enabled: !!obraId,
  } as any);
  const obraWarehouses = warehousesData?.items ?? [];

  // 2. Estaciones de esa obra
  const { data: stations } = useWorkStations({ obraId, enabled: !!obraId });

  // 3. Empleados de esa obra
  const { data: workersData } = useWorkers({
    pageSize: 100,
    obraId,
    active: true,
    enabled: !!obraId,
  });
  const obraWorkers = workersData?.items ?? [];

  // 4. Items buscables tipo HERRAMIENTA/EQUIPO (SearchCombobox maneja el debounce internamente)
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

  // Reset cascade cuando cambia la obra (preserva defaultWarehouseId si aplica).
  useEffect(() => {
    setValue('warehouseId', defaultWarehouseId ?? '');
    setValue('workStationId', '');
    setValue('borrowerWorkerId', '');
    setValue('itemId', '');
    setItemSearch('');
  }, [obraId, defaultWarehouseId, setValue]);

  // Stock del ítem seleccionado en el almacén elegido (tip informativo)
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
        itemId: data.itemId,
        warehouseId: data.warehouseId,
        workStationId: data.workStationId,
        borrowerWorkerId: data.borrowerWorkerId,
        quantity: data.quantity,
        expectedReturnAt: new Date(data.expectedReturnAt).toISOString(),
        borrowerNotes: data.borrowerNotes,
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
      itemId: '',
      quantity: 1,
      expectedReturnAt: new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 16),
      borrowerNotes: '',
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
          <DialogTitle>Nuevo préstamo de herramienta</DialogTitle>
          <DialogDescription>
            Flujo:{' '}
            <strong>Obra → Almacén de obra → Estación → Empleado → Herramienta</strong>.
            El stock no se descuenta, solo se registra el préstamo activo.
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
          {/* 1. Obra (bloqueada o seleccionable) */}
          <div className="space-y-1.5">
            <Label>1. Obra (fuente de trabajo) *</Label>
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
                onValueChange={(v) => setValue('obraId', v)}
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
            {errors.obraId && (
              <p className="text-xs text-destructive">{errors.obraId.message}</p>
            )}
          </div>

          {obraId && (
            <>
              {/* 2. Almacén de la obra */}
              <div className="space-y-1.5">
                <Label>2. Almacén de obra *</Label>
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

              {/* 3. Estación de trabajo */}
              <div className="space-y-1.5">
                <Label>3. Estación de trabajo *</Label>
                {(stations?.length ?? 0) === 0 ? (
                  <div className="rounded-md border border-amber-300 bg-amber-50/70 dark:bg-amber-950/20 p-2 text-xs">
                    <p className="text-amber-800 dark:text-amber-200">
                      Esta obra no tiene estaciones. Creá estaciones en la tab{' '}
                      <strong>Estaciones</strong> de Mi Obra.
                    </p>
                  </div>
                ) : (
                  <Select
                    value={watch('workStationId')}
                    onValueChange={(v) => setValue('workStationId', v)}
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
                {errors.workStationId && (
                  <p className="text-xs text-destructive">
                    {errors.workStationId.message}
                  </p>
                )}
              </div>

              {/* 4. Empleado */}
              <div className="space-y-1.5">
                <Label>4. Empleado (responsable) *</Label>
                {obraWorkers.length === 0 ? (
                  <div className="rounded-md border border-amber-300 bg-amber-50/70 dark:bg-amber-950/20 p-2 text-xs">
                    <p className="text-amber-800 dark:text-amber-200">
                      Esta obra no tiene empleados activos. Agrega o asigna empleados en{' '}
                      <a href="/dashboard/empleados" className="underline">
                        Maestros → Empleados
                      </a>
                      .
                    </p>
                  </div>
                ) : (
                  <Select
                    value={watch('borrowerWorkerId')}
                    onValueChange={(v) => setValue('borrowerWorkerId', v)}
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
                {errors.borrowerWorkerId && (
                  <p className="text-xs text-destructive">
                    {errors.borrowerWorkerId.message}
                  </p>
                )}
              </div>

              {/* 5. Herramienta */}
              <div className="space-y-1.5">
                <Label>5. Herramienta *</Label>
                <p className="text-[11px] text-muted-foreground">
                  Solo ítems tipo HERRAMIENTA o EQUIPO.
                </p>
                <SearchCombobox<Item>
                  value={itemId}
                  onChange={(id) => setValue('itemId', id)}
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
                      <span className="ml-1 text-[10px] text-muted-foreground">
                        ({i.type})
                      </span>
                    </>
                  )}
                  placeholder="Buscar herramienta por código o nombre..."
                  emptyMessage="No se encontraron herramientas ni equipos que coincidan."
                  error={!!errors.itemId}
                />
                {errors.itemId && (
                  <p className="text-xs text-destructive">{errors.itemId.message}</p>
                )}
                {itemId && warehouseId && availableQty !== null && (
                  <p
                    className={`text-[11px] tabular-nums ${
                      availableQty === 0 ? 'text-destructive' : 'text-muted-foreground'
                    }`}
                  >
                    Stock disponible en este almacén:{' '}
                    <span className="font-semibold">
                      {availableQty.toLocaleString('es-PE', { maximumFractionDigits: 3 })}
                    </span>
                    {selectedItem && (
                      <span className="ml-1">{selectedItem.unit.abbreviation}</span>
                    )}
                  </p>
                )}
              </div>

              {/* 6. Cantidad + fecha */}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>Cantidad *</Label>
                  <Input
                    type="number"
                    step="0.001"
                    min="0.001"
                    {...register('quantity')}
                  />
                  {errors.quantity && (
                    <p className="text-xs text-destructive">{errors.quantity.message}</p>
                  )}
                </div>
                <div className="space-y-1.5">
                  <Label>Devolver antes de *</Label>
                  <Input type="datetime-local" {...register('expectedReturnAt')} />
                  {errors.expectedReturnAt && (
                    <p className="text-xs text-destructive">
                      {errors.expectedReturnAt.message}
                    </p>
                  )}
                </div>
              </div>

              <div className="space-y-1.5">
                <Label>Observaciones</Label>
                <Input {...register('borrowerNotes')} placeholder="Opcional" />
              </div>

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
                        excepción, debes dejar constancia del motivo (queda en el registro
                        de auditoría).
                      </p>
                    </div>
                  </div>
                  <div className="space-y-1.5 pl-6">
                    <Label htmlFor="overrideReason" className="text-xs">
                      Motivo de excepción *
                    </Label>
                    <Textarea
                      id="overrideReason"
                      {...register('overrideReason')}
                      placeholder="Ej: Residente ausente — entrega urgente albañil García"
                      rows={2}
                      className="text-sm"
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
              disabled={!obraId || mutation.isPending}
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
