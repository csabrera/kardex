'use client';

import { ChevronLeft, ChevronRight, ShieldCheck } from 'lucide-react';
import { useState } from 'react';

import { PageHeader } from '@/components/layout/page-header';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { Input } from '@/components/ui/input';
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
import { useAuditLogs, useAuditLogResources } from '@/hooks/use-audit-logs';

const ACTIONS = ['POST', 'PATCH', 'PUT', 'DELETE'] as const;

const ACTION_TONE: Record<string, 'success' | 'info' | 'warning' | 'destructive'> = {
  POST: 'success',
  PATCH: 'info',
  PUT: 'info',
  DELETE: 'destructive',
};

export default function AuditoriaPage() {
  const [page, setPage] = useState(1);
  const [resource, setResource] = useState<string>('ALL');
  const [action, setAction] = useState<string>('ALL');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');

  const { data, isLoading } = useAuditLogs({
    page,
    pageSize: 50,
    resource: resource === 'ALL' ? undefined : resource,
    action: action === 'ALL' ? undefined : action,
    from: from || undefined,
    to: to ? new Date(to + 'T23:59:59').toISOString() : undefined,
  });
  const { data: resources } = useAuditLogResources();

  const items = data?.items ?? [];
  const totalPages = data?.totalPages ?? 1;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Auditoría"
        description="Registro de acciones realizadas en el sistema (POST/PATCH/PUT/DELETE)"
        icon={ShieldCheck}
      />

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="space-y-1.5">
          <Label>Recurso</Label>
          <Select
            value={resource}
            onValueChange={(v) => {
              setResource(v);
              setPage(1);
            }}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">Todos</SelectItem>
              {resources?.map((r) => (
                <SelectItem key={r} value={r}>
                  {r}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label>Acción</Label>
          <Select
            value={action}
            onValueChange={(v) => {
              setAction(v);
              setPage(1);
            }}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">Todas</SelectItem>
              {ACTIONS.map((a) => (
                <SelectItem key={a} value={a}>
                  {a}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label>Desde</Label>
          <Input
            type="date"
            value={from}
            onChange={(e) => {
              setFrom(e.target.value);
              setPage(1);
            }}
          />
        </div>
        <div className="space-y-1.5">
          <Label>Hasta</Label>
          <Input
            type="date"
            value={to}
            onChange={(e) => {
              setTo(e.target.value);
              setPage(1);
            }}
          />
        </div>
      </div>

      <div className="rounded-lg border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[160px]">Fecha</TableHead>
              <TableHead>Usuario</TableHead>
              <TableHead className="w-[90px]">Acción</TableHead>
              <TableHead>Recurso</TableHead>
              <TableHead>ID recurso</TableHead>
              <TableHead className="w-[120px]">IP</TableHead>
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
            {!isLoading && items.length === 0 && (
              <TableRow>
                <TableCell colSpan={6}>
                  <EmptyState
                    title="Sin registros"
                    description="Ajustá los filtros o ampliá el rango de fechas"
                  />
                </TableCell>
              </TableRow>
            )}
            {items.map((log) => (
              <TableRow key={log.id}>
                <TableCell className="font-mono text-xs text-muted-foreground whitespace-nowrap">
                  {new Date(log.createdAt).toLocaleString('es-PE', {
                    dateStyle: 'short',
                    timeStyle: 'medium',
                  })}
                </TableCell>
                <TableCell className="text-sm">
                  {log.user ? (
                    <>
                      <span className="font-medium">
                        {log.user.firstName} {log.user.lastName}
                      </span>
                      <span className="ml-1 text-xs text-muted-foreground">
                        · {log.user.documentType} {log.user.documentNumber}
                      </span>
                    </>
                  ) : (
                    <span className="text-xs text-muted-foreground">
                      Sistema / anónimo
                    </span>
                  )}
                </TableCell>
                <TableCell>
                  <Badge
                    variant={ACTION_TONE[log.action] ?? 'outline'}
                    className="text-xs"
                  >
                    {log.action}
                  </Badge>
                </TableCell>
                <TableCell className="text-sm">{log.resource}</TableCell>
                <TableCell className="font-mono text-xs text-muted-foreground">
                  {log.resourceId ?? '—'}
                </TableCell>
                <TableCell className="font-mono text-xs text-muted-foreground">
                  {log.ip ?? '—'}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {data && data.total > 0 && (
        <div className="flex items-center justify-between text-sm text-muted-foreground">
          <span>
            Página {data.page} de {totalPages} · {data.total} registros
          </span>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={page <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              className="gap-1"
            >
              <ChevronLeft className="h-4 w-4" />
              Anterior
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={page >= totalPages}
              onClick={() => setPage((p) => p + 1)}
              className="gap-1"
            >
              Siguiente
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
