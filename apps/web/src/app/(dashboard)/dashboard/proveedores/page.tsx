'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { type ColumnDef } from '@tanstack/react-table';
import { Edit2, Mail, Phone, Plus, Trash2, Truck, User } from 'lucide-react';
import { useState } from 'react';
import { type UseFormSetError, useForm } from 'react-hook-form';
import { toast } from 'sonner';
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
  type Supplier,
  useCreateSupplier,
  useDeleteSupplier,
  useSuppliers,
  useUpdateSupplier,
} from '@/hooks/use-suppliers';

const schema = z.object({
  name: z.string().min(2, 'Mínimo 2 caracteres').max(200, 'Máximo 200 caracteres'),
  taxId: z
    .string()
    .min(1, 'El RUC es requerido')
    .regex(/^\d{11}$/, 'El RUC debe tener exactamente 11 dígitos numéricos'),
  contactName: z.string().max(100, 'Máximo 100 caracteres').optional().or(z.literal('')),
  phone: z
    .string()
    .min(1, 'El teléfono es requerido')
    .max(15, 'Máximo 15 caracteres')
    .refine((v) => /^[+\d\s\-()]{7,15}$/.test(v), {
      message: 'Formato inválido (ej: 987654321 o +51987654321)',
    }),
  email: z
    .string()
    .email('Email inválido (ej: ventas@proveedor.com)')
    .max(120)
    .optional()
    .or(z.literal('')),
  address: z
    .string()
    .min(1, 'La dirección es requerida')
    .max(300, 'Máximo 300 caracteres'),
  notes: z.string().max(500, 'Máximo 500 caracteres').optional().or(z.literal('')),
});

type FormData = z.infer<typeof schema>;

function SupplierForm({
  defaultValues,
  onSubmit,
  isPending,
  isEdit = false,
}: {
  defaultValues?: Partial<FormData>;
  onSubmit: (data: FormData, setError: UseFormSetError<FormData>) => void;
  isPending: boolean;
  isEdit?: boolean;
}) {
  const {
    register,
    handleSubmit,
    setValue,
    watch,
    setError,
    formState: { errors, isSubmitted, isValid },
  } = useForm<FormData>({
    resolver: zodResolver(schema),
    mode: 'onBlur',
    defaultValues: defaultValues ?? {
      name: '',
      taxId: '',
      contactName: '',
      phone: '',
      email: '',
      address: '',
      notes: '',
    },
  });

  const notes = watch('notes') ?? '';

  const toUpper = (field: keyof FormData) => (e: React.ChangeEvent<HTMLInputElement>) => {
    setValue(field, e.target.value.toUpperCase(), { shouldValidate: isSubmitted });
  };

  const digitsOnly =
    (field: keyof FormData, maxLen: number) =>
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const val = e.target.value.replace(/\D/g, '').slice(0, maxLen);
      setValue(field, val, { shouldValidate: isSubmitted });
    };

  const phoneFilter = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value.replace(/[^\d+\s\-()]/g, '').slice(0, 15);
    setValue('phone', val, { shouldValidate: isSubmitted });
  };

  return (
    <form
      onSubmit={handleSubmit((data) => onSubmit(data, setError))}
      className="space-y-4"
    >
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Razón social */}
        <div className="space-y-1.5 md:col-span-2">
          <Label htmlFor="sup-name">
            Razón social <span className="text-destructive">*</span>
          </Label>
          <Input
            id="sup-name"
            {...register('name')}
            onChange={toUpper('name')}
            placeholder="CEMENTOS PACASMAYO S.A.A."
            autoComplete="off"
          />
          <p className="text-[11px] text-muted-foreground">
            Nombre oficial de la empresa · Se escribe en mayúsculas automáticamente
          </p>
          {errors.name && (
            <p className="text-xs text-destructive">{errors.name.message}</p>
          )}
        </div>

        {/* RUC */}
        <div className="space-y-1.5">
          <Label htmlFor="sup-taxid">
            RUC <span className="text-destructive">*</span>
          </Label>
          <Input
            id="sup-taxid"
            {...register('taxId')}
            onChange={digitsOnly('taxId', 11)}
            placeholder="20100070970"
            autoComplete="off"
            maxLength={11}
          />
          <p className="text-[11px] text-muted-foreground">
            11 dígitos numéricos · Debe ser único
          </p>
          {errors.taxId && (
            <p className="text-xs text-destructive">{errors.taxId.message}</p>
          )}
        </div>

        {/* Persona de contacto */}
        <div className="space-y-1.5">
          <Label htmlFor="sup-contact">Persona de contacto</Label>
          <Input
            id="sup-contact"
            {...register('contactName')}
            onChange={toUpper('contactName')}
            placeholder="JUAN PÉREZ"
            autoComplete="off"
          />
          <p className="text-[11px] text-muted-foreground">Opcional</p>
          {errors.contactName && (
            <p className="text-xs text-destructive">{errors.contactName.message}</p>
          )}
        </div>

        {/* Teléfono */}
        <div className="space-y-1.5">
          <Label htmlFor="sup-phone">
            Teléfono <span className="text-destructive">*</span>
          </Label>
          <Input
            id="sup-phone"
            {...register('phone')}
            onChange={phoneFilter}
            placeholder="987654321"
            autoComplete="off"
          />
          <p className="text-[11px] text-muted-foreground">
            Celular (9 dígitos) o número con código de país (+51...)
          </p>
          {errors.phone && (
            <p className="text-xs text-destructive">{errors.phone.message}</p>
          )}
        </div>

        {/* Email */}
        <div className="space-y-1.5">
          <Label htmlFor="sup-email">Email</Label>
          <Input
            id="sup-email"
            {...register('email')}
            type="email"
            placeholder="ventas@proveedor.com"
            autoComplete="off"
          />
          <p className="text-[11px] text-muted-foreground">Opcional</p>
          {errors.email && (
            <p className="text-xs text-destructive">{errors.email.message}</p>
          )}
        </div>

        {/* Dirección */}
        <div className="space-y-1.5 md:col-span-2">
          <Label htmlFor="sup-address">
            Dirección <span className="text-destructive">*</span>
          </Label>
          <Input
            id="sup-address"
            {...register('address')}
            onChange={toUpper('address')}
            placeholder="AV. INDUSTRIAL 123, LIMA"
            autoComplete="off"
          />
          <p className="text-[11px] text-muted-foreground">
            Dirección fiscal o comercial
          </p>
          {errors.address && (
            <p className="text-xs text-destructive">{errors.address.message}</p>
          )}
        </div>

        {/* Notas */}
        <div className="space-y-1.5 md:col-span-2">
          <Label htmlFor="sup-notes">Notas</Label>
          <Textarea
            id="sup-notes"
            {...register('notes')}
            placeholder="Términos de pago, condiciones especiales, tiempo de entrega..."
            rows={2}
            className="resize-none"
          />
          <div className="flex justify-between">
            <p className="text-[11px] text-muted-foreground">Opcional</p>
            <p className="text-[11px] text-muted-foreground tabular-nums">
              {notes.length}/500
            </p>
          </div>
          {errors.notes && (
            <p className="text-xs text-destructive">{errors.notes.message}</p>
          )}
        </div>
      </div>

      <Button
        type="submit"
        className="w-full"
        disabled={isPending || (isSubmitted && !isValid)}
      >
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

  const handleCreate = (dto: FormData, setError: UseFormSetError<FormData>) => {
    createMutation.mutate(
      {
        name: dto.name.trim(),
        taxId: dto.taxId?.trim() || undefined,
        contactName: dto.contactName?.trim() || undefined,
        phone: dto.phone?.trim() || undefined,
        email: dto.email?.trim() || undefined,
        address: dto.address?.trim() || undefined,
        notes: dto.notes?.trim() || undefined,
      },
      {
        onSuccess: (created) => {
          toast.success(`Proveedor "${created.name}" creado`, {
            description: `Código: ${created.code}`,
            duration: 6000,
          });
          setIsCreating(false);
        },
        onError: (e: any) => {
          const code = e.response?.data?.error?.code as string | undefined;
          const message = e.response?.data?.error?.message as string | undefined;
          if (code === 'TAX_ID_ALREADY_REGISTERED' || code === 'SUPPLIER_TAX_ID_EXISTS') {
            setError('taxId', { message: 'Este RUC ya está registrado' });
          } else if (
            code === 'SUPPLIER_ALREADY_EXISTS' ||
            code === 'NAME_ALREADY_TAKEN'
          ) {
            setError('name', { message: 'Ya existe un proveedor con ese nombre' });
          } else {
            toast.error(message ?? 'Error al crear proveedor');
          }
        },
      },
    );
  };

  const handleUpdate = (dto: FormData, setError: UseFormSetError<FormData>) => {
    if (!editTarget) return;
    updateMutation.mutate(
      {
        id: editTarget.id,
        dto: {
          name: dto.name.trim(),
          taxId: dto.taxId?.trim() || undefined,
          contactName: dto.contactName?.trim() || undefined,
          phone: dto.phone?.trim() || undefined,
          email: dto.email?.trim() || undefined,
          address: dto.address?.trim() || undefined,
          notes: dto.notes?.trim() || undefined,
        },
      },
      {
        onSuccess: (updated: Supplier) => {
          toast.success(`Proveedor "${updated.name}" actualizado`);
          setEditTarget(null);
        },
        onError: (e: any) => {
          const code = e.response?.data?.error?.code as string | undefined;
          const message = e.response?.data?.error?.message as string | undefined;
          if (code === 'TAX_ID_ALREADY_REGISTERED' || code === 'SUPPLIER_TAX_ID_EXISTS') {
            setError('taxId', {
              message: 'Este RUC ya está registrado en otro proveedor',
            });
          } else {
            toast.error(message ?? 'Error al actualizar proveedor');
          }
        },
      },
    );
  };

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

      {/* Modal crear */}
      <Dialog open={isCreating} onOpenChange={(v) => !v && setIsCreating(false)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Nuevo proveedor</DialogTitle>
          </DialogHeader>
          <SupplierForm onSubmit={handleCreate} isPending={createMutation.isPending} />
        </DialogContent>
      </Dialog>

      {/* Modal editar */}
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
              onSubmit={handleUpdate}
              isPending={updateMutation.isPending}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
