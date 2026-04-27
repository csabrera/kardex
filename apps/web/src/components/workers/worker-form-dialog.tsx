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
import { useObras } from '@/hooks/use-obras';
import { useSpecialties } from '@/hooks/use-specialties';
import { useCreateWorker, useUpdateWorker, type Worker } from '@/hooks/use-workers';

const DOC_TYPES = ['DNI', 'CE', 'PASAPORTE'] as const;

const schema = z.object({
  documentType: z.enum(['DNI', 'CE', 'PASAPORTE']),
  documentNumber: z.string().min(7, 'Mínimo 7 caracteres').max(20),
  firstName: z.string().min(2).max(100),
  lastName: z.string().min(2).max(100),
  phone: z.string().regex(/^9\d{8}$/, 'Celular Perú: 9 dígitos que empiece con 9'),
  address: z.string().max(300).optional().or(z.literal('')),
  birthDate: z.string().optional().or(z.literal('')),
  hireDate: z.string().optional().or(z.literal('')),
  specialtyId: z.string().min(1, 'Requerida'),
  obraId: z.string().optional().or(z.literal('')),
  notes: z.string().max(500).optional().or(z.literal('')),
});

type FormData = z.infer<typeof schema>;

interface Props {
  open: boolean;
  onClose: () => void;
  worker?: Worker | null;
}

export function WorkerFormDialog({ open, onClose, worker }: Props) {
  const { data: specialties } = useSpecialties();
  const { data: obras } = useObras({ pageSize: 100 });
  const createMut = useCreateWorker();
  const updateMut = useUpdateWorker();
  const isEdit = !!worker;

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
      documentType: 'DNI',
      documentNumber: '',
      firstName: '',
      lastName: '',
      phone: '',
      address: '',
      birthDate: '',
      hireDate: '',
      specialtyId: '',
      obraId: '',
      notes: '',
    },
  });

  useEffect(() => {
    if (worker) {
      reset({
        documentType: worker.documentType as 'DNI' | 'CE' | 'PASAPORTE',
        documentNumber: worker.documentNumber,
        firstName: worker.firstName,
        lastName: worker.lastName,
        phone: worker.phone,
        address: worker.address ?? '',
        birthDate: worker.birthDate ? worker.birthDate.slice(0, 10) : '',
        hireDate: worker.hireDate ? worker.hireDate.slice(0, 10) : '',
        specialtyId: worker.specialty.id,
        obraId: worker.obra?.id ?? '',
        notes: worker.notes ?? '',
      });
    } else if (open) {
      reset({
        documentType: 'DNI',
        documentNumber: '',
        firstName: '',
        lastName: '',
        phone: '',
        address: '',
        birthDate: '',
        hireDate: '',
        specialtyId: '',
        obraId: '',
        notes: '',
      });
    }
  }, [worker, open, reset]);

  const onSubmit = (data: FormData) => {
    const payload = {
      ...data,
      address: data.address || undefined,
      birthDate: data.birthDate || undefined,
      hireDate: data.hireDate || undefined,
      obraId: data.obraId || undefined,
      notes: data.notes || undefined,
    };
    if (isEdit && worker) {
      updateMut.mutate({ id: worker.id, dto: payload }, { onSuccess: onClose });
    } else {
      createMut.mutate(payload, { onSuccess: onClose });
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{isEdit ? 'Editar empleado' : 'Nuevo empleado'}</DialogTitle>
          <DialogDescription>
            Trabajador de campo (obrero, albañil, electricista, etc.). No accede al
            sistema.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-3">
          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-1.5">
              <Label>Tipo doc. *</Label>
              <Select
                value={watch('documentType')}
                onValueChange={(v) =>
                  setValue('documentType', v as 'DNI' | 'CE' | 'PASAPORTE')
                }
                disabled={isEdit}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {DOC_TYPES.map((t) => (
                    <SelectItem key={t} value={t}>
                      {t}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="col-span-2 space-y-1.5">
              <Label>Número documento *</Label>
              <Input
                {...register('documentNumber')}
                placeholder="12345678"
                disabled={isEdit}
              />
              {errors.documentNumber && (
                <p className="text-xs text-destructive">
                  {errors.documentNumber.message}
                </p>
              )}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Nombres *</Label>
              <Input {...register('firstName')} />
              {errors.firstName && (
                <p className="text-xs text-destructive">{errors.firstName.message}</p>
              )}
            </div>
            <div className="space-y-1.5">
              <Label>Apellidos *</Label>
              <Input {...register('lastName')} />
              {errors.lastName && (
                <p className="text-xs text-destructive">{errors.lastName.message}</p>
              )}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>
                Celular *{' '}
                <span className="text-[10px] text-muted-foreground">
                  (9 dígitos, empieza con 9)
                </span>
              </Label>
              <Input {...register('phone')} placeholder="987654321" maxLength={9} />
              {errors.phone && (
                <p className="text-xs text-destructive">{errors.phone.message}</p>
              )}
            </div>
            <div className="space-y-1.5">
              <Label>Fecha nacimiento</Label>
              <Input type="date" {...register('birthDate')} />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>Dirección</Label>
            <Input {...register('address')} placeholder="Opcional" />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Especialidad *</Label>
              <Select
                value={watch('specialtyId')}
                onValueChange={(v) => setValue('specialtyId', v)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Seleccionar..." />
                </SelectTrigger>
                <SelectContent>
                  {specialties?.map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {errors.specialtyId && (
                <p className="text-xs text-destructive">{errors.specialtyId.message}</p>
              )}
            </div>
            <div className="space-y-1.5">
              <Label>Fecha ingreso</Label>
              <Input type="date" {...register('hireDate')} />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>Obra asignada</Label>
            <Select
              value={watch('obraId') || '_none'}
              onValueChange={(v) => setValue('obraId', v === '_none' ? '' : v)}
            >
              <SelectTrigger>
                <SelectValue placeholder="Sin asignar" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="_none">Sin asignar</SelectItem>
                {obras?.items.map((o) => (
                  <SelectItem key={o.id} value={o.id}>
                    [{o.code}] {o.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label>Notas</Label>
            <Input {...register('notes')} placeholder="Opcional" />
          </div>

          <div className="flex justify-end gap-2 pt-2 border-t">
            <Button type="button" variant="outline" onClick={onClose}>
              Cancelar
            </Button>
            <Button type="submit" disabled={createMut.isPending || updateMut.isPending}>
              {isEdit ? 'Guardar cambios' : 'Crear empleado'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
