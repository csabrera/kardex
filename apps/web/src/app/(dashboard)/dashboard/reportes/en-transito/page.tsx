'use client';

import { ArrowLeft, ArrowRight, Truck } from 'lucide-react';
import Link from 'next/link';

import { PageHeader } from '@/components/layout/page-header';
import { TransferStatusBadge } from '@/components/transfers/transfer-status-badge';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { useInTransitReport } from '@/hooks/use-reports';

const STALE_AFTER_DAYS = 7;

function formatQty(v: number) {
  return v.toLocaleString('es-PE', { maximumFractionDigits: 3 });
}

export default function EnTransitoPage() {
  const { data, isLoading } = useInTransitReport();
  const rows = data?.rows ?? [];
  const totals = data?.totalsByItem ?? [];
  const grandTotalRows = data?.totalRows ?? 0;
  const grandTotalQty = totals.reduce((acc, t) => acc + t.totalPending, 0);

  return (
    <div className="space-y-6">
      <div>
        <Button asChild variant="ghost" size="sm" className="gap-1 -ml-2 mb-2">
          <Link href="/dashboard/reportes">
            <ArrowLeft className="h-4 w-4" />
            Volver a reportes
          </Link>
        </Button>
        <PageHeader
          title="Stock en tránsito"
          description="Unidades que salieron del almacén origen pero todavía no han llegado al destino. Cubre transferencias en tránsito y parcialmente recibidas."
          icon={Truck}
        />
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="rounded-xl border bg-card p-4 shadow-sm">
          <p className="text-[11px] uppercase tracking-wide text-muted-foreground font-semibold">
            Líneas pendientes
          </p>
          <p className="mt-1 text-3xl font-semibold tabular-nums">{grandTotalRows}</p>
        </div>
        <div className="rounded-xl border bg-card p-4 shadow-sm">
          <p className="text-[11px] uppercase tracking-wide text-muted-foreground font-semibold">
            Unidades totales en tránsito
          </p>
          <p className="mt-1 text-3xl font-semibold tabular-nums">
            {formatQty(grandTotalQty)}
          </p>
        </div>
        <div className="rounded-xl border bg-card p-4 shadow-sm">
          <p className="text-[11px] uppercase tracking-wide text-muted-foreground font-semibold">
            Ítems afectados
          </p>
          <p className="mt-1 text-3xl font-semibold tabular-nums">{totals.length}</p>
        </div>
      </div>

      {/* Tabla detalle */}
      <div className="rounded-xl border bg-card shadow-sm overflow-hidden">
        <div className="px-4 py-3 border-b">
          <p className="font-medium text-sm">Detalle por línea</p>
          <p className="text-xs text-muted-foreground mt-0.5">
            Click en el código de transferencia para ir al detalle y completar o cerrar
            como faltante.
          </p>
        </div>
        {isLoading ? (
          <div className="p-10 text-center text-sm text-muted-foreground">Cargando…</div>
        ) : rows.length === 0 ? (
          <EmptyState
            title="Sin stock en tránsito"
            description="No hay transferencias con saldos pendientes en este momento."
          />
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Ítem</TableHead>
                <TableHead className="text-right">Pendiente</TableHead>
                <TableHead>Ruta</TableHead>
                <TableHead>Transferencia</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead className="text-right">Antigüedad</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((r) => {
                const stale = r.transfer.daysSinceSent >= STALE_AFTER_DAYS;
                return (
                  <TableRow key={r.transferItemId}>
                    <TableCell>
                      <div className="flex flex-col">
                        <Link
                          href={`/dashboard/items/${r.item.id}`}
                          className="font-medium hover:underline"
                        >
                          {r.item.name}
                        </Link>
                        <span className="font-mono text-[10px] text-muted-foreground">
                          {r.item.code}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell className="text-right tabular-nums font-semibold">
                      {formatQty(r.pendingQty)}{' '}
                      <span className="text-[11px] text-muted-foreground">
                        {r.item.unit.abbreviation}
                      </span>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1.5 text-sm">
                        <span className="text-muted-foreground">
                          {r.fromWarehouse.name}
                        </span>
                        <ArrowRight className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                        <span className="font-medium">{r.toWarehouse.name}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Link
                        href={`/dashboard/almacen-principal?tab=transferencias`}
                        className="font-mono text-sm hover:underline text-blue-600 dark:text-blue-400"
                      >
                        {r.transfer.code}
                      </Link>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-col gap-1">
                        <TransferStatusBadge status={r.transfer.status} />
                        <Badge
                          variant={
                            r.lineStatus === 'RECIBIDO_PARCIAL' ? 'info' : 'warning'
                          }
                          className="text-[10px] w-fit"
                        >
                          {r.lineStatus === 'RECIBIDO_PARCIAL'
                            ? 'Parcial'
                            : 'Sin recibir'}
                        </Badge>
                      </div>
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      <span
                        className={
                          stale
                            ? 'text-destructive font-semibold'
                            : 'text-muted-foreground'
                        }
                      >
                        {r.transfer.daysSinceSent === 0
                          ? 'Hoy'
                          : r.transfer.daysSinceSent === 1
                            ? '1 día'
                            : `${r.transfer.daysSinceSent} días`}
                      </span>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </div>

      {/* Totales por ítem */}
      {totals.length > 0 && (
        <div className="rounded-xl border bg-card shadow-sm overflow-hidden">
          <div className="px-4 py-3 border-b">
            <p className="font-medium text-sm">Resumen por ítem</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              Total de unidades pendientes consolidadas por ítem.
            </p>
          </div>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Ítem</TableHead>
                <TableHead className="text-right">Total pendiente</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {totals.map((t) => (
                <TableRow key={t.itemId}>
                  <TableCell>
                    <div className="flex flex-col">
                      <Link
                        href={`/dashboard/items/${t.itemId}`}
                        className="font-medium hover:underline"
                      >
                        {t.name}
                      </Link>
                      <span className="font-mono text-[10px] text-muted-foreground">
                        {t.code}
                      </span>
                    </div>
                  </TableCell>
                  <TableCell className="text-right tabular-nums font-semibold">
                    {formatQty(t.totalPending)}{' '}
                    <span className="text-[11px] text-muted-foreground">{t.unit}</span>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
