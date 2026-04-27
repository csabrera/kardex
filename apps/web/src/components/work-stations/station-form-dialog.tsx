'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useEffect, useState } from 'react';
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
  useCreateWorkStation,
  useUpdateWorkStation,
  type WorkStation,
} from '@/hooks/use-work-stations';

const schema = z.object({
  name: z.string().min(2, 'Mínimo 2 caracteres').max(100),
  description: z.string().max(300).optional().or(z.literal('')),
  active: z.boolean().default(true),
});

type FormData = z.infer<typeof schema>;

interface Props {
  open: boolean;
  onClose: () => void;
  obraId: string;
  station?: WorkStation | null;
}

export function StationFormDialog({ open, onClose, obraId, station }: Props) {
  const createMut = useCreateWorkStation();
  const updateMut = useUpdateWorkStation();
  const isEdit = !!station;

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { name: '', description: '', active: true },
  });

  useEffect(() => {
    if (open) {
      reset({
        name: station?.name ?? '',
        description: station?.description ?? '',
        active: station?.active ?? true,
      });
    }
  }, [open, station, reset]);

  const [submitting, setSubmitting] = useState(false);

  const onSubmit = async (data: FormData) => {
    setSubmitting(true);
    try {
      if (isEdit && station) {
        await updateMut.mutateAsync({
          id: station.id,
          dto: {
            name: data.name,
            description: data.description || undefined,
            active: data.active,
          },
        });
      } else {
        await createMut.mutateAsync({
          obraId,
          name: data.name,
          description: data.description || undefined,
        });
      }
      onClose();
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>
            {isEdit ? 'Editar estación de trabajo' : 'Nueva estación de trabajo'}
          </DialogTitle>
          <DialogDescription>
            Área física de la obra donde los obreros usan las herramientas.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="name">Nombre *</Label>
            <Input
              id="name"
              {...register('name')}
              placeholder="Ej: Planta baja, Zona norte, Depósito 2..."
              autoFocus
            />
            {errors.name && (
              <p className="text-xs text-destructive">{errors.name.message}</p>
            )}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="description">Descripción</Label>
            <Input
              id="description"
              {...register('description')}
              placeholder="Detalle opcional"
              maxLength={300}
            />
          </div>

          {isEdit && (
            <label className="flex items-center gap-2 text-sm cursor-pointer">
              <input
                type="checkbox"
                {...register('active')}
                className="h-4 w-4 rounded border-border"
              />
              <span>Activa (desmarcá para deshabilitar)</span>
            </label>
          )}

          <div className="flex justify-end gap-2 pt-2 border-t">
            <Button type="button" variant="outline" onClick={onClose}>
              Cancelar
            </Button>
            <Button type="submit" disabled={submitting}>
              {isEdit ? 'Guardar cambios' : 'Crear estación'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
