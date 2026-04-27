'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { Loader2, Wrench } from 'lucide-react';
import { useMemo, useState } from 'react';
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
import {
  MAINTENANCE_TYPE_LABELS,
  useCreateMaintenance,
  type MaintenanceType,
} from '@/hooks/use-maintenance';

const schema = z.object({
  equipmentId: z.string().min(1, 'Requerido'),
  type: z.enum(['PREVENTIVO', 'CORRECTIVO']),
  description: z.string().min(3, 'Describe brevemente el mantenimiento').max(1000),
  scheduledDate: z.string().optional(),
  scheduledCount: z.coerce.number().min(0).optional().or(z.literal('')),
  notes: z.string().optional(),
});

type FormData = z.infer<typeof schema>;

export function NewMaintenanceDialog({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const mutation = useCreateMaintenance();

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
      type: 'PREVENTIVO',
      description: '',
    },
  });

  const equipmentId = watch('equipmentId');
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

  const onSubmit = (data: FormData) => {
    mutation.mutate(
      {
        equipmentId: data.equipmentId,
        type: data.type,
        description: data.description,
        scheduledDate: data.scheduledDate || undefined,
        scheduledCount: data.scheduledCount ? Number(data.scheduledCount) : undefined,
        notes: data.notes,
      },
      {
        onSuccess: () => {
          reset();
          setEquipmentSearch('');
          onClose();
        },
      },
    );
  };

  const handleClose = () => {
    reset();
    setEquipmentSearch('');
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && handleClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Wrench className="h-5 w-5 text-amber-600" /> Nuevo mantenimiento
          </DialogTitle>
          <DialogDescription>
            Programa un mantenimiento preventivo o registra uno correctivo. Se inicia en
            estado PROGRAMADO.
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
              placeholder="Buscar equipo..."
              error={!!errors.equipmentId}
            />
            {errors.equipmentId && (
              <p className="text-xs text-destructive">{errors.equipmentId.message}</p>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Tipo *</Label>
              <Select
                defaultValue="PREVENTIVO"
                onValueChange={(v) => setValue('type', v as MaintenanceType)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {(Object.keys(MAINTENANCE_TYPE_LABELS) as MaintenanceType[]).map(
                    (t) => (
                      <SelectItem key={t} value={t}>
                        {MAINTENANCE_TYPE_LABELS[t]}
                      </SelectItem>
                    ),
                  )}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Fecha programada</Label>
              <Input type="date" {...register('scheduledDate')} />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>Descripción *</Label>
            <Input
              {...register('description')}
              placeholder="Cambio de aceite y filtros"
            />
            {errors.description && (
              <p className="text-xs text-destructive">{errors.description.message}</p>
            )}
          </div>

          <div className="space-y-1.5">
            <Label>Contador programado</Label>
            <Input
              type="number"
              step="0.1"
              min="0"
              {...register('scheduledCount')}
              placeholder="Horómetro/km al que debe hacerse"
            />
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
                  <Loader2 className="h-4 w-4 animate-spin" /> Creando...
                </>
              ) : (
                <>
                  <Wrench className="h-4 w-4" /> Programar mantenimiento
                </>
              )}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
