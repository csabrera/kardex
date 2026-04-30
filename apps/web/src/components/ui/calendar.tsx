'use client';

import { ChevronLeft, ChevronRight } from 'lucide-react';
import * as React from 'react';
import { DayPicker } from 'react-day-picker';
import { es } from 'date-fns/locale';

import { cn } from '@/lib/cn';

export type CalendarProps = React.ComponentProps<typeof DayPicker>;

/**
 * Calendar — wrapper de react-day-picker con estilos del design system.
 * Localizado a español por default. Soporta selección single, multiple y range
 * pasando `mode` como prop.
 */
export function Calendar({
  className,
  classNames,
  showOutsideDays = true,
  ...props
}: CalendarProps) {
  return (
    <DayPicker
      locale={es}
      showOutsideDays={showOutsideDays}
      className={cn('p-3', className)}
      classNames={{
        months: 'flex flex-col sm:flex-row gap-4',
        month: 'flex flex-col gap-3',
        month_caption: 'flex justify-center pt-1 relative items-center w-full',
        caption_label: 'text-sm font-medium capitalize',
        nav: 'flex items-center gap-1',
        button_previous: cn(
          'absolute left-1 top-1 inline-flex h-7 w-7 items-center justify-center rounded-md',
          'border border-input bg-transparent p-0 hover:bg-accent hover:text-accent-foreground',
          'disabled:opacity-30 disabled:pointer-events-none transition-colors',
        ),
        button_next: cn(
          'absolute right-1 top-1 inline-flex h-7 w-7 items-center justify-center rounded-md',
          'border border-input bg-transparent p-0 hover:bg-accent hover:text-accent-foreground',
          'disabled:opacity-30 disabled:pointer-events-none transition-colors',
        ),
        month_grid: 'w-full border-collapse',
        weekdays: 'flex',
        weekday:
          'text-muted-foreground rounded-md w-9 font-normal text-[0.78rem] capitalize',
        week: 'flex w-full mt-1',
        day: cn(
          'relative p-0 text-center text-sm focus-within:relative focus-within:z-20',
          '[&:has([aria-selected])]:bg-accent/50',
          '[&:has([aria-selected].day-outside)]:bg-accent/30',
        ),
        day_button: cn(
          'inline-flex h-9 w-9 items-center justify-center rounded-md p-0',
          'font-normal aria-selected:opacity-100 hover:bg-accent hover:text-accent-foreground',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
          'aria-selected:bg-primary aria-selected:text-primary-foreground',
          'aria-selected:hover:bg-primary aria-selected:hover:text-primary-foreground',
          'transition-colors',
        ),
        selected: '',
        today: 'bg-accent text-accent-foreground rounded-md font-semibold',
        outside:
          'day-outside text-muted-foreground/50 aria-selected:text-muted-foreground',
        disabled: 'text-muted-foreground/40 opacity-50',
        range_start: '',
        range_middle:
          'aria-selected:bg-accent/40 aria-selected:text-accent-foreground rounded-none',
        range_end: '',
        hidden: 'invisible',
        ...classNames,
      }}
      components={{
        Chevron: (props) =>
          props.orientation === 'left' ? (
            <ChevronLeft className="h-4 w-4" />
          ) : (
            <ChevronRight className="h-4 w-4" />
          ),
      }}
      {...props}
    />
  );
}

Calendar.displayName = 'Calendar';
