'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { type ColumnDef } from '@tanstack/react-table';
import { Plus, UserCheck, Users, UserX } from 'lucide-react';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';

import { DataTable } from '@/components/data-table/data-table';
import { rowNumberColumn } from '@/components/data-table/row-number-column';
import { PageHeader } from '@/components/layout/page-header';
import { ActionButton } from '@/components/ui/action-button';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
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
import {
  useUsers,
  useRoles,
  useCreateUser,
  useSetUserActive,
  type User,
} from '@/hooks/use-users';

const DOC_TYPES = ['DNI', 'CE', 'PASAPORTE'] as const;

const createSchema = z.object({
  documentType: z.enum(['DNI', 'CE', 'PASAPORTE']),
  documentNumber: z.string().min(7, 'Mínimo 7 caracteres'),
  password: z.string().min(6, 'Mínimo 6 caracteres'),
  firstName: z.string().min(1, 'Requerido'),
  lastName: z.string().min(1, 'Requerido'),
  email: z.string().email('Email inválido').optional().or(z.literal('')),
  roleId: z.string().min(1, 'Requerido'),
});

type CreateForm = z.infer<typeof createSchema>;

function CreateUserDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { data: roles } = useRoles();
  const mutation = useCreateUser();

  const {
    register,
    handleSubmit,
    setValue,
    reset,
    formState: { errors },
  } = useForm<CreateForm>({
    resolver: zodResolver(createSchema),
  });

  const onSubmit = (data: CreateForm) => {
    mutation.mutate(
      { ...data, email: data.email || undefined },
      {
        onSuccess: () => {
          reset();
          onClose();
        },
      },
    );
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Nuevo usuario</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Tipo documento *</Label>
              <Select
                onValueChange={(v) =>
                  setValue('documentType', v as 'DNI' | 'CE' | 'PASAPORTE')
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Tipo..." />
                </SelectTrigger>
                <SelectContent>
                  {DOC_TYPES.map((t) => (
                    <SelectItem key={t} value={t}>
                      {t}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {errors.documentType && (
                <p className="text-xs text-destructive">{errors.documentType.message}</p>
              )}
            </div>
            <div className="space-y-1.5">
              <Label>Número *</Label>
              <Input {...register('documentNumber')} placeholder="Ej: 12345678" />
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

          <div className="space-y-1.5">
            <Label>Email</Label>
            <Input {...register('email')} type="email" placeholder="Opcional" />
            {errors.email && (
              <p className="text-xs text-destructive">{errors.email.message}</p>
            )}
          </div>

          <div className="space-y-1.5">
            <Label>Contraseña inicial *</Label>
            <Input
              {...register('password')}
              type="password"
              placeholder="Mínimo 6 caracteres"
            />
            {errors.password && (
              <p className="text-xs text-destructive">{errors.password.message}</p>
            )}
          </div>

          <div className="space-y-1.5">
            <Label>Rol *</Label>
            <Select onValueChange={(v) => setValue('roleId', v)}>
              <SelectTrigger>
                <SelectValue placeholder="Seleccionar rol..." />
              </SelectTrigger>
              <SelectContent>
                {roles?.map((r) => (
                  <SelectItem key={r.id} value={r.id}>
                    {r.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {errors.roleId && (
              <p className="text-xs text-destructive">{errors.roleId.message}</p>
            )}
          </div>

          <div className="flex justify-end gap-2 pt-2 border-t">
            <Button type="button" variant="outline" onClick={onClose}>
              Cancelar
            </Button>
            <Button type="submit" disabled={mutation.isPending}>
              {mutation.isPending ? 'Creando...' : 'Crear usuario'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export default function UsuariosPage() {
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [search, setSearch] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const debouncedSearch = useDebounce(search, 300);

  const { data, isLoading } = useUsers({
    page,
    pageSize,
    search: debouncedSearch || undefined,
  });
  const setActive = useSetUserActive();

  const columns: ColumnDef<User>[] = [
    rowNumberColumn<User>({ page, pageSize }),
    {
      id: 'name',
      header: 'Usuario',
      cell: ({ row }) => (
        <div>
          <p className="font-medium text-sm">
            {row.original.firstName} {row.original.lastName}
          </p>
          <p className="text-xs text-muted-foreground font-mono">
            {row.original.documentType} {row.original.documentNumber}
          </p>
        </div>
      ),
    },
    {
      accessorKey: 'email',
      header: 'Email',
      cell: ({ getValue }) => (
        <span className="text-sm text-muted-foreground">
          {(getValue() as string) ?? '—'}
        </span>
      ),
    },
    {
      id: 'role',
      header: 'Rol',
      cell: ({ row }) => <Badge variant="outline">{row.original.role.name}</Badge>,
    },
    {
      id: 'status',
      header: 'Estado',
      size: 90,
      cell: ({ row }) => (
        <Badge variant={row.original.active ? 'success' : 'secondary'}>
          {row.original.active ? 'Activo' : 'Inactivo'}
        </Badge>
      ),
    },
    {
      id: 'createdAt',
      header: 'Creado',
      cell: ({ row }) => new Date(row.original.createdAt).toLocaleDateString('es-PE'),
    },
    {
      id: 'actions',
      header: 'Acciones',
      size: 100,
      cell: ({ row }) => (
        <div className="flex gap-1.5">
          {row.original.active ? (
            <ActionButton
              icon={UserX}
              label="Desactivar usuario"
              tone="warning"
              onClick={() => setActive.mutate({ id: row.original.id, active: false })}
              disabled={setActive.isPending}
            />
          ) : (
            <ActionButton
              icon={UserCheck}
              label="Activar usuario"
              tone="success"
              onClick={() => setActive.mutate({ id: row.original.id, active: true })}
              disabled={setActive.isPending}
            />
          )}
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Usuarios"
        description="Gestión de cuentas de acceso al sistema"
        icon={Users}
        actions={
          <Button className="gap-2" onClick={() => setShowCreate(true)}>
            <Plus className="h-4 w-4" /> Nuevo usuario
          </Button>
        }
      />

      <Input
        placeholder="Buscar por nombre, documento o email..."
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

      <CreateUserDialog open={showCreate} onClose={() => setShowCreate(false)} />
    </div>
  );
}
