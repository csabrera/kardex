'use client';

import { type ColumnDef } from '@tanstack/react-table';
import { Plus, Truck } from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';

import { DataTable } from '@/components/data-table/data-table';
import { rowNumberColumn } from '@/components/data-table/row-number-column';
import { NewEquipmentDialog } from '@/components/equipment/new-equipment-dialog';
import { PageHeader } from '@/components/layout/page-header';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
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
  COUNT_TYPE_LABELS,
  EQUIPMENT_STATUS_LABELS,
  EQUIPMENT_TYPE_LABELS,
  useEquipmentList,
  type Equipment,
  type EquipmentStatus,
} from '@/hooks/use-equipment';

const STATUS_VARIANT: Record<EquipmentStatus, string> = {
  OPERATIVO: 'success',
  EN_MANTENIMIENTO: 'warning',
  AVERIADO: 'destructive',
  BAJA: 'secondary',
};

export default function EquiposPage() {
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<EquipmentStatus | '_all'>('_all');
  const debouncedSearch = useDebounce(search, 300);
  const [showNew, setShowNew] = useState(false);

  const { data, isLoading } = useEquipmentList({
    page,
    pageSize,
    search: debouncedSearch || undefined,
    status: status === '_all' ? undefined : status,
  });

  const columns: ColumnDef<Equipment>[] = [
    rowNumberColumn<Equipment>({ page, pageSize }),
    {
      accessorKey: 'code',
      header: 'Código',
      size: 120,
      cell: ({ row }) => (
        <span className="font-mono text-sm font-semibold">{row.original.code}</span>
      ),
    },
    {
      accessorKey: 'name',
      header: 'Equipo',
      cell: ({ row }) => (
        <Link
          href={`/dashboard/equipos/${row.original.id}`}
          className="group block -mx-2 px-2 py-1 rounded hover:bg-muted/60 transition-colors"
        >
          <p className="font-medium group-hover:text-accent transition-colors">
            {row.original.name}
          </p>
          <p className="text-xs text-muted-foreground">
            {row.original.brand}
            {row.original.brand && row.original.model && ' · '}
            {row.original.model}
            {row.original.year ? ` · ${row.original.year}` : ''}
          </p>
        </Link>
      ),
    },
    {
      accessorKey: 'type',
      header: 'Tipo',
      size: 150,
      cell: ({ row }) => (
        <Badge variant="outline">{EQUIPMENT_TYPE_LABELS[row.original.type]}</Badge>
      ),
    },
    {
      id: 'count',
      header: 'Contador',
      size: 140,
      cell: ({ row }) => {
        const unit =
          row.original.countType === 'HOROMETRO'
            ? 'h'
            : row.original.countType === 'KILOMETRAJE'
              ? 'km'
              : '';
        if (row.original.countType === 'NONE')
          return <span className="text-xs text-muted-foreground">—</span>;
        return (
          <div>
            <p className="text-sm font-semibold tabular-nums">
              {Number(row.original.currentCount).toLocaleString('es-PE', {
                maximumFractionDigits: 1,
              })}{' '}
              {unit}
            </p>
            <p className="text-[10px] text-muted-foreground">
              {COUNT_TYPE_LABELS[row.original.countType]}
            </p>
          </div>
        );
      },
    },
    {
      id: 'obra',
      header: 'Obra',
      cell: ({ row }) =>
        row.original.obra ? (
          <span className="text-sm">{row.original.obra.name}</span>
        ) : (
          <span className="text-xs text-muted-foreground">—</span>
        ),
    },
    {
      accessorKey: 'status',
      header: 'Estado',
      size: 140,
      cell: ({ row }) => (
        <Badge variant={STATUS_VARIANT[row.original.status] as any}>
          {EQUIPMENT_STATUS_LABELS[row.original.status]}
        </Badge>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Equipos"
        description="Maquinaria, vehículos y equipos menores con seguimiento de horómetro/km"
        icon={Truck}
        actions={
          <Button className="gap-2" onClick={() => setShowNew(true)}>
            <Plus className="h-4 w-4" /> Nuevo equipo
          </Button>
        }
      />

      <div className="flex gap-3 flex-wrap">
        <Input
          placeholder="Buscar por código, nombre, serie..."
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
            setStatus(v as EquipmentStatus | '_all');
            setPage(1);
          }}
        >
          <SelectTrigger className="w-48">
            <SelectValue placeholder="Estado" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="_all">Todos los estados</SelectItem>
            {(Object.keys(EQUIPMENT_STATUS_LABELS) as EquipmentStatus[]).map((s) => (
              <SelectItem key={s} value={s}>
                {EQUIPMENT_STATUS_LABELS[s]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
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

      <NewEquipmentDialog open={showNew} onClose={() => setShowNew(false)} />
    </div>
  );
}
