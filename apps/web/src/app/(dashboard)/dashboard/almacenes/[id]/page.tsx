'use client';

import {
  AlertTriangle,
  ArrowDownCircle,
  ArrowLeft,
  ArrowRight,
  Box,
  Building,
  Calendar,
  CheckCircle2,
  MapPin,
  Package,
  Star,
  TrendingDown,
  Warehouse as WarehouseIcon,
} from 'lucide-react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useMemo } from 'react';
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { useAlerts } from '@/hooks/use-alerts';
import { useMovements } from '@/hooks/use-movements';
import { useStock } from '@/hooks/use-stock';
import { useWarehouse } from '@/hooks/use-warehouses';
import { cn } from '@/lib/cn';

const TYPE_COLORS: Record<string, string> = {
  MATERIAL: 'hsl(217 91% 60%)',
  HERRAMIENTA: 'hsl(38 92% 55%)',
  EPP: 'hsl(142 71% 45%)',
  EQUIPO: 'hsl(270 60% 55%)',
  REPUESTO: 'hsl(200 30% 50%)',
};

const TYPE_LABELS: Record<string, string> = {
  MATERIAL: 'Material',
  HERRAMIENTA: 'Herramienta',
  EPP: 'EPP',
  EQUIPO: 'Equipo',
  REPUESTO: 'Repuesto',
};

const MOVEMENT_TYPE_BADGE: Record<string, { label: string; variant: string }> = {
  ENTRADA: { label: 'Entrada', variant: 'success' },
  SALIDA: { label: 'Salida', variant: 'destructive' },
  AJUSTE: { label: 'Ajuste', variant: 'warning' },
};

export default function WarehouseDetailPage() {
  const params = useParams();
  const id = params.id as string;

  const { data: warehouse, isLoading: whLoading } = useWarehouse(id);
  const { data: stock = [] } = useStock({ warehouseId: id, enabled: !!id });
  const { data: movementsPage } = useMovements({
    warehouseId: id,
    pageSize: 10,
    enabled: !!id,
  });
  const { data: alerts = [] } = useAlerts({
    warehouseId: id,
    read: false,
    enabled: !!id,
  });

  const stats = useMemo(() => {
    const items = stock.length;
    const totalQty = stock.reduce((acc, s) => acc + Number(s.quantity), 0);
    const belowMin = stock.filter(
      (s) => Number(s.item.minStock) > 0 && Number(s.quantity) < Number(s.item.minStock),
    ).length;
    const outOfStock = stock.filter(
      (s) => Number(s.quantity) === 0 && Number(s.item.minStock) > 0,
    ).length;

    // Distribución por tipo (cantidad de ítems, no cantidades físicas)
    const byType = new Map<string, number>();
    for (const s of stock) {
      byType.set(s.item.type, (byType.get(s.item.type) ?? 0) + 1);
    }
    const typeData = Array.from(byType.entries())
      .map(([type, count]) => ({
        name: TYPE_LABELS[type] ?? type,
        value: count,
        fill: TYPE_COLORS[type] ?? 'hsl(var(--muted-foreground))',
      }))
      .sort((a, b) => b.value - a.value);

    return { items, totalQty, belowMin, outOfStock, typeData };
  }, [stock]);

  if (whLoading) {
    return <div className="text-sm text-muted-foreground">Cargando almacén...</div>;
  }
  if (!warehouse) {
    return <div className="text-sm text-destructive">Almacén no encontrado</div>;
  }

  const isPrincipal = warehouse.type === 'CENTRAL';

  return (
    <div className="space-y-6">
      {/* Breadcrumb */}
      <div>
        <Link href="/dashboard/almacenes">
          <Button
            variant="ghost"
            size="sm"
            className="gap-1.5 text-muted-foreground h-7 -ml-2"
          >
            <ArrowLeft className="h-3.5 w-3.5" /> Volver a Almacenes
          </Button>
        </Link>
      </div>

      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div className="flex items-start gap-4 min-w-0">
          <div
            className={cn(
              'flex h-12 w-12 shrink-0 items-center justify-center rounded-xl ring-1',
              isPrincipal
                ? 'bg-accent/10 text-accent ring-accent/20'
                : 'bg-muted text-muted-foreground ring-border',
            )}
          >
            {isPrincipal ? (
              <Star className="h-6 w-6 fill-current" />
            ) : (
              <WarehouseIcon className="h-6 w-6" />
            )}
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-2xl font-bold tracking-tight leading-tight">
                {warehouse.name}
              </h1>
              <Badge variant="outline" className="font-mono text-xs">
                {warehouse.code}
              </Badge>
              <Badge variant={isPrincipal ? 'info' : 'secondary'}>
                {isPrincipal ? 'Almacén Principal' : 'Almacén de obra'}
              </Badge>
              <Badge variant={warehouse.active ? 'success' : 'secondary'}>
                {warehouse.active ? 'Activo' : 'Inactivo'}
              </Badge>
            </div>
            {warehouse.obra && (
              <p className="text-sm text-muted-foreground mt-1 flex items-center gap-1.5">
                <Building className="h-3.5 w-3.5" />
                Obra:{' '}
                <Link
                  href={`/dashboard/obras/${warehouse.obra.id}`}
                  className="font-medium text-foreground hover:text-accent transition-colors"
                >
                  {warehouse.obra.name}
                </Link>
              </p>
            )}
            {warehouse.location && (
              <p className="text-sm text-muted-foreground mt-1 flex items-center gap-1.5">
                <MapPin className="h-3.5 w-3.5" />
                {warehouse.location}
              </p>
            )}
            {warehouse.description && (
              <p className="text-sm text-muted-foreground mt-1">
                {warehouse.description}
              </p>
            )}
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          {isPrincipal && (
            <Link href="/dashboard/almacen-principal">
              <Button variant="outline" size="sm" className="gap-1.5">
                <ArrowDownCircle className="h-4 w-4 text-green-600" /> Registrar entrada
              </Button>
            </Link>
          )}
          {isPrincipal && (
            <Link href="/dashboard/transferencias/nueva">
              <Button variant="outline" size="sm" className="gap-1.5">
                <ArrowRight className="h-4 w-4 text-blue-600" /> Transferir
              </Button>
            </Link>
          )}
          <Link href="/dashboard/almacenes">
            <Button variant="outline" size="sm">
              Gestionar almacenes
            </Button>
          </Link>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard label="Ítems distintos" value={stats.items} icon={Box} tone="default" />
        <KpiCard
          label="Cantidad total"
          value={stats.totalQty.toLocaleString('es-PE', { maximumFractionDigits: 0 })}
          icon={Package}
          tone="info"
        />
        <KpiCard
          label="Bajo mínimo"
          value={stats.belowMin}
          icon={TrendingDown}
          tone={stats.belowMin > 0 ? 'warning' : 'success'}
        />
        <KpiCard
          label="Alertas sin leer"
          value={alerts.length}
          icon={AlertTriangle}
          tone={alerts.length > 0 ? 'destructive' : 'success'}
        />
      </div>

      {/* Fila: distribución por tipo + info general */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-5">
        {/* Donut tipo */}
        <section className="lg:col-span-2 rounded-xl border bg-card p-5 shadow-sm">
          <header className="flex items-center gap-3 mb-4">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-muted text-muted-foreground ring-1 ring-border">
              <CheckCircle2 className="h-4 w-4" />
            </div>
            <div>
              <h2 className="text-sm font-semibold leading-tight">
                Composición del inventario
              </h2>
              <p className="text-xs text-muted-foreground mt-0.5">
                Ítems distintos por tipo
              </p>
            </div>
          </header>
          {stats.items === 0 ? (
            <EmptyState
              icon={Package}
              title="Almacén vacío"
              description="Aún no hay ítems con stock en este almacén."
            />
          ) : (
            <div className="flex items-center gap-4">
              <div className="relative h-48 w-48 shrink-0">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={stats.typeData}
                      cx="50%"
                      cy="50%"
                      innerRadius={50}
                      outerRadius={78}
                      paddingAngle={2}
                      dataKey="value"
                      stroke="hsl(var(--card))"
                      strokeWidth={3}
                    >
                      {stats.typeData.map((entry, i) => (
                        <Cell key={i} fill={entry.fill} />
                      ))}
                    </Pie>
                    <Tooltip
                      contentStyle={{
                        backgroundColor: 'hsl(var(--popover))',
                        border: '1px solid hsl(var(--border))',
                        borderRadius: 8,
                        fontSize: 12,
                      }}
                    />
                  </PieChart>
                </ResponsiveContainer>
                <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                  <p className="text-2xl font-bold tabular-nums">{stats.items}</p>
                  <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
                    Ítems
                  </p>
                </div>
              </div>
              <div className="flex-1 space-y-1.5 min-w-0">
                {stats.typeData.map((d) => {
                  const pct = Math.round((d.value / stats.items) * 100);
                  return (
                    <div key={d.name} className="space-y-0.5">
                      <div className="flex items-center justify-between text-xs">
                        <div className="flex items-center gap-2 min-w-0">
                          <span
                            className="h-2.5 w-2.5 rounded-full shrink-0"
                            style={{ backgroundColor: d.fill }}
                          />
                          <span className="text-muted-foreground truncate">{d.name}</span>
                        </div>
                        <span className="font-semibold tabular-nums shrink-0 ml-2">
                          {d.value}{' '}
                          <span className="text-muted-foreground font-normal">
                            ({pct}%)
                          </span>
                        </span>
                      </div>
                      <div className="h-0.5 rounded-full bg-muted overflow-hidden">
                        <div
                          className="h-full rounded-full"
                          style={{ width: `${pct}%`, backgroundColor: d.fill }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </section>

        {/* Info general */}
        <section className="lg:col-span-3 rounded-xl border bg-card p-5 shadow-sm">
          <header className="flex items-center gap-3 mb-4">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-muted text-muted-foreground ring-1 ring-border">
              <Calendar className="h-4 w-4" />
            </div>
            <div>
              <h2 className="text-sm font-semibold leading-tight">Información</h2>
              <p className="text-xs text-muted-foreground mt-0.5">
                Datos generales del almacén
              </p>
            </div>
          </header>
          <dl className="grid grid-cols-2 gap-x-6 gap-y-4 text-sm">
            <div>
              <dt className="text-[10px] uppercase tracking-wider text-muted-foreground/70 font-semibold mb-1">
                Código
              </dt>
              <dd className="font-mono">{warehouse.code}</dd>
            </div>
            <div>
              <dt className="text-[10px] uppercase tracking-wider text-muted-foreground/70 font-semibold mb-1">
                Tipo
              </dt>
              <dd>{isPrincipal ? 'Principal (CENTRAL)' : 'De obra'}</dd>
            </div>
            <div>
              <dt className="text-[10px] uppercase tracking-wider text-muted-foreground/70 font-semibold mb-1">
                Obra asignada
              </dt>
              <dd>
                {warehouse.obra ? (
                  <Link
                    href={`/dashboard/obras/${warehouse.obra.id}`}
                    className="text-accent hover:underline"
                  >
                    {warehouse.obra.name}
                  </Link>
                ) : (
                  <span className="text-muted-foreground">—</span>
                )}
              </dd>
            </div>
            <div>
              <dt className="text-[10px] uppercase tracking-wider text-muted-foreground/70 font-semibold mb-1">
                Ubicación
              </dt>
              <dd>
                {warehouse.location ?? <span className="text-muted-foreground">—</span>}
              </dd>
            </div>
            <div>
              <dt className="text-[10px] uppercase tracking-wider text-muted-foreground/70 font-semibold mb-1">
                Estado
              </dt>
              <dd>
                <Badge variant={warehouse.active ? 'success' : 'secondary'}>
                  {warehouse.active ? 'Activo' : 'Inactivo'}
                </Badge>
              </dd>
            </div>
            <div>
              <dt className="text-[10px] uppercase tracking-wider text-muted-foreground/70 font-semibold mb-1">
                Creado
              </dt>
              <dd>
                {new Date(warehouse.createdAt).toLocaleDateString('es-PE', {
                  day: '2-digit',
                  month: 'short',
                  year: 'numeric',
                })}
              </dd>
            </div>
            {warehouse.description && (
              <div className="col-span-2">
                <dt className="text-[10px] uppercase tracking-wider text-muted-foreground/70 font-semibold mb-1">
                  Descripción
                </dt>
                <dd className="text-muted-foreground">{warehouse.description}</dd>
              </div>
            )}
          </dl>
        </section>
      </div>

      {/* Tabla stock */}
      <section className="rounded-xl border bg-card shadow-sm">
        <header className="flex items-center justify-between p-5 border-b">
          <div>
            <h2 className="text-sm font-semibold">Stock actual</h2>
            <p className="text-xs text-muted-foreground">
              {stock.length} ítem{stock.length !== 1 ? 's' : ''} registrados en este
              almacén
            </p>
          </div>
        </header>
        {stock.length === 0 ? (
          <div className="p-10">
            <EmptyState
              icon={Package}
              title="Sin stock registrado"
              description={
                isPrincipal
                  ? 'Registra una entrada para comenzar a cargar el inventario.'
                  : 'El stock llega desde el Almacén Principal vía transferencia.'
              }
            />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/40 text-xs uppercase tracking-wider text-muted-foreground">
                <tr>
                  <th className="text-left px-4 py-2.5 font-medium">Código</th>
                  <th className="text-left px-4 py-2.5 font-medium">Ítem</th>
                  <th className="text-left px-4 py-2.5 font-medium">Tipo</th>
                  <th className="text-right px-4 py-2.5 font-medium">Cantidad</th>
                  <th className="text-right px-4 py-2.5 font-medium">Mínimo</th>
                  <th className="text-left px-4 py-2.5 font-medium">Estado</th>
                </tr>
              </thead>
              <tbody>
                {[...stock]
                  .sort((a, b) => a.item.name.localeCompare(b.item.name))
                  .map((s) => {
                    const qty = Number(s.quantity);
                    const min = Number(s.item.minStock);
                    const out = qty === 0 && min > 0;
                    const low = !out && min > 0 && qty < min;
                    return (
                      <tr key={s.id} className="border-t hover:bg-muted/20">
                        <td className="px-4 py-2.5 font-mono text-xs">{s.item.code}</td>
                        <td className="px-4 py-2.5">
                          <Link
                            href={`/dashboard/items/${s.itemId}`}
                            className="font-medium hover:text-accent transition-colors"
                          >
                            {s.item.name}
                          </Link>
                        </td>
                        <td className="px-4 py-2.5">
                          <Badge variant="outline" className="text-[10px]">
                            {TYPE_LABELS[s.item.type] ?? s.item.type}
                          </Badge>
                        </td>
                        <td
                          className={cn(
                            'px-4 py-2.5 text-right font-semibold tabular-nums',
                            out && 'text-destructive',
                            low && 'text-amber-600 dark:text-amber-400',
                          )}
                        >
                          {qty.toLocaleString('es-PE', { maximumFractionDigits: 3 })}{' '}
                          {s.item.unit.abbreviation}
                        </td>
                        <td className="px-4 py-2.5 text-right tabular-nums text-muted-foreground text-xs">
                          {min > 0 ? min : '—'}
                        </td>
                        <td className="px-4 py-2.5">
                          {out ? (
                            <Badge variant="destructive">Sin stock</Badge>
                          ) : low ? (
                            <Badge variant="warning">Bajo mínimo</Badge>
                          ) : (
                            <Badge variant="success">Óptimo</Badge>
                          )}
                        </td>
                      </tr>
                    );
                  })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Últimos movimientos */}
      <section className="rounded-xl border bg-card shadow-sm">
        <header className="flex items-center justify-between p-5 border-b">
          <div>
            <h2 className="text-sm font-semibold">Últimos movimientos</h2>
            <p className="text-xs text-muted-foreground">
              Registro reciente de actividad en este almacén
            </p>
          </div>
        </header>
        {!movementsPage || movementsPage.items.length === 0 ? (
          <div className="p-10">
            <EmptyState
              icon={Package}
              title="Sin movimientos"
              description="Todavía no se han registrado entradas, salidas ni ajustes aquí."
            />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/40 text-xs uppercase tracking-wider text-muted-foreground">
                <tr>
                  <th className="text-left px-4 py-2.5 font-medium">Fecha</th>
                  <th className="text-left px-4 py-2.5 font-medium">Código</th>
                  <th className="text-left px-4 py-2.5 font-medium">Tipo</th>
                  <th className="text-right px-4 py-2.5 font-medium">Ítems</th>
                  <th className="text-left px-4 py-2.5 font-medium">Usuario</th>
                </tr>
              </thead>
              <tbody>
                {movementsPage.items.map((m) => {
                  const badge = MOVEMENT_TYPE_BADGE[m.type] ?? {
                    label: m.type,
                    variant: 'outline',
                  };
                  return (
                    <tr key={m.id} className="border-t hover:bg-muted/20">
                      <td className="px-4 py-2.5 text-xs text-muted-foreground tabular-nums">
                        {new Date(m.createdAt).toLocaleString('es-PE', {
                          dateStyle: 'short',
                          timeStyle: 'short',
                        })}
                      </td>
                      <td className="px-4 py-2.5 font-mono text-xs font-medium">
                        {m.code}
                      </td>
                      <td className="px-4 py-2.5">
                        <Badge variant={badge.variant as any}>{badge.label}</Badge>
                      </td>
                      <td className="px-4 py-2.5 text-right tabular-nums">
                        {m.items.length}
                      </td>
                      <td className="px-4 py-2.5 text-xs text-muted-foreground">
                        {m.user.firstName} {m.user.lastName}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}

// ======================================================================
// Sub-componentes
// ======================================================================

type Tone = 'default' | 'info' | 'success' | 'warning' | 'destructive';

function KpiCard({
  label,
  value,
  icon: Icon,
  tone = 'default',
}: {
  label: string;
  value: number | string;
  icon: React.ElementType;
  tone?: Tone;
}) {
  const tones: Record<Tone, { bg: string; fg: string; ring: string }> = {
    default: {
      bg: 'bg-muted',
      fg: 'text-muted-foreground',
      ring: 'ring-border',
    },
    info: {
      bg: 'bg-blue-500/10 dark:bg-blue-500/15',
      fg: 'text-blue-600 dark:text-blue-400',
      ring: 'ring-blue-500/20',
    },
    success: {
      bg: 'bg-green-500/10 dark:bg-green-500/15',
      fg: 'text-green-600 dark:text-green-400',
      ring: 'ring-green-500/20',
    },
    warning: {
      bg: 'bg-amber-500/10 dark:bg-amber-500/15',
      fg: 'text-amber-600 dark:text-amber-400',
      ring: 'ring-amber-500/20',
    },
    destructive: {
      bg: 'bg-red-500/10 dark:bg-red-500/15',
      fg: 'text-red-600 dark:text-red-400',
      ring: 'ring-red-500/20',
    },
  };
  const t = tones[tone];
  return (
    <div className="rounded-xl border bg-card p-5 shadow-sm">
      <div className="flex items-center justify-between gap-2">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/80">
          {label}
        </p>
        <div
          className={cn(
            'flex h-8 w-8 items-center justify-center rounded-lg ring-1',
            t.bg,
            t.ring,
          )}
        >
          <Icon className={cn('h-4 w-4', t.fg)} />
        </div>
      </div>
      <p className="text-[2rem] font-bold tracking-tight leading-none tabular-nums mt-3">
        {value}
      </p>
    </div>
  );
}
