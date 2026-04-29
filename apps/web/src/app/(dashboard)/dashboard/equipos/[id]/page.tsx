'use client';

import {
  ArrowLeft,
  Building,
  Calendar,
  Gauge,
  Plus,
  Settings,
  Truck,
  Wrench,
} from 'lucide-react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useMemo, useState } from 'react';
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip as RechartsTooltip,
  XAxis,
  YAxis,
} from 'recharts';

import { MaintenancePanel } from '@/components/maintenance/maintenance-panel';
import { NewMaintenanceDialog } from '@/components/maintenance/new-maintenance-dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  COUNT_TYPE_LABELS,
  EQUIPMENT_STATUS_LABELS,
  EQUIPMENT_TYPE_LABELS,
  useEquipment,
  useEquipmentReadings,
  type EquipmentStatus,
} from '@/hooks/use-equipment';
import { useMaintenances } from '@/hooks/use-maintenance';
import { cn } from '@/lib/cn';

const STATUS_CLASSES: Record<EquipmentStatus, { bg: string; ring: string; fg: string }> =
  {
    OPERATIVO: {
      bg: 'bg-green-500/10',
      ring: 'ring-green-500/20',
      fg: 'text-green-600 dark:text-green-400',
    },
    EN_MANTENIMIENTO: {
      bg: 'bg-amber-500/10',
      ring: 'ring-amber-500/20',
      fg: 'text-amber-600 dark:text-amber-400',
    },
    AVERIADO: {
      bg: 'bg-red-500/10',
      ring: 'ring-red-500/20',
      fg: 'text-red-600 dark:text-red-400',
    },
    BAJA: {
      bg: 'bg-muted',
      ring: 'ring-border',
      fg: 'text-muted-foreground',
    },
  };

export default function EquipmentDetailPage() {
  const params = useParams();
  const id = params.id as string;

  const { data: equipment, isLoading } = useEquipment(id);
  const { data: readings = [] } = useEquipmentReadings(id);
  // Solo cargamos el count para el KPI (el listado lo cubre el Panel en su tab).
  const { data: maintenancePage } = useMaintenances({
    equipmentId: id,
    pageSize: 1,
    enabled: !!id,
  } as any);

  const [activeTab, setActiveTab] = useState<'info' | 'mantenimientos'>('info');
  const [maintenanceOpen, setMaintenanceOpen] = useState(false);

  const chartData = useMemo(
    () =>
      [...readings]
        .slice(0, 30)
        .reverse()
        .map((r) => ({
          date: new Date(r.recordedAt).toLocaleDateString('es-PE', {
            day: '2-digit',
            month: 'short',
          }),
          value: Number(r.countValue),
          source: r.source,
        })),
    [readings],
  );

  if (isLoading)
    return <div className="text-sm text-muted-foreground">Cargando equipo...</div>;
  if (!equipment)
    return <div className="text-sm text-destructive">Equipo no encontrado</div>;

  const statusClasses = STATUS_CLASSES[equipment.status];
  const unit =
    equipment.countType === 'HOROMETRO'
      ? 'h'
      : equipment.countType === 'KILOMETRAJE'
        ? 'km'
        : '';

  return (
    <div className="space-y-6">
      <div>
        <Link href="/dashboard/equipos">
          <Button
            variant="ghost"
            size="sm"
            className="gap-1.5 text-muted-foreground h-7 -ml-2"
          >
            <ArrowLeft className="h-3.5 w-3.5" /> Volver a Equipos
          </Button>
        </Link>
      </div>

      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div className="flex items-start gap-4 min-w-0">
          <div
            className={cn(
              'flex h-12 w-12 shrink-0 items-center justify-center rounded-xl ring-1',
              statusClasses.bg,
              statusClasses.ring,
            )}
          >
            <Truck className={cn('h-6 w-6', statusClasses.fg)} />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-2xl font-bold tracking-tight leading-tight">
                {equipment.name}
              </h1>
              <Badge variant="outline" className="font-mono text-xs">
                {equipment.code}
              </Badge>
              <Badge
                variant={
                  equipment.status === 'OPERATIVO'
                    ? 'success'
                    : equipment.status === 'EN_MANTENIMIENTO'
                      ? 'warning'
                      : equipment.status === 'AVERIADO'
                        ? 'destructive'
                        : 'secondary'
                }
              >
                {EQUIPMENT_STATUS_LABELS[equipment.status]}
              </Badge>
            </div>
            <p className="text-sm text-muted-foreground mt-1">
              {EQUIPMENT_TYPE_LABELS[equipment.type]}
              {equipment.brand && ` · ${equipment.brand}`}
              {equipment.model && ` ${equipment.model}`}
              {equipment.year && ` · ${equipment.year}`}
            </p>
            {equipment.obra && (
              <p className="text-sm text-muted-foreground mt-1 flex items-center gap-1.5">
                <Building className="h-3.5 w-3.5" />
                <Link
                  href={`/dashboard/obras/${equipment.obra.id}`}
                  className="hover:text-accent"
                >
                  {equipment.obra.name}
                </Link>
              </p>
            )}
          </div>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard
          label="Contador actual"
          value={
            equipment.countType === 'NONE'
              ? '—'
              : `${Number(equipment.currentCount).toLocaleString('es-PE', { maximumFractionDigits: 1 })} ${unit}`
          }
          icon={Gauge}
        />
        <KpiCard
          label="Contador inicial"
          value={
            equipment.countType === 'NONE'
              ? '—'
              : `${Number(equipment.initialCount).toLocaleString('es-PE')} ${unit}`
          }
          icon={Calendar}
        />
        <KpiCard
          label="Mantenimientos"
          value={maintenancePage?.total ?? 0}
          icon={Wrench}
        />
      </div>

      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as typeof activeTab)}>
        <TabsList>
          <TabsTrigger value="info" icon={Settings}>
            Información
          </TabsTrigger>
          <TabsTrigger
            value="mantenimientos"
            icon={Wrench}
            badge={maintenancePage?.total ?? 0}
          >
            Mantenimientos
          </TabsTrigger>
        </TabsList>

        <TabsContent value="info" className="mt-5 space-y-6">
          {/* Info general */}
          <section className="rounded-xl border bg-card p-5 shadow-sm">
            <header className="flex items-center gap-3 mb-4">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-muted text-muted-foreground ring-1 ring-border">
                <Settings className="h-4 w-4" />
              </div>
              <div>
                <h2 className="text-sm font-semibold leading-tight">Información</h2>
                <p className="text-xs text-muted-foreground mt-0.5">Datos del equipo</p>
              </div>
            </header>
            <dl className="grid grid-cols-2 md:grid-cols-3 gap-x-6 gap-y-4 text-sm">
              <div>
                <dt className="text-[10px] uppercase tracking-wider text-muted-foreground/70 font-semibold mb-1">
                  Tipo de contador
                </dt>
                <dd>{COUNT_TYPE_LABELS[equipment.countType]}</dd>
              </div>
              <div>
                <dt className="text-[10px] uppercase tracking-wider text-muted-foreground/70 font-semibold mb-1">
                  N° de serie
                </dt>
                <dd className="font-mono text-xs">
                  {equipment.serialNumber ?? (
                    <span className="text-muted-foreground">—</span>
                  )}
                </dd>
              </div>
              <div>
                <dt className="text-[10px] uppercase tracking-wider text-muted-foreground/70 font-semibold mb-1">
                  Fecha adquisición
                </dt>
                <dd>
                  {equipment.acquisitionDate ? (
                    new Date(equipment.acquisitionDate).toLocaleDateString('es-PE', {
                      day: '2-digit',
                      month: 'short',
                      year: 'numeric',
                    })
                  ) : (
                    <span className="text-muted-foreground">—</span>
                  )}
                </dd>
              </div>
              <div>
                <dt className="text-[10px] uppercase tracking-wider text-muted-foreground/70 font-semibold mb-1">
                  Costo adquisición
                </dt>
                <dd>
                  {equipment.acquisitionCost ? (
                    `S/. ${Number(equipment.acquisitionCost).toLocaleString('es-PE')}`
                  ) : (
                    <span className="text-muted-foreground">—</span>
                  )}
                </dd>
              </div>
              <div>
                <dt className="text-[10px] uppercase tracking-wider text-muted-foreground/70 font-semibold mb-1">
                  Registrado
                </dt>
                <dd>
                  {new Date(equipment.createdAt).toLocaleDateString('es-PE', {
                    day: '2-digit',
                    month: 'short',
                    year: 'numeric',
                  })}
                </dd>
              </div>
              {equipment.notes && (
                <div className="col-span-full">
                  <dt className="text-[10px] uppercase tracking-wider text-muted-foreground/70 font-semibold mb-1">
                    Notas
                  </dt>
                  <dd className="text-muted-foreground">{equipment.notes}</dd>
                </div>
              )}
            </dl>
          </section>

          {/* Gráfica de contador */}
          {equipment.countType !== 'NONE' && (
            <section className="rounded-xl border bg-card p-5 shadow-sm">
              <header className="flex items-center gap-3 mb-4">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-accent/10 text-accent ring-1 ring-accent/20">
                  <Gauge className="h-4 w-4" />
                </div>
                <div>
                  <h2 className="text-sm font-semibold leading-tight">
                    Evolución del contador
                  </h2>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Últimas {chartData.length} lectura{chartData.length !== 1 ? 's' : ''}
                  </p>
                </div>
              </header>
              {chartData.length === 0 ? (
                <div className="h-56 flex items-center justify-center text-xs text-muted-foreground">
                  Sin lecturas todavía.
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
                        width={50}
                      />
                      <RechartsTooltip
                        contentStyle={{
                          backgroundColor: 'hsl(var(--popover))',
                          border: '1px solid hsl(var(--border))',
                          borderRadius: 8,
                          fontSize: 12,
                        }}
                        formatter={(val) => [`${Number(val)} ${unit}`, 'Contador']}
                      />
                      <Line
                        type="monotone"
                        dataKey="value"
                        stroke="hsl(var(--accent))"
                        strokeWidth={2}
                        dot={{ fill: 'hsl(var(--accent))', r: 3 }}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              )}
            </section>
          )}
        </TabsContent>

        <TabsContent value="mantenimientos" className="mt-5">
          <MaintenancePanel
            equipmentId={id}
            headerAction={
              <Button onClick={() => setMaintenanceOpen(true)} className="gap-2">
                <Plus className="h-4 w-4" /> Nuevo mantenimiento
              </Button>
            }
          />
        </TabsContent>
      </Tabs>

      <NewMaintenanceDialog
        open={maintenanceOpen}
        onClose={() => setMaintenanceOpen(false)}
      />
    </div>
  );
}

function KpiCard({
  label,
  value,
  icon: Icon,
}: {
  label: string;
  value: string | number;
  icon: React.ElementType;
}) {
  return (
    <div className="rounded-xl border bg-card p-5 shadow-sm">
      <div className="flex items-center justify-between gap-2">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/80">
          {label}
        </p>
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-muted text-muted-foreground ring-1 ring-border">
          <Icon className="h-4 w-4" />
        </div>
      </div>
      <p className="text-[1.75rem] font-bold tracking-tight leading-none tabular-nums mt-3">
        {value}
      </p>
    </div>
  );
}
