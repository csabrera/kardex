'use client';

import * as React from 'react';

import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/cn';

type Tone = 'neutral' | 'success' | 'warning' | 'destructive' | 'info' | 'accent';

const TONE_CLASSES: Record<Tone, string> = {
  neutral:
    'text-foreground/70 bg-muted/40 hover:bg-muted hover:text-foreground ring-border',
  success:
    'text-green-600 dark:text-green-400 bg-green-50 dark:bg-green-950/30 hover:bg-green-100 dark:hover:bg-green-900/40 ring-green-600/20 dark:ring-green-500/30',
  warning:
    'text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/30 hover:bg-amber-100 dark:hover:bg-amber-900/40 ring-amber-600/20 dark:ring-amber-500/30',
  destructive:
    'text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950/30 hover:bg-red-100 dark:hover:bg-red-900/40 ring-red-600/20 dark:ring-red-500/30',
  info: 'text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/30 hover:bg-blue-100 dark:hover:bg-blue-900/40 ring-blue-600/20 dark:ring-blue-500/30',
  accent: 'text-accent bg-accent/10 hover:bg-accent/20 ring-accent/20',
};

interface ActionButtonProps extends Omit<
  React.ButtonHTMLAttributes<HTMLButtonElement>,
  'title'
> {
  icon: React.ElementType;
  label: string;
  tone?: Tone;
}

/**
 * Botón de acción compacto para filas de tabla.
 * Muestra un icono con fondo coloreado + tooltip con el label completo.
 */
export const ActionButton = React.forwardRef<HTMLButtonElement, ActionButtonProps>(
  ({ icon: Icon, label, tone = 'neutral', className, disabled, ...props }, ref) => (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          ref={ref}
          type="button"
          disabled={disabled}
          aria-label={label}
          className={cn(
            'inline-flex h-9 w-9 items-center justify-center rounded-lg ring-1 transition-all',
            'disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-transparent',
            'active:scale-95',
            !disabled && TONE_CLASSES[tone],
            disabled && 'ring-border bg-muted/20 text-muted-foreground',
            className,
          )}
          {...props}
        >
          <Icon className="h-4 w-4" />
        </button>
      </TooltipTrigger>
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  ),
);
ActionButton.displayName = 'ActionButton';
