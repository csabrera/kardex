'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { Eye, EyeOff, Loader2, LogIn } from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useLogin } from '@/hooks/use-auth';
import { DOCUMENT_CONFIGS, type DocumentType } from '@/hooks/use-document-type';

const loginSchema = z
  .object({
    documentType: z.enum(['DNI', 'CE', 'PASAPORTE'] as const),
    documentNumber: z.string().min(1, 'Ingresa tu número de documento'),
    password: z.string().min(1, 'Ingresa tu contraseña'),
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
  });

type LoginForm = z.infer<typeof loginSchema>;

export default function LoginPage() {
  const [showPassword, setShowPassword] = useState(false);
  const login = useLogin();

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors },
  } = useForm<LoginForm>({
    resolver: zodResolver(loginSchema),
    defaultValues: { documentType: 'DNI' },
  });

  const documentType = watch('documentType') as DocumentType;
  const config = DOCUMENT_CONFIGS[documentType];

  return (
    <div className="space-y-6">
      <div className="space-y-1.5">
        <h1 className="text-3xl font-bold tracking-tight">Bienvenido</h1>
        <p className="text-muted-foreground">
          Ingresa tus credenciales para acceder al sistema.
        </p>
      </div>

      <form onSubmit={handleSubmit((data) => login.mutate(data))} className="space-y-4">
        <div className="grid grid-cols-5 gap-2">
          <div className="col-span-2 space-y-1.5">
            <Label htmlFor="documentType">Tipo</Label>
            <Select
              value={documentType}
              onValueChange={(val) => {
                setValue('documentType', val as DocumentType, { shouldValidate: false });
                setValue('documentNumber', '');
              }}
            >
              <SelectTrigger id="documentType" className="h-11">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="DNI">DNI</SelectItem>
                <SelectItem value="CE">Carnet ext.</SelectItem>
                <SelectItem value="PASAPORTE">Pasaporte</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="col-span-3 space-y-1.5">
            <Label htmlFor="documentNumber">Número de documento</Label>
            <Input
              id="documentNumber"
              className="h-11"
              placeholder={config.placeholder}
              maxLength={config.maxLength}
              autoComplete="username"
              {...register('documentNumber')}
            />
          </div>
        </div>

        {errors.documentNumber && (
          <p className="-mt-2 text-xs text-destructive">
            {errors.documentNumber.message}
          </p>
        )}
        {!errors.documentNumber && (
          <p className="-mt-2 text-xs text-muted-foreground">{config.hint}</p>
        )}

        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <Label htmlFor="password">Contraseña</Label>
            <Link
              href="/recuperar-password"
              className="text-xs text-muted-foreground hover:text-primary transition-colors"
            >
              ¿Olvidaste tu contraseña?
            </Link>
          </div>
          <div className="relative">
            <Input
              id="password"
              type={showPassword ? 'text' : 'password'}
              placeholder="••••••••"
              autoComplete="current-password"
              className="h-11 pr-10"
              {...register('password')}
            />
            <button
              type="button"
              className="absolute inset-y-0 right-0 flex items-center pr-3 text-muted-foreground hover:text-foreground transition-colors"
              onClick={() => setShowPassword((v) => !v)}
              tabIndex={-1}
              aria-label={showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
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

        <Button type="submit" className="w-full h-11 gap-2" disabled={login.isPending}>
          {login.isPending ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Verificando...
            </>
          ) : (
            <>
              <LogIn className="h-4 w-4" />
              Ingresar al sistema
            </>
          )}
        </Button>
      </form>

      <p className="text-center text-xs text-muted-foreground">
        Si no tienes credenciales, solicítalas al administrador del sistema.
      </p>
    </div>
  );
}
