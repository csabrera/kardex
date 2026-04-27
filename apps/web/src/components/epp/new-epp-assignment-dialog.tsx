'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { AlertCircle, Building, HardHat, Loader2, Shield } from 'lucide-react';
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
  quantity: z.coerce.number().min(0.001, 'Debe ser > 0'),
  notes: z.string().max(500).optional(),
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

  const { data: obrasData } = useObras({
    pageSize: 100,
    status: 'ACTIVA',
    responsibleUserId: isResidente ? user?.id : undefined,
    enabled: !lockedObraId,
  });
  const activeObras = obrasData?.items ?? [];

  const { data: lockedObra } = useObra(lockedObraId ?? null);

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    reset,
    formState: { errors },
  } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      obraId: lockedObraId ?? '',
      warehouseId: defaultWarehouseId ?? '',
      workerId: '',
      itemId: '',
      quantity: 1,
      notes: '',
    },
  });

  const obraId = watch('obraId');
  const warehouseId = watch('warehouseId');
  const workerId = watch('workerId');
  const itemId = watch('itemId');

  // Sincroniza props pre-cargadas al abrir.
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

  // Ítems tipo EPP buscables
  const [itemSearch, setItemSearch] = useState('');
  const { data: itemsData, isFetching: itemsLoading } = useItems({
    search: itemSearch || undefined,
    type: 'EPP',
    pageSize: 30,
  });
  const eppItems: Item[] = useMemo(() => itemsData?.items ?? [], [itemsData]);
  const selectedItem = eppItems.find((i) => i.id === itemId);

  const mutation = useAssignEPP();

  // Reset cascade al cambiar obra (preserva defaultWarehouseId si aplica).
  useEffect(() => {
    setValue('warehouseId', defaultWarehouseId ?? '');
    setValue('workerId', '');
    setValue('itemId', '');
    setItemSearch('');
  }, [obraId, defaultWarehouseId, setValue]);

  // Stock disponible del EPP seleccionado en el almacén elegido
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
    mutation.mutate(
      {
        workerId: data.workerId,
        itemId: data.itemId,
        warehouseId: data.warehouseId,
        quantity: data.quantity,
        notes: data.notes,
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
            Entrega de Equipo de Protección Personal al empleado. Descuenta el stock del
            almacén de obra seleccionado.
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
          {/* Obra (bloqueada o seleccionable) */}
          <div className="space-y-1.5">
            <Label>1. Obra *</Label>
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
              {/* Almacén obra */}
              <div className="space-y-1.5">
                <Label>2. Almacén de obra *</Label>
                {obraWarehouses.length === 0 ? (
                  <div className="rounded-md border border-amber-300 bg-amber-50/70 dark:bg-amber-950/20 p-2 text-xs">
                    <p className="text-amber-800 dark:text-amber-200">
                      Esta obra no tiene almacenes tipo OBRA.
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

              {/* Empleado */}
              <div className="space-y-1.5">
                <Label>3. Empleado *</Label>
                {obraWorkers.length === 0 ? (
                  <div className="rounded-md border border-amber-300 bg-amber-50/70 dark:bg-amber-950/20 p-2 text-xs">
                    <p className="text-amber-800 dark:text-amber-200">
                      Esta obra no tiene empleados activos.
                    </p>
                  </div>
                ) : (
                  <Select value={workerId} onValueChange={(v) => setValue('workerId', v)}>
                    <SelectTrigger>
                      <SelectValue
                        placeholder={`Seleccionar empleado... (${obraWorkers.length})`}
                      />
                    </SelectTrigger>
                    <SelectContent>
                      {obraWorkers.map((w) => (
                        <SelectItem key={w.id} value={w.id}>
                          <span className="inline-flex items-center gap-2">
                            <HardHat className="h-3.5 w-3.5 text-muted-foreground" />
                            {w.firstName} {w.lastName} · {w.specialty.name}
                          </span>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
                {errors.workerId && (
                  <p className="text-xs text-destructive">{errors.workerId.message}</p>
                )}
              </div>

              {/* Ítem EPP */}
              <div className="space-y-1.5">
                <Label>4. EPP a entregar *</Label>
                <p className="text-[11px] text-muted-foreground">
                  Solo ítems tipo EPP (casco, arnés, guantes, lentes, etc.).
                </p>
                <SearchCombobox<Item>
                  value={itemId}
                  onChange={(id) => setValue('itemId', id)}
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

              {/* Cantidad + notas */}
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
              </div>

              <div className="space-y-1.5">
                <Label>Observaciones</Label>
                <Input {...register('notes')} placeholder="Opcional" />
              </div>
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
              {mutation.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" /> Registrando...
                </>
              ) : (
                <>
                  <Shield className="h-4 w-4" /> Registrar entrega
                </>
              )}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
