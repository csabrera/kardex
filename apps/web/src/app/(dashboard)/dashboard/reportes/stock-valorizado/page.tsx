'use client';

import { ArrowLeft, Coins } from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';

import { PageHeader } from '@/components/layout/page-header';
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
import { useStockValuation } from '@/hooks/use-reports';
import { useWarehouses } from '@/hooks/use-warehouses';

function formatMoney(v: number) {
  return v.toLocaleString('es-PE', {
    style: 'currency',
    currency: 'PEN',
    maximumFractionDigits: 2,
  });
}

export default function StockValorizadoPage() {
  const [warehouseId, setWarehouseId] = useState<string>('ALL');
  const { data: warehouses } = useWarehouses({ pageSize: 100 });
  const { data, isLoading } = useStockValuation({
    warehouseId: warehouseId === 'ALL' ? undefined : warehouseId,
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
          title="Stock valorizado"
          description="Valorización actual del inventario usando el último costo unitario conocido por ítem. Ítems sin costo registrado se listan aparte."
          icon={Coins}
        />
      </div>

      <div className="max-w-[280px] space-y-1.5">
        <Label>Almacén</Label>
        <Select value={warehouseId} onValueChange={setWarehouseId}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">Todos los almacenes</SelectItem>
            {warehouses?.items.map((w) => (
              <SelectItem key={w.id} value={w.id}>
                {w.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        <div className="rounded-lg border bg-card p-4">
          <p className="text-xs text-muted-foreground">Valor total</p>
          <p className="text-2xl font-bold mt-1">{formatMoney(data?.totalValue ?? 0)}</p>
        </div>
        <div className="rounded-lg border bg-card p-4">
          <p className="text-xs text-muted-foreground">Ítems con costo</p>
          <p className="text-2xl font-bold mt-1">{data?.itemsWithCost ?? 0}</p>
        </div>
        <div className="rounded-lg border bg-card p-4 col-span-2 md:col-span-1">
          <p className="text-xs text-muted-foreground">Ítems sin costo</p>
          <p className="text-2xl font-bold mt-1">{data?.itemsWithoutCost ?? 0}</p>
          <p className="text-xs text-muted-foreground mt-0.5">
            No se ha registrado precio en ninguna entrada
          </p>
        </div>
      </div>

      <div className="rounded-lg border bg-card overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[110px]">Código</TableHead>
              <TableHead>Ítem</TableHead>
              <TableHead>Almacén</TableHead>
              <TableHead className="w-[130px] text-right">Cantidad</TableHead>
              <TableHead className="w-[130px] text-right">Costo unit.</TableHead>
              <TableHead className="w-[150px] text-right">Valor</TableHead>
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
                    icon={Coins}
                    title="Sin stock para valorizar"
                    description="No hay ítems con stock > 0 en el almacén seleccionado."
                  />
                </TableCell>
              </TableRow>
            )}
            {rows.map((r) => (
              <TableRow key={`${r.itemId}-${r.warehouseId}`}>
                <TableCell className="font-mono text-xs">{r.code}</TableCell>
                <TableCell className="text-sm font-medium">{r.name}</TableCell>
                <TableCell className="text-xs text-muted-foreground">
                  {r.warehouseName}
                </TableCell>
                <TableCell className="text-right font-mono text-sm">
                  {r.quantity.toLocaleString('es-PE', { maximumFractionDigits: 3 })}{' '}
                  <span className="text-xs text-muted-foreground">{r.unit}</span>
                </TableCell>
                <TableCell className="text-right font-mono text-sm">
                  {r.unitCost !== null ? (
                    formatMoney(r.unitCost)
                  ) : (
                    <Badge variant="outline" className="text-xs">
                      N/D
                    </Badge>
                  )}
                </TableCell>
                <TableCell className="text-right font-mono text-sm font-semibold">
                  {r.value !== null ? formatMoney(r.value) : '—'}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
