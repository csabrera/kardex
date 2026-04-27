'use client';

import { ArrowLeft, TrendingUp } from 'lucide-react';
import Link from 'next/link';
import { useMemo, useState } from 'react';

import { PageHeader } from '@/components/layout/page-header';
import {
  DateRangeFilter,
  getDefaultRange,
  toIsoRange,
} from '@/components/reports/date-range-filter';
import { Badge } from '@/components/ui/badge';
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
import { useTopItems } from '@/hooks/use-reports';
import { useWarehouses } from '@/hooks/use-warehouses';

type MovType = 'ALL' | 'ENTRADA' | 'SALIDA' | 'AJUSTE';

export default function TopItemsPage() {
  const [range, setRange] = useState(getDefaultRange());
  const [type, setType] = useState<MovType>('SALIDA');
  const [warehouseId, setWarehouseId] = useState<string>('ALL');
  const [limit, setLimit] = useState(20);

  const iso = useMemo(() => toIsoRange(range.from, range.to), [range]);
  const { data: warehouses } = useWarehouses({ pageSize: 100 });

  const { data, isLoading } = useTopItems({
    ...iso,
    type: type === 'ALL' ? undefined : type,
    warehouseId: warehouseId === 'ALL' ? undefined : warehouseId,
    limit,
  });

  const rows = data?.items ?? [];

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
          title="Top ítems"
          description="Ranking de ítems más movidos en el período. Filtrable por tipo de movimiento y almacén."
          icon={TrendingUp}
        />
      </div>

      <div className="flex flex-wrap gap-3">
        <DateRangeFilter from={range.from} to={range.to} onChange={setRange} />
        <div className="space-y-1.5 min-w-[160px]">
          <Label>Tipo</Label>
          <Select value={type} onValueChange={(v) => setType(v as MovType)}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">Todos</SelectItem>
              <SelectItem value="ENTRADA">Entradas</SelectItem>
              <SelectItem value="SALIDA">Salidas</SelectItem>
              <SelectItem value="AJUSTE">Ajustes</SelectItem>
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
        <div className="space-y-1.5 min-w-[110px]">
          <Label>Límite</Label>
          <Select value={String(limit)} onValueChange={(v) => setLimit(Number(v))}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {[10, 20, 50, 100].map((n) => (
                <SelectItem key={n} value={String(n)}>
                  {n}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="rounded-lg border bg-card overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[60px]">#</TableHead>
              <TableHead className="w-[110px]">Código</TableHead>
              <TableHead>Ítem</TableHead>
              <TableHead className="w-[120px]">Tipo</TableHead>
              <TableHead className="w-[140px] text-right">Movimientos</TableHead>
              <TableHead className="w-[160px] text-right">Cantidad total</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading && (
              <TableRow>
                <TableCell
                  colSpan={6}
                  className="text-center text-sm text-muted-foreground py-8"
                >
                  Cargando...
                </TableCell>
              </TableRow>
            )}
            {!isLoading && rows.length === 0 && (
              <TableRow>
                <TableCell colSpan={6}>
                  <EmptyState
                    icon={TrendingUp}
                    title="Sin movimientos en el período"
                    description="Ajustá las fechas o cambiá los filtros."
                  />
                </TableCell>
              </TableRow>
            )}
            {rows.map((r, idx) => (
              <TableRow key={r.itemId}>
                <TableCell className="font-mono text-xs text-muted-foreground">
                  {idx + 1}
                </TableCell>
                <TableCell className="font-mono text-xs">{r.code}</TableCell>
                <TableCell className="text-sm font-medium">{r.name}</TableCell>
                <TableCell>
                  <Badge variant="outline" className="text-xs">
                    {r.type}
                  </Badge>
                </TableCell>
                <TableCell className="text-right text-sm">{r.movementsCount}</TableCell>
                <TableCell className="text-right font-mono text-sm font-semibold">
                  {r.totalQuantity.toLocaleString('es-PE', { maximumFractionDigits: 3 })}{' '}
                  <span className="text-xs text-muted-foreground">{r.unit}</span>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
