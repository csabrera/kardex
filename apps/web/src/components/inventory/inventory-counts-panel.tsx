'use client';

import { ClipboardCheck, Eye, Plus } from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';

import { InventoryStatusBadge } from '@/components/inventory/inventory-status-badge';
import { NewCountDialog } from '@/components/inventory/new-count-dialog';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
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
import {
  useInventoryCounts,
  type InventoryCountStatus,
} from '@/hooks/use-inventory-counts';

const STATUS_OPTIONS: { value: InventoryCountStatus | 'ALL'; label: string }[] = [
  { value: 'ALL', label: 'Todos los estados' },
  { value: 'IN_PROGRESS', label: 'En progreso' },
  { value: 'CLOSED', label: 'Cerrados' },
  { value: 'CANCELLED', label: 'Cancelados' },
];

interface Props {
  headerAction?: React.ReactNode;
}

export function InventoryCountsPanel({ headerAction }: Props) {
  const [status, setStatus] = useState<InventoryCountStatus | 'ALL'>('ALL');
  const [newOpen, setNewOpen] = useState(false);

  const { data, isLoading } = useInventoryCounts({
    status: status === 'ALL' ? undefined : status,
    pageSize: 50,
  });

  const items = data?.items ?? [];

  // Si el caller no provee headerAction, mostramos uno por default ("Nuevo conteo").
  const action = headerAction ?? (
    <Button onClick={() => setNewOpen(true)} className="gap-2">
      <Plus className="h-4 w-4" />
      Nuevo conteo
    </Button>
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="max-w-[240px]">
          <Select
            value={status}
            onValueChange={(v) => setStatus(v as InventoryCountStatus | 'ALL')}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {STATUS_OPTIONS.map((o) => (
                <SelectItem key={o.value} value={o.value}>
                  {o.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        {action}
      </div>

      <div className="rounded-lg border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[140px]">Código</TableHead>
              <TableHead>Almacén</TableHead>
              <TableHead className="w-[130px]">Estado</TableHead>
              <TableHead className="w-[100px] text-right">Líneas</TableHead>
              <TableHead>Iniciado por</TableHead>
              <TableHead className="w-[160px]">Fecha inicio</TableHead>
              <TableHead className="w-[90px]" />
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
            {!isLoading && items.length === 0 && (
              <TableRow>
                <TableCell colSpan={7}>
                  <EmptyState
                    icon={ClipboardCheck}
                    title="Sin conteos registrados"
                    description="Iniciá un nuevo conteo para ajustar el stock según lo contado físicamente."
                    action={
                      <Button onClick={() => setNewOpen(true)} className="gap-2">
                        <Plus className="h-4 w-4" />
                        Nuevo conteo
                      </Button>
                    }
                  />
                </TableCell>
              </TableRow>
            )}
            {items.map((c) => (
              <TableRow key={c.id}>
                <TableCell className="font-mono text-sm font-semibold">
                  {c.code}
                </TableCell>
                <TableCell>{c.warehouse.name}</TableCell>
                <TableCell>
                  <InventoryStatusBadge status={c.status} />
                </TableCell>
                <TableCell className="text-right text-sm text-muted-foreground">
                  {c._count?.items ?? 0}
                </TableCell>
                <TableCell className="text-sm">
                  {c.startedBy.firstName} {c.startedBy.lastName}
                </TableCell>
                <TableCell className="text-xs text-muted-foreground">
                  {new Date(c.startedAt).toLocaleString('es-PE', {
                    dateStyle: 'short',
                    timeStyle: 'short',
                  })}
                </TableCell>
                <TableCell>
                  <Button asChild variant="ghost" size="sm" className="gap-1">
                    <Link href={`/dashboard/inventarios/${c.id}`}>
                      <Eye className="h-3.5 w-3.5" />
                      Abrir
                    </Link>
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <NewCountDialog open={newOpen} onClose={() => setNewOpen(false)} />
    </div>
  );
}
