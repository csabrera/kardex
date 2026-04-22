'use client';

import { useEffect } from 'react';

import { Button } from '@/components/ui/button';

interface ErrorPageProps {
  error: Error & { digest?: string };
  reset: () => void;
}

export default function ErrorPage({ error, reset }: ErrorPageProps): JSX.Element {
  useEffect(() => {
    // TODO: Wire up Sentry/observability in Fase 8C
    // eslint-disable-next-line no-console
    console.error('Application error:', error);
  }, [error]);

  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="mx-auto max-w-md text-center">
        <p className="font-mono-tight text-sm font-medium text-destructive">Error</p>
        <h1 className="mt-4 text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
          Algo salió mal
        </h1>
        <p className="mt-4 text-base text-muted-foreground">
          Ocurrió un error inesperado. Intenta recargar la página.
        </p>
        {process.env.NODE_ENV === 'development' && error.message && (
          <pre className="mt-6 overflow-auto rounded-md bg-muted p-4 text-left text-xs text-muted-foreground">
            {error.message}
            {error.digest && `\n\nDigest: ${error.digest}`}
          </pre>
        )}
        <div className="mt-8 flex items-center justify-center gap-4">
          <Button onClick={reset}>Reintentar</Button>
          <Button variant="ghost" onClick={() => window.location.assign('/')}>
            Ir al inicio
          </Button>
        </div>
      </div>
    </main>
  );
}
