'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { Eye, EyeOff, Loader2, Settings } from 'lucide-react';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';

import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useSetup } from '@/hooks/use-auth';
import { DOCUMENT_CONFIGS, type DocumentType } from '@/hooks/use-document-type';

const schema = z
  .object({
    documentType: z.enum(['DNI', 'CE', 'PASAPORTE'] as const),
    documentNumber: z.string().min(1, 'Requerido'),
    firstName: z.string().min(2, 'Mínimo 2 caracteres'),
    lastName: z.string().min(2, 'Mínimo 2 caracteres'),
    email: z.string().email('Email inválido').optional().or(z.literal('')),
    password: z
      .string()
      .min(8, 'Mínimo 8 caracteres')
      .regex(/[A-Z]/, 'Debe incluir una mayúscula')
      .regex(/[0-9]/, 'Debe incluir un número'),
    confirmPassword: z.string().min(1, 'Requerido'),
  })
  .superRefine((data, ctx) => {
    const config = DOCUMENT_CONFIGS[data.documentType];
    if (!config.pattern.test(data.documentNumber)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `Formato inválido. ${config.hint}`,
        path: ['documentNumber'],
      });
    }
    if (data.password !== data.confirmPassword) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Las contraseñas no coinciden',
        path: ['confirmPassword'],
      });
    }
  });

type FormData = z.infer<typeof schema>;

export default function SetupPage() {
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const setup = useSetup();

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors },
  } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { documentType: 'DNI' },
  });

  const documentType = watch('documentType') as DocumentType;
  const config = DOCUMENT_CONFIGS[documentType];

  const onSubmit = (data: FormData) =>
    setup.mutate({ ...data, email: data.email || undefined });

  return (
    <Card className="shadow-lg">
      <CardHeader className="space-y-1 pb-4">
        <div className="flex items-center justify-center mb-2">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-primary">
            <Settings className="h-5 w-5" />
          </div>
        </div>
        <CardTitle className="text-xl font-bold text-center">
          Configuración inicial
        </CardTitle>
        <CardDescription className="text-center">
          Crea la cuenta del Administrador principal del sistema
        </CardDescription>
      </CardHeader>

      <CardContent>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          {/* Document */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Tipo</Label>
              <Select
                value={documentType}
                onValueChange={(val) => {
                  setValue('documentType', val as DocumentType, {
                    shouldValidate: false,
                  });
                  setValue('documentNumber', '');
                }}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="DNI">DNI</SelectItem>
                  <SelectItem value="CE">CE</SelectItem>
                  <SelectItem value="PASAPORTE">Pasaporte</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="documentNumber">Número</Label>
              <Input
                id="documentNumber"
                placeholder={config.placeholder}
                maxLength={config.maxLength}
                {...register('documentNumber')}
              />
              {errors.documentNumber && (
                <p className="text-xs text-destructive">
                  {errors.documentNumber.message}
                </p>
              )}
            </div>
          </div>

          {/* Name */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="firstName">Nombres</Label>
              <Input id="firstName" placeholder="Juan" {...register('firstName')} />
              {errors.firstName && (
                <p className="text-xs text-destructive">{errors.firstName.message}</p>
              )}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="lastName">Apellidos</Label>
              <Input id="lastName" placeholder="Pérez" {...register('lastName')} />
              {errors.lastName && (
                <p className="text-xs text-destructive">{errors.lastName.message}</p>
              )}
            </div>
          </div>

          {/* Email (optional) */}
          <div className="space-y-1.5">
            <Label htmlFor="email">
              Email <span className="text-muted-foreground text-xs">(opcional)</span>
            </Label>
            <Input
              id="email"
              type="email"
              placeholder="admin@empresa.com"
              autoComplete="email"
              {...register('email')}
            />
            {errors.email && (
              <p className="text-xs text-destructive">{errors.email.message}</p>
            )}
          </div>

          {/* Password */}
          <div className="space-y-1.5">
            <Label htmlFor="password">Contraseña</Label>
            <div className="relative">
              <Input
                id="password"
                type={showPassword ? 'text' : 'password'}
                placeholder="••••••••"
                className="pr-10"
                autoComplete="new-password"
                {...register('password')}
              />
              <button
                type="button"
                className="absolute inset-y-0 right-0 flex items-center pr-3 text-muted-foreground hover:text-foreground"
                onClick={() => setShowPassword((v) => !v)}
                tabIndex={-1}
              >
                {showPassword ? (
                  <EyeOff className="h-4 w-4" />
                ) : (
                  <Eye className="h-4 w-4" />
                )}
              </button>
            </div>
            {errors.password && (
              <p className="text-xs text-destructive">{errors.password.message}</p>
            )}
          </div>

          {/* Confirm password */}
          <div className="space-y-1.5">
            <Label htmlFor="confirmPassword">Confirmar contraseña</Label>
            <div className="relative">
              <Input
                id="confirmPassword"
                type={showConfirm ? 'text' : 'password'}
                placeholder="••••••••"
                className="pr-10"
                autoComplete="new-password"
                {...register('confirmPassword')}
              />
              <button
                type="button"
                className="absolute inset-y-0 right-0 flex items-center pr-3 text-muted-foreground hover:text-foreground"
                onClick={() => setShowConfirm((v) => !v)}
                tabIndex={-1}
              >
                {showConfirm ? (
                  <EyeOff className="h-4 w-4" />
                ) : (
                  <Eye className="h-4 w-4" />
                )}
              </button>
            </div>
            {errors.confirmPassword && (
              <p className="text-xs text-destructive">{errors.confirmPassword.message}</p>
            )}
          </div>

          <Button type="submit" className="w-full" disabled={setup.isPending}>
            {setup.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Crear cuenta y entrar
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
