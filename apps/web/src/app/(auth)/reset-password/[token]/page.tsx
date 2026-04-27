'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { Check, Eye, EyeOff, KeyRound, Loader2, X } from 'lucide-react';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useResetPassword } from '@/hooks/use-auth';

const schema = z
  .object({
    newPassword: z
      .string()
      .min(8, 'Mínimo 8 caracteres')
      .regex(/[A-Z]/, 'Debe incluir una mayúscula')
      .regex(/[0-9]/, 'Debe incluir un número'),
    confirmPassword: z.string().min(1, 'Requerido'),
  })
  .refine((d) => d.newPassword === d.confirmPassword, {
    message: 'Las contraseñas no coinciden',
    path: ['confirmPassword'],
  });

type FormData = z.infer<typeof schema>;

function Rule({ ok, text }: { ok: boolean; text: string }) {
  return (
    <li
      className={`flex items-center gap-1.5 text-xs transition-colors ${ok ? 'text-green-600 dark:text-green-400' : 'text-muted-foreground'}`}
    >
      {ok ? <Check className="h-3 w-3" /> : <X className="h-3 w-3" />}
      {text}
    </li>
  );
}

export default function ResetPasswordPage({ params }: { params: { token: string } }) {
  const { token } = params;
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const resetPassword = useResetPassword();

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors },
  } = useForm<FormData>({ resolver: zodResolver(schema) });

  const newPassword = watch('newPassword') ?? '';
  const confirmPassword = watch('confirmPassword') ?? '';

  const hasLength = newPassword.length >= 8;
  const hasUpper = /[A-Z]/.test(newPassword);
  const hasNumber = /[0-9]/.test(newPassword);
  const matches = newPassword.length > 0 && newPassword === confirmPassword;

  const onSubmit = (data: FormData) => resetPassword.mutate({ token, ...data });

  return (
    <div className="space-y-6">
      <div className="space-y-1.5">
        <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
          <KeyRound className="h-5 w-5 text-primary" /> Establecer nueva contraseña
        </h1>
        <p className="text-sm text-muted-foreground">
          Elige una contraseña segura que no hayas usado antes en el sistema.
        </p>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <div className="space-y-1.5">
          <Label htmlFor="newPassword">Nueva contraseña</Label>
          <div className="relative">
            <Input
              id="newPassword"
              type={showNew ? 'text' : 'password'}
              placeholder="••••••••"
              className="h-11 pr-10"
              autoComplete="new-password"
              {...register('newPassword')}
            />
            <button
              type="button"
              className="absolute inset-y-0 right-0 flex items-center pr-3 text-muted-foreground hover:text-foreground transition-colors"
              onClick={() => setShowNew((v) => !v)}
              tabIndex={-1}
            >
              {showNew ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
          <ul className="grid grid-cols-2 gap-x-3 gap-y-1 mt-2 pl-0.5">
            <Rule ok={hasLength} text="Al menos 8 caracteres" />
            <Rule ok={hasUpper} text="Una letra mayúscula" />
            <Rule ok={hasNumber} text="Un número" />
            <Rule ok={matches} text="Coincide con confirmación" />
          </ul>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="confirmPassword">Confirmar contraseña</Label>
          <div className="relative">
            <Input
              id="confirmPassword"
              type={showConfirm ? 'text' : 'password'}
              placeholder="••••••••"
              className="h-11 pr-10"
              autoComplete="new-password"
              {...register('confirmPassword')}
            />
            <button
              type="button"
              className="absolute inset-y-0 right-0 flex items-center pr-3 text-muted-foreground hover:text-foreground transition-colors"
              onClick={() => setShowConfirm((v) => !v)}
              tabIndex={-1}
            >
              {showConfirm ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
          {errors.confirmPassword && (
            <p className="text-xs text-destructive">{errors.confirmPassword.message}</p>
          )}
        </div>

        <Button
          type="submit"
          className="w-full h-11 gap-2"
          disabled={resetPassword.isPending}
        >
          {resetPassword.isPending ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Actualizando...
            </>
          ) : (
            <>
              <Check className="h-4 w-4" />
              Establecer nueva contraseña
            </>
          )}
        </Button>
      </form>
    </div>
  );
}
