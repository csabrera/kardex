'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { type ColumnDef } from '@tanstack/react-table';
import { Info, KeyRound, Pencil, Plus, UserCheck, Users, UserX } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
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
  useRenewContract,
  useResetUserPassword,
  useSetUserActive,
  useUpdateUser,
  type ContractDuration,
  type User,
} from '@/hooks/use-users';
import { CalendarClock, RefreshCw } from 'lucide-react';

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

// Filtros de input — restringen lo que el usuario puede escribir en tiempo real.
const filterDigits = (max: number) => (e: React.FormEvent<HTMLInputElement>) => {
  const el = e.currentTarget;
  const v = el.value.replace(/\D/g, '').slice(0, max);
  if (el.value !== v) el.value = v;
};
const filterAlphanumericUpper =
  (max: number) => (e: React.FormEvent<HTMLInputElement>) => {
    const el = e.currentTarget;
    const v = el.value
      .replace(/[^A-Za-z0-9]/g, '')
      .toUpperCase()
      .slice(0, max);
    if (el.value !== v) el.value = v;
  };
// El input de documento por tipo: DNI solo dígitos máx 8; CE/Pasaporte alfanumérico
// en mayúsculas máx 12.
function getDocInputProps(docType: 'DNI' | 'CE' | 'PASAPORTE') {
  if (docType === 'DNI') {
    return { onInput: filterDigits(8), inputMode: 'numeric' as const, maxLength: 8 };
  }
  return {
    onInput: filterAlphanumericUpper(12),
    inputMode: 'text' as const,
    maxLength: 12,
  };
}

const CONTRACT_OPTIONS = [
  { value: '_none', label: 'Sin contrato definido' },
  { value: '3', label: '3 meses' },
  { value: '6', label: '6 meses' },
  { value: '12', label: '12 meses' },
] as const;

/** Para una contractEndDate da el badge según proximidad al vencimiento. */
function getContractBadge(contractEndDate: string | null | undefined) {
  if (!contractEndDate) return null;
  const end = new Date(contractEndDate);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const diffMs = end.getTime() - today.getTime();
  const days = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  const dateStr = end.toLocaleDateString('es-PE');
  if (days < 0) {
    return {
      label: `Vencido hace ${Math.abs(days)} d`,
      tone: 'destructive' as const,
      dateStr,
    };
  }
  if (days === 0) return { label: 'Vence hoy', tone: 'destructive' as const, dateStr };
  if (days <= 7)
    return {
      label: `Vence en ${days} d`,
      tone: 'destructive' as const,
      dateStr,
    };
  if (days <= 30)
    return {
      label: `Vence en ${days} d`,
      tone: 'warning' as const,
      dateStr,
    };
  return { label: `Vence ${dateStr}`, tone: 'default' as const, dateStr };
}

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
    paternalLastName: z
      .string()
      .min(2, 'Mínimo 2 caracteres')
      .max(100, 'Máximo 100 caracteres')
      .regex(NAME_REGEX, 'Solo letras, espacios, tildes y guiones'),
    maternalLastName: z
      .string()
      .max(100, 'Máximo 100 caracteres')
      .optional()
      .or(z.literal('')),
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
    contractDuration: z.enum(['_none', '3', '6', '12']).default('_none'),
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
    // Apellido materno obligatorio si DNI.
    if (data.documentType === 'DNI' && !data.maternalLastName?.trim()) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['maternalLastName'],
        message: 'Apellido materno obligatorio para usuarios con DNI',
      });
    }
    // Materno con regex de nombre si está presente.
    if (data.maternalLastName?.trim() && !NAME_REGEX.test(data.maternalLastName)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['maternalLastName'],
        message: 'Solo letras, espacios, tildes y guiones',
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
      paternalLastName: '',
      maternalLastName: '',
      email: '',
      phone: '',
      roleId: '',
      contractDuration: '_none',
    },
  });

  const documentType = watch('documentType');
  const documentNumber = watch('documentNumber');
  const roleId = watch('roleId');
  const contractDuration = watch('contractDuration');
  const selectedRole = roles?.find((r) => r.id === roleId);

  // Helper para uppercase en nombres y apellidos (no afecta email).
  const toUpperOnChange =
    (field: 'firstName' | 'paternalLastName' | 'maternalLastName') =>
    (e: React.ChangeEvent<HTMLInputElement>) =>
      setValue(field, e.target.value.toUpperCase(), {
        shouldValidate: isSubmitted,
      });

  const onSubmit = (data: CreateForm) => {
    const trimmedDoc = data.documentNumber.trim();
    const months =
      data.contractDuration && data.contractDuration !== '_none'
        ? (Number(data.contractDuration) as 3 | 6 | 12)
        : undefined;
    mutation.mutate(
      {
        documentType: data.documentType,
        documentNumber: trimmedDoc,
        // Contraseña inicial = número de documento. El sistema fuerza cambio en
        // el primer login (mustChangePassword: true en backend).
        password: trimmedDoc,
        firstName: data.firstName.trim(),
        paternalLastName: data.paternalLastName.trim(),
        maternalLastName: data.maternalLastName?.trim() || undefined,
        email: data.email?.trim() || undefined,
        phone: data.phone?.trim() || undefined,
        roleId: data.roleId,
        contractDurationMonths: months,
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
      <DialogContent className="max-w-lg">
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
              <Input
                {...register('documentNumber')}
                placeholder={fmt.placeholder}
                {...getDocInputProps(documentType)}
              />
              <p className="text-[11px] text-muted-foreground">{fmt.helper}</p>
              {errors.documentNumber && (
                <p className="text-xs text-destructive">
                  {errors.documentNumber.message}
                </p>
              )}
            </div>
          </div>

          {/* Nombres + Apellido paterno + Apellido materno */}
          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-1.5">
              <Label>
                Nombres <span className="text-destructive">*</span>
              </Label>
              <Input
                {...register('firstName')}
                placeholder="PEDRO ANTONIO"
                onChange={toUpperOnChange('firstName')}
                maxLength={100}
              />
              {errors.firstName && (
                <p className="text-xs text-destructive">{errors.firstName.message}</p>
              )}
            </div>
            <div className="space-y-1.5">
              <Label>
                Apellido paterno <span className="text-destructive">*</span>
              </Label>
              <Input
                {...register('paternalLastName')}
                placeholder="GARCÍA"
                onChange={toUpperOnChange('paternalLastName')}
                maxLength={100}
              />
              {errors.paternalLastName && (
                <p className="text-xs text-destructive">
                  {errors.paternalLastName.message}
                </p>
              )}
            </div>
            <div className="space-y-1.5">
              <Label>
                Apellido materno
                {documentType === 'DNI' && <span className="text-destructive"> *</span>}
              </Label>
              <Input
                {...register('maternalLastName')}
                placeholder="RODRÍGUEZ"
                onChange={toUpperOnChange('maternalLastName')}
                maxLength={100}
              />
              {documentType !== 'DNI' && (
                <p className="text-[11px] text-muted-foreground">
                  Opcional para {documentType}
                </p>
              )}
              {errors.maternalLastName && (
                <p className="text-xs text-destructive">
                  {errors.maternalLastName.message}
                </p>
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
                    {r.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-[11px] text-muted-foreground">
              {selectedRole && ROLE_DESCRIPTIONS[selectedRole.name]
                ? ROLE_DESCRIPTIONS[selectedRole.name]
                : 'Selecciona el rol del usuario'}
            </p>
            {errors.roleId && (
              <p className="text-xs text-destructive">{errors.roleId.message}</p>
            )}
          </div>

          {/* Duración de contrato */}
          <div className="space-y-1.5">
            <Label>Duración del contrato</Label>
            <Select
              value={contractDuration ?? '_none'}
              onValueChange={(v) =>
                setValue('contractDuration', v as CreateForm['contractDuration'], {
                  shouldValidate: false,
                })
              }
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {CONTRACT_OPTIONS.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-[11px] text-muted-foreground">
              {contractDuration && contractDuration !== '_none'
                ? `Vencerá el ${(() => {
                    const d = new Date();
                    d.setMonth(d.getMonth() + Number(contractDuration));
                    return d.toLocaleDateString('es-PE');
                  })()}. Te avisaremos 7 días antes.`
                : 'Opcional · sin contrato definido no habrá alerta de vencimiento'}
            </p>
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

// ─── Modal de edición — sin password ni documento (no editables) ────────────

const editSchema = z
  .object({
    firstName: z
      .string()
      .min(2, 'Mínimo 2 caracteres')
      .max(100)
      .regex(NAME_REGEX, 'Solo letras, espacios, tildes y guiones'),
    paternalLastName: z
      .string()
      .min(2, 'Mínimo 2 caracteres')
      .max(100)
      .regex(NAME_REGEX, 'Solo letras, espacios, tildes y guiones'),
    maternalLastName: z.string().max(100).optional().or(z.literal('')),
    email: z.string().email('Email inválido').max(120).optional().or(z.literal('')),
    phone: z
      .string()
      .regex(/^9\d{8}$/, 'Celular Perú: 9 dígitos que empiece con 9')
      .optional()
      .or(z.literal('')),
    roleId: z.string().min(1, 'Selecciona un rol'),
    /** Solo para validar — el tipo de documento viene del usuario y no es editable. */
    _docType: z.enum(['DNI', 'CE', 'PASAPORTE']),
  })
  .superRefine((data, ctx) => {
    if (data._docType === 'DNI' && !data.maternalLastName?.trim()) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['maternalLastName'],
        message: 'Apellido materno obligatorio para usuarios con DNI',
      });
    }
    if (data.maternalLastName?.trim() && !NAME_REGEX.test(data.maternalLastName)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['maternalLastName'],
        message: 'Solo letras, espacios, tildes y guiones',
      });
    }
  });

type EditForm = z.infer<typeof editSchema>;

function EditUserDialog({ user, onClose }: { user: User | null; onClose: () => void }) {
  const { data: roles, isLoading: rolesLoading } = useRoles();
  const mutation = useUpdateUser();

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    reset,
    setError,
    formState: { errors, isValid, isSubmitted },
  } = useForm<EditForm>({
    resolver: zodResolver(editSchema),
    mode: 'onBlur',
    defaultValues: {
      firstName: '',
      paternalLastName: '',
      maternalLastName: '',
      email: '',
      phone: '',
      roleId: '',
      _docType: 'DNI',
    },
  });

  const roleId = watch('roleId');
  const selectedRole = roles?.find((r) => r.id === roleId);

  const toUpperOnChange =
    (field: 'firstName' | 'paternalLastName' | 'maternalLastName') =>
    (e: React.ChangeEvent<HTMLInputElement>) =>
      setValue(field, e.target.value.toUpperCase(), {
        shouldValidate: isSubmitted,
      });

  // Pre-fill cuando el usuario cambia (open).
  useEffect(() => {
    if (!user) return;
    reset({
      firstName: user.firstName,
      paternalLastName: user.paternalLastName ?? user.lastName ?? '',
      maternalLastName: user.maternalLastName ?? '',
      email: user.email ?? '',
      phone: user.phone ?? '',
      roleId: user.role.id,
      _docType: user.documentType as 'DNI' | 'CE' | 'PASAPORTE',
    });
  }, [user, reset]);

  const onSubmit = (data: EditForm) => {
    if (!user) return;
    mutation.mutate(
      {
        id: user.id,
        dto: {
          firstName: data.firstName.trim(),
          paternalLastName: data.paternalLastName.trim(),
          maternalLastName: data.maternalLastName?.trim() || undefined,
          email: data.email?.trim() || undefined,
          phone: data.phone?.trim() || undefined,
          roleId: data.roleId,
        },
      },
      {
        onSuccess: () => {
          toast.success('Usuario actualizado');
          onClose();
        },
        onError: (err: any) => {
          const code = err?.response?.data?.error?.code;
          const msg = err?.response?.data?.error?.message;
          if (code === 'USER_ALREADY_EXISTS') {
            setError('email', { message: 'Este email ya está registrado' });
            return;
          }
          toast.error(msg ?? 'Error al actualizar usuario');
        },
      },
    );
  };

  return (
    <Dialog open={!!user} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Editar usuario</DialogTitle>
        </DialogHeader>

        {/* Banner: el documento no es editable */}
        {user && (
          <div className="flex gap-2.5 rounded-md bg-muted/50 p-2.5 text-[11px]">
            <Info className="h-3.5 w-3.5 shrink-0 text-muted-foreground mt-0.5" />
            <p className="text-muted-foreground">
              Documento{' '}
              <span className="font-mono font-semibold text-foreground">
                {user.documentType} {user.documentNumber}
              </span>{' '}
              no es editable. Si está incorrecto, desactiva este usuario y crea uno nuevo.
            </p>
          </div>
        )}

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-3">
          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-1.5">
              <Label>
                Nombres <span className="text-destructive">*</span>
              </Label>
              <Input
                {...register('firstName')}
                onChange={toUpperOnChange('firstName')}
                maxLength={100}
              />
              {errors.firstName && (
                <p className="text-xs text-destructive">{errors.firstName.message}</p>
              )}
            </div>
            <div className="space-y-1.5">
              <Label>
                Apellido paterno <span className="text-destructive">*</span>
              </Label>
              <Input
                {...register('paternalLastName')}
                onChange={toUpperOnChange('paternalLastName')}
                maxLength={100}
              />
              {errors.paternalLastName && (
                <p className="text-xs text-destructive">
                  {errors.paternalLastName.message}
                </p>
              )}
            </div>
            <div className="space-y-1.5">
              <Label>
                Apellido materno
                {user?.documentType === 'DNI' && (
                  <span className="text-destructive"> *</span>
                )}
              </Label>
              <Input
                {...register('maternalLastName')}
                onChange={toUpperOnChange('maternalLastName')}
                maxLength={100}
              />
              {user?.documentType !== 'DNI' && (
                <p className="text-[11px] text-muted-foreground">
                  Opcional para {user?.documentType}
                </p>
              )}
              {errors.maternalLastName && (
                <p className="text-xs text-destructive">
                  {errors.maternalLastName.message}
                </p>
              )}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Email</Label>
              <Input
                {...register('email')}
                type="email"
                placeholder="usuario@empresa.com"
              />
              {errors.email && (
                <p className="text-xs text-destructive">{errors.email.message}</p>
              )}
            </div>
            <div className="space-y-1.5">
              <Label>Celular</Label>
              <Input {...register('phone')} placeholder="987654321" maxLength={9} />
              {errors.phone && (
                <p className="text-xs text-destructive">{errors.phone.message}</p>
              )}
            </div>
          </div>

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
                <SelectValue placeholder="Selecciona un rol" />
              </SelectTrigger>
              <SelectContent>
                {roles?.map((r) => (
                  <SelectItem key={r.id} value={r.id}>
                    {r.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-[11px] text-muted-foreground">
              {selectedRole && ROLE_DESCRIPTIONS[selectedRole.name]
                ? ROLE_DESCRIPTIONS[selectedRole.name]
                : 'Selecciona el rol del usuario'}
            </p>
            {errors.roleId && (
              <p className="text-xs text-destructive">{errors.roleId.message}</p>
            )}
          </div>

          <div className="flex justify-end gap-2 pt-2 border-t">
            <Button type="button" variant="outline" onClick={onClose}>
              Cancelar
            </Button>
            <Button
              type="submit"
              disabled={mutation.isPending || (isSubmitted && !isValid)}
            >
              {mutation.isPending ? 'Guardando...' : 'Guardar cambios'}
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
  const [editTarget, setEditTarget] = useState<User | null>(null);
  const debouncedSearch = useDebounce(search, 300);
  const confirm = useConfirm();

  const { data, isLoading } = useUsers({
    page,
    pageSize,
    search: debouncedSearch || undefined,
  });
  const setActive = useSetUserActive();
  const resetPassword = useResetUserPassword();
  const renewContract = useRenewContract();

  const handleRenewContract = async (user: User) => {
    const months = window.prompt(
      `Renovar contrato de ${user.firstName} ${user.lastName}.\n\nElige duración (3, 6 o 12 meses):`,
      '6',
    );
    if (!months) return;
    const m = Number(months) as ContractDuration;
    if (![3, 6, 12].includes(m)) {
      toast.error('Debe ser 3, 6 o 12');
      return;
    }
    const ok = await confirm({
      title: `¿Renovar contrato por ${m} meses?`,
      description: `La nueva fecha de vencimiento será dentro de ${m} meses desde hoy.`,
      confirmText: 'Renovar',
    });
    if (!ok) return;
    renewContract.mutate({ id: user.id, months: m });
  };

  const handleToggleActive = async (user: User) => {
    if (user.active) {
      const ok = await confirm({
        title: `¿Desactivar a ${user.firstName} ${user.lastName}?`,
        description:
          'El usuario perderá el acceso al sistema. Sus datos quedan registrados ' +
          '(no se elimina) y puedes reactivarlo más tarde.',
        confirmText: 'Desactivar',
        tone: 'destructive',
      });
      if (!ok) return;
    }
    setActive.mutate({ id: user.id, active: !user.active });
  };

  const handleResetPassword = async (user: User) => {
    const ok = await confirm({
      title: `¿Restablecer la contraseña de ${user.firstName} ${user.lastName}?`,
      description: `La nueva contraseña será su número de documento (${user.documentNumber}). El sistema le pedirá cambiarla en su próximo ingreso. Esta acción no se puede deshacer — el usuario no podrá entrar con su contraseña anterior.`,
      confirmText: 'Restablecer contraseña',
      tone: 'destructive',
    });
    if (!ok) return;
    resetPassword.mutate(user.id);
  };

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
      id: 'contract',
      header: 'Contrato',
      size: 150,
      cell: ({ row }) => {
        const badge = getContractBadge(row.original.contractEndDate);
        if (!badge) {
          return <span className="text-xs text-muted-foreground">Sin contrato</span>;
        }
        const cls =
          badge.tone === 'destructive'
            ? 'bg-red-500/10 text-red-700 dark:text-red-300 border-red-500/30'
            : badge.tone === 'warning'
              ? 'bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-500/30'
              : 'bg-muted/40 text-muted-foreground border-border';
        return (
          <div className="space-y-0.5">
            <span
              className={`inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-full border ${cls}`}
            >
              <CalendarClock className="h-3 w-3" />
              {badge.label}
            </span>
            <p className="text-[10px] text-muted-foreground font-mono">{badge.dateStr}</p>
          </div>
        );
      },
    },
    {
      id: 'createdAt',
      header: 'Creado',
      cell: ({ row }) => new Date(row.original.createdAt).toLocaleDateString('es-PE'),
    },
    {
      id: 'actions',
      header: 'Acciones',
      size: 200,
      cell: ({ row }) => (
        <div className="flex gap-1.5">
          <ActionButton
            icon={Pencil}
            label="Editar usuario"
            tone="info"
            onClick={() => setEditTarget(row.original)}
          />
          <ActionButton
            icon={RefreshCw}
            label="Renovar contrato"
            tone="info"
            onClick={() => handleRenewContract(row.original)}
            disabled={renewContract.isPending}
          />
          <ActionButton
            icon={KeyRound}
            label="Restablecer contraseña"
            tone="warning"
            onClick={() => handleResetPassword(row.original)}
            disabled={resetPassword.isPending}
          />
          {row.original.active ? (
            <ActionButton
              icon={UserX}
              label="Desactivar usuario"
              tone="destructive"
              onClick={() => handleToggleActive(row.original)}
              disabled={setActive.isPending}
            />
          ) : (
            <ActionButton
              icon={UserCheck}
              label="Activar usuario"
              tone="success"
              onClick={() => handleToggleActive(row.original)}
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
      <EditUserDialog user={editTarget} onClose={() => setEditTarget(null)} />
    </div>
  );
}
