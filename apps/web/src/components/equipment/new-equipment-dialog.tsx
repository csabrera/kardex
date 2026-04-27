'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { Loader2, Truck } from 'lucide-react';
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
import {
  COUNT_TYPE_LABELS,
  EQUIPMENT_TYPE_LABELS,
  useCreateEquipment,
  type CountType,
  type EquipmentType,
} from '@/hooks/use-equipment';
import { useObras } from '@/hooks/use-obras';

const schema = z.object({
  name: z.string().min(1, 'Requerido').max(200),
  type: z.enum([
    'MAQUINARIA_PESADA',
    'VEHICULO',
    'EQUIPO_MENOR',
    'HERRAMIENTA_ELECTRICA',
    'OTRO',
  ]),
  brand: z.string().optional(),
  model: z.string().optional(),
  serialNumber: z.string().optional(),
  year: z.coerce.number().int().min(1900).optional().or(z.literal('')),
  countType: z.enum(['HOROMETRO', 'KILOMETRAJE', 'NONE']),
  initialCount: z.coerce.number().min(0).optional(),
  acquisitionDate: z.string().optional(),
  acquisitionCost: z.coerce.number().min(0).optional().or(z.literal('')),
  obraId: z.string().optional(),
  notes: z.string().optional(),
});

type FormData = z.infer<typeof schema>;

export function NewEquipmentDialog({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const mutation = useCreateEquipment();
  const { data: obrasData } = useObras({ pageSize: 100 });

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
      name: '',
      type: 'MAQUINARIA_PESADA',
      countType: 'HOROMETRO',
      initialCount: 0,
    },
  });

  const onSubmit = (data: FormData) => {
    mutation.mutate(
      {
        ...data,
        year: data.year ? Number(data.year) : undefined,
        acquisitionCost: data.acquisitionCost ? Number(data.acquisitionCost) : undefined,
        obraId: data.obraId || undefined,
      } as any,
      {
        onSuccess: () => {
          reset();
          onClose();
        },
      },
    );
  };

  const handleClose = () => {
    reset();
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && handleClose()}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Truck className="h-5 w-5 text-accent" /> Nuevo equipo
          </DialogTitle>
          <DialogDescription>
            Registra un equipo o maquinaria en el inventario. Podrás llevar historial de
            horómetro/km y asociarlo a una obra.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>Nombre *</Label>
              <Input
                {...register('name')}
                placeholder="Retroexcavadora Caterpillar 320"
              />
              {errors.name && (
                <p className="text-xs text-destructive">{errors.name.message}</p>
              )}
            </div>
            <div className="space-y-1.5">
              <Label>Tipo *</Label>
              <Select
                defaultValue="MAQUINARIA_PESADA"
                onValueChange={(v) => setValue('type', v as EquipmentType)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {(Object.keys(EQUIPMENT_TYPE_LABELS) as EquipmentType[]).map((t) => (
                    <SelectItem key={t} value={t}>
                      {EQUIPMENT_TYPE_LABELS[t]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-1.5">
              <Label>Marca</Label>
              <Input {...register('brand')} placeholder="Caterpillar" />
            </div>
            <div className="space-y-1.5">
              <Label>Modelo</Label>
              <Input {...register('model')} placeholder="320D" />
            </div>
            <div className="space-y-1.5">
              <Label>Año</Label>
              <Input type="number" {...register('year')} placeholder="2020" />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>Número de serie</Label>
              <Input {...register('serialNumber')} placeholder="CAT00320A1234" />
            </div>
            <div className="space-y-1.5">
              <Label>Obra actual</Label>
              <Select
                value={watch('obraId') ?? ''}
                onValueChange={(v) => setValue('obraId', v === '_none' ? '' : v)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Sin asignar" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="_none">Sin asignar</SelectItem>
                  {obrasData?.items.map((o) => (
                    <SelectItem key={o.id} value={o.id}>
                      {o.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>Tipo de contador *</Label>
              <Select
                defaultValue="HOROMETRO"
                onValueChange={(v) => setValue('countType', v as CountType)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {(Object.keys(COUNT_TYPE_LABELS) as CountType[]).map((c) => (
                    <SelectItem key={c} value={c}>
                      {COUNT_TYPE_LABELS[c]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Lectura inicial</Label>
              <Input
                type="number"
                step="0.01"
                min="0"
                {...register('initialCount')}
                placeholder="0"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>Fecha adquisición</Label>
              <Input type="date" {...register('acquisitionDate')} />
            </div>
            <div className="space-y-1.5">
              <Label>Costo de adquisición (S/.)</Label>
              <Input
                type="number"
                step="0.01"
                min="0"
                {...register('acquisitionCost')}
                placeholder="0.00"
              />
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
                  <Loader2 className="h-4 w-4 animate-spin" /> Registrando...
                </>
              ) : (
                <>
                  <Truck className="h-4 w-4" /> Registrar equipo
                </>
              )}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
