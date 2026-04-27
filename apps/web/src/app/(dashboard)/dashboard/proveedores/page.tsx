'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { type ColumnDef } from '@tanstack/react-table';
import { Edit2, Mail, Phone, Plus, Trash2, Truck, User } from 'lucide-react';
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
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useDebounce } from '@/hooks/use-debounce';
import {
  type Supplier,
  useCreateSupplier,
  useDeleteSupplier,
  useSuppliers,
  useUpdateSupplier,
} from '@/hooks/use-suppliers';

const schema = z.object({
  name: z.string().min(2, 'Requerido, mínimo 2 caracteres').max(200),
  taxId: z.string().max(20).optional().or(z.literal('')),
  contactName: z.string().max(100).optional().or(z.literal('')),
  phone: z.string().max(30).optional().or(z.literal('')),
  email: z.string().email('Email inválido').max(120).optional().or(z.literal('')),
  address: z.string().max(300).optional().or(z.literal('')),
  notes: z.string().max(500).optional().or(z.literal('')),
});
type FormData = z.infer<typeof schema>;

function SupplierForm({
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
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-1.5 md:col-span-2">
          <Label>Razón social *</Label>
          <Input {...register('name')} placeholder="Cementos Pacasmayo S.A.A." />
          {errors.name && (
            <p className="text-xs text-destructive">{errors.name.message}</p>
          )}
        </div>

        <div className="space-y-1.5">
          <Label>RUC / Documento</Label>
          <Input {...register('taxId')} placeholder="20100070970" />
          <p className="text-[11px] text-muted-foreground">
            Opcional. Debe ser único si se provee.
          </p>
          {errors.taxId && (
            <p className="text-xs text-destructive">{errors.taxId.message}</p>
          )}
        </div>

        <div className="space-y-1.5">
          <Label>Persona de contacto</Label>
          <Input {...register('contactName')} placeholder="Juan Pérez" />
        </div>

        <div className="space-y-1.5">
          <Label>Teléfono</Label>
          <Input {...register('phone')} placeholder="+51 987 654 321" />
        </div>

        <div className="space-y-1.5">
          <Label>Email</Label>
          <Input {...register('email')} type="email" placeholder="ventas@proveedor.com" />
          {errors.email && (
            <p className="text-xs text-destructive">{errors.email.message}</p>
          )}
        </div>

        <div className="space-y-1.5 md:col-span-2">
          <Label>Dirección</Label>
          <Input {...register('address')} placeholder="Av. Industrial 123, Lima" />
        </div>

        <div className="space-y-1.5 md:col-span-2">
          <Label>Notas</Label>
          <Input
            {...register('notes')}
            placeholder="Términos de pago, condiciones especiales, etc."
          />
        </div>
      </div>

      <Button type="submit" className="w-full" disabled={isPending}>
        {isPending ? 'Guardando...' : isEdit ? 'Guardar cambios' : 'Crear proveedor'}
      </Button>
    </form>
  );
}

export default function ProveedoresPage() {
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebounce(search, 300);
  const [editTarget, setEditTarget] = useState<Supplier | null>(null);
  const [isCreating, setIsCreating] = useState(false);

  const { data, isLoading } = useSuppliers({
    page,
    pageSize,
    search: debouncedSearch || undefined,
    includeInactive: true,
  });
  const createMutation = useCreateSupplier();
  const updateMutation = useUpdateSupplier();
  const deleteMutation = useDeleteSupplier();
  const confirm = useConfirm();

  const columns: ColumnDef<Supplier>[] = [
    rowNumberColumn<Supplier>({ page, pageSize }),
    {
      accessorKey: 'code',
      header: 'Código',
      size: 120,
      cell: ({ row }) => (
        <span className="font-mono text-xs font-semibold">{row.original.code}</span>
      ),
    },
    {
      accessorKey: 'name',
      header: 'Razón social',
      cell: ({ row }) => <span className="font-medium">{row.original.name}</span>,
    },
    {
      accessorKey: 'taxId',
      header: 'RUC / Doc.',
      size: 140,
      cell: ({ row }) =>
        row.original.taxId ? (
          <span className="font-mono text-xs">{row.original.taxId}</span>
        ) : (
          <span className="text-muted-foreground">—</span>
        ),
    },
    {
      id: 'contact',
      header: 'Contacto',
      cell: ({ row }) => {
        const { contactName, phone, email } = row.original;
        if (!contactName && !phone && !email) {
          return <span className="text-muted-foreground">—</span>;
        }
        return (
          <div className="space-y-0.5 text-xs text-muted-foreground">
            {contactName && (
              <p className="flex items-center justify-center gap-1.5">
                <User className="h-3 w-3" />
                {contactName}
              </p>
            )}
            {phone && (
              <p className="flex items-center justify-center gap-1.5">
                <Phone className="h-3 w-3" />
                <span className="font-mono">{phone}</span>
              </p>
            )}
            {email && (
              <p className="flex items-center justify-center gap-1.5">
                <Mail className="h-3 w-3" />
                <span className="truncate">{email}</span>
              </p>
            )}
          </div>
        );
      },
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
      size: 130,
      cell: ({ row }) => (
        <div className="flex gap-1.5 justify-center">
          <ActionButton
            icon={Edit2}
            label="Editar proveedor"
            tone="accent"
            onClick={() => setEditTarget(row.original)}
          />
          <ActionButton
            icon={Trash2}
            label="Eliminar proveedor"
            tone="destructive"
            onClick={async () => {
              const ok = await confirm({
                title: `Eliminar proveedor "${row.original.name}"`,
                description:
                  'No podrá eliminarse si tiene movimientos de compra vinculados. Considera desactivarlo para preservar el histórico.',
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
    <div className="space-y-6">
      <PageHeader
        title="Proveedores"
        description="Catálogo de proveedores para registrar compras y trazabilidad"
        icon={Truck}
        actions={
          <Button onClick={() => setIsCreating(true)} className="gap-2">
            <Plus className="h-4 w-4" /> Nuevo proveedor
          </Button>
        }
      />

      <Input
        placeholder="Buscar por nombre, código, RUC o contacto..."
        value={search}
        onChange={(e) => {
          setSearch(e.target.value);
          setPage(1);
        }}
        className="max-w-sm"
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
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Nuevo proveedor</DialogTitle>
          </DialogHeader>
          <SupplierForm
            onSubmit={(dto) =>
              createMutation.mutate(
                {
                  name: dto.name,
                  taxId: dto.taxId || undefined,
                  contactName: dto.contactName || undefined,
                  phone: dto.phone || undefined,
                  email: dto.email || undefined,
                  address: dto.address || undefined,
                  notes: dto.notes || undefined,
                },
                { onSuccess: () => setIsCreating(false) },
              )
            }
            isPending={createMutation.isPending}
          />
        </DialogContent>
      </Dialog>

      <Dialog open={!!editTarget} onOpenChange={(v) => !v && setEditTarget(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Editar proveedor</DialogTitle>
          </DialogHeader>
          {editTarget && (
            <SupplierForm
              isEdit
              defaultValues={{
                name: editTarget.name,
                taxId: editTarget.taxId ?? '',
                contactName: editTarget.contactName ?? '',
                phone: editTarget.phone ?? '',
                email: editTarget.email ?? '',
                address: editTarget.address ?? '',
                notes: editTarget.notes ?? '',
              }}
              onSubmit={(dto) =>
                updateMutation.mutate(
                  {
                    id: editTarget.id,
                    dto: {
                      name: dto.name,
                      taxId: dto.taxId || undefined,
                      contactName: dto.contactName || undefined,
                      phone: dto.phone || undefined,
                      email: dto.email || undefined,
                      address: dto.address || undefined,
                      notes: dto.notes || undefined,
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
