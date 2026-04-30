'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { HardHat, Info, UserRound } from 'lucide-react';
import { useEffect } from 'react';
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
import { Textarea } from '@/components/ui/textarea';
import { useObras } from '@/hooks/use-obras';
import { useSpecialties } from '@/hooks/use-specialties';
import { useCreateWorker, useUpdateWorker, type Worker } from '@/hooks/use-workers';

const DOC_TYPES = ['DNI', 'CE', 'PASAPORTE'] as const;
type DocType = (typeof DOC_TYPES)[number];

const DOC_FORMAT: Record<
  DocType,
  {
    regex: RegExp;
    placeholder: string;
    helper: string;
    errorMsg: string;
    maxLength: number;
    /** Si true, solo permite dígitos en el input. */
    digitsOnly: boolean;
  }
> = {
  DNI: {
    regex: /^\d{8}$/,
    placeholder: '12345678',
    helper: '8 dígitos numéricos',
    errorMsg: 'DNI debe tener exactamente 8 dígitos numéricos',
    maxLength: 8,
    digitsOnly: true,
  },
  CE: {
    regex: /^[A-Z0-9]{9,12}$/,
    placeholder: '001234567',
    helper: '9 a 12 caracteres alfanuméricos',
    errorMsg: 'Carnet de Extranjería: 9 a 12 caracteres alfanuméricos',
    maxLength: 12,
    digitsOnly: false,
  },
  PASAPORTE: {
    regex: /^[A-Z0-9]{6,12}$/,
    placeholder: 'AB123456',
    helper: '6 a 12 caracteres alfanuméricos',
    errorMsg: 'Pasaporte: 6 a 12 caracteres alfanuméricos',
    maxLength: 12,
    digitsOnly: false,
  },
};

// Letras (con tildes), espacios, guiones y apóstrofes.
const NAME_REGEX = /^[A-ZÁÉÍÓÚÜÑ' \-]+$/;

const NOTES_MAX = 500;

// Edad mínima legal para trabajar en Perú (con permiso): 14 años.
// Edad máxima razonable: 80 (filtra fechas absurdas).
const MIN_AGE_YEARS = 14;
const MAX_AGE_YEARS = 80;

// Hire desde 2000 (defensiva contra dedazos en años raros).
const MIN_HIRE_YEAR = 2000;

const schema = z
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
    phone: z
      .string()
      .regex(/^9\d{8}$/, 'Celular Perú: 9 dígitos que empiece con 9 (ej. 987654321)'),
    address: z.string().max(300, 'Máximo 300 caracteres').optional().or(z.literal('')),
    birthDate: z.string().optional().or(z.literal('')),
    hireDate: z.string().optional().or(z.literal('')),
    specialtyId: z.string().min(1, 'Selecciona una especialidad'),
    obraId: z.string().optional().or(z.literal('')),
    notes: z
      .string()
      .max(NOTES_MAX, `Máximo ${NOTES_MAX} caracteres`)
      .optional()
      .or(z.literal('')),
  })
  .superRefine((data, ctx) => {
    // Validación documento por tipo
    const fmt = DOC_FORMAT[data.documentType];
    if (fmt && !fmt.regex.test(data.documentNumber)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['documentNumber'],
        message: fmt.errorMsg,
      });
    }

    // Validaciones cruzadas de fechas
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    let birth: Date | null = null;
    let hire: Date | null = null;

    if (data.birthDate) {
      const [y, m, d] = data.birthDate.split('-').map(Number) as [number, number, number];
      birth = new Date(y, m - 1, d);
      // No futura
      if (birth > today) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['birthDate'],
          message: 'La fecha de nacimiento no puede ser futura',
        });
      }
      // Mínimo 14 años
      const minBirthAllowed = new Date(today);
      minBirthAllowed.setFullYear(minBirthAllowed.getFullYear() - MIN_AGE_YEARS);
      if (birth > minBirthAllowed) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['birthDate'],
          message: `Edad mínima ${MIN_AGE_YEARS} años (Perú con permiso)`,
        });
      }
      // Máximo 80 años (defensiva contra dedazos)
      const maxBirthAllowed = new Date(today);
      maxBirthAllowed.setFullYear(maxBirthAllowed.getFullYear() - MAX_AGE_YEARS);
      if (birth < maxBirthAllowed) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['birthDate'],
          message: `Edad máxima ${MAX_AGE_YEARS} años — verifica la fecha`,
        });
      }
    }

    if (data.hireDate) {
      const [y, m, d] = data.hireDate.split('-').map(Number) as [number, number, number];
      hire = new Date(y, m - 1, d);
      // No demasiado en el futuro (max +30 días, para contratos próximos)
      const maxHire = new Date(today);
      maxHire.setDate(maxHire.getDate() + 30);
      if (hire > maxHire) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['hireDate'],
          message: 'La fecha de ingreso no puede ser más de 30 días en el futuro',
        });
      }
      // No antes de 2000 (defensiva)
      if (hire.getFullYear() < MIN_HIRE_YEAR) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['hireDate'],
          message: `La fecha de ingreso debe ser desde ${MIN_HIRE_YEAR}`,
        });
      }
    }

    // Cruzada: hire >= birth + 14 años
    if (birth && hire) {
      const minHireFromBirth = new Date(birth);
      minHireFromBirth.setFullYear(minHireFromBirth.getFullYear() + MIN_AGE_YEARS);
      if (hire < minHireFromBirth) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['hireDate'],
          message: `Debe ser al menos ${MIN_AGE_YEARS} años después del nacimiento`,
        });
      }
    }
  });

type FormData = z.infer<typeof schema>;

interface Props {
  open: boolean;
  onClose: () => void;
  worker?: Worker | null;
}

export function WorkerFormDialog({ open, onClose, worker }: Props) {
  const { data: specialties, isLoading: specialtiesLoading } = useSpecialties();
  const { data: obras, isLoading: obrasLoading } = useObras({ pageSize: 100 });
  const createMut = useCreateWorker();
  const updateMut = useUpdateWorker();
  const isEdit = !!worker;
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
      documentType: 'DNI',
      documentNumber: '',
      firstName: '',
      lastName: '',
      phone: '',
      address: '',
      birthDate: '',
      hireDate: '',
      specialtyId: '',
      obraId: '',
      notes: '',
    },
  });

  const documentType = watch('documentType') as DocType;
  const documentNumber = watch('documentNumber');
  const birthDate = watch('birthDate');
  const hireDate = watch('hireDate');
  const specialtyId = watch('specialtyId');
  const obraId = watch('obraId');
  const notes = watch('notes') ?? '';

  const fmt = DOC_FORMAT[documentType];

  useEffect(() => {
    if (worker) {
      reset({
        documentType: worker.documentType as DocType,
        documentNumber: worker.documentNumber,
        firstName: worker.firstName.toUpperCase(),
        lastName: worker.lastName.toUpperCase(),
        phone: worker.phone,
        address: (worker.address ?? '').toUpperCase(),
        birthDate: worker.birthDate ? worker.birthDate.slice(0, 10) : '',
        hireDate: worker.hireDate ? worker.hireDate.slice(0, 10) : '',
        specialtyId: worker.specialty.id,
        obraId: worker.obra?.id ?? '',
        notes: (worker.notes ?? '').toUpperCase(),
      });
    } else if (open) {
      reset({
        documentType: 'DNI',
        documentNumber: '',
        firstName: '',
        lastName: '',
        phone: '',
        address: '',
        birthDate: '',
        hireDate: '',
        specialtyId: '',
        obraId: '',
        notes: '',
      });
    }
  }, [worker, open, reset]);

  // Helper: bloquear caracteres mientras se escribe en el doc según tipo, y
  // pasar a mayúsculas el valor.
  const handleDocChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let v = e.target.value.toUpperCase();
    if (fmt.digitsOnly) {
      v = v.replace(/\D/g, '');
    } else {
      v = v.replace(/[^A-Z0-9]/g, '');
    }
    if (v.length > fmt.maxLength) v = v.slice(0, fmt.maxLength);
    setValue('documentNumber', v, { shouldValidate: isSubmitted });
  };

  // Phone: solo dígitos, max 9.
  const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let v = e.target.value.replace(/\D/g, '');
    if (v.length > 9) v = v.slice(0, 9);
    setValue('phone', v, { shouldValidate: isSubmitted });
  };

  // Mayúsculas auto + maxLength en campos texto.
  const upperCaseHandler =
    (field: 'firstName' | 'lastName' | 'address' | 'notes', max: number) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
      let v = e.target.value.toUpperCase();
      if (v.length > max) v = v.slice(0, max);
      setValue(field, v, { shouldValidate: isSubmitted });
    };

  const onSubmit = (data: FormData) => {
    const payload = {
      documentType: data.documentType,
      documentNumber: data.documentNumber.trim().toUpperCase(),
      firstName: data.firstName.trim(),
      lastName: data.lastName.trim(),
      phone: data.phone.trim(),
      address: data.address?.trim() || undefined,
      birthDate: data.birthDate || undefined,
      hireDate: data.hireDate || undefined,
      specialtyId: data.specialtyId,
      obraId: data.obraId || undefined,
      notes: data.notes?.trim() || undefined,
    };

    const handlers = {
      onSuccess: (created: Worker) => {
        toast.success(
          `Empleado ${created.firstName} ${created.lastName} ${isEdit ? 'actualizado' : 'creado'}.`,
          { duration: 5000 },
        );
        reset();
        onClose();
      },
      onError: (err: any) => {
        const code = err?.response?.data?.error?.code;
        const msg = err?.response?.data?.error?.message;
        if (code === 'DOCUMENT_ALREADY_REGISTERED') {
          setError('documentNumber', {
            message: 'Este documento ya está registrado en el sistema',
          });
          return;
        }
        toast.error(
          msg ?? (isEdit ? 'Error al actualizar empleado' : 'Error al crear empleado'),
        );
      },
    };

    if (isEdit && worker) {
      updateMut.mutate({ id: worker.id, dto: payload }, handlers);
    } else {
      createMut.mutate(payload, handlers);
    }
  };

  // Rangos de fechas para los DatePickers
  const today = new Date();
  const minBirth = new Date(today);
  minBirth.setFullYear(minBirth.getFullYear() - MAX_AGE_YEARS);
  const maxBirth = new Date(today);
  maxBirth.setFullYear(maxBirth.getFullYear() - MIN_AGE_YEARS);
  const minHire = new Date(MIN_HIRE_YEAR, 0, 1);
  const maxHire = new Date(today);
  maxHire.setDate(maxHire.getDate() + 30);

  const selectedSpecialty = specialties?.find((s) => s.id === specialtyId);
  const selectedObra = obras?.items?.find((o) => o.id === obraId);

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>{isEdit ? 'Editar empleado' : 'Nuevo empleado'}</DialogTitle>
          <DialogDescription>
            Trabajador de campo (obrero, albañil, electricista, etc.).
          </DialogDescription>
        </DialogHeader>

        {/* Banner explicativo: Worker vs User */}
        {!isEdit && (
          <div
            className="flex gap-2.5 rounded-lg border border-info/30 bg-info/10 p-3 text-xs"
            role="note"
          >
            <UserRound className="h-4 w-4 shrink-0 text-info mt-0.5" />
            <div className="space-y-0.5">
              <p className="font-semibold text-foreground">
                Empleado ≠ Usuario del sistema
              </p>
              <p className="text-muted-foreground">
                Los empleados son obreros de campo. <strong>NO inician sesión</strong>.
                Solo aparecen como destinatarios de préstamos de herramientas y
                asignaciones de EPP.
              </p>
            </div>
          </div>
        )}

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-3">
          {/* Tipo + Número de documento */}
          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-1.5">
              <Label>
                Tipo doc. <span className="text-destructive">*</span>
              </Label>
              <Select
                value={documentType}
                onValueChange={(v) => {
                  setValue('documentType', v as DocType, { shouldValidate: isSubmitted });
                  // Re-truncar al cambiar tipo si el doc actual excede el nuevo max
                  const newFmt = DOC_FORMAT[v as DocType];
                  if (documentNumber.length > newFmt.maxLength) {
                    setValue(
                      'documentNumber',
                      documentNumber.slice(0, newFmt.maxLength),
                      {
                        shouldValidate: isSubmitted,
                      },
                    );
                  }
                }}
                disabled={isEdit}
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
            </div>
            <div className="col-span-2 space-y-1.5">
              <Label>
                Número documento <span className="text-destructive">*</span>
              </Label>
              <Input
                value={documentNumber}
                onChange={handleDocChange}
                placeholder={fmt.placeholder}
                maxLength={fmt.maxLength}
                disabled={isEdit}
                inputMode={fmt.digitsOnly ? 'numeric' : 'text'}
                autoCapitalize="characters"
              />
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
              <Input
                {...register('firstName')}
                onChange={upperCaseHandler('firstName', 100)}
                placeholder="PEDRO ANTONIO"
                maxLength={100}
                autoCapitalize="characters"
              />
              {errors.firstName && (
                <p className="text-xs text-destructive">{errors.firstName.message}</p>
              )}
            </div>
            <div className="space-y-1.5">
              <Label>
                Apellidos <span className="text-destructive">*</span>
              </Label>
              <Input
                {...register('lastName')}
                onChange={upperCaseHandler('lastName', 100)}
                placeholder="GARCÍA RODRÍGUEZ"
                maxLength={100}
                autoCapitalize="characters"
              />
              {errors.lastName && (
                <p className="text-xs text-destructive">{errors.lastName.message}</p>
              )}
            </div>
          </div>

          {/* Celular + fecha nacimiento */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>
                Celular <span className="text-destructive">*</span>
              </Label>
              <Input
                value={watch('phone')}
                onChange={handlePhoneChange}
                placeholder="987654321"
                maxLength={9}
                inputMode="numeric"
              />
              <p className="text-[11px] text-muted-foreground">
                Celular Perú · 9 dígitos · empieza con 9
              </p>
              {errors.phone && (
                <p className="text-xs text-destructive">{errors.phone.message}</p>
              )}
            </div>
            <div className="space-y-1.5">
              <Label>Fecha nacimiento</Label>
              <DatePicker
                value={birthDate ?? ''}
                onChange={(v) =>
                  setValue('birthDate', v, { shouldValidate: isSubmitted })
                }
                placeholder="Selecciona fecha"
                fromDate={minBirth}
                toDate={maxBirth}
              />
              <p className="text-[11px] text-muted-foreground">
                Opcional · entre {MIN_AGE_YEARS} y {MAX_AGE_YEARS} años
              </p>
              {errors.birthDate && (
                <p className="text-xs text-destructive">{errors.birthDate.message}</p>
              )}
            </div>
          </div>

          {/* Dirección */}
          <div className="space-y-1.5">
            <Label>Dirección</Label>
            <Input
              {...register('address')}
              onChange={upperCaseHandler('address', 300)}
              placeholder="AV. EJEMPLO 123, LIMA"
              maxLength={300}
              autoCapitalize="characters"
            />
            {errors.address && (
              <p className="text-xs text-destructive">{errors.address.message}</p>
            )}
          </div>

          {/* Especialidad + fecha ingreso */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>
                Especialidad <span className="text-destructive">*</span>
              </Label>
              <Select
                value={specialtyId}
                onValueChange={(v) =>
                  setValue('specialtyId', v, { shouldValidate: isSubmitted })
                }
                disabled={specialtiesLoading}
              >
                <SelectTrigger>
                  <SelectValue
                    placeholder={
                      specialtiesLoading ? 'Cargando...' : 'Selecciona especialidad'
                    }
                  />
                </SelectTrigger>
                <SelectContent>
                  {specialties?.map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-[11px] text-muted-foreground">
                {selectedSpecialty?.description ??
                  'Oficio del trabajador (Albañil, Electricista, etc.)'}
              </p>
              {errors.specialtyId && (
                <p className="text-xs text-destructive">{errors.specialtyId.message}</p>
              )}
            </div>
            <div className="space-y-1.5">
              <Label>Fecha ingreso</Label>
              <DatePicker
                value={hireDate ?? ''}
                onChange={(v) => setValue('hireDate', v, { shouldValidate: isSubmitted })}
                placeholder="Selecciona fecha"
                fromDate={minHire}
                toDate={maxHire}
              />
              <p className="text-[11px] text-muted-foreground">
                Opcional · desde {MIN_HIRE_YEAR}
              </p>
              {errors.hireDate && (
                <p className="text-xs text-destructive">{errors.hireDate.message}</p>
              )}
            </div>
          </div>

          {/* Obra asignada */}
          <div className="space-y-1.5">
            <Label>Obra asignada</Label>
            <Select
              value={obraId || '_none'}
              onValueChange={(v) =>
                setValue('obraId', v === '_none' ? '' : v, {
                  shouldValidate: isSubmitted,
                })
              }
              disabled={obrasLoading}
            >
              <SelectTrigger>
                <SelectValue
                  placeholder={obrasLoading ? 'Cargando obras...' : 'Sin asignar'}
                />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="_none">Sin asignar</SelectItem>
                {obras?.items?.map((o) => (
                  <SelectItem key={o.id} value={o.id}>
                    [{o.code}] {o.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-[11px] text-muted-foreground">
              {selectedObra?.client
                ? `Cliente: ${selectedObra.client}`
                : 'Opcional · se podrá asignar/cambiar después'}
            </p>
          </div>

          {/* Notas */}
          <div className="space-y-1.5">
            <Label>Notas</Label>
            <Textarea
              {...register('notes')}
              onChange={upperCaseHandler('notes', NOTES_MAX)}
              placeholder="OBSERVACIONES, CONTACTO DE EMERGENCIA, ETC."
              rows={2}
              maxLength={NOTES_MAX}
            />
            <div className="flex items-center justify-between">
              <span className="text-[11px] text-muted-foreground">
                {errors.notes?.message ?? 'Opcional'}
              </span>
              <span className="text-[11px] text-muted-foreground tabular-nums">
                {notes.length}/{NOTES_MAX}
              </span>
            </div>
          </div>

          {/* Recordatorio antes del submit */}
          {!isEdit && (
            <div className="flex gap-2.5 rounded-md bg-muted/50 p-2.5 text-[11px]">
              <Info className="h-3.5 w-3.5 shrink-0 text-muted-foreground mt-0.5" />
              <p className="text-muted-foreground">
                Este empleado no podrá iniciar sesión. Si necesitas crear una cuenta para
                que entre al sistema, ve a <strong>Usuarios</strong>.
              </p>
            </div>
          )}

          <div className="flex justify-end gap-2 pt-2 border-t">
            <Button type="button" variant="outline" onClick={onClose}>
              Cancelar
            </Button>
            <Button
              type="submit"
              disabled={isPending || (isSubmitted && !isValid)}
              className="gap-2"
            >
              <HardHat className="h-4 w-4" />
              {isPending
                ? isEdit
                  ? 'Guardando...'
                  : 'Creando...'
                : isEdit
                  ? 'Guardar cambios'
                  : 'Crear empleado'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
