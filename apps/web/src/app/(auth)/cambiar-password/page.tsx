'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { Check, Eye, EyeOff, KeyRound, Loader2, ShieldAlert, X } from 'lucide-react';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useChangePassword } from '@/hooks/use-auth';

const schema = z
  .object({
    oldPassword: z.string().min(1, 'Requerido'),
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

export default function CambiarPasswordPage() {
  const [show, setShow] = useState({ old: false, new: false, confirm: false });
  const changePassword = useChangePassword();

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

  return (
    <div className="space-y-6">
      <div className="flex items-start gap-3 rounded-lg border border-amber-200 dark:border-amber-900/50 bg-amber-50 dark:bg-amber-950/30 p-3">
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-amber-100 dark:bg-amber-900/50 text-amber-600 dark:text-amber-400">
          <ShieldAlert className="h-4 w-4" />
        </div>
        <div className="text-xs">
          <p className="font-medium text-amber-900 dark:text-amber-200">
            Cambio de contraseña requerido
          </p>
          <p className="text-amber-800/80 dark:text-amber-200/70 mt-0.5">
            Por seguridad, debes establecer una nueva contraseña antes de continuar al
            sistema.
          </p>
        </div>
      </div>

      <div className="space-y-1.5">
        <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
          <KeyRound className="h-5 w-5 text-primary" /> Nueva contraseña
        </h1>
        <p className="text-sm text-muted-foreground">
          Elige una contraseña segura que no hayas usado antes.
        </p>
      </div>

      <form
        onSubmit={handleSubmit((d) => changePassword.mutate(d))}
        className="space-y-4"
      >
        <div className="space-y-1.5">
          <Label htmlFor="old">Contraseña actual</Label>
          <div className="relative">
            <Input
              id="old"
              type={show.old ? 'text' : 'password'}
              placeholder="••••••••"
              className="h-11 pr-10"
              autoComplete="current-password"
              {...register('oldPassword')}
            />
            <button
              type="button"
              className="absolute inset-y-0 right-0 flex items-center pr-3 text-muted-foreground hover:text-foreground transition-colors"
              onClick={() => setShow((s) => ({ ...s, old: !s.old }))}
              tabIndex={-1}
            >
              {show.old ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
          {errors.oldPassword && (
            <p className="text-xs text-destructive">{errors.oldPassword.message}</p>
          )}
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="new">Nueva contraseña</Label>
          <div className="relative">
            <Input
              id="new"
              type={show.new ? 'text' : 'password'}
              placeholder="••••••••"
              className="h-11 pr-10"
              autoComplete="new-password"
              {...register('newPassword')}
            />
            <button
              type="button"
              className="absolute inset-y-0 right-0 flex items-center pr-3 text-muted-foreground hover:text-foreground transition-colors"
              onClick={() => setShow((s) => ({ ...s, new: !s.new }))}
              tabIndex={-1}
            >
              {show.new ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
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
          <Label htmlFor="confirm">Confirmar nueva contraseña</Label>
          <div className="relative">
            <Input
              id="confirm"
              type={show.confirm ? 'text' : 'password'}
              placeholder="••••••••"
              className="h-11 pr-10"
              autoComplete="new-password"
              {...register('confirmPassword')}
            />
            <button
              type="button"
              className="absolute inset-y-0 right-0 flex items-center pr-3 text-muted-foreground hover:text-foreground transition-colors"
              onClick={() => setShow((s) => ({ ...s, confirm: !s.confirm }))}
              tabIndex={-1}
            >
              {show.confirm ? (
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

        <Button
          type="submit"
          className="w-full h-11 gap-2"
          disabled={changePassword.isPending}
        >
          {changePassword.isPending ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Actualizando...
            </>
          ) : (
            <>
              <Check className="h-4 w-4" />
              Actualizar contraseña
            </>
          )}
        </Button>
      </form>
    </div>
  );
}
