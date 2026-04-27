'use client';

import { type ColumnDef } from '@tanstack/react-table';
import { Plus } from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';

import { DataTable } from '@/components/data-table/data-table';
import { rowNumberColumn } from '@/components/data-table/row-number-column';
import { NewFuelDispatchDialog } from '@/components/fuel/new-fuel-dispatch-dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useDebounce } from '@/hooks/use-debounce';
import { useFuelDispatches, type FuelDispatch } from '@/hooks/use-fuel';

interface Props {
  headerAction?: React.ReactNode;
  /** Filtra por equipo específico (ficha equipo). */
  equipmentId?: string;
}

export function FuelDispatchesPanel({ headerAction, equipmentId }: Props) {
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebounce(search, 300);
  const [showNew, setShowNew] = useState(false);

  const { data, isLoading } = useFuelDispatches({
    page,
    pageSize,
    search: debouncedSearch || undefined,
    equipmentId,
  } as any);

  const action = headerAction ?? (
    <Button className="gap-2" onClick={() => setShowNew(true)}>
      <Plus className="h-4 w-4" /> Nuevo despacho
    </Button>
  );

  const columns: ColumnDef<FuelDispatch>[] = [
    rowNumberColumn<FuelDispatch>({ page, pageSize }),
    {
      accessorKey: 'code',
      header: 'Código',
      size: 110,
      cell: ({ row }) => (
        <span className="font-mono text-sm font-semibold">{row.original.code}</span>
      ),
    },
    ...(equipmentId
      ? []
      : [
          {
            id: 'equipment',
            header: 'Equipo',
            cell: ({ row }: any) => (
              <Link
                href={`/dashboard/equipos/${row.original.equipmentId}`}
                className="group block -mx-2 px-2 py-1 rounded hover:bg-muted/60 transition-colors"
              >
                <p className="text-sm font-medium group-hover:text-accent transition-colors">
                  {row.original.equipment.name}
                </p>
                <p className="text-xs text-muted-foreground font-mono">
                  {row.original.equipment.code}
                </p>
              </Link>
            ),
          } as ColumnDef<FuelDispatch>,
        ]),
    {
      id: 'item',
      header: 'Combustible',
      cell: ({ row }) => (
        <Link
          href={`/dashboard/items/${row.original.itemId}`}
          className="text-sm hover:text-accent"
        >
          {row.original.item.name}
        </Link>
      ),
    },
    {
      id: 'quantity',
      header: 'Cantidad',
      size: 110,
      cell: ({ row }) => (
        <span className="text-sm font-medium tabular-nums">
          {Number(row.original.quantity).toLocaleString('es-PE', {
            maximumFractionDigits: 3,
          })}{' '}
          {row.original.item.unit.abbreviation}
        </span>
      ),
    },
    {
      id: 'countReading',
      header: 'Lectura',
      size: 110,
      cell: ({ row }) => {
        const unit =
          row.original.equipment.countType === 'HOROMETRO'
            ? 'h'
            : row.original.equipment.countType === 'KILOMETRAJE'
              ? 'km'
              : '';
        return (
          <span className="text-sm tabular-nums">
            {Number(row.original.countReading).toLocaleString('es-PE', {
              maximumFractionDigits: 1,
            })}{' '}
            {unit}
          </span>
        );
      },
    },
    {
      id: 'warehouse',
      header: 'Almacén',
      cell: ({ row }) => <span className="text-sm">{row.original.warehouse.name}</span>,
    },
    {
      id: 'createdAt',
      header: 'Fecha',
      size: 140,
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
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Input
          placeholder="Buscar por código, equipo..."
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setPage(1);
          }}
          className="max-w-sm"
        />
        {action}
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

      <NewFuelDispatchDialog open={showNew} onClose={() => setShowNew(false)} />
    </div>
  );
}
