'use client';

import { type ColumnDef } from '@tanstack/react-table';
import { Eye } from 'lucide-react';
import { useState } from 'react';

import { DataTable } from '@/components/data-table/data-table';
import { rowNumberColumn } from '@/components/data-table/row-number-column';
import { ExportButton } from '@/components/export/export-button';
import { ActionButton } from '@/components/ui/action-button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { useDebounce } from '@/hooks/use-debounce';
import { useMovements, type Movement, type MovementType } from '@/hooks/use-movements';

const TYPE_COLORS: Record<MovementType, string> = {
  ENTRADA: 'success',
  SALIDA: 'destructive',
  AJUSTE: 'warning',
};

const SOURCE_LABELS: Record<string, string> = {
  COMPRA: 'Compra',
  CONSUMO: 'Consumo',
  TRANSFERENCIA: 'Transferencia',
  AJUSTE: 'Ajuste',
  DEVOLUCION: 'Devolución',
  BAJA: 'Baja',
};

function MovementDetail({ movement }: { movement: Movement }) {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4 text-sm">
        <div>
          <p className="text-muted-foreground">Código</p>
          <p className="font-mono font-semibold">{movement.code}</p>
        </div>
        <div>
          <p className="text-muted-foreground">Tipo</p>
          <Badge variant={TYPE_COLORS[movement.type] as any}>{movement.type}</Badge>
        </div>
        <div>
          <p className="text-muted-foreground">Almacén</p>
          <p>{movement.warehouse.name}</p>
        </div>
        <div>
          <p className="text-muted-foreground">Motivo</p>
          <p>{SOURCE_LABELS[movement.source] ?? movement.source}</p>
        </div>
        <div>
          <p className="text-muted-foreground">Usuario</p>
          <p>
            {movement.user.firstName} {movement.user.lastName}
          </p>
        </div>
        <div>
          <p className="text-muted-foreground">Fecha</p>
          <p>{new Date(movement.createdAt).toLocaleString('es-PE')}</p>
        </div>
        {movement.notes && (
          <div className="col-span-2">
            <p className="text-muted-foreground">Observaciones</p>
            <p>{movement.notes}</p>
          </div>
        )}
      </div>

      <div>
        <p className="text-sm font-medium mb-2">Ítems del movimiento</p>
        <div className="rounded-md border overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-muted/50">
              <tr>
                <th className="px-3 py-2 text-left text-muted-foreground font-medium">
                  Ítem
                </th>
                <th className="px-3 py-2 text-right text-muted-foreground font-medium">
                  Cantidad
                </th>
                <th className="px-3 py-2 text-right text-muted-foreground font-medium">
                  Stock antes
                </th>
                <th className="px-3 py-2 text-right text-muted-foreground font-medium">
                  Stock después
                </th>
              </tr>
            </thead>
            <tbody>
              {movement.items.map((item) => (
                <tr key={item.id} className="border-t">
                  <td className="px-3 py-2">
                    <span className="font-mono text-xs text-muted-foreground mr-1">
                      {item.item.code}
                    </span>
                    {item.item.name}
                  </td>
                  <td className="px-3 py-2 text-right font-medium">
                    {Number(item.quantity).toLocaleString('es-PE', {
                      maximumFractionDigits: 3,
                    })}{' '}
                    {item.item.unit.abbreviation}
                  </td>
                  <td className="px-3 py-2 text-right text-muted-foreground">
                    {Number(item.stockBefore).toLocaleString('es-PE', {
                      maximumFractionDigits: 3,
                    })}
                  </td>
                  <td className="px-3 py-2 text-right font-medium">
                    {Number(item.stockAfter).toLocaleString('es-PE', {
                      maximumFractionDigits: 3,
                    })}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

export function MovementsTable({ type }: { type?: MovementType }) {
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebounce(search, 300);
  const [detail, setDetail] = useState<Movement | null>(null);

  const { data, isLoading } = useMovements({
    page,
    pageSize,
    type,
    search: debouncedSearch || undefined,
  });

  const columns: ColumnDef<Movement>[] = [
    rowNumberColumn<Movement>({ page, pageSize }),
    {
      accessorKey: 'code',
      header: 'Código',
      size: 120,
      cell: ({ getValue }) => (
        <span className="font-mono text-sm">{getValue() as string}</span>
      ),
    },
    {
      accessorKey: 'type',
      header: 'Tipo',
      size: 100,
      cell: ({ row }) => (
        <Badge variant={TYPE_COLORS[row.original.type] as any}>{row.original.type}</Badge>
      ),
    },
    {
      id: 'source',
      header: 'Motivo',
      cell: ({ row }) => SOURCE_LABELS[row.original.source] ?? row.original.source,
    },
    {
      id: 'warehouse',
      header: 'Almacén',
      cell: ({ row }) => row.original.warehouse.name,
    },
    {
      id: 'items',
      header: 'Ítems',
      cell: ({ row }) => (
        <span className="text-muted-foreground text-sm">
          {row.original.items.length} ítem{row.original.items.length !== 1 ? 's' : ''}
        </span>
      ),
    },
    {
      id: 'user',
      header: 'Usuario',
      cell: ({ row }) => `${row.original.user.firstName} ${row.original.user.lastName}`,
    },
    {
      id: 'createdAt',
      header: 'Fecha',
      cell: ({ row }) =>
        new Date(row.original.createdAt).toLocaleString('es-PE', {
          dateStyle: 'short',
          timeStyle: 'short',
        }),
    },
    {
      id: 'actions',
      header: 'Acciones',
      size: 100,
      cell: ({ row }) => (
        <ActionButton
          icon={Eye}
          label="Ver detalle"
          tone="info"
          onClick={() => setDetail(row.original)}
        />
      ),
    },
  ];

  return (
    <>
      <div className="flex items-center gap-3">
        <Input
          placeholder="Buscar por código u observaciones..."
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setPage(1);
          }}
          className="max-w-xs"
        />
        <div className="ml-auto">
          <ExportButton reportType="movements" filters={{ type }} />
        </div>
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

      <Dialog open={!!detail} onOpenChange={(v) => !v && setDetail(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Detalle del movimiento</DialogTitle>
          </DialogHeader>
          {detail && <MovementDetail movement={detail} />}
        </DialogContent>
      </Dialog>
    </>
  );
}
