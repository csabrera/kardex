'use client';

import { type ColumnDef } from '@tanstack/react-table';
import { Eye } from 'lucide-react';
import { useState } from 'react';

import { DataTable } from '@/components/data-table/data-table';
import { rowNumberColumn } from '@/components/data-table/row-number-column';
import { ActionButton } from '@/components/ui/action-button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { type Item } from '@/hooks/use-items';
import { useMovements, type Movement, type MovementType } from '@/hooks/use-movements';
import { useMainWarehouse } from '@/hooks/use-warehouses';

const TYPE_VARIANT: Record<MovementType, string> = {
  ENTRADA: 'success',
  SALIDA: 'destructive',
  AJUSTE: 'warning',
};

const TYPE_LABELS: Record<MovementType, string> = {
  ENTRADA: 'Entrada',
  SALIDA: 'Salida',
  AJUSTE: 'Ajuste',
};

const SOURCE_LABELS: Record<string, string> = {
  COMPRA: 'Compra',
  CONSUMO: 'Consumo',
  TRANSFERENCIA: 'Transferencia',
  AJUSTE: 'Ajuste',
  INVENTARIO: 'Inventario',
  DEVOLUCION: 'Devolución',
  BAJA: 'Baja',
  LOST_LOAN: 'Pérdida de préstamo',
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
          <Badge variant={TYPE_VARIANT[movement.type] as any}>
            {TYPE_LABELS[movement.type]}
          </Badge>
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
              {movement.items.map((mi) => (
                <tr key={mi.id} className="border-t">
                  <td className="px-3 py-2">
                    <span className="font-mono text-xs text-muted-foreground mr-1">
                      {mi.item.code}
                    </span>
                    {mi.item.name}
                  </td>
                  <td className="px-3 py-2 text-right font-medium tabular-nums">
                    {Number(mi.quantity).toLocaleString('es-PE', {
                      maximumFractionDigits: 3,
                    })}{' '}
                    {mi.item.unit.abbreviation}
                  </td>
                  <td className="px-3 py-2 text-right text-muted-foreground tabular-nums">
                    {Number(mi.stockBefore).toLocaleString('es-PE', {
                      maximumFractionDigits: 3,
                    })}
                  </td>
                  <td className="px-3 py-2 text-right font-medium tabular-nums">
                    {Number(mi.stockAfter).toLocaleString('es-PE', {
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

interface Props {
  item: Item | null;
  onClose: () => void;
}

export function ItemMovementsDialog({ item, onClose }: Props) {
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [detail, setDetail] = useState<Movement | null>(null);

  const main = useMainWarehouse();
  const warehouseId = main.data?.id;

  const { data, isLoading } = useMovements({
    page,
    pageSize,
    itemId: item?.id,
    warehouseId,
    enabled: !!item && !!warehouseId,
  });

  const columns: ColumnDef<Movement>[] = [
    rowNumberColumn<Movement>({ page, pageSize }),
    {
      accessorKey: 'type',
      header: 'Tipo',
      size: 100,
      cell: ({ row }) => (
        <Badge variant={TYPE_VARIANT[row.original.type] as any}>
          {TYPE_LABELS[row.original.type]}
        </Badge>
      ),
    },
    {
      id: 'source',
      header: 'Motivo',
      size: 150,
      cell: ({ row }) => (
        <span className="text-sm">
          {SOURCE_LABELS[row.original.source] ?? row.original.source}
        </span>
      ),
    },
    {
      id: 'code',
      header: 'Código',
      size: 120,
      cell: ({ row }) => (
        <span className="font-mono text-xs text-muted-foreground">
          {row.original.code}
        </span>
      ),
    },
    {
      id: 'qty',
      header: 'Cantidad',
      size: 120,
      cell: ({ row }) => {
        const mi = row.original.items.find((i) => i.itemId === item?.id);
        if (!mi) return <span className="text-muted-foreground">—</span>;
        return (
          <span className="tabular-nums font-medium text-sm">
            {Number(mi.quantity).toLocaleString('es-PE', { maximumFractionDigits: 3 })}{' '}
            <span className="text-muted-foreground font-normal">
              {mi.item.unit.abbreviation}
            </span>
          </span>
        );
      },
    },
    {
      id: 'stockAfter',
      header: 'Stock resultante',
      size: 130,
      cell: ({ row }) => {
        const mi = row.original.items.find((i) => i.itemId === item?.id);
        if (!mi) return <span className="text-muted-foreground">—</span>;
        return (
          <span className="tabular-nums text-sm">
            {Number(mi.stockAfter).toLocaleString('es-PE', { maximumFractionDigits: 3 })}
          </span>
        );
      },
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
    {
      id: 'actions',
      header: '',
      size: 60,
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
      <Dialog
        open={!!item}
        onOpenChange={(v) => {
          if (!v) {
            setDetail(null);
            onClose();
          }
        }}
      >
        <DialogContent className="max-w-4xl">
          <DialogHeader>
            <DialogTitle className="truncate pr-8">
              Movimientos ·{' '}
              <span className="font-normal text-muted-foreground">{item?.name}</span>
            </DialogTitle>
          </DialogHeader>
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
        </DialogContent>
      </Dialog>

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
