'use client';

import { zodResolver } from '@hookform/resolvers/zod';
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
import {
  useCreateObra,
  useUpdateObra,
  type Obra,
  type ObraStatus,
} from '@/hooks/use-obras';
import { useUsers } from '@/hooks/use-users';

const STATUSES: { value: ObraStatus; label: string }[] = [
  { value: 'PLANIFICACION', label: 'Planificación' },
  { value: 'ACTIVA', label: 'Activa' },
  { value: 'SUSPENDIDA', label: 'Suspendida' },
  { value: 'FINALIZADA', label: 'Finalizada' },
];

const schema = z.object({
  name: z.string().min(2, 'Mínimo 2 caracteres').max(200),
  address: z.string().max(300).optional().or(z.literal('')),
  client: z.string().max(200).optional().or(z.literal('')),
  description: z.string().max(1000).optional().or(z.literal('')),
  startDate: z.string().optional().or(z.literal('')),
  endDate: z.string().optional().or(z.literal('')),
  status: z.enum(['PLANIFICACION', 'ACTIVA', 'SUSPENDIDA', 'FINALIZADA']),
  responsibleUserId: z.string().min(1, 'Debe asignar un responsable'),
});

type FormData = z.infer<typeof schema>;

interface Props {
  open: boolean;
  onClose: () => void;
  obra?: Obra | null;
}

export function ObraFormDialog({ open, onClose, obra }: Props) {
  const { data: users } = useUsers({ pageSize: 100, active: true });
  const createMut = useCreateObra();
  const updateMut = useUpdateObra();
  const isEdit = !!obra;

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
      address: '',
      client: '',
      description: '',
      startDate: '',
      endDate: '',
      status: 'PLANIFICACION',
      responsibleUserId: '',
    },
  });

  useEffect(() => {
    if (obra) {
      reset({
        name: obra.name,
        address: obra.address ?? '',
        client: obra.client ?? '',
        description: obra.description ?? '',
        startDate: obra.startDate ? obra.startDate.slice(0, 10) : '',
        endDate: obra.endDate ? obra.endDate.slice(0, 10) : '',
        status: obra.status,
        responsibleUserId: obra.responsibleUserId ?? '',
      });
    } else if (open) {
      reset({
        name: '',
        address: '',
        client: '',
        description: '',
        startDate: '',
        endDate: '',
        status: 'PLANIFICACION',
        responsibleUserId: '',
      });
    }
  }, [obra, open, reset]);

  const onSubmit = (data: FormData) => {
    const payload = {
      ...data,
      address: data.address || undefined,
      client: data.client || undefined,
      description: data.description || undefined,
      startDate: data.startDate || undefined,
      endDate: data.endDate || undefined,
      responsibleUserId: data.responsibleUserId,
    };
    if (isEdit && obra) {
      updateMut.mutate({ id: obra.id, dto: payload }, { onSuccess: onClose });
    } else {
      createMut.mutate(payload, { onSuccess: onClose });
    }
  };

  const status = watch('status');

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{isEdit ? 'Editar obra' : 'Nueva obra'}</DialogTitle>
          <DialogDescription>
            Proyecto o fuente de trabajo donde se ejecutan actividades constructivas.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-3">
          <div className="space-y-1.5">
            <Label>Nombre *</Label>
            <Input {...register('name')} placeholder="Edificio Plaza San Isidro" />
            {errors.name && (
              <p className="text-xs text-destructive">{errors.name.message}</p>
            )}
          </div>

          <div className="space-y-1.5">
            <Label>Cliente</Label>
            <Input {...register('client')} placeholder="Inmobiliaria XYZ S.A.C." />
          </div>

          <div className="space-y-1.5">
            <Label>Dirección</Label>
            <Input {...register('address')} placeholder="Av. Arequipa 1234, San Isidro" />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Fecha inicio</Label>
              <Input type="date" {...register('startDate')} />
            </div>
            <div className="space-y-1.5">
              <Label>Fecha fin estimada</Label>
              <Input type="date" {...register('endDate')} />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Estado *</Label>
              <Select
                value={status}
                onValueChange={(v) => setValue('status', v as ObraStatus)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {STATUSES.map((s) => (
                    <SelectItem key={s.value} value={s.value}>
                      {s.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Responsable *</Label>
              <Select
                value={watch('responsibleUserId') || undefined}
                onValueChange={(v) =>
                  setValue('responsibleUserId', v, { shouldValidate: true })
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Seleccionar responsable" />
                </SelectTrigger>
                <SelectContent>
                  {users?.items.map((u) => (
                    <SelectItem key={u.id} value={u.id}>
                      {u.firstName} {u.lastName} · {u.role.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {errors.responsibleUserId && (
                <p className="text-xs text-destructive">
                  {errors.responsibleUserId.message}
                </p>
              )}
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>Descripción</Label>
            <Input {...register('description')} placeholder="Opcional" />
          </div>

          <div className="flex justify-end gap-2 pt-2 border-t">
            <Button type="button" variant="outline" onClick={onClose}>
              Cancelar
            </Button>
            <Button type="submit" disabled={createMut.isPending || updateMut.isPending}>
              {isEdit ? 'Guardar cambios' : 'Crear obra'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
