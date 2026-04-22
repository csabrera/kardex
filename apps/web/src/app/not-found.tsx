import Link from 'next/link';

import { Button } from '@/components/ui/button';

export default function NotFoundPage(): JSX.Element {
  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="mx-auto max-w-md text-center">
        <p className="font-mono-tight text-sm font-medium text-accent">404</p>
        <h1 className="mt-4 text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
          Página no encontrada
        </h1>
        <p className="mt-4 text-base text-muted-foreground">
          La página que buscas no existe o fue movida.
        </p>
        <div className="mt-8 flex items-center justify-center gap-4">
          <Button asChild>
            <Link href="/">Volver al inicio</Link>
          </Button>
        </div>
      </div>
    </main>
  );
}
