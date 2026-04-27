'use client';

import { ArrowDownRight, ArrowUpRight, Minus } from 'lucide-react';
import Link from 'next/link';

import { cn } from '@/lib/cn';

export type KpiTone =
  | 'default'
  | 'accent'
  | 'info'
  | 'success'
  | 'warning'
  | 'destructive';

const KPI_TONES: Record<KpiTone, { bg: string; fg: string }> = {
  default: { bg: 'bg-muted', fg: 'text-muted-foreground' },
  accent: { bg: 'bg-accent/10', fg: 'text-accent' },
  info: { bg: 'bg-info/10', fg: 'text-info' },
  success: { bg: 'bg-success/10', fg: 'text-success' },
  warning: { bg: 'bg-warning/10', fg: 'text-warning' },
  destructive: { bg: 'bg-destructive/10', fg: 'text-destructive' },
};

export interface KpiCardProps {
  label: string;
  value: number | string | undefined;
  icon: React.ElementType;
  tone?: KpiTone;
  context?: { kind: 'up' | 'down' | 'neutral'; label: string };
  isLoading?: boolean;
  href?: string;
  onClick?: () => void;
  /** Formato custom para el valor (ej. moneda). Default: toLocaleString('es-PE') si es number. */
  formatter?: (value: number | string) => string;
}

/**
 * KPI card con estética shadcn Blocks `dashboard-01` / Vercel.
 *
 * Principios:
 *  - Layout compacto: label arriba, value grande, trend abajo — como dashboards reales
 *  - Íconos semánticos usando tokens HSL (no colores hardcoded)
 *  - Trend como chip con flecha + label → legible a primera vista
 *  - Hover sutil: solo border, sin lift (estilo Linear/Stripe)
 *  - Click opcional via `href` (Link) o `onClick` (mismo look)
 */
export function KpiCard({
  label,
  value,
  icon: Icon,
  tone = 'default',
  context,
  isLoading,
  href,
  onClick,
  formatter,
}: KpiCardProps) {
  const t = KPI_TONES[tone];

  const formattedValue = (() => {
    if (isLoading || value === undefined) return null;
    if (formatter) return formatter(value);
    if (typeof value === 'number') return value.toLocaleString('es-PE');
    return value;
  })();

  const trendTone =
    context?.kind === 'up'
      ? 'bg-success/10 text-success'
      : context?.kind === 'down'
        ? 'bg-destructive/10 text-destructive'
        : 'bg-muted text-muted-foreground';

  const TrendIcon =
    context?.kind === 'up'
      ? ArrowUpRight
      : context?.kind === 'down'
        ? ArrowDownRight
        : Minus;

  const body = (
    <>
      <div className="flex items-start justify-between gap-2">
        <p className="text-xs font-medium text-muted-foreground truncate">{label}</p>
        <div
          className={cn(
            'flex h-7 w-7 shrink-0 items-center justify-center rounded-md',
            t.bg,
          )}
        >
          <Icon className={cn('h-3.5 w-3.5', t.fg)} />
        </div>
      </div>
      <div className="mt-2 flex items-baseline gap-2 min-h-[36px]">
        {isLoading ? (
          <span className="inline-block h-8 w-20 rounded-md bg-muted animate-pulse" />
        ) : (
          <span className="text-3xl font-semibold tracking-tight tabular-nums">
            {formattedValue}
          </span>
        )}
      </div>
      {context && !isLoading && (
        <div className="mt-2 flex items-center gap-1.5">
          <span
            className={cn(
              'inline-flex items-center gap-0.5 rounded-md px-1.5 py-0.5 text-[11px] font-medium tabular-nums',
              trendTone,
            )}
          >
            <TrendIcon className="h-3 w-3" />
          </span>
          <span className="text-xs text-muted-foreground truncate">{context.label}</span>
        </div>
      )}
    </>
  );

  const baseClasses = cn(
    'group relative flex flex-col rounded-xl border bg-card p-4 text-left transition-colors',
    (href ?? onClick) && 'hover:border-foreground/20 hover:bg-accent/5 cursor-pointer',
  );

  if (href) {
    return (
      <Link href={href} className={baseClasses}>
        {body}
      </Link>
    );
  }

  if (onClick) {
    return (
      <button type="button" onClick={onClick} className={baseClasses}>
        {body}
      </button>
    );
  }

  return <div className={baseClasses}>{body}</div>;
}
