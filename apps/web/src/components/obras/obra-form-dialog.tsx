'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';
import { z } from 'zod';

import { Button } from '@/components/ui/button';
import { DatePicker } from '@/components/ui/date-picker';
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
import { SearchCombobox } from '@/components/ui/search-combobox';
import { Textarea } from '@/components/ui/textarea';
import {
  useCreateObra,
  useUpdateObra,
  type Obra,
  type ObraStatus,
} from '@/hooks/use-obras';
import { useUsers, type User } from '@/hooks/use-users';

const STATUS_META: { value: ObraStatus; label: string; description: string }[] = [
  {
    value: 'PLANIFICACION',
    label: 'Planificación',
    description: 'Obra en etapa de diseño y preparación, sin actividades iniciadas.',
  },
  {
    value: 'ACTIVA',
    label: 'Activa',
    description: 'Obra en ejecución — permite registrar movimientos y préstamos.',
  },
  {
    value: 'SUSPENDIDA',
    label: 'Suspendida',
    description: 'Actividades pausadas temporalmente. Los datos se conservan.',
  },
  {
    value: 'FINALIZADA',
    label: 'Finalizada',
    description: 'Obra concluida. Solo lectura de historial.',
  },
];

const schema = z
  .object({
    name: z.string().min(2, 'Mínimo 2 caracteres').max(200, 'Máximo 200 caracteres'),
    client: z.string().max(200, 'Máximo 200 caracteres').optional().or(z.literal('')),
    address: z.string().max(300, 'Máximo 300 caracteres').optional().or(z.literal('')),
    startDate: z.string().optional().or(z.literal('')),
    endDate: z.string().optional().or(z.literal('')),
    status: z.enum(['PLANIFICACION', 'ACTIVA', 'SUSPENDIDA', 'FINALIZADA']),
    responsibleUserId: z.string().min(1, 'Debe asignar un responsable'),
    description: z
      .string()
      .max(1000, 'Máximo 1000 caracteres')
      .optional()
      .or(z.literal('')),
  })
  .superRefine((data, ctx) => {
    if (data.startDate && data.endDate && data.endDate < data.startDate) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'La fecha fin debe ser igual o posterior a la fecha de inicio',
        path: ['endDate'],
      });
    }
  });

type FormData = z.infer<typeof schema>;

interface Props {
  open: boolean;
  onClose: () => void;
  obra?: Obra | null;
}

const ROLE_LABEL: Record<string, string> = {
  ADMIN: 'Admin',
  ALMACENERO: 'Almacenero',
  RESIDENTE: 'Residente',
};

const ROLE_CLASS: Record<string, string> = {
  ADMIN: 'bg-destructive/10 text-destructive',
  ALMACENERO: 'bg-info/10 text-info',
  RESIDENTE: 'bg-success/10 text-success',
};

export function ObraFormDialog({ open, onClose, obra }: Props) {
  const [userSearch, setUserSearch] = useState('');
  const [lastSelectedUser, setLastSelectedUser] = useState<User | null>(null);
  const { data: usersData, isFetching: usersFetching } = useUsers({
    search: userSearch,
    pageSize: 20,
    active: true,
  });
  const users = usersData?.items ?? [];

  const createMut = useCreateObra();
  const updateMut = useUpdateObra();
  const isEdit = !!obra;
  const isPending = createMut.isPending || updateMut.isPending;

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    reset,
    setError,
    formState: { errors, isSubmitted, isValid },
  } = useForm<FormData>({
    resolver: zodResolver(schema),
    mode: 'onBlur',
    defaultValues: {
      name: '',
      client: '',
      address: '',
      startDate: '',
      endDate: '',
      status: 'PLANIFICACION',
      responsibleUserId: '',
      description: '',
    },
  });

  useEffect(() => {
    if (obra) {
      reset({
        name: obra.name?.toUpperCase() ?? '',
        client: obra.client?.toUpperCase() ?? '',
        address: obra.address?.toUpperCase() ?? '',
        startDate: obra.startDate ? obra.startDate.slice(0, 10) : '',
        endDate: obra.endDate ? obra.endDate.slice(0, 10) : '',
        status: obra.status,
        responsibleUserId: obra.responsibleUserId ?? '',
        description: obra.description ?? '',
      });
    } else if (open) {
      reset({
        name: '',
        client: '',
        address: '',
        startDate: '',
        endDate: '',
        status: 'PLANIFICACION',
        responsibleUserId: '',
        description: '',
      });
      setLastSelectedUser(null);
    }
  }, [obra, open, reset]);

  const handleError = (e: any) => {
    const code = e.response?.data?.error?.code as string | undefined;
    const message = e.response?.data?.error?.message as string | undefined;
    if (code === 'OBRA_ALREADY_EXISTS' || code === 'NAME_ALREADY_TAKEN') {
      setError('name', { message: 'Ya existe una obra con ese nombre' });
    } else {
      toast.error(
        message ?? (isEdit ? 'Error al actualizar obra' : 'Error al crear obra'),
      );
    }
  };

  const onSubmit = (data: FormData) => {
    const payload = {
      name: data.name.trim(),
      client: data.client?.trim() || undefined,
      address: data.address?.trim() || undefined,
      startDate: data.startDate || undefined,
      endDate: data.endDate || undefined,
      status: data.status,
      responsibleUserId: data.responsibleUserId,
      description: data.description?.trim() || undefined,
    };

    if (isEdit && obra) {
      updateMut.mutate(
        { id: obra.id, dto: payload },
        {
          onSuccess: (updated) => {
            toast.success(`Obra "${updated.name}" actualizada`);
            onClose();
          },
          onError: handleError,
        },
      );
    } else {
      createMut.mutate(payload, {
        onSuccess: (created) => {
          toast.success(`Obra "${created.name}" creada`, {
            description: `Código asignado: ${created.code}`,
            duration: 6000,
          });
          onClose();
        },
        onError: handleError,
      });
    }
  };

  const toUpperOnChange =
    (field: keyof FormData) => (e: React.ChangeEvent<HTMLInputElement>) => {
      setValue(field, e.target.value.toUpperCase(), { shouldValidate: isSubmitted });
    };

  const status = watch('status');
  const startDate = watch('startDate');
  const description = watch('description') ?? '';
  const responsibleUserId = watch('responsibleUserId');
  const selectedStatusMeta = STATUS_META.find((s) => s.value === status);
  const startDateObj = startDate ? new Date(startDate + 'T00:00:00') : undefined;
  const selectedUser =
    users.find((u) => u.id === responsibleUserId) ?? lastSelectedUser ?? null;

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>{isEdit ? 'Editar obra' : 'Nueva obra'}</DialogTitle>
          <DialogDescription>
            Proyecto o fuente de trabajo donde se ejecutan actividades constructivas.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          {/* Nombre */}
          <div className="space-y-1.5">
            <Label htmlFor="obra-name">
              Nombre <span className="text-destructive">*</span>
            </Label>
            <Input
              id="obra-name"
              {...register('name')}
              onChange={toUpperOnChange('name')}
              placeholder="EDIFICIO PLAZA SAN ISIDRO"
              autoComplete="off"
            />
            <p className="text-[11px] text-muted-foreground">
              Nombre oficial del proyecto · Se escribe en mayúsculas automáticamente
            </p>
            {errors.name && (
              <p className="text-xs text-destructive">{errors.name.message}</p>
            )}
          </div>

          {/* Cliente */}
          <div className="space-y-1.5">
            <Label htmlFor="obra-client">Cliente</Label>
            <Input
              id="obra-client"
              {...register('client')}
              onChange={toUpperOnChange('client')}
              placeholder="INMOBILIARIA XYZ S.A.C."
              autoComplete="off"
            />
            <p className="text-[11px] text-muted-foreground">
              Opcional · Empresa o persona que encarga la obra
            </p>
            {errors.client && (
              <p className="text-xs text-destructive">{errors.client.message}</p>
            )}
          </div>

          {/* Dirección */}
          <div className="space-y-1.5">
            <Label htmlFor="obra-address">Dirección</Label>
            <Input
              id="obra-address"
              {...register('address')}
              onChange={toUpperOnChange('address')}
              placeholder="AV. AREQUIPA 1234, SAN ISIDRO"
              autoComplete="off"
            />
            <p className="text-[11px] text-muted-foreground">
              Opcional · Ubicación física de la obra
            </p>
            {errors.address && (
              <p className="text-xs text-destructive">{errors.address.message}</p>
            )}
          </div>

          {/* Fechas */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Fecha inicio</Label>
              <DatePicker
                value={startDate ?? ''}
                onChange={(v) =>
                  setValue('startDate', v, { shouldValidate: isSubmitted })
                }
                placeholder="Selecciona fecha"
              />
              <p className="text-[11px] text-muted-foreground">Opcional</p>
            </div>
            <div className="space-y-1.5">
              <Label>Fecha fin estimada</Label>
              <DatePicker
                value={watch('endDate') ?? ''}
                onChange={(v) => setValue('endDate', v, { shouldValidate: isSubmitted })}
                placeholder="Selecciona fecha"
                fromDate={startDateObj}
              />
              <p className="text-[11px] text-muted-foreground">Opcional</p>
              {errors.endDate && (
                <p className="text-xs text-destructive">{errors.endDate.message}</p>
              )}
            </div>
          </div>

          {/* Estado + Responsable */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>
                Estado <span className="text-destructive">*</span>
              </Label>
              <Select
                value={status}
                onValueChange={(v) =>
                  setValue('status', v as ObraStatus, { shouldValidate: isSubmitted })
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {STATUS_META.map((s) => (
                    <SelectItem key={s.value} value={s.value}>
                      {s.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {selectedStatusMeta && (
                <p className="text-[11px] text-muted-foreground leading-snug">
                  {selectedStatusMeta.description}
                </p>
              )}
            </div>

            <div className="space-y-1.5">
              <Label>
                Responsable <span className="text-destructive">*</span>
              </Label>
              <SearchCombobox<User>
                value={responsibleUserId}
                onChange={(id, user) => {
                  setValue('responsibleUserId', id, { shouldValidate: true });
                  if (user) setLastSelectedUser(user);
                }}
                items={users}
                isLoading={usersFetching}
                onSearchChange={setUserSearch}
                getId={(u) => u.id}
                getLabel={(u) => `${u.firstName} ${u.lastName}`.toUpperCase()}
                selectedItem={selectedUser}
                placeholder="Buscar usuario..."
                emptyMessage="Sin resultados"
                renderItem={(u) => (
                  <div className="flex items-center justify-between w-full gap-2">
                    <span className="truncate text-sm uppercase">
                      {u.firstName} {u.lastName}
                    </span>
                    <span
                      className={`shrink-0 rounded px-1.5 py-0.5 text-[10px] font-medium ${ROLE_CLASS[u.role.name] ?? 'bg-muted text-muted-foreground'}`}
                    >
                      {ROLE_LABEL[u.role.name] ?? u.role.name}
                    </span>
                  </div>
                )}
                error={!!errors.responsibleUserId}
              />
              <p className="text-[11px] text-muted-foreground">
                Usuario que gestiona esta obra
              </p>
              {errors.responsibleUserId && (
                <p className="text-xs text-destructive">
                  {errors.responsibleUserId.message}
                </p>
              )}
            </div>
          </div>

          {/* Descripción */}
          <div className="space-y-1.5">
            <Label htmlFor="obra-desc">Descripción</Label>
            <Textarea
              id="obra-desc"
              {...register('description')}
              placeholder="Detalles adicionales del proyecto..."
              rows={2}
              className="resize-none"
            />
            <div className="flex justify-between">
              <p className="text-[11px] text-muted-foreground">Opcional</p>
              <p className="text-[11px] text-muted-foreground tabular-nums">
                {description.length}/1000
              </p>
            </div>
            {errors.description && (
              <p className="text-xs text-destructive">{errors.description.message}</p>
            )}
          </div>

          <div className="flex justify-end gap-2 pt-2 border-t">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              disabled={isPending}
            >
              Cancelar
            </Button>
            <Button type="submit" disabled={isPending || (isSubmitted && !isValid)}>
              {isPending
                ? isEdit
                  ? 'Guardando...'
                  : 'Creando...'
                : isEdit
                  ? 'Guardar cambios'
                  : 'Crear obra'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
