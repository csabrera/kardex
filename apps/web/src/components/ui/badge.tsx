import { cva, type VariantProps } from 'class-variance-authority';
import * as React from 'react';

import { cn } from '@/lib/cn';

const badgeVariants = cva(
  'inline-flex items-center rounded-md border px-2 py-0.5 text-xs font-medium transition-colors ring-1 ring-inset',
  {
    variants: {
      variant: {
        default: 'border-transparent bg-primary text-primary-foreground ring-primary/20',
        secondary:
          'border-transparent bg-secondary text-secondary-foreground ring-secondary/30',
        destructive:
          'border-transparent bg-red-50 text-red-700 ring-red-600/20 dark:bg-red-950/30 dark:text-red-400 dark:ring-red-500/30',
        outline: 'text-foreground ring-border',
        success:
          'border-transparent bg-green-50 text-green-700 ring-green-600/20 dark:bg-green-950/30 dark:text-green-400 dark:ring-green-500/30',
        warning:
          'border-transparent bg-amber-50 text-amber-800 ring-amber-600/20 dark:bg-amber-950/30 dark:text-amber-400 dark:ring-amber-500/30',
        info: 'border-transparent bg-blue-50 text-blue-700 ring-blue-600/20 dark:bg-blue-950/30 dark:text-blue-400 dark:ring-blue-500/30',
      },
    },
    defaultVariants: { variant: 'default' },
  },
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>, VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return <div className={cn(badgeVariants({ variant }), className)} {...props} />;
}

export { Badge, badgeVariants };
