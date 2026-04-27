'use client';

import {
  flexRender,
  getCoreRowModel,
  useReactTable,
  type Cell,
  type ColumnDef,
  type Table as ReactTable,
} from '@tanstack/react-table';
import {
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  Loader2,
} from 'lucide-react';

import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableEmpty,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

interface DataTableProps<TData> {
  columns: ColumnDef<TData>[];
  data: TData[];
  isLoading?: boolean;
  page: number;
  pageSize: number;
  total: number;
  onPageChange: (page: number) => void;
  /** Si se provee, muestra selector de tamaño de página */
  onPageSizeChange?: (size: number) => void;
  pageSizeOptions?: number[];
  /**
   * Slot para toolbar encima de la tabla (filtros + column visibility).
   * Recibe la instancia de `Table` para que se puedan usar `DataTableViewOptions`,
   * filtros faceted, botones de reset, etc.
   */
  toolbar?: (table: ReactTable<TData>) => React.ReactNode;
  /**
   * Estado externo de visibilidad de columnas (opcional).
   * Si no se provee, las columnas se mantienen siempre visibles.
   */
  columnVisibility?: Record<string, boolean>;
  onColumnVisibilityChange?: (visibility: Record<string, boolean>) => void;
}

export function DataTable<TData>({
  columns,
  data,
  isLoading,
  page,
  pageSize,
  total,
  onPageChange,
  onPageSizeChange,
  pageSizeOptions = [10, 25, 50, 100],
  toolbar,
  columnVisibility,
  onColumnVisibilityChange,
}: DataTableProps<TData>) {
  const table = useReactTable({
    data,
    columns,
    state: columnVisibility ? { columnVisibility } : undefined,
    onColumnVisibilityChange: onColumnVisibilityChange
      ? (updater) => {
          const next =
            typeof updater === 'function' ? updater(columnVisibility ?? {}) : updater;
          onColumnVisibilityChange(next);
        }
      : undefined,
    getCoreRowModel: getCoreRowModel(),
    manualPagination: true,
    pageCount: Math.ceil(total / pageSize),
  });

  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const rangeStart = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const rangeEnd = Math.min(page * pageSize, total);

  const rows = table.getRowModel().rows;

  return (
    <div className="space-y-4">
      {toolbar && (
        <div className="flex items-center gap-2 flex-wrap">{toolbar(table)}</div>
      )}

      {/* Desktop/tablet: tabla tradicional (md+) */}
      <div className="hidden md:block rounded-xl border bg-card shadow-sm overflow-hidden">
        <Table>
          <TableHeader>
            {table.getHeaderGroups().map((hg) => (
              <TableRow key={hg.id}>
                {hg.headers.map((header) => (
                  <TableHead key={header.id}>
                    {header.isPlaceholder
                      ? null
                      : flexRender(header.column.columnDef.header, header.getContext())}
                  </TableHead>
                ))}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={columns.length} className="h-32 text-center">
                  <Loader2 className="mx-auto h-5 w-5 animate-spin text-muted-foreground" />
                </TableCell>
              </TableRow>
            ) : rows.length === 0 ? (
              <TableEmpty colSpan={columns.length} />
            ) : (
              rows.map((row) => (
                <TableRow key={row.id}>
                  {row.getVisibleCells().map((cell) => (
                    <TableCell key={cell.id}>
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Mobile: cards apiladas (< md) */}
      <div className="md:hidden space-y-3">
        {isLoading ? (
          <MobileSkeleton />
        ) : rows.length === 0 ? (
          <div className="rounded-xl border bg-card p-10 text-center text-sm text-muted-foreground">
            Sin resultados
          </div>
        ) : (
          rows.map((row) => <MobileCard key={row.id} row={row} />)
        )}
      </div>

      {/* Paginación */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 px-1 text-sm">
        <div className="flex flex-wrap items-center gap-4 text-muted-foreground">
          <span>
            <span className="hidden sm:inline">Mostrando </span>
            <span className="font-medium text-foreground">{rangeStart}</span>–
            <span className="font-medium text-foreground">{rangeEnd}</span> de{' '}
            <span className="font-medium text-foreground">{total}</span>
          </span>

          {onPageSizeChange && (
            <div className="flex items-center gap-2">
              <span className="text-xs">Filas:</span>
              <Select
                value={String(pageSize)}
                onValueChange={(v) => {
                  onPageSizeChange(Number(v));
                  onPageChange(1);
                }}
              >
                <SelectTrigger className="h-8 w-[72px] text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {pageSizeOptions.map((size) => (
                    <SelectItem key={size} value={String(size)}>
                      {size}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
        </div>

        <div className="flex items-center gap-1">
          <Button
            variant="outline"
            size="sm"
            className="h-8 w-8 p-0"
            onClick={() => onPageChange(1)}
            disabled={page <= 1 || isLoading}
            title="Primera página"
          >
            <ChevronsLeft className="h-4 w-4" />
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="h-8 w-8 p-0"
            onClick={() => onPageChange(page - 1)}
            disabled={page <= 1 || isLoading}
            title="Página anterior"
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>

          <span className="px-3 text-sm tabular-nums">
            <span className="font-medium">{page}</span>
            <span className="text-muted-foreground"> / </span>
            <span className="text-muted-foreground">{totalPages}</span>
          </span>

          <Button
            variant="outline"
            size="sm"
            className="h-8 w-8 p-0"
            onClick={() => onPageChange(page + 1)}
            disabled={page >= totalPages || isLoading}
            title="Página siguiente"
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="h-8 w-8 p-0"
            onClick={() => onPageChange(totalPages)}
            disabled={page >= totalPages || isLoading}
            title="Última página"
          >
            <ChevronsRight className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}

// ======================================================================
// Renderizado mobile: cada fila como card apilada
// ======================================================================

function MobileCard<TData>({
  row,
}: {
  row: { id: string; getVisibleCells: () => Cell<TData, unknown>[] };
}) {
  const cells = row.getVisibleCells();
  const rowNumberCell = cells.find((c) => c.column.id === '__rowNumber__');
  const actionsCell = cells.find((c) => c.column.id === 'actions');
  const restCells = cells.filter(
    (c) => c.column.id !== '__rowNumber__' && c.column.id !== 'actions',
  );
  const primaryCell = restCells[0];
  const secondaryCells = restCells.slice(1);

  return (
    <div className="rounded-xl border bg-card p-4 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-2 min-w-0 flex-1">
          {rowNumberCell && (
            <span className="shrink-0 inline-flex h-5 min-w-[22px] px-1.5 items-center justify-center rounded-md bg-muted text-[10px] font-mono font-semibold tabular-nums text-muted-foreground">
              {flexRender(
                rowNumberCell.column.columnDef.cell,
                rowNumberCell.getContext(),
              )}
            </span>
          )}
          {primaryCell && (
            <div className="min-w-0 flex-1">
              {flexRender(primaryCell.column.columnDef.cell, primaryCell.getContext())}
            </div>
          )}
        </div>
        {actionsCell && (
          <div className="shrink-0">
            {flexRender(actionsCell.column.columnDef.cell, actionsCell.getContext())}
          </div>
        )}
      </div>

      {secondaryCells.length > 0 && (
        <dl className="grid grid-cols-2 gap-x-4 gap-y-3 mt-4 pt-4 border-t text-xs">
          {secondaryCells.map((cell) => {
            const header = cell.column.columnDef.header;
            const label =
              typeof header === 'string' && header.length > 0
                ? header
                : cell.column.id.replace('__', '').replace(/([A-Z])/g, ' $1');
            return (
              <div key={cell.id} className="min-w-0">
                <dt className="text-[10px] uppercase tracking-wider text-muted-foreground/70 font-semibold mb-1">
                  {label}
                </dt>
                <dd className="min-w-0 text-sm text-foreground">
                  {flexRender(cell.column.columnDef.cell, cell.getContext())}
                </dd>
              </div>
            );
          })}
        </dl>
      )}
    </div>
  );
}

function MobileSkeleton() {
  return (
    <>
      {[0, 1, 2, 3].map((i) => (
        <div key={i} className="rounded-xl border bg-card p-4 shadow-sm space-y-3">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2 flex-1">
              <div className="h-5 w-6 rounded-md bg-muted animate-pulse" />
              <div className="h-4 flex-1 max-w-[180px] rounded bg-muted animate-pulse" />
            </div>
            <div className="h-8 w-20 rounded-md bg-muted animate-pulse" />
          </div>
          <div className="grid grid-cols-2 gap-3 pt-3 border-t">
            {[0, 1].map((j) => (
              <div key={j} className="space-y-1">
                <div className="h-2 w-12 rounded bg-muted/80 animate-pulse" />
                <div className="h-3.5 w-20 rounded bg-muted animate-pulse" />
              </div>
            ))}
          </div>
        </div>
      ))}
    </>
  );
}
