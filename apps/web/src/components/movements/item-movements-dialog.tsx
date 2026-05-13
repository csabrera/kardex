'use client';

import { type ColumnDef } from '@tanstack/react-table';
import { Eye } from 'lucide-react';
import { useState } from 'react';

import { DataTable } from '@/components/data-table/data-table';
import { rowNumberColumn } from '@/components/data-table/row-number-column';
import { MovementDetail, SOURCE_LABELS } from '@/components/movements/movement-detail';
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
