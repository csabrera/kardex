'use client';

import { AlertTriangle, Bell, CheckCheck, PackageMinus } from 'lucide-react';
import { useState } from 'react';

import { PageHeader } from '@/components/layout/page-header';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  useAlerts,
  useMarkAllAlertsRead,
  useMarkAlertRead,
  type AlertType,
} from '@/hooks/use-alerts';

type StatusFilter = 'unread' | 'all';

const TYPE_META: Record<
  AlertType,
  {
    label: string;
    icon: typeof AlertTriangle;
    tone: 'destructive' | 'warning' | 'secondary';
  }
> = {
  STOCK_CRITICO: { label: 'Stock crítico', icon: AlertTriangle, tone: 'destructive' },
  STOCK_BAJO: { label: 'Stock bajo', icon: PackageMinus, tone: 'warning' },
  TRANSFER_DISCREPANCIA: {
    label: 'Discrepancia transferencia',
    icon: AlertTriangle,
    tone: 'secondary',
  },
};

export default function AlertasPage() {
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('unread');
  const [typeFilter, setTypeFilter] = useState<AlertType | 'ALL'>('ALL');

  const { data: alerts, isLoading } = useAlerts({
    read: statusFilter === 'unread' ? false : undefined,
    type: typeFilter === 'ALL' ? undefined : typeFilter,
  });
  const markRead = useMarkAlertRead();
  const markAll = useMarkAllAlertsRead();

  const list = alerts ?? [];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Alertas"
        description="Stock bajo/crítico y discrepancias en transferencias"
        icon={Bell}
        actions={
          list.some((a) => !a.read) ? (
            <Button
              variant="outline"
              size="sm"
              onClick={() => markAll.mutate()}
              className="gap-2"
            >
              <CheckCheck className="h-4 w-4" />
              Marcar todas como leídas
            </Button>
          ) : undefined
        }
      />

      <div className="flex flex-wrap gap-3">
        <div className="flex-1 min-w-[180px]">
          <Select
            value={statusFilter}
            onValueChange={(v) => setStatusFilter(v as StatusFilter)}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="unread">No leídas</SelectItem>
              <SelectItem value="all">Todas</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="flex-1 min-w-[180px]">
          <Select
            value={typeFilter}
            onValueChange={(v) => setTypeFilter(v as AlertType | 'ALL')}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">Todos los tipos</SelectItem>
              <SelectItem value="STOCK_CRITICO">Stock crítico</SelectItem>
              <SelectItem value="STOCK_BAJO">Stock bajo</SelectItem>
              <SelectItem value="TRANSFER_DISCREPANCIA">
                Discrepancia transferencia
              </SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {isLoading && (
        <div className="text-sm text-muted-foreground p-4">Cargando alertas...</div>
      )}

      {!isLoading && list.length === 0 && (
        <div className="flex flex-col items-center justify-center h-40 rounded-lg border border-dashed gap-2 text-muted-foreground">
          <CheckCheck className="h-8 w-8" />
          <p className="text-sm">
            No hay alertas {statusFilter === 'unread' ? 'pendientes' : 'registradas'}
          </p>
        </div>
      )}

      <div className="space-y-2">
        {list.map((alert) => {
          const meta = TYPE_META[alert.type];
          const Icon = meta.icon;
          const isStock = alert.type === 'STOCK_BAJO' || alert.type === 'STOCK_CRITICO';
          return (
            <div
              key={alert.id}
              className={`flex items-start gap-4 rounded-lg border p-4 ${alert.read ? 'bg-muted/30' : 'bg-card'}`}
            >
              <Icon
                className={`h-5 w-5 shrink-0 mt-0.5 ${
                  alert.type === 'STOCK_CRITICO'
                    ? 'text-destructive'
                    : alert.type === 'TRANSFER_DISCREPANCIA'
                      ? 'text-orange-500'
                      : 'text-amber-500'
                }`}
              />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1 flex-wrap">
                  <Badge variant={meta.tone} className="text-xs">
                    {meta.label}
                  </Badge>
                  {alert.read && (
                    <Badge variant="outline" className="text-xs">
                      Leída
                    </Badge>
                  )}
                  <span className="text-xs text-muted-foreground">
                    {new Date(alert.createdAt).toLocaleString('es-PE', {
                      dateStyle: 'short',
                      timeStyle: 'short',
                    })}
                  </span>
                </div>
                <p className="text-sm font-medium">{alert.message}</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Almacén: {alert.warehouse.name}
                  {isStock && (
                    <>
                      {' '}
                      · Stock actual:{' '}
                      {Number(alert.quantity).toLocaleString('es-PE', {
                        maximumFractionDigits: 3,
                      })}{' '}
                      {alert.item.unit.abbreviation} · Mínimo:{' '}
                      {Number(alert.threshold).toLocaleString('es-PE', {
                        maximumFractionDigits: 3,
                      })}
                    </>
                  )}
                  {alert.type === 'TRANSFER_DISCREPANCIA' && (
                    <>
                      {' '}
                      · Enviado:{' '}
                      {Number(alert.threshold).toLocaleString('es-PE', {
                        maximumFractionDigits: 3,
                      })}{' '}
                      · Recibido:{' '}
                      {Number(alert.quantity).toLocaleString('es-PE', {
                        maximumFractionDigits: 3,
                      })}{' '}
                      {alert.item.unit.abbreviation}
                    </>
                  )}
                </p>
              </div>
              {!alert.read && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => markRead.mutate(alert.id)}
                  className="shrink-0 text-xs"
                >
                  Marcar leída
                </Button>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
