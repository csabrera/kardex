'use client';

import { Check, Loader2, Search, X } from 'lucide-react';
import * as React from 'react';

import { cn } from '@/lib/cn';

/**
 * Combobox de búsqueda async genérico. La integración con TanStack Query / backend
 * queda del lado del consumidor: éste pasa `items` y se entera del query de búsqueda
 * a través de `onSearchChange`.
 *
 * Maneja: debounce interno (250ms), apertura/cierre del dropdown, selección,
 * navegación por teclado (↑↓ Enter Escape), click-outside, limpieza con botón X.
 *
 * Ejemplo:
 * ```tsx
 * const [search, setSearch] = useState('');
 * const debounced = useDebouncedValue(search, 250); // o el propio componente
 * const { data, isFetching } = useItems({ search: debounced });
 * <SearchCombobox
 *   value={selectedId}
 *   onChange={(id, item) => setSelectedId(id)}
 *   onSearchChange={setSearch}
 *   items={data?.items ?? []}
 *   isLoading={isFetching}
 *   getId={(i) => i.id}
 *   getLabel={(i) => `[${i.code}] ${i.name}`}
 *   placeholder="Buscar ítem..."
 * />
 * ```
 */

interface SearchComboboxProps<T> {
  /** ID del item actualmente seleccionado (controlado) */
  value: string;
  /** Se invoca al seleccionar (o al limpiar con `''`). Recibe también el item completo si está disponible. */
  onChange: (id: string, item?: T) => void;
  /** Lista actual de candidatos (el caller se encarga del fetch) */
  items: T[];
  isLoading?: boolean;
  /** Se invoca con el query de búsqueda (debounced internamente). */
  onSearchChange: (query: string) => void;
  /** Extrae el id único de un item. */
  getId: (item: T) => string;
  /** Texto mostrado en el input cuando el item está seleccionado. */
  getLabel: (item: T) => string;
  /** Render custom de cada fila del dropdown. Default: usa getLabel. */
  renderItem?: (item: T, selected: boolean) => React.ReactNode;
  /** Para mostrar el label del item ya seleccionado cuando items aún no contiene al seleccionado (ej. form cargado con data previa). */
  selectedItem?: T | null;
  placeholder?: string;
  emptyMessage?: string;
  loadingMessage?: string;
  /** Caracteres mínimos antes de empezar a pedir resultados. Default: 0 (busca desde el 1er caracter). */
  minQueryLength?: number;
  disabled?: boolean;
  autoFocus?: boolean;
  id?: string;
  className?: string;
  error?: boolean;
  /** Debounce del onSearchChange en ms (default 250). */
  debounceMs?: number;
}

export function SearchCombobox<T>({
  value,
  onChange,
  items,
  isLoading,
  onSearchChange,
  getId,
  getLabel,
  renderItem,
  selectedItem,
  placeholder = 'Buscar...',
  emptyMessage = 'Sin resultados',
  loadingMessage = 'Buscando...',
  minQueryLength = 0,
  disabled,
  autoFocus,
  id,
  className,
  error,
  debounceMs = 250,
}: SearchComboboxProps<T>) {
  const [query, setQuery] = React.useState('');
  const [open, setOpen] = React.useState(false);
  const [activeIndex, setActiveIndex] = React.useState(-1);
  const inputRef = React.useRef<HTMLInputElement>(null);
  const containerRef = React.useRef<HTMLDivElement>(null);
  const listRef = React.useRef<HTMLDivElement>(null);

  const resolvedSelected: T | null =
    selectedItem ?? items.find((i) => getId(i) === value) ?? null;

  // Debounce del query hacia onSearchChange
  React.useEffect(() => {
    if (!open) return;
    const t = setTimeout(() => {
      onSearchChange(query);
    }, debounceMs);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query, open, debounceMs]);

  // Click-outside cierra el dropdown
  React.useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  // Reset activeIndex cuando cambian items o se reabre
  React.useEffect(() => {
    if (open) setActiveIndex(items.length > 0 ? 0 : -1);
  }, [items, open]);

  const canSearch = query.length >= minQueryLength;
  const showEmpty = open && canSearch && !isLoading && items.length === 0;
  const showLoading = open && isLoading;

  const select = (item: T) => {
    onChange(getId(item), item);
    setQuery('');
    setOpen(false);
    inputRef.current?.blur();
  };

  const clear = () => {
    onChange('', undefined);
    setQuery('');
    onSearchChange('');
    inputRef.current?.focus();
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (!open) {
        setOpen(true);
        return;
      }
      setActiveIndex((i) => Math.min(items.length - 1, i + 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveIndex((i) => Math.max(0, i - 1));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (open && items[activeIndex]) {
        select(items[activeIndex]);
      }
    } else if (e.key === 'Escape') {
      setOpen(false);
    }
  };

  // Mantener el item activo visible
  React.useEffect(() => {
    if (!open || activeIndex < 0) return;
    const el = listRef.current?.children[activeIndex] as HTMLElement | undefined;
    el?.scrollIntoView({ block: 'nearest' });
  }, [activeIndex, open]);

  const displayValue = resolvedSelected ? getLabel(resolvedSelected) : query;

  return (
    <div ref={containerRef} className={cn('relative', className)}>
      <div
        className={cn(
          'flex items-center gap-2 rounded-lg border bg-background transition-colors',
          error
            ? 'border-destructive focus-within:border-destructive focus-within:ring-2 focus-within:ring-destructive/30'
            : 'border-input focus-within:border-foreground/30 focus-within:ring-2 focus-within:ring-ring/30',
          disabled && 'opacity-50 cursor-not-allowed',
          'h-10 px-3',
        )}
      >
        <Search className="h-4 w-4 shrink-0 text-muted-foreground" />
        <input
          ref={inputRef}
          id={id}
          type="text"
          autoComplete="off"
          autoFocus={autoFocus}
          disabled={disabled}
          value={displayValue}
          placeholder={placeholder}
          className="flex-1 text-sm outline-none bg-transparent placeholder:text-muted-foreground disabled:cursor-not-allowed"
          onChange={(e) => {
            // Si se estaba mostrando un seleccionado y el usuario empieza a escribir, se limpia la selección
            if (resolvedSelected) {
              onChange('', undefined);
            }
            setQuery(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={handleKeyDown}
          role="combobox"
          aria-expanded={open}
          aria-controls={`${id ?? 'combobox'}-list`}
          aria-autocomplete="list"
        />
        {resolvedSelected && !disabled && (
          <button
            type="button"
            onClick={clear}
            aria-label="Limpiar selección"
            className="shrink-0 rounded-md p-0.5 text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        )}
      </div>

      {open && (showLoading || showEmpty || items.length > 0) && (
        <div
          id={`${id ?? 'combobox'}-list`}
          role="listbox"
          className="absolute top-full left-0 right-0 z-50 mt-1 max-h-64 overflow-auto rounded-lg border bg-popover shadow-lg"
        >
          {showLoading && (
            <div className="flex items-center gap-2 px-3 py-3 text-xs text-muted-foreground">
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
              {loadingMessage}
            </div>
          )}
          {showEmpty && (
            <div className="px-3 py-4 text-center text-xs text-muted-foreground">
              {emptyMessage}
            </div>
          )}
          {!showLoading && items.length > 0 && (
            <div ref={listRef}>
              {items.map((item, idx) => {
                const selected = resolvedSelected
                  ? getId(item) === getId(resolvedSelected)
                  : false;
                const active = idx === activeIndex;
                return (
                  <button
                    key={getId(item)}
                    type="button"
                    role="option"
                    aria-selected={selected}
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => select(item)}
                    onMouseEnter={() => setActiveIndex(idx)}
                    className={cn(
                      'flex w-full items-center gap-2 px-3 py-2 text-left text-sm transition-colors border-b last:border-b-0',
                      active
                        ? 'bg-accent/10 text-foreground'
                        : 'hover:bg-muted text-foreground',
                    )}
                  >
                    <div className="flex-1 min-w-0">
                      {renderItem ? renderItem(item, selected) : getLabel(item)}
                    </div>
                    {selected && <Check className="h-3.5 w-3.5 shrink-0 text-accent" />}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
