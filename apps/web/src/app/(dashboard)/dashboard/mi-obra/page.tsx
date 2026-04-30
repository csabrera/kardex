'use client';

import { useQueries } from '@tanstack/react-query';
import {
  AlertTriangle,
  ArrowUpCircle,
  Bell,
  Building,
  CheckCircle2,
  ClipboardList,
  Clock,
  Layers,
  MapPin,
  Package,
  Pencil,
  Plus,
  Search,
  Shield,
  SlidersHorizontal,
  Trash2,
  TrendingDown,
  Warehouse,
  Wrench,
} from 'lucide-react';
import { useMemo, useState } from 'react';

import { NewEPPAssignmentDialog } from '@/components/epp/new-epp-assignment-dialog';
import { QuickAdjustDialog } from '@/components/items/quick-adjust-dialog';
import { QuickOutgoingDialog } from '@/components/items/quick-outgoing-dialog';
import { NewLoanDialog } from '@/components/tool-loans/new-loan-dialog';
import { ReturnLoanDialog } from '@/components/tool-loans/return-loan-dialog';
import { TransferDetailDialog } from '@/components/transfers/transfer-detail-dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useConfirm } from '@/components/ui/confirm-provider';
import { EmptyState } from '@/components/ui/empty-state';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { StationFormDialog } from '@/components/work-stations/station-form-dialog';
import { useObras } from '@/hooks/use-obras';
import { type ToolLoan } from '@/hooks/use-tool-loans';
import { usePendingTransfersForMe, type Transfer } from '@/hooks/use-transfers';
import { useWarehouses } from '@/hooks/use-warehouses';
import {
  useDeleteWorkStation,
  useWorkStations,
  type WorkStation,
} from '@/hooks/use-work-stations';
import { apiClient } from '@/lib/api-client';
import { cn } from '@/lib/cn';
import { useAuthStore } from '@/stores/use-auth-store';

import type { Alert } from '@/hooks/use-alerts';
import type { EPPAssignment } from '@/hooks/use-epp';
import type { Item } from '@/hooks/use-items';
import type { Movement } from '@/hooks/use-movements';
import type { StockEntry } from '@/hooks/use-stock';

type TabId = 'almacen' | 'prestamos' | 'epp' | 'estaciones' | 'movimientos' | 'alertas';

const ALL = 'ALL';

export default function MiObraPage() {
  const user = useAuthStore((s) => s.user);

  const { data: obrasData, isLoading: obrasLoading } = useObras({
    responsibleUserId: user?.id,
    pageSize: 100,
    enabled: !!user?.id,
  });

  const obras = obrasData?.items ?? [];
  const [selectedObraId, setSelectedObraId] = useState<string>('');
  const obraId = selectedObraId || obras[0]?.id || '';
  const obra = obras.find((o) => o.id === obraId);

  // Almacenes de la obra
  const { data: warehousesData } = useWarehouses({
    pageSize: 20,
    type: 'OBRA',
    obraId,
    enabled: !!obraId,
  } as any);
  const obraWarehouses = warehousesData?.items ?? [];
  const warehouseIds = useMemo(() => obraWarehouses.map((w) => w.id), [obraWarehouses]);

  // Selección de almacén con default = TODOS si hay >1
  const [selectedWarehouseId, setSelectedWarehouseId] = useState<string>('');
  const effectiveWarehouseId = useMemo(() => {
    if (selectedWarehouseId) return selectedWarehouseId;
    if (obraWarehouses.length > 1) return ALL;
    return obraWarehouses[0]?.id ?? '';
  }, [selectedWarehouseId, obraWarehouses]);
  const isAllMode = effectiveWarehouseId === ALL;
  const currentWarehouse = isAllMode
    ? null
    : obraWarehouses.find((w) => w.id === effectiveWarehouseId);

  // ───── Queries paralelas: 1 por almacén. Cache compartida con resto de la app. ─────
  const stockResults = useQueries({
    queries: warehouseIds.map((id) => ({
      queryKey: ['stock', { warehouseId: id }],
      queryFn: () =>
        apiClient
          .get('/stock', { params: { warehouseId: id } })
          .then((r) => r.data.data as StockEntry[]),
      enabled: !!id,
    })),
  });
  // allStock excluye filas con quantity = 0 (son "fantasmas" que persisten en BD
  // por historial de movimientos pero que físicamente no tienen nada).
  const allStock = useMemo(
    () => stockResults.flatMap((q) => q.data ?? []).filter((s) => Number(s.quantity) > 0),
    [stockResults],
  );

  const movementsResults = useQueries({
    queries: warehouseIds.map((id) => ({
      queryKey: ['movements', { warehouseId: id, pageSize: 50 }],
      queryFn: () =>
        apiClient
          .get('/movements', { params: { warehouseId: id, pageSize: 50 } })
          .then((r) => r.data.data as { items: Movement[] }),
      enabled: !!id,
    })),
  });
  const allMovements = useMemo(
    () =>
      movementsResults
        .flatMap((q) => q.data?.items ?? [])
        .sort(
          (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
        ),
    [movementsResults],
  );

  const alertsResults = useQueries({
    queries: warehouseIds.map((id) => ({
      queryKey: ['alerts', { warehouseId: id, read: false }],
      queryFn: () =>
        apiClient
          .get('/alerts', { params: { warehouseId: id, read: false } })
          .then((r) => r.data.data as Alert[]),
      enabled: !!id,
    })),
  });
  const allAlerts = useMemo(
    () => alertsResults.flatMap((q) => q.data ?? []),
    [alertsResults],
  );

  const loansResults = useQueries({
    queries: warehouseIds.map((id) => ({
      queryKey: ['tool-loans', { warehouseId: id, status: 'ACTIVE', pageSize: 50 }],
      queryFn: () =>
        apiClient
          .get('/tool-loans', {
            params: { warehouseId: id, status: 'ACTIVE', pageSize: 50 },
          })
          .then((r) => r.data.data as { items: ToolLoan[] }),
      enabled: !!id,
    })),
  });
  const allLoans = useMemo(
    () => loansResults.flatMap((q) => q.data?.items ?? []),
    [loansResults],
  );

  const eppResults = useQueries({
    queries: warehouseIds.map((id) => ({
      queryKey: ['epp', { warehouseId: id, pageSize: 50 }],
      queryFn: () =>
        apiClient
          .get('/epp', { params: { warehouseId: id, pageSize: 50 } })
          .then((r) => r.data.data as { items: EPPAssignment[] }),
      enabled: !!id,
    })),
  });
  const allEpps = useMemo(
    () => eppResults.flatMap((q) => q.data?.items ?? []),
    [eppResults],
  );

  // Pendientes de TODOS los almacenes de la obra (siempre, sin filtrar por selección)
  const { data: pendingPage } = usePendingTransfersForMe();
  const pendingTransfers = useMemo(() => {
    const set = new Set(warehouseIds);
    return (pendingPage?.items ?? []).filter((t) => set.has(t.toWarehouse.id));
  }, [pendingPage, warehouseIds]);

  // Estaciones de trabajo (filtradas por obra)
  const { data: stations = [] } = useWorkStations({
    obraId,
    enabled: !!obraId,
  });
  const deleteStationMut = useDeleteWorkStation();
  const confirm = useConfirm();

  const [transferDetail, setTransferDetail] = useState<Transfer | null>(null);
  const [activeTab, setActiveTab] = useState<TabId>('almacen');
  const [stockFilter, setStockFilter] = useState('');

  // Dialogs de acciones
  const [newLoanOpen, setNewLoanOpen] = useState(false);
  const [returnLoan, setReturnLoan] = useState<ToolLoan | null>(null);
  const [newEppOpen, setNewEppOpen] = useState(false);
  const [stationDialog, setStationDialog] = useState<{
    open: boolean;
    station: WorkStation | null;
  }>({ open: false, station: null });
  // Ajuste / salida directa sobre stock del almacén de la obra
  const [adjustTarget, setAdjustTarget] = useState<{
    item: Item;
    availableQty: number;
    warehouseId: string;
    warehouseName: string;
  } | null>(null);
  const [outgoingTarget, setOutgoingTarget] = useState<{
    item: Item;
    availableQty: number;
    warehouseId: string;
    warehouseName: string;
  } | null>(null);

  // Para items PRESTAMO usamos availableQty (descuenta los actualmente prestados)
  // así el residente no intenta sacar stock que no está en estante. Para otros
  // tipos availableQty == quantity.
  const openAdjustForEntry = (s: StockEntry) => {
    setAdjustTarget({
      item: s.item as unknown as Item,
      availableQty: Number(s.availableQty ?? s.quantity),
      warehouseId: s.warehouseId,
      warehouseName: s.warehouse.name,
    });
  };
  const openOutgoingForEntry = (s: StockEntry) => {
    setOutgoingTarget({
      item: s.item as unknown as Item,
      availableQty: Number(s.availableQty ?? s.quantity),
      warehouseId: s.warehouseId,
      warehouseName: s.warehouse.name,
    });
  };

  const handleDeleteStation = async (station: WorkStation) => {
    const ok = await confirm({
      title: '¿Eliminar estación?',
      description: `Esto eliminará la estación "${station.name}". Los préstamos activos asociados bloquearán la operación.`,
      confirmText: 'Eliminar',
      tone: 'destructive',
    });
    if (!ok) return;
    deleteStationMut.mutate(station.id);
  };

  const greeting = (() => {
    const h = new Date().getHours();
    if (h < 12) return 'Buenos días';
    if (h < 19) return 'Buenas tardes';
    return 'Buenas noches';
  })();

  // ───── Datos visibles según selección ─────
  const visibleStock = useMemo(
    () =>
      isAllMode
        ? allStock
        : allStock.filter((s) => s.warehouseId === effectiveWarehouseId),
    [isAllMode, allStock, effectiveWarehouseId],
  );
  const visibleMovements = useMemo(
    () =>
      isAllMode
        ? allMovements
        : allMovements.filter((m) => m.warehouseId === effectiveWarehouseId),
    [isAllMode, allMovements, effectiveWarehouseId],
  );
  const visibleAlerts = useMemo(
    () =>
      isAllMode
        ? allAlerts
        : allAlerts.filter((a) => a.warehouse.id === effectiveWarehouseId),
    [isAllMode, allAlerts, effectiveWarehouseId],
  );
  const visibleLoans = useMemo(
    () =>
      isAllMode
        ? allLoans
        : allLoans.filter((l) => l.warehouse.id === effectiveWarehouseId),
    [isAllMode, allLoans, effectiveWarehouseId],
  );
  const visibleEpps = useMemo(
    () =>
      isAllMode ? allEpps : allEpps.filter((e) => e.warehouseId === effectiveWarehouseId),
    [isAllMode, allEpps, effectiveWarehouseId],
  );

  // ───── Stock agregado por ítem (solo en modo TODOS) ─────
  interface AggregatedStockRow {
    itemId: string;
    item: StockEntry['item'];
    totalQty: number;
    /** Para items PRESTAMO suma de availableQty entre warehouses; otros = totalQty. */
    availableQty: number;
    /** Para items PRESTAMO suma de loanedQty entre warehouses; otros = 0. */
    loanedQty: number;
    /** Para items PRESTAMO suma de damagedReturnedQty entre warehouses; otros = 0. */
    damagedReturnedQty: number;
    breakdown: Array<{ warehouseId: string; warehouseName: string; qty: number }>;
  }
  const aggregatedStock = useMemo<AggregatedStockRow[]>(() => {
    if (!isAllMode) return [];
    const map = new Map<string, AggregatedStockRow>();
    for (const entry of allStock) {
      const qty = Number(entry.quantity);
      const avail = Number(entry.availableQty ?? qty);
      const loaned = Number(entry.loanedQty ?? 0);
      const damaged = Number(entry.damagedReturnedQty ?? 0);
      const existing = map.get(entry.itemId);
      if (existing) {
        existing.totalQty += qty;
        existing.availableQty += avail;
        existing.loanedQty += loaned;
        existing.damagedReturnedQty += damaged;
        existing.breakdown.push({
          warehouseId: entry.warehouseId,
          warehouseName: entry.warehouse.name,
          qty,
        });
      } else {
        map.set(entry.itemId, {
          itemId: entry.itemId,
          item: entry.item,
          totalQty: qty,
          availableQty: avail,
          loanedQty: loaned,
          damagedReturnedQty: damaged,
          breakdown: [
            {
              warehouseId: entry.warehouseId,
              warehouseName: entry.warehouse.name,
              qty,
            },
          ],
        });
      }
    }
    return Array.from(map.values()).sort((a, b) =>
      a.item.name.localeCompare(b.item.name),
    );
  }, [isAllMode, allStock]);

  // KPIs reactivos a la selección
  const kpis = useMemo(() => {
    if (isAllMode) {
      const itemsDistintos = aggregatedStock.length;
      const totalQty = aggregatedStock.reduce((acc, r) => acc + r.totalQty, 0);
      const belowMin = aggregatedStock.filter(
        (r) => Number(r.item.minStock) > 0 && r.totalQty < Number(r.item.minStock),
      ).length;
      return {
        items: itemsDistintos,
        totalQty,
        belowMin,
        alerts: visibleAlerts.length,
      };
    }
    const items = visibleStock.length;
    const totalQty = visibleStock.reduce((acc, s) => acc + Number(s.quantity), 0);
    const belowMin = visibleStock.filter(
      (s) => Number(s.item.minStock) > 0 && Number(s.quantity) < Number(s.item.minStock),
    ).length;
    return { items, totalQty, belowMin, alerts: visibleAlerts.length };
  }, [isAllMode, aggregatedStock, visibleStock, visibleAlerts]);

  // Filtro de búsqueda en stock
  const filteredStock = useMemo(() => {
    if (isAllMode) {
      if (!stockFilter.trim()) return aggregatedStock;
      const q = stockFilter.toLowerCase();
      return aggregatedStock.filter(
        (r) =>
          r.item.name.toLowerCase().includes(q) || r.item.code.toLowerCase().includes(q),
      );
    }
    if (!stockFilter.trim()) return visibleStock;
    const q = stockFilter.toLowerCase();
    return visibleStock.filter(
      (s) =>
        s.item.name.toLowerCase().includes(q) || s.item.code.toLowerCase().includes(q),
    );
  }, [isAllMode, aggregatedStock, visibleStock, stockFilter]);

  if (obrasLoading) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center text-sm text-muted-foreground">
        Cargando obras...
      </div>
    );
  }

  if (obras.length === 0) {
    return (
      <div className="max-w-xl mx-auto mt-10">
        <EmptyState
          icon={Building}
          title="No tienes obras asignadas"
          description="No estás registrado como responsable de ninguna obra. Contacta al administrador."
        />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header con saludo + selector de obra */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-[2rem] font-bold tracking-tight leading-[1.15]">
            {greeting}, {user?.firstName ?? 'Residente'}
          </h1>
          <p className="text-base text-muted-foreground mt-2">
            Panel de control de tu obra
          </p>
        </div>
        {obras.length > 1 && (
          <Select value={obraId} onValueChange={setSelectedObraId}>
            <SelectTrigger className="w-64">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {obras.map((o) => (
                <SelectItem key={o.id} value={o.id}>
                  {o.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </div>

      {/* Card de obra + selector de almacén con TODOS */}
      {obra && (
        <section className="rounded-xl border bg-card p-5 shadow-sm">
          <div className="flex items-center gap-4 flex-wrap">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-accent/10 ring-1 ring-accent/20 text-accent">
              <Building className="h-6 w-6" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-lg font-semibold">{obra.name}</h2>
                <Badge variant="outline" className="font-mono text-xs">
                  {obra.code}
                </Badge>
                <Badge
                  variant={
                    obra.status === 'ACTIVA'
                      ? 'success'
                      : obra.status === 'FINALIZADA'
                        ? 'secondary'
                        : 'info'
                  }
                >
                  {obra.status}
                </Badge>
              </div>
              {obra.address && (
                <p className="text-sm text-muted-foreground mt-0.5">{obra.address}</p>
              )}
            </div>
            {obraWarehouses.length > 0 && (
              <div className="min-w-[240px]">
                <p className="text-xs text-muted-foreground uppercase tracking-wider font-medium mb-1.5">
                  {obraWarehouses.length > 1
                    ? `Almacén (${obraWarehouses.length} disponibles)`
                    : 'Almacén'}
                </p>
                {obraWarehouses.length > 1 ? (
                  <Select
                    value={effectiveWarehouseId}
                    onValueChange={setSelectedWarehouseId}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={ALL}>
                        <span className="flex items-center gap-2 font-bold uppercase">
                          <Layers className="h-4 w-4" />
                          TODOS
                        </span>
                      </SelectItem>
                      {obraWarehouses.map((w) => (
                        <SelectItem key={w.id} value={w.id}>
                          <span className="font-bold uppercase">{w.name}</span>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                ) : (
                  <p className="font-bold uppercase text-base">
                    {obraWarehouses[0]?.name}
                  </p>
                )}
              </div>
            )}
          </div>
        </section>
      )}

      {/* Pendientes — siempre visible, de TODOS los almacenes de la obra */}
      <section
        className={cn(
          'rounded-xl border shadow-sm',
          pendingTransfers.length > 0
            ? 'border-2 border-amber-300 bg-amber-50/50 dark:bg-amber-950/15 p-5'
            : 'bg-card p-5',
        )}
      >
        <header className="flex items-center gap-3 mb-4">
          <div
            className={cn(
              'flex h-9 w-9 items-center justify-center rounded-lg ring-1',
              pendingTransfers.length > 0
                ? 'bg-amber-500/15 text-amber-700 dark:text-amber-400 ring-amber-500/30'
                : 'bg-muted text-muted-foreground ring-border',
            )}
          >
            <CheckCircle2 className="h-[18px] w-[18px]" />
          </div>
          <div className="flex-1">
            <h2 className="text-base font-semibold">
              {pendingTransfers.length === 0
                ? 'Sin transferencias pendientes'
                : pendingTransfers.length === 1
                  ? '1 transferencia por confirmar'
                  : `${pendingTransfers.length} transferencias por confirmar`}
            </h2>
            <p className="text-sm text-muted-foreground">
              {pendingTransfers.length === 0
                ? 'Cuando el almacenero te transfiera ítems, aparecerán aquí.'
                : 'Click en una para ver el detalle y confirmar la recepción.'}
            </p>
          </div>
        </header>
        {pendingTransfers.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
            {pendingTransfers.map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => setTransferDetail(t)}
                className="flex items-center justify-between gap-3 rounded-lg border bg-background px-4 py-3 text-left hover:border-amber-400 hover:shadow-sm transition-all group"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <Warehouse className="h-5 w-5 text-amber-600 dark:text-amber-400 shrink-0" />
                  <div className="min-w-0">
                    <p className="font-mono text-sm font-bold group-hover:text-accent transition-colors">
                      {t.code}
                    </p>
                    <p className="text-xs text-muted-foreground truncate">
                      {t.fromWarehouse.name} →{' '}
                      <span className="font-medium uppercase">{t.toWarehouse.name}</span>{' '}
                      · {t.items.length} ítem
                      {t.items.length !== 1 ? 's' : ''}
                    </p>
                  </div>
                </div>
                <span className="text-xs text-amber-700 dark:text-amber-400 font-medium shrink-0">
                  Ver y confirmar →
                </span>
              </button>
            ))}
          </div>
        )}
      </section>

      {/* KPIs según selección (TODOS = consolidado, específico = del almacén) */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard label="Ítems distintos" value={kpis.items} icon={Package} />
        <KpiCard
          label="Cantidad total"
          value={kpis.totalQty.toLocaleString('es-PE', { maximumFractionDigits: 0 })}
          icon={Package}
        />
        <KpiCard
          label="Bajo mínimo"
          value={kpis.belowMin}
          icon={TrendingDown}
          tone={kpis.belowMin > 0 ? 'warning' : 'success'}
        />
        <KpiCard
          label="Alertas"
          value={kpis.alerts}
          icon={AlertTriangle}
          tone={kpis.alerts > 0 ? 'destructive' : 'success'}
        />
      </div>

      {/* Tabs principales */}
      {obraWarehouses.length === 0 ? (
        <section className="rounded-xl border bg-card p-10">
          <EmptyState
            icon={Warehouse}
            title="Esta obra no tiene almacén"
            description="El administrador debe crear un almacén tipo OBRA para que puedas operar."
          />
        </section>
      ) : (
        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as TabId)}>
          <TabsList>
            <TabsTrigger value="almacen" icon={Package}>
              Mi Almacén
            </TabsTrigger>
            <TabsTrigger value="prestamos" icon={Wrench} badge={visibleLoans.length}>
              Préstamos
            </TabsTrigger>
            <TabsTrigger value="epp" icon={Shield}>
              EPP
            </TabsTrigger>
            <TabsTrigger value="estaciones" icon={MapPin} badge={stations.length}>
              Estaciones
            </TabsTrigger>
            <TabsTrigger value="movimientos" icon={Clock}>
              Movimientos
            </TabsTrigger>
            <TabsTrigger value="alertas" icon={Bell} badge={visibleAlerts.length}>
              Alertas
            </TabsTrigger>
          </TabsList>

          {/* === TAB: MI ALMACÉN === */}
          <TabsContent value="almacen" className="mt-5 space-y-4">
            <div className="flex items-center gap-3 flex-wrap">
              <div className="relative flex-1 min-w-[240px] max-w-md">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Buscar ítem por nombre o código..."
                  value={stockFilter}
                  onChange={(e) => setStockFilter(e.target.value)}
                  className="pl-9"
                />
              </div>
              <p className="text-xs text-muted-foreground">
                {filteredStock.length} ítem{filteredStock.length !== 1 ? 's' : ''}
                {isAllMode && ` · consolidado de ${obraWarehouses.length} almacenes`}
              </p>
            </div>

            <div className="rounded-lg border bg-card overflow-hidden">
              {filteredStock.length === 0 ? (
                <div className="p-10">
                  <EmptyState
                    icon={Package}
                    title={
                      (isAllMode ? aggregatedStock : visibleStock).length === 0
                        ? 'Almacén vacío'
                        : 'Sin resultados'
                    }
                    description={
                      (isAllMode ? aggregatedStock : visibleStock).length === 0
                        ? 'Aún no tienes stock. Las entradas aparecerán cuando el almacenero te transfiera ítems.'
                        : 'Probá con otro término de búsqueda.'
                    }
                  />
                </div>
              ) : isAllMode ? (
                <table className="w-full text-sm">
                  <thead className="bg-muted/40 text-xs uppercase tracking-wider text-muted-foreground">
                    <tr>
                      <th className="text-left px-4 py-3 font-medium">Código</th>
                      <th className="text-left px-4 py-3 font-medium">Ítem</th>
                      <th className="text-left px-4 py-3 font-medium">Tipo</th>
                      <th className="text-left px-4 py-3 font-medium">En almacenes</th>
                      <th
                        className="text-right px-4 py-3 font-medium"
                        title="Disponible / Total. Para préstamos: disponible = total − en préstamo activo."
                      >
                        Disp. / Total
                      </th>
                      <th className="text-right px-4 py-3 font-medium">Prestados</th>
                      <th className="text-left px-4 py-3 font-medium">Estado</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(filteredStock as AggregatedStockRow[]).map((r) => {
                      const min = Number(r.item.minStock);
                      const isLoan = r.item.type === 'PRESTAMO';
                      const available = r.availableQty;
                      const out = available === 0 && min > 0;
                      const low = !out && min > 0 && available < min;
                      return (
                        <tr key={r.itemId} className="border-t hover:bg-muted/20">
                          <td className="px-4 py-3 font-mono text-xs">{r.item.code}</td>
                          <td className="px-4 py-3 font-medium">
                            {r.item.name}
                            {isLoan && r.damagedReturnedQty > 0 && (
                              <span
                                className="ml-2 text-[10px] text-destructive"
                                title="Devueltos en condición DAMAGED — no utilizables"
                              >
                                ⚠ {r.damagedReturnedQty} no utilizables
                              </span>
                            )}
                          </td>
                          <td className="px-4 py-3">
                            <Badge variant="outline" className="text-[10px]">
                              {r.item.type}
                            </Badge>
                          </td>
                          <td className="px-4 py-3 text-xs">
                            <div className="space-y-0.5">
                              {r.breakdown.map((b) => (
                                <div
                                  key={b.warehouseId}
                                  className="flex items-center justify-between gap-3 max-w-[280px]"
                                >
                                  <span className="uppercase font-medium text-muted-foreground truncate">
                                    {b.warehouseName}
                                  </span>
                                  <span className="font-mono tabular-nums">
                                    {b.qty.toLocaleString('es-PE', {
                                      maximumFractionDigits: 3,
                                    })}
                                  </span>
                                </div>
                              ))}
                            </div>
                          </td>
                          <td
                            className={cn(
                              'px-4 py-3 text-right font-bold tabular-nums',
                              out && 'text-destructive',
                              low && 'text-amber-600 dark:text-amber-400',
                            )}
                          >
                            {isLoan ? (
                              <>
                                {available.toLocaleString('es-PE', {
                                  maximumFractionDigits: 3,
                                })}
                                <span className="text-muted-foreground font-normal">
                                  {' / '}
                                  {r.totalQty.toLocaleString('es-PE', {
                                    maximumFractionDigits: 3,
                                  })}
                                </span>
                              </>
                            ) : (
                              r.totalQty.toLocaleString('es-PE', {
                                maximumFractionDigits: 3,
                              })
                            )}{' '}
                            <span className="text-xs text-muted-foreground font-normal">
                              {r.item.unit.abbreviation}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-right tabular-nums text-xs">
                            {isLoan && r.loanedQty > 0 ? (
                              <span className="text-blue-600 dark:text-blue-400 font-medium">
                                {r.loanedQty}
                              </span>
                            ) : (
                              <span className="text-muted-foreground">—</span>
                            )}
                          </td>
                          <td className="px-4 py-3">
                            {out ? (
                              <Badge variant="destructive">Sin disponible</Badge>
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
              ) : (
                <table className="w-full text-sm">
                  <thead className="bg-muted/40 text-xs uppercase tracking-wider text-muted-foreground">
                    <tr>
                      <th className="text-left px-4 py-3 font-medium">Código</th>
                      <th className="text-left px-4 py-3 font-medium">Ítem</th>
                      <th className="text-left px-4 py-3 font-medium">Tipo</th>
                      <th
                        className="text-right px-4 py-3 font-medium"
                        title="Disponible / Total. Para préstamos: disponible = total − en préstamo activo."
                      >
                        Disp. / Total
                      </th>
                      <th className="text-right px-4 py-3 font-medium">Prestados</th>
                      <th className="text-left px-4 py-3 font-medium">Estado</th>
                      <th className="text-right px-4 py-3 font-medium">Acciones</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(filteredStock as StockEntry[])
                      .slice()
                      .sort((a, b) => a.item.name.localeCompare(b.item.name))
                      .map((s) => {
                        const qty = Number(s.quantity);
                        const min = Number(s.item.minStock);
                        const isLoan = s.item.type === 'PRESTAMO';
                        const available = Number(s.availableQty ?? qty);
                        const loaned = Number(s.loanedQty ?? 0);
                        const damaged = Number(s.damagedReturnedQty ?? 0);
                        const out = available === 0 && min > 0;
                        const low = !out && min > 0 && available < min;
                        return (
                          <tr key={s.id} className="border-t hover:bg-muted/20">
                            <td className="px-4 py-3 font-mono text-xs">{s.item.code}</td>
                            <td className="px-4 py-3 font-medium">
                              {s.item.name}
                              {isLoan && damaged > 0 && (
                                <span
                                  className="ml-2 text-[10px] text-destructive"
                                  title="Devueltos en condición DAMAGED — no utilizables"
                                >
                                  ⚠ {damaged} no utilizables
                                </span>
                              )}
                            </td>
                            <td className="px-4 py-3">
                              <Badge variant="outline" className="text-[10px]">
                                {s.item.type}
                              </Badge>
                            </td>
                            <td
                              className={cn(
                                'px-4 py-3 text-right font-semibold tabular-nums',
                                out && 'text-destructive',
                                low && 'text-amber-600 dark:text-amber-400',
                              )}
                            >
                              {isLoan ? (
                                <>
                                  {available.toLocaleString('es-PE', {
                                    maximumFractionDigits: 3,
                                  })}
                                  <span className="text-muted-foreground font-normal">
                                    {' / '}
                                    {qty.toLocaleString('es-PE', {
                                      maximumFractionDigits: 3,
                                    })}
                                  </span>
                                </>
                              ) : (
                                qty.toLocaleString('es-PE', { maximumFractionDigits: 3 })
                              )}{' '}
                              <span className="text-xs text-muted-foreground font-normal">
                                {s.item.unit.abbreviation}
                              </span>
                            </td>
                            <td className="px-4 py-3 text-right tabular-nums text-xs">
                              {isLoan && loaned > 0 ? (
                                <span className="text-blue-600 dark:text-blue-400 font-medium">
                                  {loaned}
                                </span>
                              ) : (
                                <span className="text-muted-foreground">—</span>
                              )}
                            </td>
                            <td className="px-4 py-3">
                              {out ? (
                                <Badge variant="destructive">Sin disponible</Badge>
                              ) : low ? (
                                <Badge variant="warning">Bajo mínimo</Badge>
                              ) : (
                                <Badge variant="success">Óptimo</Badge>
                              )}
                            </td>
                            <td className="px-4 py-3 text-right">
                              <div className="flex items-center justify-end gap-1.5">
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => openAdjustForEntry(s)}
                                  className="gap-1 h-8 px-2.5"
                                  title="Ajustar cantidad tras conteo físico"
                                >
                                  <SlidersHorizontal className="h-3.5 w-3.5 text-amber-600" />
                                  <span className="hidden lg:inline">Ajustar</span>
                                </Button>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => openOutgoingForEntry(s)}
                                  disabled={available === 0}
                                  className="gap-1 h-8 px-2.5"
                                  title="Registrar salida (consumo / baja)"
                                >
                                  <ArrowUpCircle className="h-3.5 w-3.5 text-red-600" />
                                  <span className="hidden lg:inline">Salida</span>
                                </Button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                  </tbody>
                </table>
              )}
            </div>
          </TabsContent>

          {/* === TAB: PRÉSTAMOS === */}
          <TabsContent value="prestamos" className="mt-5 space-y-4">
            <div className="flex justify-end">
              <Button onClick={() => setNewLoanOpen(true)} className="gap-2">
                <Plus className="h-4 w-4" />
                Nuevo préstamo
              </Button>
            </div>
            <div className="rounded-lg border bg-card overflow-hidden">
              {visibleLoans.length === 0 ? (
                <div className="p-10">
                  <EmptyState
                    icon={Wrench}
                    title="Sin préstamos activos"
                    description={
                      isAllMode
                        ? 'Ninguna herramienta está prestada actualmente en esta obra.'
                        : `Ninguna herramienta de "${currentWarehouse?.name ?? 'este almacén'}" está prestada actualmente.`
                    }
                  />
                </div>
              ) : (
                <table className="w-full text-sm">
                  <thead className="bg-muted/40 text-xs uppercase tracking-wider text-muted-foreground">
                    <tr>
                      <th className="text-left px-4 py-3 font-medium">Código</th>
                      <th className="text-left px-4 py-3 font-medium">Herramienta</th>
                      {isAllMode && (
                        <th className="text-left px-4 py-3 font-medium">Almacén</th>
                      )}
                      <th className="text-left px-4 py-3 font-medium">Empleado</th>
                      <th className="text-left px-4 py-3 font-medium">Estación</th>
                      <th className="text-left px-4 py-3 font-medium">Devolver antes</th>
                      <th className="text-right px-4 py-3 font-medium">Acciones</th>
                    </tr>
                  </thead>
                  <tbody>
                    {visibleLoans.map((l) => {
                      const overdue = new Date(l.expectedReturnAt) < new Date();
                      return (
                        <tr key={l.id} className="border-t hover:bg-muted/20">
                          <td className="px-4 py-3 font-mono text-xs">{l.code}</td>
                          <td className="px-4 py-3 font-medium">{l.item.name}</td>
                          {isAllMode && (
                            <td className="px-4 py-3 text-xs uppercase font-medium text-muted-foreground">
                              {l.warehouse.name}
                            </td>
                          )}
                          <td className="px-4 py-3 text-sm">
                            {l.borrowerWorker.firstName} {l.borrowerWorker.lastName}
                          </td>
                          <td className="px-4 py-3 text-xs text-muted-foreground">
                            {l.workStation.name}
                          </td>
                          <td
                            className={cn(
                              'px-4 py-3 text-xs tabular-nums',
                              overdue
                                ? 'text-destructive font-semibold'
                                : 'text-muted-foreground',
                            )}
                          >
                            {new Date(l.expectedReturnAt).toLocaleString('es-PE', {
                              dateStyle: 'short',
                            })}
                            {overdue && (
                              <Badge variant="destructive" className="ml-2 text-[9px]">
                                Vencido
                              </Badge>
                            )}
                          </td>
                          <td className="px-4 py-3 text-right">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => setReturnLoan(l)}
                              className="gap-1"
                            >
                              <CheckCircle2 className="h-3.5 w-3.5" />
                              Devolver
                            </Button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>
          </TabsContent>

          {/* === TAB: EPP === */}
          <TabsContent value="epp" className="mt-5 space-y-4">
            <div className="flex justify-end">
              <Button onClick={() => setNewEppOpen(true)} className="gap-2">
                <Plus className="h-4 w-4" />
                Asignar EPP
              </Button>
            </div>
            <div className="rounded-lg border bg-card overflow-hidden">
              {visibleEpps.length === 0 ? (
                <div className="p-10">
                  <EmptyState
                    icon={Shield}
                    title="Sin asignaciones de EPP"
                    description={
                      isAllMode
                        ? 'No se ha entregado EPP en ninguno de los almacenes de esta obra todavía.'
                        : `No se ha entregado EPP desde "${currentWarehouse?.name ?? 'este almacén'}" todavía.`
                    }
                  />
                </div>
              ) : (
                <table className="w-full text-sm">
                  <thead className="bg-muted/40 text-xs uppercase tracking-wider text-muted-foreground">
                    <tr>
                      <th className="text-left px-4 py-3 font-medium">Código</th>
                      <th className="text-left px-4 py-3 font-medium">Obrero</th>
                      <th className="text-left px-4 py-3 font-medium">EPP</th>
                      {isAllMode && (
                        <th className="text-left px-4 py-3 font-medium">Almacén</th>
                      )}
                      <th className="text-right px-4 py-3 font-medium">Cantidad</th>
                      <th className="text-left px-4 py-3 font-medium">Asignado</th>
                    </tr>
                  </thead>
                  <tbody>
                    {visibleEpps.map((e) => (
                      <tr key={e.id} className="border-t hover:bg-muted/20">
                        <td className="px-4 py-3 font-mono text-xs">{e.code}</td>
                        <td className="px-4 py-3 text-sm">
                          {e.worker.firstName} {e.worker.lastName}
                        </td>
                        <td className="px-4 py-3 font-medium">{e.item.name}</td>
                        {isAllMode && (
                          <td className="px-4 py-3 text-xs uppercase font-medium text-muted-foreground">
                            {e.warehouse.name}
                          </td>
                        )}
                        <td className="px-4 py-3 text-right tabular-nums">
                          {Number(e.quantity).toLocaleString('es-PE', {
                            maximumFractionDigits: 3,
                          })}{' '}
                          <span className="text-xs text-muted-foreground">
                            {e.item.unit.abbreviation}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-xs text-muted-foreground">
                          {new Date(e.assignedAt).toLocaleDateString('es-PE')}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </TabsContent>

          {/* === TAB: ESTACIONES === */}
          <TabsContent value="estaciones" className="mt-5 space-y-4">
            <div className="flex items-center justify-between flex-wrap gap-3">
              <div>
                <p className="text-sm text-muted-foreground">
                  Áreas físicas de tu obra donde se usan herramientas (ej: zona norte,
                  planta baja).
                </p>
              </div>
              <Button
                onClick={() => setStationDialog({ open: true, station: null })}
                className="gap-2"
              >
                <Plus className="h-4 w-4" />
                Nueva estación
              </Button>
            </div>
            <div className="rounded-lg border bg-card overflow-hidden">
              {stations.length === 0 ? (
                <div className="p-10">
                  <EmptyState
                    icon={MapPin}
                    title="Sin estaciones creadas"
                    description="Creá estaciones para organizar los préstamos por área de trabajo."
                    action={
                      <Button
                        onClick={() => setStationDialog({ open: true, station: null })}
                        className="gap-2"
                      >
                        <Plus className="h-4 w-4" />
                        Crear primera estación
                      </Button>
                    }
                  />
                </div>
              ) : (
                <table className="w-full text-sm">
                  <thead className="bg-muted/40 text-xs uppercase tracking-wider text-muted-foreground">
                    <tr>
                      <th className="text-left px-4 py-3 font-medium">Nombre</th>
                      <th className="text-left px-4 py-3 font-medium">Descripción</th>
                      <th className="text-left px-4 py-3 font-medium">Estado</th>
                      <th className="text-right px-4 py-3 font-medium">Acciones</th>
                    </tr>
                  </thead>
                  <tbody>
                    {stations.map((s) => (
                      <tr key={s.id} className="border-t hover:bg-muted/20">
                        <td className="px-4 py-3 font-medium">{s.name}</td>
                        <td className="px-4 py-3 text-xs text-muted-foreground">
                          {s.description || '—'}
                        </td>
                        <td className="px-4 py-3">
                          {s.active ? (
                            <Badge variant="success">Activa</Badge>
                          ) : (
                            <Badge variant="secondary">Inactiva</Badge>
                          )}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <div className="flex items-center justify-end gap-2">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => setStationDialog({ open: true, station: s })}
                              className="gap-1"
                            >
                              <Pencil className="h-3.5 w-3.5" />
                              Editar
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleDeleteStation(s)}
                              className="gap-1 text-destructive border-destructive/40 hover:bg-destructive/10"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                              Eliminar
                            </Button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </TabsContent>

          {/* === TAB: MOVIMIENTOS === */}
          <TabsContent value="movimientos" className="mt-5">
            <div className="rounded-lg border bg-card overflow-hidden">
              {visibleMovements.length === 0 ? (
                <div className="p-10">
                  <EmptyState
                    icon={ClipboardList}
                    title="Sin actividad"
                    description={
                      isAllMode
                        ? 'Aún no se han registrado movimientos en los almacenes de esta obra.'
                        : `Aún no se han registrado movimientos en "${currentWarehouse?.name ?? 'este almacén'}".`
                    }
                  />
                </div>
              ) : (
                <table className="w-full text-sm">
                  <thead className="bg-muted/40 text-xs uppercase tracking-wider text-muted-foreground">
                    <tr>
                      <th className="text-left px-4 py-3 font-medium">Fecha</th>
                      <th className="text-left px-4 py-3 font-medium">Código</th>
                      <th className="text-left px-4 py-3 font-medium">Tipo</th>
                      {isAllMode && (
                        <th className="text-left px-4 py-3 font-medium">Almacén</th>
                      )}
                      <th className="text-right px-4 py-3 font-medium">Ítems</th>
                      <th className="text-left px-4 py-3 font-medium">Por</th>
                    </tr>
                  </thead>
                  <tbody>
                    {visibleMovements.map((m) => (
                      <tr key={m.id} className="border-t hover:bg-muted/20">
                        <td className="px-4 py-3 text-xs text-muted-foreground tabular-nums whitespace-nowrap">
                          {new Date(m.createdAt).toLocaleString('es-PE', {
                            dateStyle: 'short',
                            timeStyle: 'short',
                          })}
                        </td>
                        <td className="px-4 py-3 font-mono text-xs font-medium">
                          {m.code}
                        </td>
                        <td className="px-4 py-3">
                          <Badge
                            variant={
                              m.type === 'ENTRADA'
                                ? 'success'
                                : m.type === 'SALIDA'
                                  ? 'destructive'
                                  : 'warning'
                            }
                          >
                            {m.type}
                          </Badge>
                        </td>
                        {isAllMode && (
                          <td className="px-4 py-3 text-xs uppercase font-medium text-muted-foreground">
                            {m.warehouse.name}
                          </td>
                        )}
                        <td className="px-4 py-3 text-right tabular-nums">
                          {m.items.length}
                        </td>
                        <td className="px-4 py-3 text-xs text-muted-foreground">
                          {m.user?.firstName} {m.user?.lastName}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </TabsContent>

          {/* === TAB: ALERTAS === */}
          <TabsContent value="alertas" className="mt-5 space-y-2">
            {visibleAlerts.length === 0 ? (
              <div className="rounded-lg border bg-card p-10">
                <EmptyState
                  icon={CheckCircle2}
                  title="Sin alertas pendientes"
                  description={
                    isAllMode
                      ? 'Los almacenes de esta obra están en niveles normales.'
                      : `"${currentWarehouse?.name ?? 'Este almacén'}" está en niveles normales.`
                  }
                />
              </div>
            ) : (
              visibleAlerts.map((a) => (
                <div
                  key={a.id}
                  className={cn(
                    'flex items-start gap-3 rounded-lg border p-4',
                    a.type === 'STOCK_CRITICO'
                      ? 'border-red-200/50 dark:border-red-900/40 bg-red-50/50 dark:bg-red-950/20'
                      : a.type === 'STOCK_BAJO'
                        ? 'border-amber-200/50 dark:border-amber-900/40 bg-amber-50/50 dark:bg-amber-950/20'
                        : 'border-orange-200/50 dark:border-orange-900/40 bg-orange-50/50 dark:bg-orange-950/20',
                  )}
                >
                  <AlertTriangle
                    className={cn(
                      'h-5 w-5 shrink-0 mt-0.5',
                      a.type === 'STOCK_CRITICO'
                        ? 'text-destructive'
                        : a.type === 'STOCK_BAJO'
                          ? 'text-amber-600 dark:text-amber-400'
                          : 'text-orange-600 dark:text-orange-400',
                    )}
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <Badge
                        variant={
                          a.type === 'STOCK_CRITICO'
                            ? 'destructive'
                            : a.type === 'STOCK_BAJO'
                              ? 'warning'
                              : 'secondary'
                        }
                        className="text-xs"
                      >
                        {a.type === 'STOCK_CRITICO'
                          ? 'Crítico'
                          : a.type === 'STOCK_BAJO'
                            ? 'Stock bajo'
                            : 'Discrepancia'}
                      </Badge>
                      {isAllMode && (
                        <Badge variant="outline" className="text-xs uppercase">
                          {a.warehouse.name}
                        </Badge>
                      )}
                      <span className="text-xs text-muted-foreground">
                        {new Date(a.createdAt).toLocaleString('es-PE', {
                          dateStyle: 'short',
                          timeStyle: 'short',
                        })}
                      </span>
                    </div>
                    <p className="text-sm font-medium">{a.message}</p>
                  </div>
                </div>
              ))
            )}
          </TabsContent>
        </Tabs>
      )}

      <TransferDetailDialog
        transfer={transferDetail}
        onClose={() => setTransferDetail(null)}
      />

      <NewLoanDialog
        open={newLoanOpen}
        onClose={() => setNewLoanOpen(false)}
        lockedObraId={obraId || undefined}
        defaultWarehouseId={isAllMode ? undefined : effectiveWarehouseId || undefined}
      />

      <ReturnLoanDialog loan={returnLoan} onClose={() => setReturnLoan(null)} />

      <NewEPPAssignmentDialog
        open={newEppOpen}
        onClose={() => setNewEppOpen(false)}
        lockedObraId={obraId || undefined}
        defaultWarehouseId={isAllMode ? undefined : effectiveWarehouseId || undefined}
      />

      <QuickAdjustDialog
        item={
          adjustTarget
            ? ({ ...adjustTarget.item, principalStock: adjustTarget.availableQty } as any)
            : null
        }
        onClose={() => setAdjustTarget(null)}
        warehouseId={adjustTarget?.warehouseId}
        warehouseName={adjustTarget?.warehouseName}
      />

      <QuickOutgoingDialog
        item={
          outgoingTarget
            ? ({
                ...outgoingTarget.item,
                principalStock: outgoingTarget.availableQty,
              } as any)
            : null
        }
        onClose={() => setOutgoingTarget(null)}
        warehouseId={outgoingTarget?.warehouseId}
        warehouseName={outgoingTarget?.warehouseName}
      />

      {obraId && (
        <StationFormDialog
          open={stationDialog.open}
          onClose={() => setStationDialog({ open: false, station: null })}
          obraId={obraId}
          station={stationDialog.station}
        />
      )}
    </div>
  );
}

// ============================================================================
// KPI Card local
// ============================================================================

type Tone = 'default' | 'success' | 'warning' | 'destructive';

function KpiCard({
  label,
  value,
  icon: Icon,
  tone = 'default',
}: {
  label: string;
  value: string | number;
  icon: React.ElementType;
  tone?: Tone;
}) {
  const tones: Record<Tone, { bg: string; fg: string; ring: string }> = {
    default: { bg: 'bg-muted', fg: 'text-muted-foreground', ring: 'ring-border' },
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
      <p className="text-[1.75rem] font-bold tracking-tight leading-none tabular-nums mt-3">
        {value}
      </p>
    </div>
  );
}
