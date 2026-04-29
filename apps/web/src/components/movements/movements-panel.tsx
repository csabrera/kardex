'use client';

import { type ColumnDef } from '@tanstack/react-table';
import { useState } from 'react';

import { DataTable } from '@/components/data-table/data-table';
import { rowNumberColumn } from '@/components/data-table/row-number-column';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useMovements, type Movement, type MovementType } from '@/hooks/use-movements';

interface Props {
  /** Filtra por almacén (en Almacén Principal pasamos el ID del Principal). */
  warehouseId?: string;
  headerAction?: React.ReactNode;
}

/**
 * Listado de movimientos (kardex agrupado por movimiento).
 *
 * No usa /dashboard/movimientos (eliminada en consolidación previa).
 * Las acciones de crear movimiento van vía las ActionTiles del Almacén Principal.
 */
export function MovementsPanel({ warehouseId, headerAction }: Props) {
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [type, setType] = useState<MovementType | '_all'>('_all');

  const { data, isLoading } = useMovements({
    page,
    pageSize,
    warehouseId,
    type: type === '_all' ? undefined : type,
  });

  const columns: ColumnDef<Movement>[] = [
    rowNumberColumn<Movement>({ page, pageSize }),
    {
      accessorKey: 'type',
      header: 'Tipo',
      size: 110,
      cell: ({ row }) => (
        <Badge
          variant={
            row.original.type === 'ENTRADA'
              ? 'success'
              : row.original.type === 'SALIDA'
                ? 'destructive'
                : 'warning'
          }
        >
          {row.original.type}
        </Badge>
      ),
    },
    {
      accessorKey: 'source',
      header: 'Origen',
      size: 130,
      cell: ({ row }) => (
        <Badge variant="outline" className="text-[10px]">
          {row.original.source}
        </Badge>
      ),
    },
    ...(warehouseId
      ? []
      : [
          {
            id: 'warehouse',
            header: 'Almacén',
            cell: ({ row }: any) => (
              <span className="text-sm">{row.original.warehouse.name}</span>
            ),
          } as ColumnDef<Movement>,
        ]),
    {
      id: 'items',
      header: 'Ítems',
      size: 80,
      cell: ({ row }) => (
        <span className="text-sm tabular-nums">{row.original.items.length}</span>
      ),
    },
    {
      id: 'user',
      header: 'Por',
      cell: ({ row }) => (
        <span className="text-sm text-muted-foreground">
          {row.original.user.firstName} {row.original.user.lastName}
        </span>
      ),
    },
    {
      id: 'createdAt',
      header: 'Fecha',
      size: 150,
      cell: ({ row }) => (
        <span className="text-xs text-muted-foreground tabular-nums">
          {new Date(row.original.createdAt).toLocaleString('es-PE', {
            dateStyle: 'short',
            timeStyle: 'short',
          })}
        </span>
      ),
    },
  ];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <Select
          value={type}
          onValueChange={(v) => {
            setType(v as MovementType | '_all');
            setPage(1);
          }}
        >
          <SelectTrigger className="w-full sm:w-44">
            <SelectValue placeholder="Tipo" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="_all">Todos</SelectItem>
            <SelectItem value="ENTRADA">Entradas</SelectItem>
            <SelectItem value="SALIDA">Salidas</SelectItem>
            <SelectItem value="AJUSTE">Ajustes</SelectItem>
          </SelectContent>
        </Select>
        {headerAction && (
          <div className="w-full sm:ml-auto sm:w-auto">{headerAction}</div>
        )}
      </div>

      <DataTable
        columns={columns}
        data={data?.items ?? []}
        isLoading={isLoading}
        page={page}
        pageSize={pageSize}
        onPageSizeChange={setPageSize}
        total={data?.total ?? 0}
        onPageChange={setPage}
      />
    </div>
  );
}
