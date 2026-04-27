import { type ColumnDef } from '@tanstack/react-table';

/**
 * Helper que crea una columna "N°" calculada según la página actual.
 * Usar como primera columna en DataTable:
 *
 *   const columns = [
 *     rowNumberColumn<T>({ page, pageSize }),
 *     ...otras columnas
 *   ];
 */
export function rowNumberColumn<T>({
  page = 1,
  pageSize = 20,
}: { page?: number; pageSize?: number } = {}): ColumnDef<T> {
  return {
    id: '__rowNumber__',
    header: 'N°',
    size: 50,
    cell: ({ row }) => (
      <span className="text-sm text-muted-foreground tabular-nums font-medium">
        {(page - 1) * pageSize + row.index + 1}
      </span>
    ),
  };
}
