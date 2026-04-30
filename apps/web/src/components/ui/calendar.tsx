'use client';

import { ChevronDown, ChevronLeft, ChevronRight } from 'lucide-react';
import * as React from 'react';
import { DayPicker } from 'react-day-picker';
import { es } from 'date-fns/locale';

import { cn } from '@/lib/cn';

export type CalendarProps = React.ComponentProps<typeof DayPicker>;

/**
 * Calendar — wrapper de react-day-picker (v9) con estilos del design system.
 * Localizado a español por default. Soporta los modos de captionLayout incluido
 * dropdown (cuando el rango de años es amplio).
 */
export function Calendar({
  className,
  classNames,
  showOutsideDays = true,
  captionLayout,
  ...props
}: CalendarProps) {
  const isDropdown = captionLayout?.includes('dropdown');

  return (
    <DayPicker
      locale={es}
      showOutsideDays={showOutsideDays}
      captionLayout={captionLayout}
      className={cn('p-3', className)}
      classNames={{
        months: 'flex flex-col sm:flex-row gap-4',
        month: 'flex flex-col gap-3',
        month_caption: cn(
          'flex justify-center pt-1 relative items-center w-full',
          // Cuando hay dropdowns, dejamos espacio para los selects (no usar absolute)
          isDropdown && 'gap-2 px-8',
        ),
        caption_label: cn(
          'text-sm font-medium capitalize',
          // Cuando hay dropdowns, ocultar el label de texto (los selects lo reemplazan)
          isDropdown && 'hidden',
        ),
        // Dropdowns nativos restilizados para que se integren con el theme
        dropdowns: 'flex items-center justify-center gap-1.5 grow',
        dropdown_root: 'relative inline-flex items-center',
        dropdown: cn(
          'appearance-none bg-transparent border border-input rounded-md',
          'pl-2 pr-7 py-1 text-sm font-medium cursor-pointer',
          'hover:bg-accent hover:text-accent-foreground transition-colors',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
        ),
        months_dropdown: '',
        years_dropdown: '',
        nav: 'flex items-center gap-1',
        button_previous: cn(
          'absolute left-1 top-1 inline-flex h-7 w-7 items-center justify-center rounded-md',
          'border border-input bg-transparent p-0 hover:bg-accent hover:text-accent-foreground',
          'disabled:opacity-30 disabled:pointer-events-none transition-colors',
          'z-10',
        ),
        button_next: cn(
          'absolute right-1 top-1 inline-flex h-7 w-7 items-center justify-center rounded-md',
          'border border-input bg-transparent p-0 hover:bg-accent hover:text-accent-foreground',
          'disabled:opacity-30 disabled:pointer-events-none transition-colors',
          'z-10',
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
        disabled: 'text-muted-foreground/40 opacity-50 pointer-events-none',
        range_start: '',
        range_middle:
          'aria-selected:bg-accent/40 aria-selected:text-accent-foreground rounded-none',
        range_end: '',
        hidden: 'invisible',
        ...classNames,
      }}
      components={{
        Chevron: ({ orientation, className: chevClassName }) => {
          if (orientation === 'left') {
            return <ChevronLeft className={cn('h-4 w-4', chevClassName)} />;
          }
          if (orientation === 'right') {
            return <ChevronRight className={cn('h-4 w-4', chevClassName)} />;
          }
          // 'down' / 'up' — usado en los dropdowns
          return (
            <ChevronDown
              className={cn(
                'h-3.5 w-3.5 absolute right-1.5 top-1/2 -translate-y-1/2 pointer-events-none opacity-60',
                chevClassName,
              )}
            />
          );
        },
      }}
      {...props}
    />
  );
}

Calendar.displayName = 'Calendar';
