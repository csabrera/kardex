'use client';

import { type ColumnDef } from '@tanstack/react-table';
import { ArrowRight, Eye, Plus } from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';

import { DataTable } from '@/components/data-table/data-table';
import { rowNumberColumn } from '@/components/data-table/row-number-column';
import { TransferDetail } from '@/components/transfers/transfer-detail';
import { TransferStatusBadge } from '@/components/transfers/transfer-status-badge';
import { ActionButton } from '@/components/ui/action-button';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useDebounce } from '@/hooks/use-debounce';
import { useTransfers, type Transfer, type TransferStatus } from '@/hooks/use-transfers';

const STATUS_OPTIONS: { value: TransferStatus | '_all'; label: string }[] = [
  { value: '_all', label: 'Todos los estados' },
  { value: 'EN_TRANSITO', label: 'En tránsito' },
  { value: 'RECIBIDA', label: 'Recibidas' },
  { value: 'RECHAZADA', label: 'Rechazadas' },
];

interface Props {
  /** Slot para acción primaria (ej. "Nueva transferencia"). */
  headerAction?: React.ReactNode;
}

/**
 * Listado de transferencias entre almacenes con filtro por estado/búsqueda.
 * Detalle se abre en modal.
 *
 * Reutilizable: vive como tab dentro de `/almacen-principal?tab=transferencias`.
 */
export function TransferenciasPanel({ headerAction }: Props) {
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<TransferStatus | '_all'>('_all');
  const debouncedSearch = useDebounce(search, 300);
  const [detail, setDetail] = useState<Transfer | null>(null);

  const { data, isLoading } = useTransfers({
    page,
    pageSize,
    status: status === '_all' ? undefined : status,
    search: debouncedSearch || undefined,
  });

  const action = headerAction ?? (
    <Button asChild className="gap-2">
      <Link href="/dashboard/transferencias/nueva">
        <Plus className="h-4 w-4" /> Nueva transferencia
      </Link>
    </Button>
  );

  const columns: ColumnDef<Transfer>[] = [
    rowNumberColumn<Transfer>({ page, pageSize }),
    {
      accessorKey: 'code',
      header: 'Código',
      size: 120,
      cell: ({ getValue }) => (
        <span className="font-mono text-sm font-semibold">{getValue() as string}</span>
      ),
    },
    {
      id: 'route',
      header: 'Ruta',
      cell: ({ row }) => (
        <div className="flex items-center gap-1.5 text-sm">
          <span>{row.original.fromWarehouse.name}</span>
          <ArrowRight className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
          <span className="font-medium">{row.original.toWarehouse.name}</span>
        </div>
      ),
    },
    {
      accessorKey: 'status',
      header: 'Estado',
      size: 120,
      cell: ({ row }) => <TransferStatusBadge status={row.original.status} />,
    },
    {
      id: 'items',
      header: 'Ítems',
      size: 70,
      cell: ({ row }) => (
        <span className="text-muted-foreground text-sm">{row.original.items.length}</span>
      ),
    },
    {
      id: 'requestedBy',
      header: 'Solicitado por',
      cell: ({ row }) =>
        `${row.original.requestedBy.firstName} ${row.original.requestedBy.lastName}`,
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
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-3">
          <Input
            placeholder="Buscar por código..."
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            className="max-w-xs"
          />
          <Select
            value={status}
            onValueChange={(v) => {
              setStatus(v as TransferStatus | '_all');
              setPage(1);
            }}
          >
            <SelectTrigger className="w-48">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {STATUS_OPTIONS.map((o) => (
                <SelectItem key={o.value} value={o.value}>
                  {o.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
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

      <Dialog open={!!detail} onOpenChange={(v) => !v && setDetail(null)}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Detalle de transferencia</DialogTitle>
          </DialogHeader>
          {detail && <TransferDetail transfer={detail} onClose={() => setDetail(null)} />}
        </DialogContent>
      </Dialog>
    </div>
  );
}
