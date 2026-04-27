'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { type ColumnDef } from '@tanstack/react-table';
import { Edit2, Plus, Star, Trash2, Warehouse as WarehouseIcon } from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';

import { DataTable } from '@/components/data-table/data-table';
import { rowNumberColumn } from '@/components/data-table/row-number-column';
import { PageHeader } from '@/components/layout/page-header';
import { ActionButton } from '@/components/ui/action-button';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useConfirm } from '@/components/ui/confirm-provider';
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
import { useDebounce } from '@/hooks/use-debounce';
import { useObras } from '@/hooks/use-obras';
import {
  type Warehouse,
  useCreateWarehouse,
  useDeleteWarehouse,
  useUpdateWarehouse,
  useWarehouses,
} from '@/hooks/use-warehouses';

const WAREHOUSE_TYPE_LABELS: Record<string, string> = {
  CENTRAL: 'Principal',
  OBRA: 'De obra',
};

// Solo tipo OBRA puede crearse desde el CRUD.
// El Almacén Principal (CENTRAL) se crea en el seed y solo se pueden editar sus datos (sin obra).
const schema = z.object({
  name: z.string().min(1, 'Requerido').max(100),
  obraId: z.string().optional().or(z.literal('')),
  location: z.string().max(200).optional().or(z.literal('')),
  description: z.string().max(500).optional().or(z.literal('')),
});

type FormData = z.infer<typeof schema>;

function WarehouseForm({
  defaultValues,
  onSubmit,
  isPending,
  requiresObra = true,
}: {
  defaultValues?: Partial<FormData>;
  onSubmit: (data: FormData) => void;
  isPending: boolean;
  requiresObra?: boolean;
}) {
  const { data: obras } = useObras({ pageSize: 100 });
  const {
    register,
    handleSubmit,
    setValue,
    watch,
    setError,
    formState: { errors },
  } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      obraId: '',
      name: '',
      location: '',
      description: '',
      ...defaultValues,
    },
  });

  const handleInternalSubmit = (data: FormData) => {
    if (requiresObra && !data.obraId) {
      setError('obraId', { message: 'La obra es obligatoria' });
      return;
    }
    onSubmit(data);
  };

  return (
    <form onSubmit={handleSubmit(handleInternalSubmit)} className="space-y-4">
      <div className="space-y-1.5">
        <Label>Nombre *</Label>
        <Input
          {...register('name')}
          placeholder={
            requiresObra ? 'Caseta principal Plaza San Isidro' : 'Almacén Principal'
          }
        />
        {errors.name && <p className="text-xs text-destructive">{errors.name.message}</p>}
      </div>

      {requiresObra && (
        <div className="space-y-1.5">
          <Label>Obra *</Label>
          <Select value={watch('obraId')} onValueChange={(v) => setValue('obraId', v)}>
            <SelectTrigger>
              <SelectValue placeholder="Seleccionar obra..." />
            </SelectTrigger>
            <SelectContent>
              {obras?.items.map((o) => (
                <SelectItem key={o.id} value={o.id}>
                  {o.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {errors.obraId && (
            <p className="text-xs text-destructive">{errors.obraId.message}</p>
          )}
        </div>
      )}
      <div className="space-y-1.5">
        <Label>Ubicación</Label>
        <Input {...register('location')} placeholder="Dirección o referencia" />
      </div>
      <div className="space-y-1.5">
        <Label>Descripción</Label>
        <Input {...register('description')} placeholder="Opcional" />
      </div>
      <Button type="submit" className="w-full" disabled={isPending}>
        {isPending ? 'Guardando...' : 'Guardar'}
      </Button>
    </form>
  );
}

export default function AlmacenesPage() {
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebounce(search, 300);
  const [editTarget, setEditTarget] = useState<Warehouse | null>(null);
  const [isCreating, setIsCreating] = useState(false);

  const { data, isLoading } = useWarehouses({
    page,
    pageSize,
    search: debouncedSearch || undefined,
  });
  const createMutation = useCreateWarehouse();
  const updateMutation = useUpdateWarehouse();
  const deleteMutation = useDeleteWarehouse();
  const confirm = useConfirm();

  const columns: ColumnDef<Warehouse>[] = [
    rowNumberColumn<Warehouse>({ page, pageSize }),
    {
      accessorKey: 'name',
      header: 'Nombre',
      cell: ({ row }) => (
        <Link
          href={`/dashboard/almacenes/${row.original.id}`}
          className="group flex items-center gap-2 -mx-2 px-2 py-1 rounded hover:bg-muted/60 transition-colors"
        >
          {row.original.type === 'CENTRAL' && (
            <span
              className="inline-flex items-center justify-center h-5 w-5 rounded bg-accent/10 text-accent shrink-0"
              title="Almacén Principal"
            >
              <Star className="h-3 w-3 fill-current" />
            </span>
          )}
          <span className="font-medium group-hover:text-accent transition-colors truncate">
            {row.original.name}
          </span>
        </Link>
      ),
    },
    {
      accessorKey: 'type',
      header: 'Tipo',
      size: 100,
      cell: ({ row }) => (
        <Badge variant={row.original.type === 'CENTRAL' ? 'info' : 'outline'}>
          {WAREHOUSE_TYPE_LABELS[row.original.type] ?? row.original.type}
        </Badge>
      ),
    },
    {
      id: 'obra',
      header: 'Obra',
      cell: ({ row }) =>
        row.original.obra ? (
          <span className="text-sm">{row.original.obra.name}</span>
        ) : (
          <span className="text-xs text-muted-foreground">—</span>
        ),
    },
    {
      accessorKey: 'location',
      header: 'Ubicación',
      cell: ({ row }) => row.original.location ?? '—',
    },
    {
      accessorKey: 'active',
      header: 'Estado',
      size: 90,
      cell: ({ row }) => (
        <Badge variant={row.original.active ? 'success' : 'secondary'}>
          {row.original.active ? 'Activo' : 'Inactivo'}
        </Badge>
      ),
    },
    {
      id: 'actions',
      header: 'Acciones',
      size: 120,
      cell: ({ row }) => {
        const isPrincipal = row.original.type === 'CENTRAL';
        return (
          <div className="flex gap-1.5">
            <ActionButton
              icon={Edit2}
              label="Editar almacén"
              tone="accent"
              onClick={() => setEditTarget(row.original)}
            />
            <ActionButton
              icon={Trash2}
              label={
                isPrincipal
                  ? 'El Almacén Principal no se puede eliminar'
                  : 'Eliminar almacén'
              }
              tone="destructive"
              disabled={isPrincipal}
              onClick={async () => {
                const ok = await confirm({
                  title: `Eliminar almacén "${row.original.name}"`,
                  description:
                    'No podrá eliminarse si tiene stock, movimientos o transferencias registradas.',
                  confirmText: 'Eliminar',
                  tone: 'destructive',
                });
                if (ok) deleteMutation.mutate(row.original.id);
              }}
            />
          </div>
        );
      },
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Almacenes"
        description="Almacén Principal (único, auto-creado) y almacenes de obras"
        icon={WarehouseIcon}
        actions={
          <Button onClick={() => setIsCreating(true)} className="gap-2">
            <Plus className="h-4 w-4" /> Nuevo almacén de obra
          </Button>
        }
      />

      <div className="rounded-lg border border-blue-200/50 dark:border-blue-900/30 bg-blue-50/50 dark:bg-blue-950/20 p-3 text-xs flex items-start gap-2">
        <Star className="h-3.5 w-3.5 text-blue-600 dark:text-blue-400 mt-0.5 shrink-0 fill-current" />
        <p className="text-blue-900 dark:text-blue-200">
          El <strong>Almacén Principal</strong> es único y no se puede eliminar. Es el
          punto de entrada de todas las compras. Desde aquí solo se crean almacenes{' '}
          <strong>de obra</strong>.
        </p>
      </div>

      <div className="flex gap-3">
        <Input
          placeholder="Buscar almacén..."
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setPage(1);
          }}
          className="max-w-xs"
        />
      </div>

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
            <DialogTitle>Nuevo almacén de obra</DialogTitle>
            <DialogDescription>
              Almacén asignado a una obra específica. Recibe materiales por transferencia
              desde el Almacén Principal.
            </DialogDescription>
          </DialogHeader>
          <WarehouseForm
            onSubmit={(dto) =>
              createMutation.mutate(
                {
                  ...dto,
                  type: 'OBRA',
                  obraId: dto.obraId,
                  location: dto.location || undefined,
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
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Editar almacén</DialogTitle>
            <DialogDescription>
              {editTarget?.type === 'CENTRAL'
                ? 'Actualiza los datos del Almacén Principal. No puedes cambiar su tipo.'
                : 'Actualiza los datos del almacén de obra.'}
            </DialogDescription>
          </DialogHeader>
          {editTarget && (
            <WarehouseForm
              requiresObra={editTarget.type === 'OBRA'}
              defaultValues={{
                name: editTarget.name,
                obraId: editTarget.obraId ?? '',
                location: editTarget.location ?? '',
                description: editTarget.description ?? '',
              }}
              onSubmit={(dto) =>
                updateMutation.mutate(
                  {
                    id: editTarget.id,
                    ...dto,
                    obraId:
                      editTarget.type === 'OBRA' ? dto.obraId || undefined : undefined,
                    location: dto.location || undefined,
                    description: dto.description || undefined,
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
