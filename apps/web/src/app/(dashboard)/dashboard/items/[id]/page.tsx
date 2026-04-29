'use client';

import {
  ArrowDownCircle,
  ArrowLeft,
  ArrowRight,
  ArrowUpCircle,
  Box,
  Edit2,
  Package,
  SlidersHorizontal,
  Star,
  Truck,
  TrendingDown,
  TrendingUp,
  Warehouse as WarehouseIcon,
} from 'lucide-react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useMemo, useState } from 'react';
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

import { QuickAdjustDialog } from '@/components/items/quick-adjust-dialog';
import { QuickEntryDialog } from '@/components/items/quick-entry-dialog';
import { QuickOutgoingDialog } from '@/components/items/quick-outgoing-dialog';
import { QuickTransferDialog } from '@/components/items/quick-transfer-dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useItem } from '@/hooks/use-items';
import { useKardex, type MovementType } from '@/hooks/use-movements';
import { useTransfers } from '@/hooks/use-transfers';

const TYPE_BADGE: Record<MovementType, { label: string; variant: string }> = {
  ENTRADA: { label: 'Entrada', variant: 'success' },
  SALIDA: { label: 'Salida', variant: 'destructive' },
  AJUSTE: { label: 'Ajuste', variant: 'warning' },
};

export default function ItemDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;

  const { data: item, isLoading } = useItem(id);
  const { data: kardex = [], isLoading: kardexLoading } = useKardex(id);
  // Transferencias EN_TRANSITO de este ítem (esperando recepción del destino)
  const { data: pendingTransfers } = useTransfers({
    status: 'EN_TRANSITO',
    itemId: id,
    pageSize: 50,
    enabled: !!id,
  });
  const pendingItemLines = useMemo(() => {
    return (pendingTransfers?.items ?? []).flatMap((t) =>
      t.items
        .filter((ti) => ti.itemId === id)
        .map((ti) => ({
          transferId: t.id,
          transferCode: t.code,
          toWarehouseName: t.toWarehouse.name,
          requestedQty: Number(ti.requestedQty),
          createdAt: t.createdAt,
        })),
    );
  }, [pendingTransfers, id]);
  const totalInTransit = useMemo(
    () => pendingItemLines.reduce((acc, l) => acc + l.requestedQty, 0),
    [pendingItemLines],
  );

  const [typeFilter, setTypeFilter] = useState<MovementType | '_all'>('_all');
  const [showEntry, setShowEntry] = useState(false);
  const [showOutgoing, setShowOutgoing] = useState(false);
  const [showTransfer, setShowTransfer] = useState(false);
  const [showAdjust, setShowAdjust] = useState(false);

  const principalStockEntry = useMemo(
    () => item?.stocks?.find((s) => s.warehouse.type === 'CENTRAL'),
    [item],
  );
  const principalStock = Number(principalStockEntry?.quantity ?? 0);

  const stocksByWarehouse = useMemo(() => {
    if (!item?.stocks) return [];
    return [...item.stocks].sort((a, b) => {
      if (a.warehouse.type === 'CENTRAL') return -1;
      if (b.warehouse.type === 'CENTRAL') return 1;
      return a.warehouse.name.localeCompare(b.warehouse.name);
    });
  }, [item]);

  const totalStock = useMemo(
    () => (item?.stocks ?? []).reduce((acc, s) => acc + Number(s.quantity), 0),
    [item],
  );

  // Serie para la gráfica: stockAfter del Principal según kardex
  const chartData = useMemo(() => {
    return kardex
      .filter((k) => k.movement.warehouse.id === principalStockEntry?.warehouseId)
      .slice(-30)
      .map((k) => ({
        date: new Date(k.movement.createdAt).toLocaleDateString('es-PE', {
          day: '2-digit',
          month: 'short',
        }),
        stock: Number(k.stockAfter),
        code: k.movement.code,
      }));
  }, [kardex, principalStockEntry]);

  const filteredKardex = useMemo(() => {
    if (typeFilter === '_all') return kardex;
    return kardex.filter((k) => k.movement.type === typeFilter);
  }, [kardex, typeFilter]);

  const min = Number(item?.minStock ?? 0);
  const max = item?.maxStock != null ? Number(item.maxStock) : null;
  const status = useMemo(() => {
    if (principalStock === 0) return { label: 'Sin stock', tone: 'destructive' as const };
    if (min > 0 && principalStock < min)
      return { label: 'Bajo mínimo', tone: 'warning' as const };
    if (max && principalStock > max)
      return { label: 'Sobre máximo', tone: 'warning' as const };
    return { label: 'Óptimo', tone: 'success' as const };
  }, [principalStock, min, max]);

  const itemWithPrincipalStock = item ? { ...item, principalStock } : null;

  if (isLoading)
    return <div className="text-sm text-muted-foreground">Cargando ítem...</div>;
  if (!item) return <div className="text-sm text-destructive">Ítem no encontrado</div>;

  return (
    <div className="space-y-6">
      {/* Breadcrumb + header */}
      <div>
        <Link href="/dashboard/almacen-principal">
          <Button
            variant="ghost"
            size="sm"
            className="gap-1.5 text-muted-foreground h-7 -ml-2"
          >
            <ArrowLeft className="h-3.5 w-3.5" /> Volver al inventario
          </Button>
        </Link>
      </div>

      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div className="flex items-start gap-4 min-w-0">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-accent/10 ring-1 ring-accent/20">
            <Box className="h-6 w-6 text-accent" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-2xl font-bold tracking-tight leading-tight">
                {item.name}
              </h1>
              <Badge variant="outline" className="font-mono text-xs">
                {item.code}
              </Badge>
              <Badge variant={item.active ? 'success' : 'secondary'}>
                {item.active ? 'Activo' : 'Inactivo'}
              </Badge>
            </div>
            <p className="text-sm text-muted-foreground mt-1">
              {item.category.name} · {item.unit.name} ({item.unit.abbreviation}) ·{' '}
              {item.type}
            </p>
            {item.description && (
              <p className="text-sm text-muted-foreground mt-1">{item.description}</p>
            )}
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          <Button
            variant="outline"
            size="sm"
            className="gap-1.5"
            onClick={() => setShowEntry(true)}
            disabled={!item.active}
          >
            <ArrowDownCircle className="h-4 w-4 text-green-600" /> Entrada
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="gap-1.5"
            onClick={() => setShowTransfer(true)}
            disabled={!item.active || principalStock === 0}
          >
            <ArrowRight className="h-4 w-4 text-blue-600" /> Transferir
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="gap-1.5"
            onClick={() => setShowAdjust(true)}
            disabled={!item.active}
          >
            <SlidersHorizontal className="h-4 w-4 text-amber-600" /> Ajustar
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="gap-1.5"
            onClick={() => setShowOutgoing(true)}
            disabled={!item.active || principalStock === 0}
          >
            <ArrowUpCircle className="h-4 w-4 text-red-600" /> Salida
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="gap-1.5"
            onClick={() => router.push(`/dashboard/almacen-principal?edit=${item.id}`)}
          >
            <Edit2 className="h-4 w-4" /> Editar
          </Button>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        <KpiCard
          label="Stock en Principal"
          value={principalStock.toLocaleString('es-PE', { maximumFractionDigits: 3 })}
          unit={item.unit.abbreviation}
          icon={Star}
          tone={status.tone}
        />
        <KpiCard
          label="Stock total (todos)"
          value={totalStock.toLocaleString('es-PE', { maximumFractionDigits: 3 })}
          unit={item.unit.abbreviation}
          icon={Package}
          tone="default"
        />
        <KpiCard
          label="En tránsito"
          value={totalInTransit.toLocaleString('es-PE', { maximumFractionDigits: 3 })}
          unit={item.unit.abbreviation}
          icon={Truck}
          tone={totalInTransit > 0 ? ('warning' as const) : 'default'}
          hint={
            pendingItemLines.length > 0
              ? `${pendingItemLines.length} transferencia${pendingItemLines.length === 1 ? '' : 's'} pendiente${pendingItemLines.length === 1 ? '' : 's'}`
              : undefined
          }
        />
        <KpiCard
          label="Rango min / max"
          value={`${min}${max ? ` – ${max}` : ' – ∞'}`}
          unit={item.unit.abbreviation}
          icon={min > 0 ? TrendingDown : TrendingUp}
          tone="default"
        />
        <KpiCard
          label="Estado"
          value={status.label}
          icon={TrendingUp}
          tone={status.tone}
        />
      </div>

      {pendingItemLines.length > 0 && (
        <section className="rounded-xl border border-warning/40 bg-warning/5 p-5">
          <header className="flex items-center gap-2 mb-3">
            <Truck className="h-4 w-4 text-warning" />
            <h2 className="text-sm font-semibold">
              Transferencias pendientes de recepción
            </h2>
            <span className="text-[11px] text-muted-foreground">
              ({pendingItemLines.length}{' '}
              {pendingItemLines.length === 1 ? 'pendiente' : 'pendientes'})
            </span>
          </header>
          <p className="text-xs text-muted-foreground mb-3">
            Estas cantidades ya salieron del Almacén Principal pero aún no han sido
            confirmadas por el residente del almacén destino. Se sumarán al stock de obra
            cuando se reciba la transferencia.
          </p>
          <div className="space-y-1.5">
            {pendingItemLines.map((l) => (
              <Link
                key={l.transferId}
                href={`/dashboard/almacen-principal?tab=transferencias`}
                className="flex items-center justify-between gap-3 rounded-md border bg-card px-3 py-2 text-sm hover:border-warning/60 transition-colors"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <span className="font-mono text-xs font-semibold">
                    {l.transferCode}
                  </span>
                  <ArrowRight className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                  <span className="truncate">{l.toWarehouseName}</span>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  <span className="font-semibold tabular-nums">
                    {l.requestedQty.toLocaleString('es-PE', { maximumFractionDigits: 3 })}{' '}
                    {item.unit.abbreviation}
                  </span>
                  <Badge variant="warning" className="text-[10px]">
                    En tránsito
                  </Badge>
                </div>
              </Link>
            ))}
          </div>
        </section>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Distribución por almacén */}
        <section className="lg:col-span-1 rounded-xl border bg-card p-5">
          <header className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold flex items-center gap-2">
              <WarehouseIcon className="h-4 w-4 text-muted-foreground" />
              Distribución por almacén
            </h2>
          </header>
          {stocksByWarehouse.length === 0 ? (
            <p className="text-xs text-muted-foreground py-6 text-center">
              Sin stock registrado.
            </p>
          ) : (
            <div className="space-y-1.5">
              {stocksByWarehouse.map((s) => {
                const qty = Number(s.quantity);
                const isPrincipal = s.warehouse.type === 'CENTRAL';
                const pct = totalStock > 0 ? (qty / totalStock) * 100 : 0;
                return (
                  <div
                    key={s.id}
                    className="rounded-md border bg-muted/20 px-3 py-2 text-sm"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2 min-w-0">
                        {isPrincipal ? (
                          <Star className="h-3.5 w-3.5 fill-current text-accent shrink-0" />
                        ) : (
                          <WarehouseIcon className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                        )}
                        <span className="truncate">{s.warehouse.name}</span>
                      </div>
                      <span className="font-semibold tabular-nums shrink-0">
                        {qty.toLocaleString('es-PE', { maximumFractionDigits: 3 })}
                      </span>
                    </div>
                    {totalStock > 0 && (
                      <div className="mt-1.5 h-1 rounded-full bg-muted overflow-hidden">
                        <div
                          className={`h-full ${isPrincipal ? 'bg-accent' : 'bg-muted-foreground/40'}`}
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </section>

        {/* Gráfica de tendencia */}
        <section className="lg:col-span-2 rounded-xl border bg-card p-5">
          <header className="flex items-center justify-between mb-3">
            <div>
              <h2 className="text-sm font-semibold">
                Evolución del stock en el Principal
              </h2>
              <p className="text-xs text-muted-foreground">
                Últimos {chartData.length} movimientos registrados
              </p>
            </div>
          </header>
          {chartData.length === 0 ? (
            <div className="h-56 flex items-center justify-center text-xs text-muted-foreground">
              Sin movimientos todavía.
            </div>
          ) : (
            <div className="h-56">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart
                  data={chartData}
                  margin={{ top: 8, right: 12, left: 4, bottom: 4 }}
                >
                  <CartesianGrid
                    strokeDasharray="3 3"
                    stroke="hsl(var(--border))"
                    vertical={false}
                  />
                  <XAxis
                    dataKey="date"
                    stroke="hsl(var(--muted-foreground))"
                    fontSize={11}
                    tickLine={false}
                    axisLine={false}
                  />
                  <YAxis
                    stroke="hsl(var(--muted-foreground))"
                    fontSize={11}
                    tickLine={false}
                    axisLine={false}
                    width={40}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: 'hsl(var(--popover))',
                      border: '1px solid hsl(var(--border))',
                      borderRadius: 8,
                      fontSize: 12,
                    }}
                  />
                  <Line
                    type="monotone"
                    dataKey="stock"
                    stroke="hsl(var(--accent))"
                    strokeWidth={2}
                    dot={{ fill: 'hsl(var(--accent))', r: 3 }}
                    activeDot={{ r: 5 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}
        </section>
      </div>

      {/* Tabla Kardex */}
      <section className="rounded-xl border bg-card">
        <header className="flex items-center justify-between p-5 border-b">
          <div>
            <h2 className="text-sm font-semibold">Kardex del ítem</h2>
            <p className="text-xs text-muted-foreground">
              Todos los movimientos que afectan a este ítem
            </p>
          </div>
          <Select
            value={typeFilter}
            onValueChange={(v) => setTypeFilter(v as MovementType | '_all')}
          >
            <SelectTrigger className="w-40 h-9">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="_all">Todos los tipos</SelectItem>
              <SelectItem value="ENTRADA">Entradas</SelectItem>
              <SelectItem value="SALIDA">Salidas</SelectItem>
              <SelectItem value="AJUSTE">Ajustes</SelectItem>
            </SelectContent>
          </Select>
        </header>

        {kardexLoading ? (
          <div className="p-6 space-y-2">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="h-10 bg-muted animate-pulse rounded" />
            ))}
          </div>
        ) : filteredKardex.length === 0 ? (
          <div className="p-12 text-center text-sm text-muted-foreground">
            Sin movimientos para este filtro.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/40 text-xs uppercase tracking-wider text-muted-foreground">
                <tr>
                  <th className="text-left px-4 py-2.5 font-medium">Fecha</th>
                  <th className="text-left px-4 py-2.5 font-medium">Código</th>
                  <th className="text-left px-4 py-2.5 font-medium">Tipo</th>
                  <th className="text-left px-4 py-2.5 font-medium">Almacén</th>
                  <th className="text-right px-4 py-2.5 font-medium">Cantidad</th>
                  <th className="text-right px-4 py-2.5 font-medium">Stock antes</th>
                  <th className="text-right px-4 py-2.5 font-medium">Stock después</th>
                  <th className="text-left px-4 py-2.5 font-medium">Usuario</th>
                </tr>
              </thead>
              <tbody>
                {[...filteredKardex].reverse().map((k) => {
                  const badge = TYPE_BADGE[k.movement.type];
                  return (
                    <tr key={k.id} className="border-t hover:bg-muted/20">
                      <td className="px-4 py-2.5 text-xs text-muted-foreground tabular-nums">
                        {new Date(k.movement.createdAt).toLocaleString('es-PE', {
                          dateStyle: 'short',
                          timeStyle: 'short',
                        })}
                      </td>
                      <td className="px-4 py-2.5 font-mono text-xs font-medium">
                        {k.movement.code}
                      </td>
                      <td className="px-4 py-2.5">
                        <Badge variant={badge.variant as any}>{badge.label}</Badge>
                      </td>
                      <td className="px-4 py-2.5 text-xs">{k.movement.warehouse.name}</td>
                      <td
                        className={`px-4 py-2.5 text-right font-semibold tabular-nums ${
                          k.movement.type === 'SALIDA'
                            ? 'text-red-600 dark:text-red-400'
                            : k.movement.type === 'ENTRADA'
                              ? 'text-green-600 dark:text-green-400'
                              : 'text-amber-600 dark:text-amber-400'
                        }`}
                      >
                        {k.movement.type === 'SALIDA'
                          ? '-'
                          : k.movement.type === 'ENTRADA'
                            ? '+'
                            : '='}
                        {Number(k.quantity).toLocaleString('es-PE', {
                          maximumFractionDigits: 3,
                        })}
                      </td>
                      <td className="px-4 py-2.5 text-right tabular-nums text-muted-foreground">
                        {Number(k.stockBefore).toLocaleString('es-PE', {
                          maximumFractionDigits: 3,
                        })}
                      </td>
                      <td className="px-4 py-2.5 text-right tabular-nums font-medium">
                        {Number(k.stockAfter).toLocaleString('es-PE', {
                          maximumFractionDigits: 3,
                        })}
                      </td>
                      <td className="px-4 py-2.5 text-xs text-muted-foreground">
                        {k.movement.user.firstName} {k.movement.user.lastName}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Diálogos */}
      <QuickEntryDialog
        item={showEntry ? itemWithPrincipalStock : null}
        onClose={() => setShowEntry(false)}
      />
      <QuickOutgoingDialog
        item={showOutgoing ? itemWithPrincipalStock : null}
        onClose={() => setShowOutgoing(false)}
      />
      <QuickTransferDialog
        item={showTransfer ? itemWithPrincipalStock : null}
        onClose={() => setShowTransfer(false)}
      />
      <QuickAdjustDialog
        item={showAdjust ? itemWithPrincipalStock : null}
        onClose={() => setShowAdjust(false)}
      />
    </div>
  );
}

type Tone = 'default' | 'success' | 'warning' | 'destructive';

function KpiCard({
  label,
  value,
  unit,
  icon: Icon,
  tone = 'default',
  hint,
}: {
  label: string;
  value: string;
  unit?: string;
  icon: React.ElementType;
  tone?: Tone;
  /** Línea pequeña debajo del valor (ej. "3 transferencias pendientes"). */
  hint?: string;
}) {
  const tones: Record<Tone, { bg: string; fg: string; ring: string }> = {
    default: {
      bg: 'bg-muted',
      fg: 'text-muted-foreground',
      ring: 'ring-border',
    },
    success: {
      bg: 'bg-green-500/10',
      fg: 'text-green-600 dark:text-green-400',
      ring: 'ring-green-500/20',
    },
    warning: {
      bg: 'bg-amber-500/10',
      fg: 'text-amber-600 dark:text-amber-400',
      ring: 'ring-amber-500/20',
    },
    destructive: {
      bg: 'bg-red-500/10',
      fg: 'text-red-600 dark:text-red-400',
      ring: 'ring-red-500/20',
    },
  };
  const t = tones[tone];
  return (
    <div className="rounded-xl border bg-card p-5 shadow-sm">
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs font-medium text-muted-foreground">{label}</p>
        <div
          className={`flex h-8 w-8 items-center justify-center rounded-lg ring-1 ${t.bg} ${t.ring}`}
        >
          <Icon className={`h-4 w-4 ${t.fg}`} />
        </div>
      </div>
      <p className="text-2xl font-bold tracking-tight tabular-nums mt-3 leading-none">
        {value}
        {unit && (
          <span className="text-sm font-normal text-muted-foreground ml-1">{unit}</span>
        )}
      </p>
      {hint && <p className="text-[11px] text-muted-foreground mt-1.5">{hint}</p>}
    </div>
  );
}
