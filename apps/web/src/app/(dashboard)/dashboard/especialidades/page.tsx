'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { type ColumnDef } from '@tanstack/react-table';
import { Edit2, HardHat, Plus, Trash2 } from 'lucide-react';
import { useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';

import { DataTable } from '@/components/data-table/data-table';
import { rowNumberColumn } from '@/components/data-table/row-number-column';
import { PageHeader } from '@/components/layout/page-header';
import { ActionButton } from '@/components/ui/action-button';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useConfirm } from '@/components/ui/confirm-provider';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useDebounce } from '@/hooks/use-debounce';
import {
  type Specialty,
  useCreateSpecialty,
  useDeleteSpecialty,
  useSpecialties,
  useUpdateSpecialty,
} from '@/hooks/use-specialties';

const schema = z.object({
  name: z.string().min(2, 'Mínimo 2 caracteres').max(100),
  description: z.string().max(500).optional().or(z.literal('')),
});
type FormData = z.infer<typeof schema>;

function SpecialtyForm({
  defaultValues,
  onSubmit,
  isPending,
  isEdit = false,
}: {
  defaultValues?: Partial<FormData>;
  onSubmit: (data: FormData) => void;
  isPending: boolean;
  isEdit?: boolean;
}) {
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues,
  });

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <div className="space-y-1.5">
        <Label>Nombre *</Label>
        <Input {...register('name')} placeholder="Albañil, Electricista, etc." />
        {errors.name && <p className="text-xs text-destructive">{errors.name.message}</p>}
      </div>

      <div className="space-y-1.5">
        <Label>Descripción</Label>
        <Textarea
          {...register('description')}
          rows={3}
          placeholder="Qué hace este oficio (opcional)"
        />
      </div>

      <Button type="submit" className="w-full" disabled={isPending}>
        {isPending ? 'Guardando...' : isEdit ? 'Guardar cambios' : 'Crear especialidad'}
      </Button>
    </form>
  );
}

export default function EspecialidadesPage() {
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebounce(search, 300);
  const [editTarget, setEditTarget] = useState<Specialty | null>(null);
  const [isCreating, setIsCreating] = useState(false);

  const { data: specialties, isLoading } = useSpecialties({
    search: debouncedSearch || undefined,
    includeInactive: true,
  });
  const createMutation = useCreateSpecialty();
  const updateMutation = useUpdateSpecialty();
  const deleteMutation = useDeleteSpecialty();
  const confirm = useConfirm();

  const columns: ColumnDef<Specialty>[] = useMemo(
    () => [
      rowNumberColumn<Specialty>({ page: 1, pageSize: specialties?.length ?? 0 }),
      {
        accessorKey: 'code',
        header: 'Código',
        size: 140,
        cell: ({ row }) => (
          <span className="font-mono text-xs font-semibold">{row.original.code}</span>
        ),
      },
      {
        accessorKey: 'name',
        header: 'Nombre',
        cell: ({ row }) => <span className="font-medium">{row.original.name}</span>,
      },
      {
        accessorKey: 'description',
        header: 'Descripción',
        cell: ({ row }) =>
          row.original.description ? (
            <span className="text-xs text-muted-foreground">
              {row.original.description}
            </span>
          ) : (
            <span className="text-muted-foreground">—</span>
          ),
      },
      {
        accessorKey: 'active',
        header: 'Estado',
        size: 90,
        cell: ({ row }) => (
          <Badge variant={row.original.active ? 'success' : 'secondary'}>
            {row.original.active ? 'Activa' : 'Inactiva'}
          </Badge>
        ),
      },
      {
        id: 'actions',
        header: 'Acciones',
        size: 130,
        cell: ({ row }) => (
          <div className="flex gap-1.5 justify-center">
            <ActionButton
              icon={Edit2}
              label="Editar especialidad"
              tone="accent"
              onClick={() => setEditTarget(row.original)}
            />
            <ActionButton
              icon={Trash2}
              label="Eliminar especialidad"
              tone="destructive"
              onClick={async () => {
                const ok = await confirm({
                  title: `Eliminar especialidad "${row.original.name}"`,
                  description:
                    'No podrá eliminarse si hay empleados asignados a esta especialidad.',
                  confirmText: 'Eliminar',
                  tone: 'destructive',
                });
                if (ok) deleteMutation.mutate(row.original.id);
              }}
            />
          </div>
        ),
      },
    ],
    [specialties?.length, confirm, deleteMutation],
  );

  return (
    <div className="space-y-6">
      <PageHeader
        title="Especialidades"
        description="Oficios o roles de los empleados de campo (albañil, electricista, etc.)"
        icon={HardHat}
        actions={
          <Button onClick={() => setIsCreating(true)} className="gap-2">
            <Plus className="h-4 w-4" /> Nueva especialidad
          </Button>
        }
      />

      <Input
        placeholder="Buscar por nombre o código..."
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        className="max-w-sm"
      />

      <DataTable
        columns={columns}
        data={specialties ?? []}
        isLoading={isLoading}
        page={1}
        pageSize={specialties?.length ?? 10}
        total={specialties?.length ?? 0}
        onPageChange={() => {}}
      />

      <Dialog open={isCreating} onOpenChange={setIsCreating}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Nueva especialidad</DialogTitle>
          </DialogHeader>
          <SpecialtyForm
            onSubmit={(dto) =>
              createMutation.mutate(
                {
                  name: dto.name,
                  description: dto.description || undefined,
                },
                { onSuccess: () => setIsCreating(false) },
              )
            }
            isPending={createMutation.isPending}
          />
        </DialogContent>
      </Dialog>

      <Dialog open={!!editTarget} onOpenChange={(v) => !v && setEditTarget(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Editar especialidad</DialogTitle>
          </DialogHeader>
          {editTarget && (
            <SpecialtyForm
              isEdit
              defaultValues={{
                name: editTarget.name,
                description: editTarget.description ?? '',
              }}
              onSubmit={(dto) =>
                updateMutation.mutate(
                  {
                    id: editTarget.id,
                    dto: {
                      name: dto.name,
                      description: dto.description || undefined,
                    },
                  },
                  { onSuccess: () => setEditTarget(null) },
                )
              }
              isPending={updateMutation.isPending}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
