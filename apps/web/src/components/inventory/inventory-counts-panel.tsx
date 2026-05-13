'use client';

import { ClipboardCheck, Eye, Info, Plus } from 'lucide-react';
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
      Iniciar conteo físico
    </Button>
  );

  return (
    <div className="space-y-4">
      {/* Banner explicativo — el flujo de "conteo físico" no es obvio para alguien
          sin experiencia en gestión de bodegas. */}
      <div className="rounded-lg border border-info/30 bg-info/5 px-4 py-3 flex gap-3">
        <Info className="h-4 w-4 text-info shrink-0 mt-0.5" />
        <div className="text-xs text-foreground/80 leading-relaxed">
          <p className="font-medium text-foreground mb-1">¿Qué es un conteo físico?</p>
          <p>
            Un conteo es una auditoría del stock real de un almacén. Al iniciarlo se toma
            una "foto" del stock actual; tú vas físicamente a contar cada ítem y registras
            lo encontrado. Al cerrar, el sistema ajusta automáticamente las diferencias
            dejando registro en el kardex.
          </p>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <Select
          value={status}
          onValueChange={(v) => setStatus(v as InventoryCountStatus | 'ALL')}
        >
          <SelectTrigger className="w-full sm:w-60">
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
        <div className="w-full sm:ml-auto sm:w-auto">{action}</div>
      </div>

      <div className="rounded-lg border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
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
                    icon={ClipboardCheck}
                    title="Sin conteos físicos registrados"
                    description="Empieza un conteo cuando necesites verificar que el stock del sistema coincide con lo que hay físicamente en la bodega."
                    action={
                      <Button onClick={() => setNewOpen(true)} className="gap-2">
                        <Plus className="h-4 w-4" />
                        Iniciar conteo físico
                      </Button>
                    }
                  />
                </TableCell>
              </TableRow>
            )}
            {items.map((c) => (
              <TableRow key={c.id}>
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
