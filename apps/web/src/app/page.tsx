import { Package, Rocket, ShieldCheck, Users } from 'lucide-react';
import Link from 'next/link';

import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { APP_NAME, APP_VERSION } from '@/lib/constants';

const features = [
  {
    icon: Package,
    title: 'Gestión de Inventario',
    description: 'Movimientos, transferencias y kardex histórico.',
  },
  {
    icon: Users,
    title: 'Control de Accesos',
    description: 'RBAC granular por rol y almacén asignado.',
  },
  {
    icon: ShieldCheck,
    title: 'Auditoría Completa',
    description: 'Trazabilidad de cada acción sensible.',
  },
  {
    icon: Rocket,
    title: 'Tiempo Real',
    description: 'Notificaciones en vivo por WebSocket.',
  },
];

export default function HomePage(): JSX.Element {
  return (
    <main className="relative min-h-screen">
      {/* Subtle gradient background */}
      <div
        aria-hidden="true"
        className="absolute inset-0 -z-10 bg-gradient-to-br from-background via-background to-accent/5"
      />

      <div className="container mx-auto px-4 py-24">
        {/* Hero */}
        <div className="mx-auto max-w-2xl text-center">
          <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-border bg-card px-3 py-1 text-xs font-medium text-muted-foreground">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-accent opacity-75" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-accent" />
            </span>
            v{APP_VERSION} — En desarrollo
          </div>

          <h1 className="text-balance text-4xl font-bold tracking-tight text-foreground sm:text-5xl lg:text-6xl">
            {APP_NAME}
            <span className="block bg-gradient-to-r from-accent to-accent/50 bg-clip-text text-transparent">
              Inventario inteligente
            </span>
          </h1>

          <p className="mt-6 text-balance text-lg leading-8 text-muted-foreground">
            Sistema integral de gestión de inventario, almacenes, transferencias y
            reportes para empresas constructoras.
          </p>

          <div className="mt-10 flex items-center justify-center gap-4">
            <Button asChild size="lg">
              <Link href="/login">Ingresar al sistema</Link>
            </Button>
            <Button asChild variant="ghost" size="lg">
              <a
                href="http://localhost:4000/docs"
                target="_blank"
                rel="noopener noreferrer"
              >
                Ver API Docs →
              </a>
            </Button>
          </div>
        </div>

        {/* Feature cards */}
        <div className="mx-auto mt-20 grid max-w-4xl grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {features.map((feature) => {
            const Icon = feature.icon;
            return (
              <Card
                key={feature.title}
                className="transition-colors hover:bg-muted/30"
              >
                <CardHeader className="pb-3">
                  <div className="mb-2 flex h-9 w-9 items-center justify-center rounded-lg bg-accent/10 text-accent">
                    <Icon className="h-5 w-5" />
                  </div>
                  <CardTitle className="text-base">{feature.title}</CardTitle>
                  <CardDescription className="text-xs">
                    {feature.description}
                  </CardDescription>
                </CardHeader>
                <CardContent />
              </Card>
            );
          })}
        </div>

        {/* Status footer */}
        <div className="mt-20 text-center">
          <p className="text-sm text-muted-foreground">
            Fase actual:{' '}
            <span className="font-mono-tight font-medium text-foreground">
              1D — Design System
            </span>
          </p>
          <p className="mt-2 text-xs text-muted-foreground">
            Toggle dark/light mode usando las preferencias del sistema.
          </p>
        </div>
      </div>
    </main>
  );
}
