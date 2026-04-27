'use client';

import {
  AlertTriangle,
  ArrowRight,
  BarChart3,
  Box,
  Building,
  CheckCircle2,
  Clock,
  HardHat,
  Package,
  Warehouse,
  Wrench,
} from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

import { ChartCard } from '@/components/dashboard/chart-card';
import { KpiCard } from '@/components/dashboard/kpi-card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { useAlerts } from '@/hooks/use-alerts';
import { useDashboardStats } from '@/hooks/use-dashboard';
import { useToolLoans } from '@/hooks/use-tool-loans';
import { useTransfers } from '@/hooks/use-transfers';
import { cn } from '@/lib/cn';
import { useAuthStore } from '@/stores/use-auth-store';

export default function DashboardPage() {
  const user = useAuthStore((s) => s.user);
  const router = useRouter();
  const isResidente = user?.role?.name === 'RESIDENTE';

  // Fase 7A: RESIDENTE tiene su propia landing en /mi-obra
  useEffect(() => {
    if (isResidente) {
      router.replace('/dashboard/mi-obra');
    }
  }, [isResidente, router]);

  // Evita renderizar los charts y gatillar queries del dashboard general
  // mientras el redirect se resuelve (previene warnings de Recharts con width=-1
  // y peticiones innecesarias a endpoints donde el residente no tiene permiso).
  const { data: stats, isLoading } = useDashboardStats({ enabled: !isResidente });
  const alerts = useAlerts({ read: false, enabled: !isResidente });
  const overdueLoans = useToolLoans({
    overdueOnly: true,
    pageSize: 5,
    enabled: !isResidente,
  });
  const pendingTransfers = useTransfers({
    status: 'EN_TRANSITO',
    pageSize: 5,
    enabled: !isResidente,
  });

  if (isResidente) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center text-muted-foreground">
        Redirigiendo a tu obra...
      </div>
    );
  }

  const greeting = (() => {
    const h = new Date().getHours();
    if (h < 12) return 'Buenos días';
    if (h < 19) return 'Buenas tardes';
    return 'Buenas noches';
  })();

  return (
    <div className="space-y-8">
      {/* Greeting */}
      <div>
        <h1 className="text-[2rem] font-bold tracking-tight leading-[1.15]">
          {greeting}, {user?.firstName ?? 'usuario'}
        </h1>
        <p className="text-base text-muted-foreground mt-2">
          Resumen del sistema Kardex ·{' '}
          {new Date().toLocaleDateString('es-PE', {
            weekday: 'long',
            day: 'numeric',
            month: 'long',
            year: 'numeric',
          })}
        </p>
      </div>

      {/* KPIs principales — 6 tarjetas con contexto */}
      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-4">
        <KpiCard
          label="Obras activas"
          value={stats?.kpis.obrasActivas.value}
          icon={Building}
          tone="accent"
          context={
            stats?.kpis.obrasActivas.recent
              ? { kind: 'up', label: `+${stats.kpis.obrasActivas.recent} esta semana` }
              : { kind: 'neutral', label: 'Sin cambios recientes' }
          }
          isLoading={isLoading}
          href="/dashboard/obras"
        />
        <KpiCard
          label="Empleados"
          value={stats?.kpis.empleadosActivos.value}
          icon={HardHat}
          tone="info"
          context={
            stats?.kpis.empleadosActivos.recent
              ? {
                  kind: 'up',
                  label: `+${stats.kpis.empleadosActivos.recent} esta semana`,
                }
              : { kind: 'neutral', label: 'Sin nuevos ingresos' }
          }
          isLoading={isLoading}
          href="/dashboard/empleados"
        />
        <KpiCard
          label="Ítems en catálogo"
          value={stats?.kpis.itemsCatalogo.value}
          icon={Box}
          tone="default"
          context={
            stats?.kpis.itemsCatalogo.recent
              ? { kind: 'up', label: `+${stats.kpis.itemsCatalogo.recent} esta semana` }
              : { kind: 'neutral', label: 'Catálogo estable' }
          }
          isLoading={isLoading}
          href="/dashboard/items"
        />
        <KpiCard
          label="Préstamos activos"
          value={stats?.kpis.prestamosActivos.value}
          icon={Wrench}
          tone={stats?.kpis.prestamosActivos.overdue ? 'warning' : 'success'}
          context={
            stats?.kpis.prestamosActivos.overdue
              ? {
                  kind: 'down',
                  label: `${stats.kpis.prestamosActivos.overdue} vencidos`,
                }
              : { kind: 'up', label: 'Todos en plazo' }
          }
          isLoading={isLoading}
          href="/dashboard/herramientas"
        />
        <KpiCard
          label="Alertas pendientes"
          value={stats?.kpis.alertasPendientes.value}
          icon={AlertTriangle}
          tone={stats?.kpis.alertasPendientes.value ? 'destructive' : 'success'}
          context={
            stats?.kpis.alertasPendientes.critical
              ? {
                  kind: 'down',
                  label: `${stats.kpis.alertasPendientes.critical} críticas`,
                }
              : stats?.kpis.alertasPendientes.value
                ? { kind: 'neutral', label: 'Solo stock bajo' }
                : { kind: 'up', label: 'Inventario óptimo' }
          }
          isLoading={isLoading}
          href="/dashboard/alertas"
        />
        <KpiCard
          label="Movimientos (7d)"
          value={stats?.kpis.movimientos7d.value}
          icon={BarChart3}
          tone="default"
          context={
            stats?.kpis.movimientos7d.deltaPct === null
              ? { kind: 'up', label: 'Primera semana con datos' }
              : stats && stats.kpis.movimientos7d.delta > 0
                ? {
                    kind: 'up',
                    label: `+${stats.kpis.movimientos7d.delta} · +${stats.kpis.movimientos7d.deltaPct ?? 0}%`,
                  }
                : stats && stats.kpis.movimientos7d.delta < 0
                  ? {
                      kind: 'down',
                      label: `${stats.kpis.movimientos7d.delta} · ${stats.kpis.movimientos7d.deltaPct ?? 0}%`,
                    }
                  : { kind: 'neutral', label: 'Igual que la semana anterior' }
          }
          isLoading={isLoading}
          href="/dashboard/almacen-principal"
        />
      </div>

      {/* Gráficas fila 1 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <ChartCard
          title="Actividad de los últimos 7 días"
          description="Entradas, salidas y ajustes por día"
          icon={BarChart3}
        >
          {isLoading ? (
            <ChartSkeleton />
          ) : !stats?.movementsByDay.some(
              (d) => d.entradas + d.salidas + d.ajustes > 0,
            ) ? (
            <EmptyState
              icon={BarChart3}
              title="Sin movimientos aún"
              description="Registra una entrada en el Almacén Principal para ver la actividad."
            />
          ) : (
            <ResponsiveContainer width="100%" height={260}>
              <BarChart
                data={stats.movementsByDay.map((d) => ({
                  ...d,
                  day: new Date(d.date).toLocaleDateString('es-PE', {
                    weekday: 'short',
                    day: '2-digit',
                  }),
                }))}
                margin={{ top: 8, right: 8, left: -12, bottom: 0 }}
              >
                <CartesianGrid
                  strokeDasharray="3 3"
                  stroke="hsl(var(--border))"
                  vertical={false}
                />
                <XAxis
                  dataKey="day"
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
                  allowDecimals={false}
                />
                <Tooltip
                  cursor={{ fill: 'hsl(var(--muted))', opacity: 0.5 }}
                  contentStyle={tooltipStyle}
                />
                <Legend
                  verticalAlign="top"
                  align="right"
                  iconType="circle"
                  iconSize={8}
                  wrapperStyle={{ fontSize: 12, paddingBottom: 8 }}
                />
                <Bar
                  dataKey="entradas"
                  name="Entradas"
                  fill="hsl(142 71% 45%)"
                  radius={[4, 4, 0, 0]}
                  maxBarSize={28}
                />
                <Bar
                  dataKey="salidas"
                  name="Salidas"
                  fill="hsl(0 72% 55%)"
                  radius={[4, 4, 0, 0]}
                  maxBarSize={28}
                />
                <Bar
                  dataKey="ajustes"
                  name="Ajustes"
                  fill="hsl(38 92% 55%)"
                  radius={[4, 4, 0, 0]}
                  maxBarSize={28}
                />
              </BarChart>
            </ResponsiveContainer>
          )}
        </ChartCard>

        <ChartCard
          title="Top ítems por rotación"
          description="Mayor volumen movido en los últimos 7 días"
          icon={Package}
        >
          {isLoading ? (
            <ChartSkeleton />
          ) : (stats?.topItems.length ?? 0) === 0 ? (
            <EmptyState
              icon={Package}
              title="Sin rotación todavía"
              description="Los ítems aparecerán aquí cuando tengan entradas o salidas."
            />
          ) : (
            <ResponsiveContainer width="100%" height={260}>
              <BarChart
                data={stats!.topItems
                  .slice()
                  .reverse()
                  .map((t) => ({
                    name: t.name.length > 26 ? t.name.slice(0, 25) + '…' : t.name,
                    total: t.totalQuantity,
                    unit: t.unit,
                  }))}
                layout="vertical"
                margin={{ top: 4, right: 12, left: 8, bottom: 0 }}
              >
                <CartesianGrid
                  strokeDasharray="3 3"
                  stroke="hsl(var(--border))"
                  horizontal={false}
                />
                <XAxis
                  type="number"
                  stroke="hsl(var(--muted-foreground))"
                  fontSize={11}
                  tickLine={false}
                  axisLine={false}
                  allowDecimals={false}
                />
                <YAxis
                  type="category"
                  dataKey="name"
                  stroke="hsl(var(--muted-foreground))"
                  fontSize={11}
                  tickLine={false}
                  axisLine={false}
                  width={140}
                />
                <Tooltip
                  cursor={{ fill: 'hsl(var(--muted))', opacity: 0.5 }}
                  contentStyle={tooltipStyle}
                  formatter={(val, _n, p) => [
                    `${Number(val).toLocaleString('es-PE', { maximumFractionDigits: 2 })} ${(p as any).payload.unit}`,
                    'Total movido',
                  ]}
                />
                <Bar
                  dataKey="total"
                  fill="hsl(var(--accent))"
                  radius={[0, 4, 4, 0]}
                  maxBarSize={22}
                />
              </BarChart>
            </ResponsiveContainer>
          )}
        </ChartCard>
      </div>

      {/* Gráficas fila 2 */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-5">
        <ChartCard
          title="Estado del stock"
          description="Distribución en el Almacén Principal"
          icon={CheckCircle2}
          className="lg:col-span-2"
        >
          {isLoading ? (
            <ChartSkeleton />
          ) : !stats ||
            stats.stockByStatus.optimo +
              stats.stockByStatus.bajo +
              stats.stockByStatus.sinStock ===
              0 ? (
            <EmptyState
              icon={Package}
              title="Sin ítems con stock"
              description="Aún no hay ítems cargados en el Principal."
            />
          ) : (
            <StockStatusDonut data={stats.stockByStatus} />
          )}
        </ChartCard>

        <ChartCard
          title="Consumo por obra (últimos 7 días)"
          description="Obras con más actividad"
          icon={Building}
          className="lg:col-span-3"
        >
          {isLoading ? (
            <ChartSkeleton />
          ) : (stats?.topObras.length ?? 0) === 0 ? (
            <EmptyState
              icon={Building}
              title="Sin consumo por obra"
              description="Cuando se hagan transferencias o movimientos en almacenes de obra, aparecerán aquí."
            />
          ) : (
            <ResponsiveContainer width="100%" height={260}>
              <BarChart
                data={stats!.topObras.map((o) => ({
                  name: o.name.length > 20 ? o.name.slice(0, 19) + '…' : o.name,
                  total: o.totalQuantity,
                  movs: o.movementsCount,
                }))}
                margin={{ top: 8, right: 8, left: -12, bottom: 0 }}
              >
                <CartesianGrid
                  strokeDasharray="3 3"
                  stroke="hsl(var(--border))"
                  vertical={false}
                />
                <XAxis
                  dataKey="name"
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
                />
                <Tooltip
                  cursor={{ fill: 'hsl(var(--muted))', opacity: 0.5 }}
                  contentStyle={tooltipStyle}
                  formatter={(val, _n, p) => [
                    `${Number(val).toLocaleString('es-PE', { maximumFractionDigits: 2 })} — ${(p as any).payload.movs} mov.`,
                    'Consumo',
                  ]}
                />
                <Bar
                  dataKey="total"
                  fill="hsl(var(--accent))"
                  radius={[6, 6, 0, 0]}
                  maxBarSize={44}
                />
              </BarChart>
            </ResponsiveContainer>
          )}
        </ChartCard>
      </div>

      {/* Actividad: Préstamos vencidos + Transferencias pendientes */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <section className="rounded-xl border bg-card p-6 shadow-sm">
          <header className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-amber-500/10 text-amber-600 dark:text-amber-400 ring-1 ring-amber-500/20">
                <Clock className="h-[18px] w-[18px]" />
              </div>
              <div>
                <h2 className="text-base font-semibold">Préstamos vencidos</h2>
                <p className="text-sm text-muted-foreground">
                  Herramientas sin devolver en fecha
                </p>
              </div>
            </div>
            <Link href="/dashboard/herramientas?status=_overdue">
              <Button variant="ghost" size="sm" className="gap-1.5 h-8">
                Ver todo <ArrowRight className="h-3.5 w-3.5" />
              </Button>
            </Link>
          </header>
          {overdueLoans.isLoading ? (
            <SkeletonRows />
          ) : (overdueLoans.data?.items.length ?? 0) === 0 ? (
            <EmptyState
              icon={Clock}
              title="Todo en orden"
              description="No hay préstamos vencidos."
            />
          ) : (
            <div className="space-y-1.5">
              {overdueLoans.data?.items.slice(0, 5).map((loan) => {
                const daysOverdue = Math.floor(
                  (Date.now() - new Date(loan.expectedReturnAt).getTime()) / 86400000,
                );
                return (
                  <div
                    key={loan.id}
                    className="flex items-center gap-3 rounded-lg border border-amber-200/50 dark:border-amber-900/40 bg-amber-50/50 dark:bg-amber-950/20 px-3 py-2 text-sm"
                  >
                    <div className="flex-1 min-w-0">
                      <p className="font-medium truncate">{loan.item.name}</p>
                      <p className="text-xs text-muted-foreground truncate">
                        {loan.borrowerWorker.firstName} {loan.borrowerWorker.lastName} ·{' '}
                        {loan.workStation.name}
                      </p>
                    </div>
                    <Badge variant="destructive" className="text-[10px]">
                      {daysOverdue}d vencido
                    </Badge>
                  </div>
                );
              })}
            </div>
          )}
        </section>

        <section className="rounded-xl border bg-card p-6 shadow-sm">
          <header className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-500/10 text-blue-600 dark:text-blue-400 ring-1 ring-blue-500/20">
                <Warehouse className="h-[18px] w-[18px]" />
              </div>
              <div>
                <h2 className="text-base font-semibold">Transferencias pendientes</h2>
                <p className="text-sm text-muted-foreground">Requieren aprobación</p>
              </div>
            </div>
            <Link href="/dashboard/transferencias">
              <Button variant="ghost" size="sm" className="gap-1.5 h-8">
                Ver todo <ArrowRight className="h-3.5 w-3.5" />
              </Button>
            </Link>
          </header>
          {pendingTransfers.isLoading ? (
            <SkeletonRows />
          ) : (pendingTransfers.data?.items.length ?? 0) === 0 ? (
            <EmptyState
              icon={Warehouse}
              title="Sin pendientes"
              description="No hay transferencias por aprobar."
            />
          ) : (
            <div className="space-y-1.5">
              {pendingTransfers.data?.items.slice(0, 5).map((t) => (
                <div
                  key={t.id}
                  className="flex items-center gap-3 rounded-lg border bg-muted/30 px-3 py-2 text-sm"
                >
                  <span className="font-mono text-xs font-semibold">{t.code}</span>
                  <div className="flex-1 min-w-0 truncate">
                    {t.fromWarehouse.name} →{' '}
                    <span className="font-medium">{t.toWarehouse.name}</span>
                  </div>
                  <span className="text-xs text-muted-foreground">
                    {t.items.length} ítem{t.items.length !== 1 ? 's' : ''}
                  </span>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>

      {/* Alertas recientes — full width */}
      <section className="rounded-xl border bg-card p-6 shadow-sm">
        <header className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-red-500/10 text-red-600 dark:text-red-400 ring-1 ring-red-500/20">
              <AlertTriangle className="h-[18px] w-[18px]" />
            </div>
            <div>
              <h2 className="text-base font-semibold">Alertas recientes</h2>
              <p className="text-sm text-muted-foreground">Stock crítico y bajo mínimo</p>
            </div>
          </div>
          <Link href="/dashboard/alertas">
            <Button variant="ghost" size="sm" className="gap-1.5 h-8">
              Ver todo <ArrowRight className="h-3.5 w-3.5" />
            </Button>
          </Link>
        </header>
        {alerts.isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="h-12 rounded-md bg-muted animate-pulse" />
            ))}
          </div>
        ) : (alerts.data?.length ?? 0) === 0 ? (
          <EmptyState
            icon={AlertTriangle}
            title="Sin alertas"
            description="El inventario está en niveles óptimos."
          />
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-2">
            {alerts.data?.slice(0, 9).map((alert) => (
              <div
                key={alert.id}
                className={cn(
                  'flex items-start gap-2 rounded-lg border px-3 py-2 text-sm',
                  alert.type === 'STOCK_CRITICO'
                    ? 'border-red-200/50 dark:border-red-900/40 bg-red-50/50 dark:bg-red-950/20'
                    : 'border-amber-200/50 dark:border-amber-900/40 bg-amber-50/50 dark:bg-amber-950/20',
                )}
              >
                <AlertTriangle
                  className={cn(
                    'h-3.5 w-3.5 shrink-0 mt-0.5',
                    alert.type === 'STOCK_CRITICO'
                      ? 'text-red-600 dark:text-red-400'
                      : 'text-amber-600 dark:text-amber-400',
                  )}
                />
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium truncate">{alert.item.name}</p>
                  <p className="text-[11px] text-muted-foreground truncate">
                    {alert.warehouse.name} · {Number(alert.quantity)}{' '}
                    {alert.item.unit.abbreviation}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

// ======================================================================
// Sub-componentes
// ======================================================================

const tooltipStyle = {
  backgroundColor: 'hsl(var(--popover))',
  border: '1px solid hsl(var(--border))',
  borderRadius: 8,
  fontSize: 12,
  boxShadow: '0 4px 12px rgb(0 0 0 / 0.08)',
};

function ChartSkeleton() {
  return (
    <div className="flex flex-col gap-3 animate-pulse">
      <div className="h-48 rounded-md bg-muted" />
      <div className="flex gap-2 justify-center">
        <div className="h-2 w-12 rounded-full bg-muted" />
        <div className="h-2 w-12 rounded-full bg-muted" />
        <div className="h-2 w-12 rounded-full bg-muted" />
      </div>
    </div>
  );
}

function SkeletonRows() {
  return (
    <div className="space-y-2">
      {[...Array(3)].map((_, i) => (
        <div key={i} className="h-12 rounded-md bg-muted animate-pulse" />
      ))}
    </div>
  );
}

function StockStatusDonut({
  data,
}: {
  data: { optimo: number; bajo: number; sinStock: number };
}) {
  const total = data.optimo + data.bajo + data.sinStock;
  const chartData = [
    { name: 'Óptimo', value: data.optimo, fill: 'hsl(142 71% 45%)' },
    { name: 'Bajo mínimo', value: data.bajo, fill: 'hsl(38 92% 55%)' },
    { name: 'Sin stock', value: data.sinStock, fill: 'hsl(0 72% 55%)' },
  ].filter((d) => d.value > 0);

  return (
    <div className="flex items-center gap-4 h-full">
      <div className="relative h-56 w-56 shrink-0">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={chartData}
              cx="50%"
              cy="50%"
              innerRadius={60}
              outerRadius={90}
              paddingAngle={2}
              dataKey="value"
              stroke="hsl(var(--card))"
              strokeWidth={3}
            >
              {chartData.map((entry, i) => (
                <Cell key={i} fill={entry.fill} />
              ))}
            </Pie>
            <Tooltip
              contentStyle={tooltipStyle}
              formatter={(val) => [
                `${Number(val)} ítem${Number(val) !== 1 ? 's' : ''}`,
                '',
              ]}
            />
          </PieChart>
        </ResponsiveContainer>
        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
          <p className="text-3xl font-bold tabular-nums">{total}</p>
          <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
            Ítems totales
          </p>
        </div>
      </div>
      <div className="flex-1 space-y-2.5 min-w-0">
        <LegendRow
          color="hsl(142 71% 45%)"
          label="Óptimo"
          value={data.optimo}
          total={total}
        />
        <LegendRow
          color="hsl(38 92% 55%)"
          label="Bajo mínimo"
          value={data.bajo}
          total={total}
        />
        <LegendRow
          color="hsl(0 72% 55%)"
          label="Sin stock"
          value={data.sinStock}
          total={total}
        />
      </div>
    </div>
  );
}

function LegendRow({
  color,
  label,
  value,
  total,
}: {
  color: string;
  label: string;
  value: number;
  total: number;
}) {
  const pct = total > 0 ? Math.round((value / total) * 100) : 0;
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-xs">
        <div className="flex items-center gap-2 min-w-0">
          <span
            className="h-2.5 w-2.5 rounded-full shrink-0"
            style={{ backgroundColor: color }}
          />
          <span className="text-muted-foreground truncate">{label}</span>
        </div>
        <span className="font-semibold tabular-nums">
          {value} <span className="text-muted-foreground font-normal">({pct}%)</span>
        </span>
      </div>
      <div className="h-1 rounded-full bg-muted overflow-hidden">
        <div
          className="h-full rounded-full transition-all"
          style={{ width: `${pct}%`, backgroundColor: color }}
        />
      </div>
    </div>
  );
}
