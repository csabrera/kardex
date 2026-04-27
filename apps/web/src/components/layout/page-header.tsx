import { cn } from '@/lib/cn';

import type { ReactNode } from 'react';

interface PageHeaderProps {
  title: string;
  description?: string;
  icon?: React.ElementType;
  actions?: ReactNode;
  className?: string;
}

/**
 * Encabezado estándar de página. Unifica el layout de título/descripción/acciones.
 */
export function PageHeader({
  title,
  description,
  icon: Icon,
  actions,
  className,
}: PageHeaderProps) {
  return (
    <div className={cn('flex items-start justify-between gap-6', className)}>
      <div className="flex items-start gap-4 min-w-0">
        {Icon && (
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-accent/10 text-accent ring-1 ring-accent/20">
            <Icon className="h-6 w-6" />
          </div>
        )}
        <div className="min-w-0 flex-1">
          <h1 className="text-[1.75rem] font-bold tracking-tight leading-[1.15]">
            {title}
          </h1>
          {description && (
            <p className="text-base text-muted-foreground mt-1.5 leading-relaxed">
              {description}
            </p>
          )}
        </div>
      </div>
      {actions && <div className="flex items-center gap-2 shrink-0 pt-1">{actions}</div>}
    </div>
  );
}
