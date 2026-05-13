'use client';

import { type ColumnDef } from '@tanstack/react-table';
import { ArrowRight, Eye, Paperclip, Plus } from 'lucide-react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useState } from 'react';

import { DataTable } from '@/components/data-table/data-table';
import { rowNumberColumn } from '@/components/data-table/row-number-column';
import { NewTransferDialog } from '@/components/transfers/new-transfer-dialog';
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
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { useDebounce } from '@/hooks/use-debounce';
import { useTransfers, type Transfer, type TransferStatus } from '@/hooks/use-transfers';

const STATUS_OPTIONS: { value: TransferStatus | '_all'; label: string }[] = [
  { value: '_all', label: 'Todos los estados' },
  { value: 'EN_TRANSITO', label: 'En tránsito' },
  { value: 'PARCIALMENTE_RECIBIDA', label: 'Parcialmente recibidas' },
  { value: 'RECIBIDA', label: 'Recibidas' },
  { value: 'RECHAZADA', label: 'Rechazadas' },
  { value: 'CANCELADA', label: 'Canceladas' },
];

const STALE_AFTER_DAYS = 7;

/**
 * Tiempo relativo en español para transferencias EN_TRANSITO.
 * `stale=true` si superó {@link STALE_AFTER_DAYS} días → la fila merece atención.
 */
function getTransitTime(date: string): { label: string; stale: boolean } {
  const diffMs = Date.now() - new Date(date).getTime();
  const minutes = Math.floor(diffMs / 60_000);
  if (minutes < 60) return { label: `Hace ${Math.max(minutes, 1)} min`, stale: false };
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return { label: `Hace ${hours} h`, stale: false };
  const days = Math.floor(hours / 24);
  return {
    label: days === 1 ? 'Hace 1 día' : `Hace ${days} días`,
    stale: days >= STALE_AFTER_DAYS,
  };
}

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
  const router = useRouter();
  const searchParams = useSearchParams();
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<TransferStatus | '_all'>('_all');
  const debouncedSearch = useDebounce(search, 300);
  const [detail, setDetail] = useState<Transfer | null>(null);
  const [showNew, setShowNew] = useState(false);

  // Deep-link `?action=new` (Command Palette o redirect de /transferencias/nueva):
  // abre el modal automáticamente y limpia el query param.
  useEffect(() => {
    if (searchParams.get('action') !== 'new') return;
    setShowNew(true);
    const params = new URLSearchParams(searchParams.toString());
    params.delete('action');
    const qs = params.toString();
    router.replace(`/dashboard/almacen-principal${qs ? `?${qs}` : ''}`, {
      scroll: false,
    });
  }, [searchParams, router]);

  const { data, isLoading } = useTransfers({
    page,
    pageSize,
    status: status === '_all' ? undefined : status,
    search: debouncedSearch || undefined,
  });

  const action = headerAction ?? (
    <Button onClick={() => setShowNew(true)} className="gap-2">
      <Plus className="h-4 w-4" /> Nueva transferencia
    </Button>
  );

  const columns: ColumnDef<Transfer>[] = [
    rowNumberColumn<Transfer>({ page, pageSize }),
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
      size: 180,
      cell: ({ row }) => {
        const t = row.original;
        const inTransit = t.status === 'EN_TRANSITO';
        const partial = t.status === 'PARCIALMENTE_RECIBIDA';
        const guideMissing =
          inTransit && t.requiresRecipientDocument && (t.attachments?.length ?? 0) === 0;
        const transit =
          inTransit || partial ? getTransitTime(t.sentAt ?? t.createdAt) : null;
        // Resumen "X/Y" en transferencias parciales: cuánto se ha recibido vs.
        // enviado en total (sumando todas las líneas).
        let progress: { received: number; sent: number } | null = null;
        if (partial) {
          const sent = t.items.reduce(
            (acc, i) => acc + Number(i.sentQty ?? i.requestedQty ?? 0),
            0,
          );
          const received = t.items.reduce(
            (acc, i) => acc + Number(i.receivedQty ?? 0),
            0,
          );
          progress = { received, sent };
        }
        return (
          <div className="flex flex-col items-start gap-1">
            <div className="flex items-center gap-1.5">
              <TransferStatusBadge status={t.status} />
              {progress && (
                <span className="text-[10px] font-semibold tabular-nums text-blue-700 dark:text-blue-300">
                  {progress.received}/{progress.sent}
                </span>
              )}
              {guideMissing && (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <span
                      className="inline-flex h-5 w-5 items-center justify-center rounded-md bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300 ring-1 ring-amber-500/30"
                      aria-label="Guía de remisión pendiente"
                    >
                      <Paperclip className="h-3 w-3" />
                    </span>
                  </TooltipTrigger>
                  <TooltipContent>Guía de remisión pendiente</TooltipContent>
                </Tooltip>
              )}
            </div>
            {transit && (
              <span
                className={`text-[10px] tabular-nums ${transit.stale ? 'text-destructive font-semibold' : 'text-muted-foreground'}`}
              >
                {transit.label}
              </span>
            )}
          </div>
        );
      },
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
          onClick={(e) => {
            e.stopPropagation();
            setDetail(row.original);
          }}
        />
      ),
    },
  ];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <Input
          placeholder="Buscar por código..."
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setPage(1);
          }}
          className="w-full sm:w-72"
        />
        <Select
          value={status}
          onValueChange={(v) => {
            setStatus(v as TransferStatus | '_all');
            setPage(1);
          }}
        >
          <SelectTrigger className="w-full sm:w-48">
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
        <div className="w-full sm:ml-auto sm:w-auto">{action}</div>
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
        onRowClick={(t) => setDetail(t)}
      />

      <Dialog open={!!detail} onOpenChange={(v) => !v && setDetail(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Detalle de transferencia</DialogTitle>
          </DialogHeader>
          {detail && <TransferDetail transfer={detail} onClose={() => setDetail(null)} />}
        </DialogContent>
      </Dialog>

      <NewTransferDialog open={showNew} onClose={() => setShowNew(false)} />
    </div>
  );
}
