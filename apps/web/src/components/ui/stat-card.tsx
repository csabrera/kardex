import { TrendingDown, TrendingUp } from 'lucide-react';

import { cn } from '@/lib/cn';

type Tone = 'default' | 'success' | 'warning' | 'destructive' | 'info' | 'accent';

const TONE_CONFIG: Record<Tone, { iconBg: string; iconFg: string; ring: string }> = {
  default: {
    iconBg: 'bg-muted',
    iconFg: 'text-muted-foreground',
    ring: 'ring-border',
  },
  success: {
    iconBg: 'bg-green-500/10 dark:bg-green-500/15',
    iconFg: 'text-green-600 dark:text-green-400',
    ring: 'ring-green-500/20 dark:ring-green-500/30',
  },
  warning: {
    iconBg: 'bg-amber-500/10 dark:bg-amber-500/15',
    iconFg: 'text-amber-600 dark:text-amber-400',
    ring: 'ring-amber-500/20 dark:ring-amber-500/30',
  },
  destructive: {
    iconBg: 'bg-red-500/10 dark:bg-red-500/15',
    iconFg: 'text-red-600 dark:text-red-400',
    ring: 'ring-red-500/20 dark:ring-red-500/30',
  },
  info: {
    iconBg: 'bg-blue-500/10 dark:bg-blue-500/15',
    iconFg: 'text-blue-600 dark:text-blue-400',
    ring: 'ring-blue-500/20 dark:ring-blue-500/30',
  },
  accent: {
    iconBg: 'bg-accent/10',
    iconFg: 'text-accent',
    ring: 'ring-accent/20',
  },
};

interface StatCardProps {
  title: string;
  value: string | number | undefined;
  icon: React.ElementType;
  description?: string;
  tone?: Tone;
  trend?: { direction: 'up' | 'down'; label: string };
  isLoading?: boolean;
  className?: string;
  onClick?: () => void;
}

export function StatCard({
  title,
  value,
  icon: Icon,
  description,
  tone = 'default',
  trend,
  isLoading,
  className,
  onClick,
}: StatCardProps) {
  const cfg = TONE_CONFIG[tone];
  const interactive = !!onClick;

  return (
    <div
      onClick={onClick}
      className={cn(
        'rounded-xl border bg-card p-6 shadow-sm transition-all duration-200',
        interactive &&
          'cursor-pointer hover:shadow-md hover:border-foreground/10 hover:-translate-y-0.5',
        className,
      )}
    >
      <div className="flex items-center justify-between gap-4">
        <p className="text-sm font-medium text-muted-foreground">{title}</p>
        <div
          className={cn(
            'flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ring-1',
            cfg.iconBg,
            cfg.ring,
          )}
        >
          <Icon className={cn('h-5 w-5', cfg.iconFg)} />
        </div>
      </div>

      <div className="mt-4">
        <p className="text-[2.25rem] font-bold tracking-tight leading-none tabular-nums">
          {isLoading ? (
            <span className="inline-block h-9 w-20 rounded-md bg-muted animate-pulse align-middle" />
          ) : (
            (value ?? '—')
          )}
        </p>

        <div className="flex items-center gap-3 mt-2 flex-wrap">
          {trend && (
            <div
              className={cn(
                'inline-flex items-center gap-1 text-sm font-medium',
                trend.direction === 'up'
                  ? 'text-green-600 dark:text-green-400'
                  : 'text-red-600 dark:text-red-400',
              )}
            >
              {trend.direction === 'up' ? (
                <TrendingUp className="h-3.5 w-3.5" />
              ) : (
                <TrendingDown className="h-3.5 w-3.5" />
              )}
              {trend.label}
            </div>
          )}
          {description && (
            <p className="text-sm text-muted-foreground truncate">{description}</p>
          )}
        </div>
      </div>
    </div>
  );
}
