'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { Droplet, Loader2 } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
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
import { SearchCombobox } from '@/components/ui/search-combobox';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useEquipmentList, type Equipment } from '@/hooks/use-equipment';
import { useDispatchFuel } from '@/hooks/use-fuel';
import { useItems, type Item } from '@/hooks/use-items';
import { useWarehouses } from '@/hooks/use-warehouses';

const schema = z.object({
  equipmentId: z.string().min(1, 'Requerido'),
  warehouseId: z.string().min(1, 'Requerido'),
  itemId: z.string().min(1, 'Requerido'),
  quantity: z.coerce.number().min(0.001, 'Debe ser > 0'),
  countReading: z.coerce.number().min(0, 'Requerido'),
  notes: z.string().max(500).optional(),
});

type FormData = z.infer<typeof schema>;

export function NewFuelDispatchDialog({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const mutation = useDispatchFuel();

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
      equipmentId: '',
      warehouseId: '',
      itemId: '',
      quantity: 0,
      countReading: 0,
    },
  });

  const equipmentId = watch('equipmentId');

  // Equipos buscables (operativos o averiados)
  const [equipmentSearch, setEquipmentSearch] = useState('');
  const { data: equipmentData, isFetching: equipmentLoading } = useEquipmentList({
    search: equipmentSearch || undefined,
    pageSize: 20,
  });
  const availableEquipment: Equipment[] = useMemo(
    () => (equipmentData?.items ?? []).filter((e) => e.status !== 'BAJA'),
    [equipmentData],
  );
  const selectedEquipment = availableEquipment.find((e) => e.id === equipmentId);

  // Cuando cambia el equipo, prellenar countReading con el actual
  useEffect(() => {
    if (selectedEquipment) {
      setValue('countReading', Number(selectedEquipment.currentCount));
    }
  }, [selectedEquipment, setValue]);

  // Almacenes (cualquiera)
  const { data: warehousesData } = useWarehouses({ pageSize: 50 });

  // Ítems combustible buscables
  const [itemSearch, setItemSearch] = useState('');
  const { data: itemsData, isFetching: itemsLoading } = useItems({
    search: itemSearch || undefined,
    type: 'COMBUSTIBLE',
    pageSize: 30,
  });
  const fuelItems: Item[] = itemsData?.items ?? [];
  const itemId = watch('itemId');
  const selectedItem = fuelItems.find((i) => i.id === itemId);

  const onSubmit = (data: FormData) => {
    mutation.mutate(data, {
      onSuccess: () => {
        reset();
        setEquipmentSearch('');
        setItemSearch('');
        onClose();
      },
    });
  };

  const handleClose = () => {
    reset();
    setEquipmentSearch('');
    setItemSearch('');
    onClose();
  };

  const unit =
    selectedEquipment?.countType === 'HOROMETRO'
      ? 'h'
      : selectedEquipment?.countType === 'KILOMETRAJE'
        ? 'km'
        : '';

  return (
    <Dialog open={open} onOpenChange={(v) => !v && handleClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Droplet className="h-5 w-5 text-blue-600" /> Despacho de combustible
          </DialogTitle>
          <DialogDescription>
            Registra el abastecimiento de combustible a un equipo. Descuenta stock y
            actualiza la lectura del contador.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-3">
          <div className="space-y-1.5">
            <Label>Equipo *</Label>
            <SearchCombobox<Equipment>
              value={equipmentId}
              onChange={(id) => setValue('equipmentId', id)}
              items={availableEquipment}
              selectedItem={selectedEquipment ?? null}
              isLoading={equipmentLoading}
              onSearchChange={setEquipmentSearch}
              getId={(e) => e.id}
              getLabel={(e) => `[${e.code}] ${e.name}`}
              renderItem={(e) => (
                <>
                  <span className="font-mono text-xs text-muted-foreground mr-2">
                    {e.code}
                  </span>
                  {e.name}
                  <span className="ml-1 text-[10px] text-muted-foreground">
                    ({Number(e.currentCount)}{' '}
                    {e.countType === 'HOROMETRO'
                      ? 'h'
                      : e.countType === 'KILOMETRAJE'
                        ? 'km'
                        : ''}
                    )
                  </span>
                </>
              )}
              placeholder="Buscar equipo por código o nombre..."
              emptyMessage="No se encontraron equipos operativos."
              error={!!errors.equipmentId}
            />
            {errors.equipmentId && (
              <p className="text-xs text-destructive">{errors.equipmentId.message}</p>
            )}
          </div>

          <div className="space-y-1.5">
            <Label>Almacén origen *</Label>
            <Select
              value={watch('warehouseId')}
              onValueChange={(v) => setValue('warehouseId', v)}
            >
              <SelectTrigger>
                <SelectValue placeholder="Seleccionar almacén..." />
              </SelectTrigger>
              <SelectContent>
                {warehousesData?.items.map((w) => (
                  <SelectItem key={w.id} value={w.id}>
                    [{w.code}] {w.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {errors.warehouseId && (
              <p className="text-xs text-destructive">{errors.warehouseId.message}</p>
            )}
          </div>

          <div className="space-y-1.5">
            <Label>Combustible *</Label>
            <p className="text-[11px] text-muted-foreground">
              Solo ítems tipo COMBUSTIBLE.
            </p>
            <SearchCombobox<Item>
              value={itemId}
              onChange={(id) => setValue('itemId', id)}
              items={fuelItems}
              selectedItem={selectedItem ?? null}
              isLoading={itemsLoading}
              onSearchChange={setItemSearch}
              getId={(i) => i.id}
              getLabel={(i) => `[${i.code}] ${i.name} (${i.unit.abbreviation})`}
              placeholder="Buscar combustible..."
              error={!!errors.itemId}
            />
            {errors.itemId && (
              <p className="text-xs text-destructive">{errors.itemId.message}</p>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Cantidad *</Label>
              <Input
                type="number"
                step="0.001"
                min="0.001"
                {...register('quantity')}
                placeholder={selectedItem?.unit.abbreviation}
              />
              {errors.quantity && (
                <p className="text-xs text-destructive">{errors.quantity.message}</p>
              )}
            </div>
            <div className="space-y-1.5">
              <Label>Lectura actual * {unit && `(${unit})`}</Label>
              <Input
                type="number"
                step="0.1"
                min="0"
                {...register('countReading')}
                placeholder={`Mín ${Number(selectedEquipment?.currentCount ?? 0)}`}
              />
              {errors.countReading && (
                <p className="text-xs text-destructive">{errors.countReading.message}</p>
              )}
              {selectedEquipment && (
                <p className="text-[10px] text-muted-foreground">
                  Actual: {Number(selectedEquipment.currentCount)} {unit}
                </p>
              )}
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>Notas</Label>
            <Input {...register('notes')} placeholder="Opcional" />
          </div>

          <div className="flex justify-end gap-2 pt-2 border-t">
            <Button type="button" variant="outline" onClick={handleClose}>
              Cancelar
            </Button>
            <Button type="submit" disabled={mutation.isPending} className="gap-2">
              {mutation.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" /> Despachando...
                </>
              ) : (
                <>
                  <Droplet className="h-4 w-4" /> Registrar despacho
                </>
              )}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
