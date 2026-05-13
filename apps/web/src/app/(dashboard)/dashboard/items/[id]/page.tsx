'use client';

import {
  ArrowDownCircle,
  ArrowLeft,
  ArrowRight,
  ArrowUpCircle,
  Box,
  ChevronDown,
  Edit2,
  Eye,
  Package,
  Paperclip,
  ShoppingCart,
  SlidersHorizontal,
  Star,
  TrendingUp,
  Warehouse as WarehouseIcon,
  Wrench,
} from 'lucide-react';
import Link from 'next/link';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

import { EppPanel } from '@/components/epp/epp-panel';
import { QuickAdjustDialog } from '@/components/items/quick-adjust-dialog';
import { QuickEntryDialog } from '@/components/items/quick-entry-dialog';
import { QuickOutgoingDialog } from '@/components/items/quick-outgoing-dialog';
import { MovementDetail, SOURCE_LABELS } from '@/components/movements/movement-detail';
import { ToolLoansPanel } from '@/components/tool-loans/tool-loans-panel';
import { NewTransferDialog } from '@/components/transfers/new-transfer-dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useItem } from '@/hooks/use-items';
import {
  useKardex,
  useMovement,
  type MovementSource,
  type MovementType,
} from '@/hooks/use-movements';

const TYPE_BADGE: Record<MovementType, { label: string; variant: string }> = {
  ENTRADA: { label: 'Entrada', variant: 'success' },
  SALIDA: { label: 'Salida', variant: 'destructive' },
  AJUSTE: { label: 'Ajuste', variant: 'warning' },
};

const TABS_BASE = ['resumen', 'kardex', 'compras'] as const;
type TabKey = (typeof TABS_BASE)[number] | 'prestamos' | 'asignaciones';

export default function ItemDetailPage() {
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const id = params.id as string;

  const { data: item, isLoading } = useItem(id);
  const { data: kardex = [], isLoading: kardexLoading } = useKardex(id);

  const initialTab = (searchParams.get('tab') as TabKey | null) ?? 'resumen';
  const [tab, setTab] = useState<TabKey>(initialTab);

  // Sincroniza tab con la URL (sin scroll) — permite compartir link a un tab específico.
  useEffect(() => {
    const sp = new URLSearchParams(Array.from(searchParams.entries()));
    if (tab === 'resumen') sp.delete('tab');
    else sp.set('tab', tab);
    const qs = sp.toString();
    router.replace(qs ? `?${qs}` : window.location.pathname, { scroll: false });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab]);

  const [typeFilter, setTypeFilter] = useState<MovementType | '_all'>('_all');
  const [sourceFilter, setSourceFilter] = useState<MovementSource | '_all'>('_all');
  const [warehouseFilter, setWarehouseFilter] = useState<string>('_all');

  const [showEntry, setShowEntry] = useState(false);
  const [showOutgoing, setShowOutgoing] = useState(false);
  const [showTransfer, setShowTransfer] = useState(false);
  const [showAdjust, setShowAdjust] = useState(false);
  const [detailMovementId, setDetailMovementId] = useState<string | null>(null);
  const { data: movementDetail } = useMovement(detailMovementId ?? '');

  const principalStockEntry = useMemo(
    () => item?.stocks?.find((s) => s.warehouse.type === 'CENTRAL'),
    [item],
  );
  const principalStock = Number(principalStockEntry?.quantity ?? 0);

  // Solo almacenes con stock real. Al crear un ítem el sistema crea filas Stock(qty=0)
  // en todos los almacenes — esas filas son ruido visual aquí.
  const stocksByWarehouse = useMemo(() => {
    if (!item?.stocks) return [];
    return [...item.stocks]
      .filter((s) => Number(s.quantity) > 0)
      .sort((a, b) => {
        if (a.warehouse.type === 'CENTRAL') return -1;
        if (b.warehouse.type === 'CENTRAL') return 1;
        return a.warehouse.name.localeCompare(b.warehouse.name);
      });
  }, [item]);

  const totalStock = useMemo(
    () => (item?.stocks ?? []).reduce((acc, s) => acc + Number(s.quantity), 0),
    [item],
  );

  // Breakdown por tipo para el KPI Distribución.
  const obraStocks = useMemo(
    () => (item?.stocks ?? []).filter((s) => s.warehouse.type === 'OBRA'),
    [item],
  );
  const obrasWithStock = useMemo(
    () => obraStocks.filter((s) => Number(s.quantity) > 0),
    [obraStocks],
  );
  const totalInObras = useMemo(
    () => obraStocks.reduce((acc, s) => acc + Number(s.quantity), 0),
    [obraStocks],
  );

  const totalLoaned = useMemo(
    () => (item?.stocks ?? []).reduce((acc, s) => acc + Number(s.loanedQty ?? 0), 0),
    [item],
  );
  const totalDamagedReturned = useMemo(
    () =>
      (item?.stocks ?? []).reduce((acc, s) => acc + Number(s.damagedReturnedQty ?? 0), 0),
    [item],
  );
  const isLoanItem = item?.type === 'PRESTAMO';
  const isEppItem = item?.type === 'ASIGNACION';

  // Almacenes únicos presentes en el kardex — alimenta el filtro de almacén.
  const warehousesInKardex = useMemo(() => {
    const map = new Map<string, { id: string; code: string; name: string }>();
    for (const k of kardex) {
      map.set(k.movement.warehouse.id, k.movement.warehouse);
    }
    return Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name));
  }, [kardex]);

  // Motivos únicos presentes en el kardex — alimenta el filtro de motivo.
  const sourcesInKardex = useMemo(() => {
    const set = new Set<MovementSource>();
    for (const k of kardex) set.add(k.movement.source);
    return Array.from(set);
  }, [kardex]);

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
    return kardex.filter((k) => {
      if (typeFilter !== '_all' && k.movement.type !== typeFilter) return false;
      if (sourceFilter !== '_all' && k.movement.source !== sourceFilter) return false;
      if (warehouseFilter !== '_all' && k.movement.warehouse.id !== warehouseFilter)
        return false;
      return true;
    });
  }, [kardex, typeFilter, sourceFilter, warehouseFilter]);

  const purchases = useMemo(
    () => kardex.filter((k) => k.movement.source === 'COMPRA'),
    [kardex],
  );

  const min = Number(item?.minStock ?? 0);
  const max = item?.maxStock != null ? Number(item.maxStock) : null;

  const itemWithPrincipalStock = item ? { ...item, principalStock } : null;

  if (isLoading)
    return <div className="text-sm text-muted-foreground">Cargando ítem...</div>;
  if (!item) return <div className="text-sm text-destructive">Ítem no encontrado</div>;

  const minMaxHint = `Mín: ${min || '—'}${max != null ? ` · Máx: ${max}` : ''} ${item.unit.abbreviation}`;

  return (
    <div className="space-y-6">
      {/* Breadcrumb */}
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

      {/* Header: identidad del ítem + acción primaria + dropdown */}
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
              <Badge variant="outline" className="text-xs">
                {item.type}
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {item.category.name} · {item.unit.name} ({item.unit.abbreviation})
            </p>
            {item.description && (
              <p className="text-sm text-muted-foreground mt-1.5 max-w-xl">
                {item.description}
              </p>
            )}
          </div>
        </div>

        <div className="flex gap-2 shrink-0">
          <Button
            className="gap-1.5"
            onClick={() => setShowTransfer(true)}
            disabled={!item.active || principalStock === 0}
          >
            <ArrowRight className="h-4 w-4" /> Transferir
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" className="gap-1.5">
                Acciones <ChevronDown className="h-3.5 w-3.5 opacity-70" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuLabel>Operaciones</DropdownMenuLabel>
              <DropdownMenuItem
                onSelect={() => setShowEntry(true)}
                disabled={!item.active}
              >
                <ArrowDownCircle className="text-green-600 dark:text-green-500" />
                Registrar entrada
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuLabel>Avanzado</DropdownMenuLabel>
              <DropdownMenuItem
                onSelect={() => setShowAdjust(true)}
                disabled={!item.active}
              >
                <SlidersHorizontal className="text-amber-600 dark:text-amber-500" />
                Ajustar stock
              </DropdownMenuItem>
              <DropdownMenuItem
                onSelect={() => setShowOutgoing(true)}
                disabled={!item.active || principalStock === 0}
              >
                <ArrowUpCircle className="text-red-600 dark:text-red-500" />
                Salida directa
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onSelect={() =>
                  router.push(`/dashboard/almacen-principal?edit=${item.id}`)
                }
              >
                <Edit2 />
                Editar ítem
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Stat strip horizontal compacto (Opción A) — en lugar de 2-4 cards grandes */}
      <div className="rounded-xl border bg-card px-5 py-3">
        <div className="flex flex-wrap items-center gap-x-8 gap-y-3">
          <StatInline
            icon={Package}
            label="Distribución"
            value={`${principalStock.toLocaleString('es-PE', { maximumFractionDigits: 3 })} / ${totalStock.toLocaleString('es-PE', { maximumFractionDigits: 3 })}`}
            unit={item.unit.abbreviation}
            tone={totalStock === 0 ? 'destructive' : 'default'}
            sub={(() => {
              if (totalStock === 0) return `Sin stock · ${minMaxHint}`;
              const obraCount = obrasWithStock.length;
              const parts = [`${principalStock.toLocaleString('es-PE')} en Principal`];
              if (totalInObras > 0) {
                parts.push(
                  `${totalInObras.toLocaleString('es-PE')} en ${obraCount} ${
                    obraCount === 1 ? 'obra' : 'obras'
                  }`,
                );
              }
              return parts.join(' · ');
            })()}
          />
          <StatInline
            icon={ShoppingCart}
            label="Compras"
            value={purchases.length.toString()}
            tone={purchases.length > 0 ? 'info' : 'default'}
            sub={(() => {
              const last = purchases[purchases.length - 1];
              if (!last) return 'Sin registros';
              return `Última: ${new Date(last.movement.createdAt).toLocaleDateString('es-PE')}`;
            })()}
          />
          {isLoanItem && (
            <>
              <StatInline
                icon={Wrench}
                label="Prestados"
                value={totalLoaned.toLocaleString('es-PE', { maximumFractionDigits: 3 })}
                unit={item.unit.abbreviation}
                tone={totalLoaned > 0 ? 'info' : 'default'}
                sub="En préstamo activo"
              />
              <StatInline
                icon={TrendingUp}
                label="Devueltos dañados"
                value={totalDamagedReturned.toLocaleString('es-PE', {
                  maximumFractionDigits: 3,
                })}
                unit={item.unit.abbreviation}
                tone={totalDamagedReturned > 0 ? 'destructive' : 'default'}
                sub="No utilizables"
              />
            </>
          )}
        </div>
      </div>

      {/* Tabs */}
      <Tabs value={tab} onValueChange={(v) => setTab(v as TabKey)}>
        <TabsList>
          <TabsTrigger value="resumen">Resumen</TabsTrigger>
          <TabsTrigger value="kardex">Kardex</TabsTrigger>
          <TabsTrigger value="compras">
            Compras{' '}
            {purchases.length > 0 && (
              <Badge variant="secondary" className="ml-1.5 tabular-nums">
                {purchases.length}
              </Badge>
            )}
          </TabsTrigger>
          {isLoanItem && <TabsTrigger value="prestamos">Préstamos</TabsTrigger>}
          {isEppItem && <TabsTrigger value="asignaciones">Asignaciones</TabsTrigger>}
        </TabsList>

        {/* ────────── Tab: Resumen (default) ────────── */}
        <TabsContent value="resumen" className="mt-4 space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
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

            <section className="lg:col-span-2 rounded-xl border bg-card p-5">
              <header className="mb-3">
                <h2 className="text-sm font-semibold">
                  Evolución del stock en el Principal
                </h2>
                <p className="text-xs text-muted-foreground">
                  Últimos {chartData.length} movimientos registrados
                </p>
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
        </TabsContent>

        {/* ────────── Tab: Kardex ────────── */}
        <TabsContent value="kardex" className="mt-4">
          <section className="rounded-xl border bg-card">
            <header className="flex flex-wrap items-center justify-between gap-2 p-5 border-b">
              <div>
                <h2 className="text-sm font-semibold">Kardex del ítem</h2>
                <p className="text-xs text-muted-foreground">
                  Todos los movimientos que afectan a este ítem · {filteredKardex.length}{' '}
                  de {kardex.length}
                </p>
              </div>
              <div className="flex gap-2 flex-wrap">
                <Select
                  value={typeFilter}
                  onValueChange={(v) => setTypeFilter(v as MovementType | '_all')}
                >
                  <SelectTrigger className="w-36 h-9">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="_all">Todos los tipos</SelectItem>
                    <SelectItem value="ENTRADA">Entradas</SelectItem>
                    <SelectItem value="SALIDA">Salidas</SelectItem>
                    <SelectItem value="AJUSTE">Ajustes</SelectItem>
                  </SelectContent>
                </Select>
                <Select
                  value={sourceFilter}
                  onValueChange={(v) => setSourceFilter(v as MovementSource | '_all')}
                >
                  <SelectTrigger className="w-40 h-9">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="_all">Todos los motivos</SelectItem>
                    {sourcesInKardex.map((s) => (
                      <SelectItem key={s} value={s}>
                        {SOURCE_LABELS[s] ?? s}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {warehousesInKardex.length > 1 && (
                  <Select value={warehouseFilter} onValueChange={setWarehouseFilter}>
                    <SelectTrigger className="w-44 h-9">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="_all">Todos los almacenes</SelectItem>
                      {warehousesInKardex.map((w) => (
                        <SelectItem key={w.id} value={w.id}>
                          {w.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              </div>
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
                      <th className="text-left px-4 py-2.5 font-medium">Motivo</th>
                      <th className="text-left px-4 py-2.5 font-medium">Almacén</th>
                      <th className="text-right px-4 py-2.5 font-medium">Cantidad</th>
                      <th className="text-right px-4 py-2.5 font-medium">
                        Stock después
                      </th>
                      <th className="text-center px-4 py-2.5 font-medium">📎</th>
                      <th className="text-right px-4 py-2.5 font-medium">Acción</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[...filteredKardex].reverse().map((k) => {
                      const badge = TYPE_BADGE[k.movement.type];
                      const attCount = k.movement.attachmentsCount;
                      return (
                        <tr
                          key={k.id}
                          className="border-t hover:bg-muted/20 cursor-pointer"
                          onClick={() => setDetailMovementId(k.movement.id)}
                        >
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
                          <td className="px-4 py-2.5 text-xs">
                            {SOURCE_LABELS[k.movement.source] ?? k.movement.source}
                          </td>
                          <td className="px-4 py-2.5 text-xs">
                            {k.movement.warehouse.name}
                          </td>
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
                          <td className="px-4 py-2.5 text-right tabular-nums font-medium">
                            {Number(k.stockAfter).toLocaleString('es-PE', {
                              maximumFractionDigits: 3,
                            })}
                          </td>
                          <td className="px-4 py-2.5 text-center">
                            {attCount > 0 ? (
                              <Badge variant="secondary" className="gap-1 tabular-nums">
                                <Paperclip className="h-3 w-3" />
                                {attCount}
                              </Badge>
                            ) : (
                              <span className="text-xs text-muted-foreground">—</span>
                            )}
                          </td>
                          <td className="px-4 py-2.5 text-right">
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-7 w-7 p-0"
                              onClick={(e) => {
                                e.stopPropagation();
                                setDetailMovementId(k.movement.id);
                              }}
                              aria-label="Ver detalle"
                            >
                              <Eye className="h-4 w-4" />
                            </Button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </TabsContent>

        {/* ────────── Tab: Compras ────────── */}
        <TabsContent value="compras" className="mt-4">
          <section className="rounded-xl border bg-card">
            <header className="p-5 border-b">
              <h2 className="text-sm font-semibold flex items-center gap-2">
                <ShoppingCart className="h-4 w-4 text-muted-foreground" />
                Historial de compras
              </h2>
              <p className="text-xs text-muted-foreground">
                Entradas con motivo COMPRA · {purchases.length}{' '}
                {purchases.length === 1 ? 'registro' : 'registros'}
              </p>
            </header>

            {purchases.length === 0 ? (
              <div className="p-12 text-center text-sm text-muted-foreground">
                Sin compras registradas para este ítem.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-muted/40 text-xs uppercase tracking-wider text-muted-foreground">
                    <tr>
                      <th className="text-left px-4 py-2.5 font-medium">Fecha</th>
                      <th className="text-left px-4 py-2.5 font-medium">Código</th>
                      <th className="text-left px-4 py-2.5 font-medium">Proveedor</th>
                      <th className="text-right px-4 py-2.5 font-medium">Cantidad</th>
                      <th className="text-right px-4 py-2.5 font-medium">Costo unit.</th>
                      <th className="text-right px-4 py-2.5 font-medium">Subtotal</th>
                      <th className="text-center px-4 py-2.5 font-medium">📎</th>
                      <th className="text-right px-4 py-2.5 font-medium">Acción</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[...purchases].reverse().map((k) => {
                      const qty = Number(k.quantity);
                      const cost = Number(k.unitCost ?? 0);
                      const subtotal = qty * cost;
                      const attCount = k.movement.attachmentsCount;
                      return (
                        <tr
                          key={k.id}
                          className="border-t hover:bg-muted/20 cursor-pointer"
                          onClick={() => setDetailMovementId(k.movement.id)}
                        >
                          <td className="px-4 py-2.5 text-xs text-muted-foreground tabular-nums">
                            {new Date(k.movement.createdAt).toLocaleString('es-PE', {
                              dateStyle: 'short',
                              timeStyle: 'short',
                            })}
                          </td>
                          <td className="px-4 py-2.5 font-mono text-xs font-medium">
                            {k.movement.code}
                          </td>
                          <td className="px-4 py-2.5 text-xs">
                            {k.movement.supplier?.name ?? '—'}
                          </td>
                          <td className="px-4 py-2.5 text-right tabular-nums">
                            {qty.toLocaleString('es-PE', { maximumFractionDigits: 3 })}
                          </td>
                          <td className="px-4 py-2.5 text-right text-muted-foreground tabular-nums">
                            {cost > 0
                              ? `S/ ${cost.toLocaleString('es-PE', { maximumFractionDigits: 2 })}`
                              : '—'}
                          </td>
                          <td className="px-4 py-2.5 text-right font-medium tabular-nums">
                            {subtotal > 0
                              ? `S/ ${subtotal.toLocaleString('es-PE', { maximumFractionDigits: 2 })}`
                              : '—'}
                          </td>
                          <td className="px-4 py-2.5 text-center">
                            {attCount > 0 ? (
                              <Badge variant="secondary" className="gap-1 tabular-nums">
                                <Paperclip className="h-3 w-3" />
                                {attCount}
                              </Badge>
                            ) : (
                              <span className="text-xs text-muted-foreground">—</span>
                            )}
                          </td>
                          <td className="px-4 py-2.5 text-right">
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-7 w-7 p-0"
                              onClick={(e) => {
                                e.stopPropagation();
                                setDetailMovementId(k.movement.id);
                              }}
                              aria-label="Ver detalle"
                            >
                              <Eye className="h-4 w-4" />
                            </Button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </TabsContent>

        {/* ────────── Tab: Préstamos (solo PRESTAMO) ────────── */}
        {isLoanItem && (
          <TabsContent value="prestamos" className="mt-4">
            <ToolLoansPanel itemId={id} hideSummary hideNewAction />
          </TabsContent>
        )}

        {/* ────────── Tab: Asignaciones (solo ASIGNACION) ────────── */}
        {isEppItem && (
          <TabsContent value="asignaciones" className="mt-4">
            <EppPanel itemId={id} hideNewAction />
          </TabsContent>
        )}
      </Tabs>

      {/* Modal de detalle de movimiento — abre desde Kardex y Compras */}
      <Dialog
        open={!!detailMovementId}
        onOpenChange={(v) => !v && setDetailMovementId(null)}
      >
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>Detalle del movimiento</DialogTitle>
          </DialogHeader>
          {movementDetail ? (
            <MovementDetail movement={movementDetail} />
          ) : (
            <div className="p-6 text-sm text-muted-foreground">Cargando...</div>
          )}
        </DialogContent>
      </Dialog>

      {/* Diálogos de acciones (entrada, salida, transferencia, ajuste) */}
      <QuickEntryDialog
        item={showEntry ? itemWithPrincipalStock : null}
        onClose={() => setShowEntry(false)}
      />
      <QuickOutgoingDialog
        item={showOutgoing ? itemWithPrincipalStock : null}
        onClose={() => setShowOutgoing(false)}
      />
      <NewTransferDialog
        open={showTransfer}
        defaultItem={showTransfer ? itemWithPrincipalStock : null}
        onClose={() => setShowTransfer(false)}
      />
      <QuickAdjustDialog
        item={showAdjust ? itemWithPrincipalStock : null}
        onClose={() => setShowAdjust(false)}
      />
    </div>
  );
}

type Tone = 'default' | 'success' | 'warning' | 'destructive' | 'info';

/**
 * KPI inline (estilo stat strip) — icono coloreado + label tiny + valor + sub-línea.
 * Mucho más denso que KpiCard. Pensado para una sola fila en el header.
 */
function StatInline({
  label,
  value,
  unit,
  icon: Icon,
  tone = 'default',
  sub,
}: {
  label: string;
  value: string;
  unit?: string;
  icon: React.ElementType;
  tone?: Tone;
  sub?: string;
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
    info: {
      bg: 'bg-blue-500/10',
      fg: 'text-blue-600 dark:text-blue-400',
      ring: 'ring-blue-500/20',
    },
  };
  const t = tones[tone];
  return (
    <div className="flex items-center gap-2.5 min-w-0">
      <div
        className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ring-1 ${t.bg} ${t.ring}`}
      >
        <Icon className={`h-4 w-4 ${t.fg}`} />
      </div>
      <div className="min-w-0">
        <p className="text-[10px] uppercase tracking-wide text-muted-foreground font-medium leading-none">
          {label}
        </p>
        <p className="text-base font-semibold tabular-nums mt-1 leading-none">
          {value}
          {unit && (
            <span className="text-xs font-normal text-muted-foreground ml-1">{unit}</span>
          )}
        </p>
        {sub && <p className="text-[10px] text-muted-foreground mt-1 truncate">{sub}</p>}
      </div>
    </div>
  );
}
