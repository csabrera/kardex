'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { ArrowLeft, CheckCircle2, KeyRound, Loader2, Mail } from 'lucide-react';
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
import { useForgotPassword } from '@/hooks/use-auth';
import { DOCUMENT_CONFIGS, type DocumentType } from '@/hooks/use-document-type';

const schema = z
  .object({
    documentType: z.enum(['DNI', 'CE', 'PASAPORTE'] as const),
    documentNumber: z.string().min(1, 'Requerido'),
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

type FormData = z.infer<typeof schema>;

export default function RecuperarPasswordPage() {
  const [submitted, setSubmitted] = useState(false);
  const [devToken, setDevToken] = useState<string | null>(null);
  const forgotPassword = useForgotPassword();

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

  const onSubmit = async (data: FormData) => {
    const res = await forgotPassword.mutateAsync(data);
    setSubmitted(true);
    if (res.data.data.token) setDevToken(res.data.data.token);
  };

  if (submitted) {
    return (
      <div className="space-y-6">
        <div className="flex items-start gap-3 rounded-lg border border-green-200 dark:border-green-900/50 bg-green-50 dark:bg-green-950/30 p-4">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-green-100 dark:bg-green-900/50 text-green-600 dark:text-green-400">
            <CheckCircle2 className="h-5 w-5" />
          </div>
          <div className="text-sm">
            <p className="font-semibold text-green-900 dark:text-green-200">
              Solicitud recibida
            </p>
            <p className="text-green-800/80 dark:text-green-200/70 mt-1">
              Si el documento está registrado en el sistema, el administrador te
              proporcionará el enlace de recuperación.
            </p>
          </div>
        </div>

        {devToken && (
          <div className="rounded-lg border border-amber-200 dark:border-amber-900/50 bg-amber-50 dark:bg-amber-950/30 p-3 text-sm">
            <p className="font-medium text-amber-900 dark:text-amber-200">
              Modo desarrollo
            </p>
            <p className="text-amber-800/80 dark:text-amber-200/70 mt-1 break-all text-xs">
              Enlace generado:{' '}
              <Link href={`/reset-password/${devToken}`} className="underline font-mono">
                /reset-password/{devToken.slice(0, 20)}...
              </Link>
            </p>
          </div>
        )}

        <Link href="/login">
          <Button variant="outline" className="w-full h-11 gap-2">
            <ArrowLeft className="h-4 w-4" />
            Volver al inicio de sesión
          </Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="space-y-1.5">
        <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
          <KeyRound className="h-5 w-5 text-primary" /> Recuperar contraseña
        </h1>
        <p className="text-sm text-muted-foreground">
          Ingresa tu documento y recibirás instrucciones para restablecer tu acceso.
        </p>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <div className="grid grid-cols-5 gap-2">
          <div className="col-span-2 space-y-1.5">
            <Label>Tipo</Label>
            <Select
              value={documentType}
              onValueChange={(val) => {
                setValue('documentType', val as DocumentType, { shouldValidate: false });
                setValue('documentNumber', '');
              }}
            >
              <SelectTrigger className="h-11">
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
              {...register('documentNumber')}
            />
          </div>
        </div>
        {errors.documentNumber && (
          <p className="-mt-2 text-xs text-destructive">
            {errors.documentNumber.message}
          </p>
        )}

        <Button
          type="submit"
          className="w-full h-11 gap-2"
          disabled={forgotPassword.isPending}
        >
          {forgotPassword.isPending ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Enviando solicitud...
            </>
          ) : (
            <>
              <Mail className="h-4 w-4" />
              Solicitar recuperación
            </>
          )}
        </Button>
      </form>

      <Link
        href="/login"
        className="flex items-center justify-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
      >
        <ArrowLeft className="h-3.5 w-3.5" />
        Volver al inicio de sesión
      </Link>
    </div>
  );
}
