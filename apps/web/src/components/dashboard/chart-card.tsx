'use client';

import { cn } from '@/lib/cn';

export interface ChartCardProps {
  title: string;
  description?: string;
  icon?: React.ElementType;
  /** Slot derecho del header (filtros, botones de navegación, etc.) */
  action?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  /** Altura mínima del área de contenido (default: 260px). */
  minHeight?: number;
}

/**
 * Container para gráficas y bloques de información del dashboard.
 *
 * Estética shadcn Blocks `dashboard-01`:
 *  - Header limpio con título prominente + descripción secundaria
 *  - Icono opcional en tono muted (no saturado)
 *  - Slot `action` para filtros/toggles
 *  - Borde y sombra sutiles, sin hover
 */
export function ChartCard({
  title,
  description,
  icon: Icon,
  action,
  children,
  className,
  minHeight = 260,
}: ChartCardProps) {
  return (
    <section className={cn('rounded-xl border bg-card flex flex-col', className)}>
      <header className="flex items-start justify-between gap-3 px-5 pt-5 pb-3">
        <div className="flex items-start gap-3 min-w-0">
          {Icon && (
            <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground">
              <Icon className="h-3.5 w-3.5" />
            </div>
          )}
          <div className="min-w-0">
            <h2 className="text-sm font-semibold leading-tight">{title}</h2>
            {description && (
              <p className="text-xs text-muted-foreground mt-1 truncate">{description}</p>
            )}
          </div>
        </div>
        {action && <div className="flex items-center gap-2 shrink-0">{action}</div>}
      </header>
      <div
        className="flex-1 flex flex-col justify-center px-5 pb-5"
        style={{ minHeight }}
      >
        {children}
      </div>
    </section>
  );
}
