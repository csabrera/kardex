'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { type ColumnDef } from '@tanstack/react-table';
import { Info, KeyRound, Plus, UserCheck, Users, UserX } from 'lucide-react';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';
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

const DOC_FORMAT: Record<
  (typeof DOC_TYPES)[number],
  { regex: RegExp; placeholder: string; helper: string; errorMsg: string }
> = {
  DNI: {
    regex: /^\d{8}$/,
    placeholder: '12345678',
    helper: '8 dígitos numéricos',
    errorMsg: 'DNI debe tener exactamente 8 dígitos numéricos',
  },
  CE: {
    regex: /^[A-Za-z0-9]{9,12}$/,
    placeholder: '001234567',
    helper: '9 a 12 caracteres alfanuméricos',
    errorMsg: 'Carnet de Extranjería: 9 a 12 caracteres alfanuméricos',
  },
  PASAPORTE: {
    regex: /^[A-Za-z0-9]{6,12}$/,
    placeholder: 'AB123456',
    helper: '6 a 12 caracteres alfanuméricos',
    errorMsg: 'Pasaporte: 6 a 12 caracteres alfanuméricos',
  },
};

// Letras (con tildes), espacios, guiones y apóstrofes — sin números ni símbolos.
const NAME_REGEX = /^[A-Za-zÁÉÍÓÚÜÑáéíóúüñ' \-]+$/;

const ROLE_DESCRIPTIONS: Record<string, string> = {
  ADMIN: 'Acceso total al sistema y a todas las obras',
  ALMACENERO: 'Operación diaria del Almacén Principal: compras, transferencias',
  RESIDENTE: 'Solo ve las obras a su cargo: recibe transferencias y presta herramientas',
};

const createSchema = z
  .object({
    documentType: z.enum(['DNI', 'CE', 'PASAPORTE'], {
      required_error: 'Selecciona el tipo de documento',
    }),
    documentNumber: z.string().min(1, 'Ingresa el número de documento'),
    firstName: z
      .string()
      .min(2, 'Mínimo 2 caracteres')
      .max(100, 'Máximo 100 caracteres')
      .regex(NAME_REGEX, 'Solo letras, espacios, tildes y guiones'),
    lastName: z
      .string()
      .min(2, 'Mínimo 2 caracteres')
      .max(100, 'Máximo 100 caracteres')
      .regex(NAME_REGEX, 'Solo letras, espacios, tildes y guiones'),
    email: z
      .string()
      .email('Email inválido (ej: usuario@empresa.com)')
      .max(120, 'Máximo 120 caracteres')
      .optional()
      .or(z.literal('')),
    phone: z
      .string()
      .regex(/^9\d{8}$/, 'Celular Perú: 9 dígitos que empiece con 9 (ej: 987654321)')
      .optional()
      .or(z.literal('')),
    roleId: z.string().min(1, 'Selecciona un rol'),
  })
  .superRefine((data, ctx) => {
    const fmt = DOC_FORMAT[data.documentType];
    if (fmt && !fmt.regex.test(data.documentNumber)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['documentNumber'],
        message: fmt.errorMsg,
      });
    }
  });

type CreateForm = z.infer<typeof createSchema>;

function CreateUserDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { data: roles, isLoading: rolesLoading } = useRoles();
  const mutation = useCreateUser();

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    reset,
    setError,
    formState: { errors, isValid, isSubmitted },
  } = useForm<CreateForm>({
    resolver: zodResolver(createSchema),
    mode: 'onBlur',
    defaultValues: {
      documentType: 'DNI',
      documentNumber: '',
      firstName: '',
      lastName: '',
      email: '',
      phone: '',
      roleId: '',
    },
  });

  const documentType = watch('documentType');
  const documentNumber = watch('documentNumber');
  const roleId = watch('roleId');
  const selectedRole = roles?.find((r) => r.id === roleId);

  const onSubmit = (data: CreateForm) => {
    const trimmedDoc = data.documentNumber.trim();
    mutation.mutate(
      {
        documentType: data.documentType,
        documentNumber: trimmedDoc,
        // Contraseña inicial = número de documento. El sistema fuerza cambio en
        // el primer login (mustChangePassword: true en backend).
        password: trimmedDoc,
        firstName: data.firstName.trim(),
        lastName: data.lastName.trim(),
        email: data.email?.trim() || undefined,
        phone: data.phone?.trim() || undefined,
        roleId: data.roleId,
      },
      {
        onSuccess: (created) => {
          toast.success(
            `Usuario ${created.firstName} ${created.lastName} creado. Contraseña inicial: ${trimmedDoc}. Comunícale esta información para su primer ingreso.`,
            { duration: 8000 },
          );
          reset();
          onClose();
        },
        onError: (err: any) => {
          const errorCode = err?.response?.data?.error?.code;
          const errorMessage = err?.response?.data?.error?.message;
          // Backend retorna DOCUMENT_ALREADY_REGISTERED cuando el doc ya existe,
          // y USER_ALREADY_EXISTS cuando el email ya está usado. Marcamos inline.
          if (errorCode === 'DOCUMENT_ALREADY_REGISTERED') {
            setError('documentNumber', {
              message: 'Este documento ya está registrado en el sistema',
            });
            return;
          }
          if (errorCode === 'USER_ALREADY_EXISTS') {
            setError('email', { message: 'Este email ya está registrado' });
            return;
          }
          toast.error(errorMessage ?? 'Error al crear usuario');
        },
      },
    );
  };

  const fmt = DOC_FORMAT[documentType];

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-lg max-h-[calc(100vh-2rem)] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Nuevo usuario</DialogTitle>
        </DialogHeader>

        {/* Banner informativo: regla de contraseña inicial */}
        <div
          className="flex gap-2.5 rounded-lg border border-info/30 bg-info/10 p-3 text-xs"
          role="note"
        >
          <KeyRound className="h-4 w-4 shrink-0 text-info mt-0.5" />
          <div className="space-y-0.5">
            <p className="font-semibold text-foreground">
              Contraseña inicial = número de documento
            </p>
            <p className="text-muted-foreground">
              El usuario podrá ingresar con su número de documento como contraseña. El
              sistema le pedirá cambiarla en su primer ingreso.
            </p>
          </div>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-3">
          {/* Tipo + Número de documento */}
          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-1.5">
              <Label>
                Tipo documento <span className="text-destructive">*</span>
              </Label>
              <Select
                value={documentType}
                onValueChange={(v) =>
                  setValue('documentType', v as 'DNI' | 'CE' | 'PASAPORTE', {
                    shouldValidate: true,
                  })
                }
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
              {errors.documentType && (
                <p className="text-xs text-destructive">{errors.documentType.message}</p>
              )}
            </div>
            <div className="col-span-2 space-y-1.5">
              <Label>
                Número <span className="text-destructive">*</span>
              </Label>
              <Input {...register('documentNumber')} placeholder={fmt.placeholder} />
              <p className="text-[11px] text-muted-foreground">{fmt.helper}</p>
              {errors.documentNumber && (
                <p className="text-xs text-destructive">
                  {errors.documentNumber.message}
                </p>
              )}
            </div>
          </div>

          {/* Nombres + Apellidos */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>
                Nombres <span className="text-destructive">*</span>
              </Label>
              <Input {...register('firstName')} placeholder="Pedro Antonio" />
              {errors.firstName && (
                <p className="text-xs text-destructive">{errors.firstName.message}</p>
              )}
            </div>
            <div className="space-y-1.5">
              <Label>
                Apellidos <span className="text-destructive">*</span>
              </Label>
              <Input {...register('lastName')} placeholder="García Rodríguez" />
              {errors.lastName && (
                <p className="text-xs text-destructive">{errors.lastName.message}</p>
              )}
            </div>
          </div>

          {/* Email + Teléfono */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Email</Label>
              <Input
                {...register('email')}
                type="email"
                placeholder="usuario@empresa.com"
              />
              <p className="text-[11px] text-muted-foreground">
                Opcional, recomendado para recuperar contraseña
              </p>
              {errors.email && (
                <p className="text-xs text-destructive">{errors.email.message}</p>
              )}
            </div>
            <div className="space-y-1.5">
              <Label>Celular</Label>
              <Input {...register('phone')} placeholder="987654321" maxLength={9} />
              <p className="text-[11px] text-muted-foreground">
                Opcional · 9 dígitos · empieza con 9
              </p>
              {errors.phone && (
                <p className="text-xs text-destructive">{errors.phone.message}</p>
              )}
            </div>
          </div>

          {/* Rol */}
          <div className="space-y-1.5">
            <Label>
              Rol <span className="text-destructive">*</span>
            </Label>
            <Select
              value={roleId}
              onValueChange={(v) => setValue('roleId', v, { shouldValidate: true })}
              disabled={rolesLoading}
            >
              <SelectTrigger>
                <SelectValue
                  placeholder={rolesLoading ? 'Cargando roles...' : 'Selecciona un rol'}
                />
              </SelectTrigger>
              <SelectContent>
                {roles?.map((r) => (
                  <SelectItem key={r.id} value={r.id}>
                    <div className="flex flex-col items-start gap-0.5">
                      <span className="font-medium">{r.name}</span>
                      {ROLE_DESCRIPTIONS[r.name] && (
                        <span className="text-[11px] text-muted-foreground">
                          {ROLE_DESCRIPTIONS[r.name]}
                        </span>
                      )}
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {selectedRole && ROLE_DESCRIPTIONS[selectedRole.name] && (
              <p className="text-[11px] text-muted-foreground">
                {ROLE_DESCRIPTIONS[selectedRole.name]}
              </p>
            )}
            {errors.roleId && (
              <p className="text-xs text-destructive">{errors.roleId.message}</p>
            )}
          </div>

          {/* Resumen previo a submit (solo si campos clave llenos) */}
          {documentNumber && (
            <div className="flex gap-2.5 rounded-md bg-muted/50 p-2.5 text-[11px]">
              <Info className="h-3.5 w-3.5 shrink-0 text-muted-foreground mt-0.5" />
              <p className="text-muted-foreground">
                Contraseña inicial será{' '}
                <span className="font-mono font-semibold text-foreground">
                  {documentNumber.trim() || '—'}
                </span>{' '}
                — recuérdala para comunicársela al usuario.
              </p>
            </div>
          )}

          <div className="flex justify-end gap-2 pt-2 border-t">
            <Button type="button" variant="outline" onClick={onClose}>
              Cancelar
            </Button>
            <Button
              type="submit"
              disabled={mutation.isPending || (isSubmitted && !isValid)}
            >
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
