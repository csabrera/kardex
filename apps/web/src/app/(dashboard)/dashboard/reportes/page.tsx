'use client';

import { BarChart3, Building, Coins, Package, TrendingUp } from 'lucide-react';
import Link from 'next/link';

import { PageHeader } from '@/components/layout/page-header';

interface ReportCard {
  href: string;
  icon: React.ElementType;
  title: string;
  description: string;
  tone: 'info' | 'success' | 'warning' | 'accent';
}

const TONE_CLASSES: Record<ReportCard['tone'], { bg: string; ring: string; fg: string }> =
  {
    info: {
      bg: 'bg-blue-500/10 dark:bg-blue-500/15',
      ring: 'ring-blue-500/20 dark:ring-blue-500/30',
      fg: 'text-blue-600 dark:text-blue-400',
    },
    success: {
      bg: 'bg-green-500/10 dark:bg-green-500/15',
      ring: 'ring-green-500/20 dark:ring-green-500/30',
      fg: 'text-green-600 dark:text-green-400',
    },
    warning: {
      bg: 'bg-amber-500/10 dark:bg-amber-500/15',
      ring: 'ring-amber-500/20 dark:ring-amber-500/30',
      fg: 'text-amber-600 dark:text-amber-400',
    },
    accent: {
      bg: 'bg-accent/10',
      ring: 'ring-accent/20',
      fg: 'text-accent',
    },
  };

const REPORTS: ReportCard[] = [
  {
    href: '/dashboard/reportes/consumo-por-obra',
    icon: Building,
    title: 'Consumo por obra',
    description: 'Cantidades y valorización de salidas a cada obra en un período.',
    tone: 'info',
  },
  {
    href: '/dashboard/reportes/top-items',
    icon: TrendingUp,
    title: 'Top ítems',
    description:
      'Ranking de ítems más movidos (entradas, salidas o ajustes) con filtros.',
    tone: 'accent',
  },
  {
    href: '/dashboard/reportes/stock-valorizado',
    icon: Coins,
    title: 'Stock valorizado',
    description:
      'Valorización actual del inventario usando el último costo unitario conocido.',
    tone: 'success',
  },
  {
    href: '/dashboard/reportes/movimientos',
    icon: BarChart3,
    title: 'Movimientos agregados',
    description: 'Evolución de entradas, salidas y ajustes por día, semana o mes.',
    tone: 'warning',
  },
];

export default function ReportesHubPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Reportes"
        description="Reportes agregados de consumo, rotación y valorización. Filtrable por período, almacén y obra."
        icon={Package}
      />

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {REPORTS.map((r) => {
          const tone = TONE_CLASSES[r.tone];
          const Icon = r.icon;
          return (
            <Link
              key={r.href}
              href={r.href}
              className="group rounded-xl border bg-card p-6 shadow-sm transition-all hover:shadow-md hover:border-foreground/10 hover:-translate-y-0.5"
            >
              <div className="flex items-start gap-4">
                <div
                  className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-lg ring-1 ${tone.bg} ${tone.ring}`}
                >
                  <Icon className={`h-5 w-5 ${tone.fg}`} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold group-hover:text-accent transition-colors">
                    {r.title}
                  </p>
                  <p className="text-sm text-muted-foreground mt-0.5">{r.description}</p>
                </div>
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
