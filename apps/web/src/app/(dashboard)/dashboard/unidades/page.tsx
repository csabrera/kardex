'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { type ColumnDef } from '@tanstack/react-table';
import { Edit2, Plus, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';

import { DataTable } from '@/components/data-table/data-table';
import { rowNumberColumn } from '@/components/data-table/row-number-column';
import { ActionButton } from '@/components/ui/action-button';
import { Button } from '@/components/ui/button';
import { useConfirm } from '@/components/ui/confirm-provider';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useDebounce } from '@/hooks/use-debounce';
import {
  type Unit,
  useCreateUnit,
  useDeleteUnit,
  useUnits,
  useUpdateUnit,
} from '@/hooks/use-units';

const schema = z.object({
  name: z.string().min(1, 'Requerido').max(100),
  abbreviation: z.string().min(1, 'Requerida').max(10),
});
type FormData = z.infer<typeof schema>;

function UnitForm({
  defaultValues,
  onSubmit,
  isPending,
}: {
  defaultValues?: Partial<FormData>;
  onSubmit: (data: FormData) => void;
  isPending: boolean;
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
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <Label>Nombre *</Label>
          <Input {...register('name')} placeholder="Kilogramo" />
          {errors.name && (
            <p className="text-xs text-destructive">{errors.name.message}</p>
          )}
        </div>
        <div className="space-y-1.5">
          <Label>Abreviatura *</Label>
          <Input {...register('abbreviation')} placeholder="kg" />
          {errors.abbreviation && (
            <p className="text-xs text-destructive">{errors.abbreviation.message}</p>
          )}
        </div>
      </div>
      <Button type="submit" className="w-full" disabled={isPending}>
        {isPending ? 'Guardando...' : 'Guardar'}
      </Button>
    </form>
  );
}

export default function UnidadesPage() {
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebounce(search, 300);
  const [editTarget, setEditTarget] = useState<Unit | null>(null);
  const [isCreating, setIsCreating] = useState(false);

  const { data, isLoading } = useUnits({
    page,
    pageSize,
    search: debouncedSearch || undefined,
  });
  const createMutation = useCreateUnit();
  const updateMutation = useUpdateUnit();
  const deleteMutation = useDeleteUnit();
  const confirm = useConfirm();

  const columns: ColumnDef<Unit>[] = [
    rowNumberColumn<Unit>({ page, pageSize }),
    { accessorKey: 'name', header: 'Nombre' },
    { accessorKey: 'abbreviation', header: 'Abreviatura', size: 120 },
    {
      id: 'actions',
      header: 'Acciones',
      size: 120,
      cell: ({ row }) => (
        <div className="flex gap-1.5">
          <ActionButton
            icon={Edit2}
            label="Editar unidad"
            tone="accent"
            onClick={() => setEditTarget(row.original)}
          />
          <ActionButton
            icon={Trash2}
            label="Eliminar unidad"
            tone="destructive"
            onClick={async () => {
              const ok = await confirm({
                title: `Eliminar unidad "${row.original.name}"`,
                description:
                  'Esta acción no se puede deshacer. Si la unidad está asociada a ítems, no podrá eliminarse.',
                confirmText: 'Eliminar',
                tone: 'destructive',
              });
              if (ok) deleteMutation.mutate(row.original.id);
            }}
          />
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Unidades de Medida</h1>
          <p className="text-sm text-muted-foreground">
            Unidades utilizadas en los ítems
          </p>
        </div>
        <Button onClick={() => setIsCreating(true)}>
          <Plus className="mr-2 h-4 w-4" /> Nueva unidad
        </Button>
      </div>

      <Input
        placeholder="Buscar unidad..."
        value={search}
        onChange={(e) => {
          setSearch(e.target.value);
          setPage(1);
        }}
        className="max-w-xs"
      />

      <DataTable
        columns={columns}
        data={data?.items ?? []}
        isLoading={isLoading}
        page={page}
        pageSize={pageSize}
        onPageSizeChange={setPageSize}
        total={data?.total ?? 0}
        onPageChange={setPage}
      />

      <Dialog open={isCreating} onOpenChange={setIsCreating}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Nueva unidad</DialogTitle>
          </DialogHeader>
          <UnitForm
            onSubmit={(dto) =>
              createMutation.mutate(dto, { onSuccess: () => setIsCreating(false) })
            }
            isPending={createMutation.isPending}
          />
        </DialogContent>
      </Dialog>

      <Dialog open={!!editTarget} onOpenChange={(v) => !v && setEditTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Editar unidad</DialogTitle>
          </DialogHeader>
          {editTarget && (
            <UnitForm
              defaultValues={editTarget}
              onSubmit={(dto) =>
                updateMutation.mutate(
                  { id: editTarget.id, ...dto },
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
