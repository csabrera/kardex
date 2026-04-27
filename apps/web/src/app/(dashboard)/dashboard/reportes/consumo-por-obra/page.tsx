'use client';

import { ArrowLeft, Building } from 'lucide-react';
import Link from 'next/link';
import { useMemo, useState } from 'react';
import {
  Bar,
  BarChart,
  CartesianGrid,
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
import { useConsumptionByObra } from '@/hooks/use-reports';

function formatMoney(v: number) {
  return v.toLocaleString('es-PE', {
    style: 'currency',
    currency: 'PEN',
    maximumFractionDigits: 2,
  });
}

function formatQty(v: number) {
  return v.toLocaleString('es-PE', { maximumFractionDigits: 3 });
}

export default function ConsumoPorObraPage() {
  const [range, setRange] = useState(getDefaultRange());
  const iso = useMemo(() => toIsoRange(range.from, range.to), [range]);
  const { data, isLoading } = useConsumptionByObra(iso);

  const rows = data?.items ?? [];
  const totals = rows.reduce(
    (acc, r) => ({
      qty: acc.qty + r.totalQuantity,
      value: acc.value + r.totalValue,
      count: acc.count + r.movementsCount,
    }),
    { qty: 0, value: 0, count: 0 },
  );

  const chartData = rows.slice(0, 10).map((r) => ({
    name: r.name.length > 18 ? r.name.slice(0, 18) + '…' : r.name,
    cantidad: r.totalQuantity,
    valor: r.totalValue,
  }));

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
          title="Consumo por obra"
          description="Suma de salidas (cantidad y valor) en los almacenes de cada obra durante el período seleccionado."
          icon={Building}
        />
      </div>

      <DateRangeFilter from={range.from} to={range.to} onChange={setRange} />

      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        <div className="rounded-lg border bg-card p-4">
          <p className="text-xs text-muted-foreground">Obras con consumo</p>
          <p className="text-2xl font-bold mt-1">{rows.length}</p>
        </div>
        <div className="rounded-lg border bg-card p-4">
          <p className="text-xs text-muted-foreground">Cantidad total movida</p>
          <p className="text-2xl font-bold mt-1">{formatQty(totals.qty)}</p>
        </div>
        <div className="rounded-lg border bg-card p-4 col-span-2 md:col-span-1">
          <p className="text-xs text-muted-foreground">Valor total</p>
          <p className="text-2xl font-bold mt-1">{formatMoney(totals.value)}</p>
        </div>
      </div>

      {rows.length > 0 && (
        <div className="rounded-lg border bg-card p-4">
          <p className="text-sm font-medium mb-3">Top 10 obras por cantidad</p>
          <ResponsiveContainer width="100%" height={280}>
            <BarChart
              data={chartData}
              margin={{ top: 5, right: 10, bottom: 40, left: 0 }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis
                dataKey="name"
                tick={{ fontSize: 11 }}
                angle={-20}
                textAnchor="end"
                height={60}
              />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip
                contentStyle={{
                  borderRadius: 8,
                  border: '1px solid hsl(var(--border))',
                  background: 'hsl(var(--card))',
                }}
                formatter={(value, name) => {
                  const num = Number(value ?? 0);
                  return name === 'valor' ? formatMoney(num) : formatQty(num);
                }}
              />
              <Bar dataKey="cantidad" fill="hsl(var(--accent))" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      <div className="rounded-lg border bg-card overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Obra</TableHead>
              <TableHead className="w-[110px]">Estado</TableHead>
              <TableHead className="w-[130px] text-right">Movimientos</TableHead>
              <TableHead className="w-[140px] text-right">Cantidad</TableHead>
              <TableHead className="w-[150px] text-right">Valor</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading && (
              <TableRow>
                <TableCell
                  colSpan={5}
                  className="text-center text-sm text-muted-foreground py-8"
                >
                  Cargando...
                </TableCell>
              </TableRow>
            )}
            {!isLoading && rows.length === 0 && (
              <TableRow>
                <TableCell colSpan={5}>
                  <EmptyState
                    icon={Building}
                    title="Sin consumo en el período"
                    description="No hubo salidas registradas en almacenes de obras durante las fechas elegidas."
                  />
                </TableCell>
              </TableRow>
            )}
            {rows.map((r, idx) => (
              <TableRow key={r.obraId}>
                <TableCell>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground font-mono w-6">
                      {idx + 1}
                    </span>
                    <div>
                      <p className="text-sm font-medium">{r.name}</p>
                      <p className="text-xs text-muted-foreground font-mono">{r.code}</p>
                    </div>
                  </div>
                </TableCell>
                <TableCell>
                  <Badge
                    variant={r.status === 'ACTIVA' ? 'success' : 'secondary'}
                    className="text-xs"
                  >
                    {r.status}
                  </Badge>
                </TableCell>
                <TableCell className="text-right text-sm">{r.movementsCount}</TableCell>
                <TableCell className="text-right font-mono text-sm">
                  {formatQty(r.totalQuantity)}
                </TableCell>
                <TableCell className="text-right font-mono text-sm font-semibold">
                  {formatMoney(r.totalValue)}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
