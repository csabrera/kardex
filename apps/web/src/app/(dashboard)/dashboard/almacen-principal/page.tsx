'use client';

import {
  AlertTriangle,
  Box,
  ClipboardCheck,
  Droplet,
  FileText,
  Package,
  Shield,
  Star,
  TrendingDown,
  Warehouse as WarehouseIcon,
  Wrench,
} from 'lucide-react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useCallback } from 'react';

import { EppPanel } from '@/components/epp/epp-panel';
import { FuelDispatchesPanel } from '@/components/fuel/fuel-dispatches-panel';
import { InventoryCountsPanel } from '@/components/inventory/inventory-counts-panel';
import { ItemsPanel } from '@/components/items/items-panel';
import { MaintenancePanel } from '@/components/maintenance/maintenance-panel';
import { MovementsPanel } from '@/components/movements/movements-panel';
import { ToolLoansPanel } from '@/components/tool-loans/tool-loans-panel';
import { TransferenciasPanel } from '@/components/transfers/transferencias-panel';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useAlerts } from '@/hooks/use-alerts';
import { useStock } from '@/hooks/use-stock';
import { useMainWarehouse } from '@/hooks/use-warehouses';
import { cn } from '@/lib/cn';

type TabId =
  | 'inventario'
  | 'movimientos'
  | 'transferencias'
  | 'prestamos'
  | 'epp'
  | 'combustible'
  | 'mantenimientos'
  | 'inventarios';

const TABS: { id: TabId; label: string; icon: React.ElementType }[] = [
  { id: 'inventario', label: 'Inventario', icon: Box },
  { id: 'movimientos', label: 'Movimientos', icon: FileText },
  { id: 'transferencias', label: 'Transferencias', icon: WarehouseIcon },
  { id: 'prestamos', label: 'Préstamos', icon: Wrench },
  { id: 'epp', label: 'EPP', icon: Shield },
  { id: 'combustible', label: 'Combustible', icon: Droplet },
  { id: 'mantenimientos', label: 'Mantenimientos', icon: Wrench },
  { id: 'inventarios', label: 'Inventarios', icon: ClipboardCheck },
];

const VALID_TABS = new Set<TabId>(TABS.map((t) => t.id));
const DEFAULT_TAB: TabId = 'inventario';

export default function AlmacenPrincipalPage() {
  const router = useRouter();
  const searchParams = useSearchParams();

  // Tab activa via URL param ?tab=. Default = "inventario".
  const tabParam = searchParams.get('tab') as TabId | null;
  const activeTab: TabId = tabParam && VALID_TABS.has(tabParam) ? tabParam : DEFAULT_TAB;

  const setActiveTab = useCallback(
    (id: TabId) => {
      const params = new URLSearchParams(searchParams.toString());
      if (id === DEFAULT_TAB) params.delete('tab');
      else params.set('tab', id);
      const qs = params.toString();
      router.replace(`/dashboard/almacen-principal${qs ? `?${qs}` : ''}`, {
        scroll: false,
      });
    },
    [router, searchParams],
  );

  const main = useMainWarehouse();
  const mainId = main.data?.id;

  const stock = useStock({ warehouseId: mainId, enabled: !!mainId });
  const alerts = useAlerts({ warehouseId: mainId, read: false, enabled: !!mainId });

  // KPIs
  const items = stock.data ?? [];
  const totalQty = items.reduce((acc, s) => acc + Number(s.quantity), 0);
  const belowMin = items.filter(
    (s) => Number(s.item.minStock) > 0 && Number(s.quantity) < Number(s.item.minStock),
  ).length;

  const alertsCount = alerts.data?.length ?? 0;

  return (
    <div className="space-y-4">
      {/* Header compacto + KPIs inline (mitad del alto que tenía antes). */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 pb-4 border-b">
        <div className="flex items-center gap-3 min-w-0">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-accent/10 text-accent ring-1 ring-accent/20">
            <Star className="h-[18px] w-[18px]" />
          </div>
          <div className="min-w-0">
            <h1 className="text-lg font-semibold tracking-tight leading-tight truncate">
              Almacén Principal
            </h1>
            <p className="text-xs text-muted-foreground truncate">
              {main.data
                ? `${main.data.code} · hub operativo de la empresa`
                : 'Inventario matriz de la empresa'}
            </p>
          </div>
        </div>

        {/* KPIs como "strip" horizontal compacto */}
        <div className="grid grid-cols-2 md:grid-cols-4 lg:flex lg:items-center gap-3 lg:gap-6">
          <KpiInline
            label="Ítems"
            value={items.length}
            icon={Package}
            loading={stock.isLoading}
          />
          <KpiInline
            label="Cantidad total"
            value={totalQty.toLocaleString('es-PE', { maximumFractionDigits: 0 })}
            icon={Package}
            loading={stock.isLoading}
          />
          <KpiInline
            label="Bajo mínimo"
            value={belowMin}
            icon={TrendingDown}
            tone={belowMin > 0 ? 'warning' : 'muted'}
            loading={stock.isLoading}
          />
          <KpiInline
            label="Alertas"
            value={alertsCount}
            icon={AlertTriangle}
            tone={alertsCount > 0 ? 'destructive' : 'muted'}
            loading={alerts.isLoading}
          />
        </div>
      </div>

      {/* Mobile: Select dropdown — Desktop: Tabs */}
      <div className="md:hidden">
        <Select value={activeTab} onValueChange={(v) => setActiveTab(v as TabId)}>
          <SelectTrigger className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {TABS.map((t) => (
              <SelectItem key={t.id} value={t.id}>
                <span className="inline-flex items-center gap-2">
                  <t.icon className="h-4 w-4" />
                  {t.label}
                </span>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as TabId)}>
        <TabsList className="hidden md:inline-flex">
          {TABS.map((t) => (
            <TabsTrigger key={t.id} value={t.id} icon={t.icon}>
              {t.label}
            </TabsTrigger>
          ))}
        </TabsList>

        {/* === INVENTARIO (default) === */}
        <TabsContent value="inventario" className="mt-5">
          <ItemsPanel />
        </TabsContent>

        <TabsContent value="movimientos" className="mt-5">
          <MovementsPanel warehouseId={mainId} />
        </TabsContent>

        <TabsContent value="transferencias" className="mt-5">
          <TransferenciasPanel />
        </TabsContent>

        <TabsContent value="prestamos" className="mt-5">
          <ToolLoansPanel />
        </TabsContent>

        <TabsContent value="epp" className="mt-5">
          <EppPanel />
        </TabsContent>

        <TabsContent value="combustible" className="mt-5">
          <FuelDispatchesPanel />
        </TabsContent>

        <TabsContent value="mantenimientos" className="mt-5">
          <MaintenancePanel />
        </TabsContent>

        <TabsContent value="inventarios" className="mt-5">
          <InventoryCountsPanel />
        </TabsContent>
      </Tabs>
    </div>
  );
}

// ============================================================================
// KPI compacto en línea — reemplaza el StatCard grande en el header del hub
// ============================================================================

type KpiTone = 'default' | 'muted' | 'warning' | 'destructive';

const KPI_TONE: Record<KpiTone, string> = {
  default: 'text-foreground',
  muted: 'text-foreground',
  warning: 'text-amber-600 dark:text-amber-400',
  destructive: 'text-destructive',
};

const KPI_ICON_TONE: Record<KpiTone, string> = {
  default: 'text-muted-foreground',
  muted: 'text-muted-foreground',
  warning: 'text-amber-600 dark:text-amber-400',
  destructive: 'text-destructive',
};

function KpiInline({
  label,
  value,
  icon: Icon,
  tone = 'default',
  loading,
}: {
  label: string;
  value: string | number;
  icon: React.ElementType;
  tone?: KpiTone;
  loading?: boolean;
}) {
  return (
    <div className="flex items-center justify-center gap-2.5 min-w-0">
      <Icon className={cn('h-4 w-4 shrink-0', KPI_ICON_TONE[tone])} />
      <div className="min-w-0 leading-tight text-center">
        <p className="text-[10px] uppercase tracking-wider text-muted-foreground/80 font-medium">
          {label}
        </p>
        <p
          className={cn('text-base font-semibold tabular-nums truncate', KPI_TONE[tone])}
        >
          {loading ? (
            <span className="inline-block h-4 w-10 rounded bg-muted animate-pulse" />
          ) : (
            value
          )}
        </p>
      </div>
    </div>
  );
}
