'use client';

import { type ColumnDef } from '@tanstack/react-table';
import { Ban, CheckCircle2, ChevronDown, PlayCircle, Plus } from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';

import { DataTable } from '@/components/data-table/data-table';
import { rowNumberColumn } from '@/components/data-table/row-number-column';
import { NewMaintenanceDialog } from '@/components/maintenance/new-maintenance-dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useConfirm } from '@/components/ui/confirm-provider';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useDebounce } from '@/hooks/use-debounce';
import {
  MAINTENANCE_STATUS_LABELS,
  MAINTENANCE_TYPE_LABELS,
  useCancelMaintenance,
  useCompleteMaintenance,
  useMaintenances,
  useStartMaintenance,
  type Maintenance,
  type MaintenanceStatus,
} from '@/hooks/use-maintenance';

interface Props {
  headerAction?: React.ReactNode;
  /** Filtra por equipo específico (ficha equipo). */
  equipmentId?: string;
}

export function MaintenancePanel({ headerAction, equipmentId }: Props) {
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<MaintenanceStatus | '_all'>('_all');
  const debouncedSearch = useDebounce(search, 300);
  const [showNew, setShowNew] = useState(false);

  const { data, isLoading } = useMaintenances({
    page,
    pageSize,
    search: debouncedSearch || undefined,
    status: status === '_all' ? undefined : status,
    equipmentId,
  } as any);

  const startMut = useStartMaintenance();
  const completeMut = useCompleteMaintenance();
  const cancelMut = useCancelMaintenance();
  const confirm = useConfirm();

  const handleStart = async (m: Maintenance) => {
    const count = prompt(
      `Lectura inicial del contador (actual: ${m.equipment.currentCount}):`,
      String(m.equipment.currentCount),
    );
    if (count == null) return;
    const value = Number(count);
    if (isNaN(value) || value < 0) return;
    startMut.mutate({ id: m.id, countAtStart: value });
  };

  const handleComplete = async (m: Maintenance) => {
    const count = prompt(
      `Lectura final del contador (inicio: ${m.countAtStart}):`,
      String(m.countAtStart ?? m.equipment.currentCount),
    );
    if (count == null) return;
    const value = Number(count);
    if (isNaN(value) || value < 0) return;
    completeMut.mutate({ id: m.id, countAtEnd: value });
  };

  const handleCancel = async (m: Maintenance) => {
    const reason = prompt('Motivo de la cancelación:');
    if (!reason || !reason.trim()) return;
    const ok = await confirm({
      title: `Cancelar mantenimiento ${m.code}`,
      description: 'Esta acción no se puede deshacer.',
      confirmText: 'Cancelar mantenimiento',
      tone: 'destructive',
    });
    if (ok) cancelMut.mutate({ id: m.id, reason: reason.trim() });
  };

  const action = headerAction ?? (
    <Button className="gap-2" onClick={() => setShowNew(true)}>
      <Plus className="h-4 w-4" /> Nuevo mantenimiento
    </Button>
  );

  const columns: ColumnDef<Maintenance>[] = [
    rowNumberColumn<Maintenance>({ page, pageSize }),
    {
      accessorKey: 'code',
      header: 'Código',
      size: 110,
      cell: ({ row }) => (
        <span className="font-mono text-sm font-semibold">{row.original.code}</span>
      ),
    },
    ...(equipmentId
      ? []
      : [
          {
            id: 'equipment',
            header: 'Equipo',
            cell: ({ row }: any) => (
              <Link
                href={`/dashboard/equipos/${row.original.equipmentId}`}
                className="group block -mx-2 px-2 py-1 rounded hover:bg-muted/60 transition-colors"
              >
                <p className="text-sm font-medium group-hover:text-accent transition-colors">
                  {row.original.equipment.name}
                </p>
                <p className="text-xs text-muted-foreground font-mono">
                  {row.original.equipment.code}
                </p>
              </Link>
            ),
          } as ColumnDef<Maintenance>,
        ]),
    {
      accessorKey: 'type',
      header: 'Tipo',
      size: 110,
      cell: ({ row }) => (
        <Badge variant="outline">{MAINTENANCE_TYPE_LABELS[row.original.type]}</Badge>
      ),
    },
    {
      accessorKey: 'description',
      header: 'Descripción',
      cell: ({ row }) => (
        <span className="text-sm truncate block max-w-[260px]">
          {row.original.description}
        </span>
      ),
    },
    {
      id: 'items',
      header: 'Repuestos',
      size: 90,
      cell: ({ row }) => (
        <span className="text-sm tabular-nums">{row.original.items.length}</span>
      ),
    },
    {
      accessorKey: 'status',
      header: 'Estado',
      size: 130,
      cell: ({ row }) => (
        <Badge
          variant={
            row.original.status === 'COMPLETADO'
              ? 'success'
              : row.original.status === 'EN_CURSO'
                ? 'warning'
                : row.original.status === 'CANCELADO'
                  ? 'secondary'
                  : 'info'
          }
        >
          {MAINTENANCE_STATUS_LABELS[row.original.status]}
        </Badge>
      ),
    },
    {
      id: 'actions',
      header: 'Acciones',
      size: 130,
      cell: ({ row }) => {
        const m = row.original;
        const canStart = m.status === 'PROGRAMADO';
        const canComplete = m.status === 'EN_CURSO';
        const canCancel = m.status === 'PROGRAMADO' || m.status === 'EN_CURSO';

        if (!canStart && !canComplete && !canCancel) {
          return <span className="text-xs text-muted-foreground">—</span>;
        }

        return (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="gap-1.5 h-9">
                Acciones
                <ChevronDown className="h-3.5 w-3.5 opacity-70" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-52">
              {canStart && (
                <DropdownMenuItem onSelect={() => handleStart(m)}>
                  <PlayCircle />
                  Iniciar mantenimiento
                </DropdownMenuItem>
              )}
              {canComplete && (
                <DropdownMenuItem onSelect={() => handleComplete(m)}>
                  <CheckCircle2 />
                  Completar
                </DropdownMenuItem>
              )}
              {canCancel && (
                <DropdownMenuItem destructive onSelect={() => handleCancel(m)}>
                  <Ban />
                  Cancelar
                </DropdownMenuItem>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        );
      },
    },
  ];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-3">
          <Input
            placeholder="Buscar por código, equipo, descripción..."
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            className="max-w-sm"
          />
          <Select
            value={status}
            onValueChange={(v) => {
              setStatus(v as MaintenanceStatus | '_all');
              setPage(1);
            }}
          >
            <SelectTrigger className="w-48">
              <SelectValue placeholder="Estado" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="_all">Todos</SelectItem>
              {(Object.keys(MAINTENANCE_STATUS_LABELS) as MaintenanceStatus[]).map(
                (s) => (
                  <SelectItem key={s} value={s}>
                    {MAINTENANCE_STATUS_LABELS[s]}
                  </SelectItem>
                ),
              )}
            </SelectContent>
          </Select>
        </div>
        {action}
      </div>

      <DataTable
        columns={columns}
        data={data?.items ?? []}
        isLoading={isLoading}
        page={page}
        pageSize={pageSize}
        onPageSizeChange={setPageSize}
        total={data?.total ?? 0}
        onPageChange={setPage}
      />

      <NewMaintenanceDialog open={showNew} onClose={() => setShowNew(false)} />
    </div>
  );
}
