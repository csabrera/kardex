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
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useConfirm } from '@/components/ui/confirm-provider';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  type Category,
  useCategories,
  useCreateCategory,
  useDeleteCategory,
  useUpdateCategory,
} from '@/hooks/use-categories';
import { useDebounce } from '@/hooks/use-debounce';

const schema = z.object({
  name: z.string().min(1, 'Requerido').max(100),
  description: z.string().max(500).optional(),
});
type FormData = z.infer<typeof schema>;

function CategoryForm({
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
      <div className="space-y-1.5">
        <Label>Nombre *</Label>
        <Input {...register('name')} placeholder="Ferretería" />
        {errors.name && <p className="text-xs text-destructive">{errors.name.message}</p>}
      </div>
      <div className="space-y-1.5">
        <Label>Descripción</Label>
        <Input {...register('description')} placeholder="Descripción opcional" />
      </div>
      <Button type="submit" className="w-full" disabled={isPending}>
        {isPending ? 'Guardando...' : 'Guardar'}
      </Button>
    </form>
  );
}

export default function CategoriasPage() {
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebounce(search, 300);
  const [editTarget, setEditTarget] = useState<Category | null>(null);
  const [isCreating, setIsCreating] = useState(false);

  const { data, isLoading } = useCategories({
    page,
    pageSize,
    search: debouncedSearch || undefined,
  });
  const createMutation = useCreateCategory();
  const updateMutation = useUpdateCategory();
  const deleteMutation = useDeleteCategory();
  const confirm = useConfirm();

  const columns: ColumnDef<Category>[] = [
    rowNumberColumn<Category>({ page, pageSize }),
    { accessorKey: 'name', header: 'Nombre' },
    {
      id: 'parent',
      header: 'Categoría padre',
      cell: ({ row }) =>
        row.original.parent?.name ?? <span className="text-muted-foreground">—</span>,
    },
    {
      id: 'items',
      header: 'Ítems',
      cell: ({ row }) => (
        <Badge variant="outline">{row.original._count?.items ?? 0}</Badge>
      ),
    },
    {
      id: 'actions',
      header: 'Acciones',
      size: 120,
      cell: ({ row }) => (
        <div className="flex gap-1.5">
          <ActionButton
            icon={Edit2}
            label="Editar categoría"
            tone="accent"
            onClick={() => setEditTarget(row.original)}
          />
          <ActionButton
            icon={Trash2}
            label="Eliminar categoría"
            tone="destructive"
            onClick={async () => {
              const ok = await confirm({
                title: `Eliminar categoría "${row.original.name}"`,
                description:
                  'No podrá eliminarse si tiene ítems o subcategorías asociadas.',
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
          <h1 className="text-2xl font-bold">Categorías</h1>
          <p className="text-sm text-muted-foreground">
            Organización jerárquica de ítems
          </p>
        </div>
        <Button onClick={() => setIsCreating(true)}>
          <Plus className="mr-2 h-4 w-4" /> Nueva categoría
        </Button>
      </div>

      <Input
        placeholder="Buscar categoría..."
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
            <DialogTitle>Nueva categoría</DialogTitle>
          </DialogHeader>
          <CategoryForm
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
            <DialogTitle>Editar categoría</DialogTitle>
          </DialogHeader>
          {editTarget && (
            <CategoryForm
              defaultValues={{
                ...editTarget,
                description: editTarget.description ?? undefined,
              }}
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
