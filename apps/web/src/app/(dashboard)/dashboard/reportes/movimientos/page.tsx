'use client';

import { ArrowLeft, BarChart3 } from 'lucide-react';
import Link from 'next/link';
import { useMemo, useState } from 'react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

import { PageHeader } from '@/components/layout/page-header';
import {
  DateRangeFilter,
  getDefaultRange,
  toIsoRange,
} from '@/components/reports/date-range-filter';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { useMovementsSummary } from '@/hooks/use-reports';
import { useWarehouses } from '@/hooks/use-warehouses';

type GroupBy = 'day' | 'week' | 'month';

export default function MovimientosReportPage() {
  const [range, setRange] = useState(getDefaultRange());
  const [groupBy, setGroupBy] = useState<GroupBy>('day');
  const [warehouseId, setWarehouseId] = useState<string>('ALL');

  const iso = useMemo(() => toIsoRange(range.from, range.to), [range]);
  const { data: warehouses } = useWarehouses({ pageSize: 100 });
  const { data, isLoading } = useMovementsSummary({
    ...iso,
    groupBy,
    warehouseId: warehouseId === 'ALL' ? undefined : warehouseId,
  });

  const series = data?.series ?? [];

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
          title="Movimientos agregados"
          description="Evolución de entradas, salidas y ajustes en el tiempo. Agrupable por día, semana o mes."
          icon={BarChart3}
        />
      </div>

      <div className="flex flex-wrap gap-3">
        <DateRangeFilter from={range.from} to={range.to} onChange={setRange} />
        <div className="space-y-1.5 min-w-[150px]">
          <Label>Agrupar por</Label>
          <Select value={groupBy} onValueChange={(v) => setGroupBy(v as GroupBy)}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="day">Día</SelectItem>
              <SelectItem value="week">Semana</SelectItem>
              <SelectItem value="month">Mes</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5 min-w-[220px]">
          <Label>Almacén</Label>
          <Select value={warehouseId} onValueChange={setWarehouseId}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">Todos</SelectItem>
              {warehouses?.items.map((w) => (
                <SelectItem key={w.id} value={w.id}>
                  {w.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <div className="rounded-lg border bg-card p-4">
          <p className="text-xs text-muted-foreground">Entradas</p>
          <p className="text-2xl font-bold mt-1 text-green-600 dark:text-green-400">
            {data?.totals.entradas ?? 0}
          </p>
        </div>
        <div className="rounded-lg border bg-card p-4">
          <p className="text-xs text-muted-foreground">Salidas</p>
          <p className="text-2xl font-bold mt-1 text-red-600 dark:text-red-400">
            {data?.totals.salidas ?? 0}
          </p>
        </div>
        <div className="rounded-lg border bg-card p-4">
          <p className="text-xs text-muted-foreground">Ajustes</p>
          <p className="text-2xl font-bold mt-1 text-amber-600 dark:text-amber-400">
            {data?.totals.ajustes ?? 0}
          </p>
        </div>
      </div>

      {series.length > 0 && (
        <div className="rounded-lg border bg-card p-4">
          <p className="text-sm font-medium mb-3">
            Conteo de movimientos por{' '}
            {groupBy === 'day' ? 'día' : groupBy === 'week' ? 'semana' : 'mes'}
          </p>
          <ResponsiveContainer width="100%" height={320}>
            <BarChart data={series} margin={{ top: 5, right: 10, bottom: 5, left: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey="bucket" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip
                contentStyle={{
                  borderRadius: 8,
                  border: '1px solid hsl(var(--border))',
                  background: 'hsl(var(--card))',
                }}
              />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Bar
                dataKey="entradas"
                fill="hsl(142, 72%, 45%)"
                stackId="a"
                radius={[0, 0, 0, 0]}
              />
              <Bar
                dataKey="salidas"
                fill="hsl(0, 72%, 50%)"
                stackId="a"
                radius={[0, 0, 0, 0]}
              />
              <Bar
                dataKey="ajustes"
                fill="hsl(38, 92%, 50%)"
                stackId="a"
                radius={[4, 4, 0, 0]}
              />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      <div className="rounded-lg border bg-card overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Período</TableHead>
              <TableHead className="text-right">Entradas</TableHead>
              <TableHead className="text-right">Salidas</TableHead>
              <TableHead className="text-right">Ajustes</TableHead>
              <TableHead className="text-right">Cant. ent.</TableHead>
              <TableHead className="text-right">Cant. sal.</TableHead>
              <TableHead className="text-right">Cant. aj.</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading && (
              <TableRow>
                <TableCell
                  colSpan={7}
                  className="text-center text-sm text-muted-foreground py-8"
                >
                  Cargando...
                </TableCell>
              </TableRow>
            )}
            {!isLoading && series.length === 0 && (
              <TableRow>
                <TableCell colSpan={7}>
                  <EmptyState
                    icon={BarChart3}
                    title="Sin movimientos"
                    description="Ajustá el rango de fechas o el almacén."
                  />
                </TableCell>
              </TableRow>
            )}
            {series.map((s) => (
              <TableRow key={s.bucket}>
                <TableCell className="font-mono text-sm">{s.bucket}</TableCell>
                <TableCell className="text-right text-sm text-green-600 dark:text-green-400 font-medium">
                  {s.entradas}
                </TableCell>
                <TableCell className="text-right text-sm text-red-600 dark:text-red-400 font-medium">
                  {s.salidas}
                </TableCell>
                <TableCell className="text-right text-sm text-amber-600 dark:text-amber-400 font-medium">
                  {s.ajustes}
                </TableCell>
                <TableCell className="text-right font-mono text-xs text-muted-foreground">
                  {s.qtyEntradas.toLocaleString('es-PE', { maximumFractionDigits: 3 })}
                </TableCell>
                <TableCell className="text-right font-mono text-xs text-muted-foreground">
                  {s.qtySalidas.toLocaleString('es-PE', { maximumFractionDigits: 3 })}
                </TableCell>
                <TableCell className="text-right font-mono text-xs text-muted-foreground">
                  {s.qtyAjustes.toLocaleString('es-PE', { maximumFractionDigits: 3 })}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
