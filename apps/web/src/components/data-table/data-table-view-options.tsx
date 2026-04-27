'use client';

import { Settings2 } from 'lucide-react';

import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

import type { Table } from '@tanstack/react-table';

interface Props<TData> {
  table: Table<TData>;
  /** Label visible en el botón. Default: "Columnas" */
  label?: string;
}

/**
 * Menú "Columnas" tipo shadcn Tasks: lista checkboxes de columnas ocultables
 * (las que declaran `enableHiding !== false`). Toggleando la visibilidad
 * persiste en el estado interno de TanStack Table.
 *
 * Uso desde el consumidor:
 *
 *   const [columnVisibility, setColumnVisibility] = useState({});
 *   const table = useReactTable({
 *     ...,
 *     state: { columnVisibility },
 *     onColumnVisibilityChange: setColumnVisibility,
 *   });
 *
 *   <DataTableViewOptions table={table} />
 */
export function DataTableViewOptions<TData>({ table, label = 'Columnas' }: Props<TData>) {
  const hideableCols = table
    .getAllColumns()
    .filter((column) => typeof column.accessorFn !== 'undefined' && column.getCanHide());

  if (hideableCols.length === 0) return null;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className="ml-auto hidden h-8 lg:flex gap-1.5"
        >
          <Settings2 className="h-3.5 w-3.5" />
          {label}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-48">
        <DropdownMenuLabel>Mostrar/ocultar</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {hideableCols.map((column) => {
          const header = column.columnDef.header;
          const niceLabel =
            typeof header === 'string' && header.length > 0 ? header : column.id;
          return (
            <DropdownMenuCheckboxItem
              key={column.id}
              className="capitalize"
              checked={column.getIsVisible()}
              onCheckedChange={(v) => column.toggleVisibility(!!v)}
            >
              {niceLabel}
            </DropdownMenuCheckboxItem>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
