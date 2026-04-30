'use client';

import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { CalendarIcon, X } from 'lucide-react';
import * as React from 'react';

import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/cn';

interface DatePickerProps {
  /** Valor controlado (ISO string YYYY-MM-DD). Empty string = sin selección. */
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
  /** Restricción de rango. Si rango > 5 años, captionLayout cambia a dropdown
   *  para que el usuario pueda saltar entre meses/años con selects. */
  fromDate?: Date;
  toDate?: Date;
  className?: string;
  /** Permite borrar la selección con un botón X. Default true. */
  clearable?: boolean;
  ariaLabel?: string;
}

/**
 * DatePicker — combinación Popover + Calendar localizada a español.
 * Valor controlado en formato ISO YYYY-MM-DD para integración con react-hook-form.
 */
export function DatePicker({
  value,
  onChange,
  placeholder = 'Selecciona fecha',
  disabled = false,
  fromDate,
  toDate,
  className,
  clearable = true,
  ariaLabel,
}: DatePickerProps) {
  const [open, setOpen] = React.useState(false);

  // Parse value (YYYY-MM-DD) → Date local sin TZ shifts.
  const selectedDate = React.useMemo(() => {
    if (!value) return undefined;
    const parts = value.split('-').map(Number);
    if (parts.length !== 3 || parts.some(Number.isNaN)) return undefined;
    const [y, m, d] = parts as [number, number, number];
    return new Date(y, m - 1, d);
  }, [value]);

  const formattedLabel = selectedDate
    ? format(selectedDate, "d 'de' MMMM 'de' yyyy", { locale: es })
    : '';

  const handleSelect = (date: Date | undefined) => {
    if (!date) {
      onChange('');
    } else {
      const y = date.getFullYear();
      const m = String(date.getMonth() + 1).padStart(2, '0');
      const d = String(date.getDate()).padStart(2, '0');
      onChange(`${y}-${m}-${d}`);
    }
    setOpen(false);
  };

  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation();
    onChange('');
  };

  // Si el rango es amplio, usar dropdowns de mes/año para saltar rápido.
  const useDropdownLayout =
    fromDate && toDate && toDate.getFullYear() - fromDate.getFullYear() > 5;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          disabled={disabled}
          aria-label={ariaLabel ?? placeholder}
          className={cn(
            'w-full justify-start text-left font-normal',
            !selectedDate && 'text-muted-foreground',
            className,
          )}
        >
          <CalendarIcon className="mr-2 h-4 w-4 shrink-0 opacity-70" />
          <span className="flex-1 truncate capitalize">
            {formattedLabel || placeholder}
          </span>
          {clearable && selectedDate && !disabled && (
            <span
              role="button"
              tabIndex={0}
              aria-label="Borrar fecha"
              onClick={handleClear}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  handleClear(e as unknown as React.MouseEvent);
                }
              }}
              className="ml-2 rounded-sm p-0.5 opacity-60 hover:opacity-100 hover:bg-muted transition"
            >
              <X className="h-3.5 w-3.5" />
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <Calendar
          mode="single"
          selected={selectedDate}
          onSelect={handleSelect}
          captionLayout={useDropdownLayout ? 'dropdown' : 'label'}
          startMonth={fromDate}
          endMonth={toDate}
          disabled={
            fromDate || toDate
              ? [
                  ...(fromDate ? [{ before: fromDate }] : []),
                  ...(toDate ? [{ after: toDate }] : []),
                ]
              : undefined
          }
          defaultMonth={selectedDate ?? toDate ?? new Date()}
        />
      </PopoverContent>
    </Popover>
  );
}
