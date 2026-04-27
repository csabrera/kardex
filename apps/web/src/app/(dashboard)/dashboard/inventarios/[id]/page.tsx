'use client';

import {
  AlertCircle,
  ArrowLeft,
  Ban,
  CheckCircle2,
  CheckSquare,
  ClipboardCheck,
  ClipboardList,
  Hourglass,
  Loader2,
} from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { use, useMemo, useState } from 'react';

import { InventoryStatusBadge } from '@/components/inventory/inventory-status-badge';
import { PageHeader } from '@/components/layout/page-header';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useConfirm } from '@/components/ui/confirm-provider';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { StatCard } from '@/components/ui/stat-card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  useCancelInventoryCount,
  useCloseInventoryCount,
  useInventoryCount,
  useUpdateCountItem,
  type InventoryCountLine,
} from '@/hooks/use-inventory-counts';

interface PageProps {
  params: Promise<{ id: string }>;
}

export default function InventoryCountDetailPage({ params }: PageProps) {
  const { id } = use(params);
  const router = useRouter();
  const confirm = useConfirm();
  const { data: count, isLoading } = useInventoryCount(id);
  const updateItem = useUpdateCountItem(id);
  const closeMut = useCloseInventoryCount();
  const cancelMut = useCancelInventoryCount();

  const [lineDrafts, setLineDrafts] = useState<Record<string, string>>({});
  const [closeNotes, setCloseNotes] = useState('');
  const [cancelOpen, setCancelOpen] = useState(false);
  const [cancelReason, setCancelReason] = useState('');

  const stats = useMemo(() => {
    if (!count) return null;
    const total = count.items.length;
    const counted = count.items.filter((i) => i.countedQty !== null).length;
    const withVariance = count.items.filter(
      (i) => i.countedQty !== null && Number(i.countedQty) !== Number(i.expectedQty),
    ).length;
    return { total, counted, withVariance, pending: total - counted };
  }, [count]);

  if (isLoading || !count) {
    return (
      <div className="flex items-center justify-center py-16 text-muted-foreground">
        <Loader2 className="h-5 w-5 animate-spin mr-2" />
        Cargando conteo...
      </div>
    );
  }

  const editable = count.status === 'IN_PROGRESS';

  const handleSaveLine = async (line: InventoryCountLine) => {
    const raw = lineDrafts[line.id];
    if (raw === undefined || raw === '') return;
    const counted = Number(raw);
    if (Number.isNaN(counted) || counted < 0) return;
    await updateItem.mutateAsync({ itemId: line.itemId, countedQty: counted });
    setLineDrafts((d) => {
      const { [line.id]: _, ...rest } = d;
      return rest;
    });
  };

  const handleClose = async () => {
    const ok = await confirm({
      title: '¿Cerrar conteo?',
      description:
        stats && stats.withVariance > 0
          ? `Se generará un ajuste AJUSTE source=INVENTARIO con ${stats.withVariance} línea(s) con diferencia. Esta acción es irreversible.`
          : stats && stats.pending > 0
            ? `Hay ${stats.pending} línea(s) sin contar — no se ajustarán (solo se ajustan las contadas con diferencia). ¿Continuar?`
            : 'Todas las líneas cuadran — el conteo se cerrará sin generar ajustes. ¿Confirmar?',
      confirmText: 'Cerrar conteo',
    });
    if (!ok) return;
    closeMut.mutate(
      { id: count.id, notes: closeNotes || undefined },
      { onSuccess: () => router.refresh() },
    );
  };

  const handleCancelConfirm = () => {
    cancelMut.mutate(
      { id: count.id, reason: cancelReason.trim() || undefined },
      {
        onSuccess: () => {
          setCancelOpen(false);
          setCancelReason('');
          router.refresh();
        },
      },
    );
  };

  return (
    <div className="space-y-6">
      <div>
        <Button asChild variant="ghost" size="sm" className="gap-1 -ml-2 mb-2">
          <Link href="/dashboard/inventarios">
            <ArrowLeft className="h-4 w-4" />
            Volver a inventarios
          </Link>
        </Button>
        <PageHeader
          title={count.code}
          description={`${count.warehouse.name} · Iniciado por ${count.startedBy.firstName} ${count.startedBy.lastName} el ${new Date(count.startedAt).toLocaleString('es-PE', { dateStyle: 'short', timeStyle: 'short' })}`}
          icon={ClipboardCheck}
          actions={
            <div className="flex items-center gap-2">
              <InventoryStatusBadge status={count.status} />
              {count.adjustmentMovement && (
                <Badge variant="outline" className="font-mono text-xs">
                  {count.adjustmentMovement.code}
                </Badge>
              )}
            </div>
          }
        />
      </div>

      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <StatCard title="Total líneas" value={stats.total} icon={ClipboardList} />
          <StatCard
            title="Contadas"
            value={stats.counted}
            icon={CheckSquare}
            tone="info"
          />
          <StatCard
            title="Pendientes"
            value={stats.pending}
            icon={Hourglass}
            tone="warning"
          />
          <StatCard
            title="Con diferencia"
            value={stats.withVariance}
            icon={AlertCircle}
            tone={stats.withVariance > 0 ? 'destructive' : 'success'}
          />
        </div>
      )}

      <div className="rounded-lg border bg-card overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[110px]">Código</TableHead>
              <TableHead>Ítem</TableHead>
              <TableHead className="w-[110px] text-right">Esperado</TableHead>
              <TableHead className="w-[160px]">Contado</TableHead>
              <TableHead className="w-[120px] text-right">Diferencia</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {count.items.map((line) => {
              const draft = lineDrafts[line.id];
              const displayed =
                draft !== undefined
                  ? draft
                  : line.countedQty !== null
                    ? String(line.countedQty)
                    : '';
              const numeric = Number(displayed);
              const hasDraftDiff =
                draft !== undefined && draft !== '' && !Number.isNaN(numeric);
              const computedVariance = hasDraftDiff
                ? numeric - Number(line.expectedQty)
                : line.variance !== null
                  ? Number(line.variance)
                  : null;

              return (
                <TableRow key={line.id}>
                  <TableCell className="font-mono text-xs text-muted-foreground">
                    {line.item.code}
                  </TableCell>
                  <TableCell className="text-sm">{line.item.name}</TableCell>
                  <TableCell className="text-right font-mono text-sm">
                    {Number(line.expectedQty).toLocaleString('es-PE', {
                      maximumFractionDigits: 3,
                    })}
                    <span className="ml-1 text-xs text-muted-foreground">
                      {line.item.unit.abbreviation}
                    </span>
                  </TableCell>
                  <TableCell>
                    {editable ? (
                      <Input
                        type="number"
                        step="0.001"
                        min="0"
                        value={displayed}
                        placeholder="—"
                        disabled={updateItem.isPending}
                        onChange={(e) =>
                          setLineDrafts((d) => ({ ...d, [line.id]: e.target.value }))
                        }
                        onBlur={() => handleSaveLine(line)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
                        }}
                        className="h-8 font-mono text-sm"
                      />
                    ) : line.countedQty !== null ? (
                      <span className="font-mono text-sm">
                        {Number(line.countedQty).toLocaleString('es-PE', {
                          maximumFractionDigits: 3,
                        })}
                      </span>
                    ) : (
                      <span className="text-xs text-muted-foreground italic">
                        No contado
                      </span>
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    {computedVariance === null ? (
                      <span className="text-xs text-muted-foreground">—</span>
                    ) : computedVariance === 0 ? (
                      <Badge variant="success" className="text-xs">
                        OK
                      </Badge>
                    ) : (
                      <span
                        className={`font-mono text-sm font-semibold ${computedVariance > 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}
                      >
                        {computedVariance > 0 ? '+' : ''}
                        {computedVariance.toLocaleString('es-PE', {
                          maximumFractionDigits: 3,
                        })}
                      </span>
                    )}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>

      {editable && (
        <div className="rounded-lg border bg-card p-4 space-y-3">
          <div className="space-y-1.5">
            <Label>Notas al cerrar (opcional)</Label>
            <Input
              value={closeNotes}
              onChange={(e) => setCloseNotes(e.target.value)}
              placeholder="Observaciones generales del conteo..."
            />
          </div>
          <div className="flex flex-wrap justify-end gap-2 pt-2 border-t">
            <Button
              variant="outline"
              onClick={() => setCancelOpen(true)}
              disabled={cancelMut.isPending}
              className="gap-2"
            >
              <Ban className="h-4 w-4" />
              Cancelar conteo
            </Button>
            <Button onClick={handleClose} disabled={closeMut.isPending} className="gap-2">
              <CheckCircle2 className="h-4 w-4" />
              Cerrar y ajustar stock
            </Button>
          </div>
        </div>
      )}

      {count.status === 'CLOSED' && count.closedBy && (
        <div className="rounded-lg border bg-muted/30 p-4 text-sm">
          <p className="font-medium">Conteo cerrado</p>
          <p className="text-muted-foreground text-xs mt-0.5">
            Por {count.closedBy.firstName} {count.closedBy.lastName} el{' '}
            {count.closedAt &&
              new Date(count.closedAt).toLocaleString('es-PE', {
                dateStyle: 'short',
                timeStyle: 'short',
              })}
            {count.adjustmentMovement && (
              <>
                {' '}
                · Ajuste generado:{' '}
                <Link href="/dashboard/almacen-principal" className="underline font-mono">
                  {count.adjustmentMovement.code}
                </Link>
              </>
            )}
          </p>
        </div>
      )}

      {count.status === 'CANCELLED' && count.cancelledBy && (
        <div className="rounded-lg border bg-muted/30 p-4 text-sm">
          <p className="font-medium">Conteo cancelado</p>
          <p className="text-muted-foreground text-xs mt-0.5">
            Por {count.cancelledBy.firstName} {count.cancelledBy.lastName} el{' '}
            {count.cancelledAt &&
              new Date(count.cancelledAt).toLocaleString('es-PE', {
                dateStyle: 'short',
                timeStyle: 'short',
              })}
          </p>
          {count.notes && (
            <p className="text-muted-foreground text-xs mt-1">{count.notes}</p>
          )}
        </div>
      )}

      <Dialog open={cancelOpen} onOpenChange={(v) => !v && setCancelOpen(false)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Cancelar conteo {count.code}</DialogTitle>
            <DialogDescription>
              El conteo se descartará sin generar ajustes al stock. Esta acción es
              irreversible.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-1.5">
            <Label>Motivo (opcional)</Label>
            <Input
              value={cancelReason}
              onChange={(e) => setCancelReason(e.target.value)}
              placeholder="Ej: duplicado, error al iniciar..."
              maxLength={500}
              autoFocus
            />
          </div>
          <div className="flex justify-end gap-2 pt-2 border-t">
            <Button variant="outline" onClick={() => setCancelOpen(false)}>
              Volver
            </Button>
            <Button
              variant="destructive"
              onClick={handleCancelConfirm}
              disabled={cancelMut.isPending}
            >
              Cancelar conteo
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
