'use client';

import { type ColumnDef } from '@tanstack/react-table';
import { Building, Edit, Eye, Plus } from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';

import { DataTable } from '@/components/data-table/data-table';
import { rowNumberColumn } from '@/components/data-table/row-number-column';
import { PageHeader } from '@/components/layout/page-header';
import { ObraFormDialog } from '@/components/obras/obra-form-dialog';
import { ObraStatusBadge } from '@/components/obras/obra-status-badge';
import { ActionButton } from '@/components/ui/action-button';
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
import { useObras, type Obra, type ObraStatus } from '@/hooks/use-obras';

const STATUS_OPTIONS: { value: ObraStatus | '_all'; label: string }[] = [
  { value: '_all', label: 'Todos los estados' },
  { value: 'PLANIFICACION', label: 'Planificación' },
  { value: 'ACTIVA', label: 'Activas' },
  { value: 'SUSPENDIDA', label: 'Suspendidas' },
  { value: 'FINALIZADA', label: 'Finalizadas' },
];

export default function ObrasPage() {
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<ObraStatus | '_all'>('_all');
  const debouncedSearch = useDebounce(search, 300);
  const [showNew, setShowNew] = useState(false);
  const [editing, setEditing] = useState<Obra | null>(null);

  const { data, isLoading } = useObras({
    page,
    pageSize,
    status: status === '_all' ? undefined : status,
    search: debouncedSearch || undefined,
  });

  const columns: ColumnDef<Obra>[] = [
    rowNumberColumn<Obra>({ page, pageSize }),
    {
      id: 'name',
      header: 'Nombre / Cliente',
      cell: ({ row }) => (
        <div>
          <p className="text-sm font-medium">{row.original.name}</p>
          {row.original.client && (
            <p className="text-xs text-muted-foreground">{row.original.client}</p>
          )}
        </div>
      ),
    },
    {
      id: 'status',
      header: 'Estado',
      size: 120,
      cell: ({ row }) => <ObraStatusBadge status={row.original.status} />,
    },
    {
      id: 'responsible',
      header: 'Responsable',
      cell: ({ row }) =>
        row.original.responsibleUser ? (
          `${row.original.responsibleUser.firstName} ${row.original.responsibleUser.lastName}`
        ) : (
          <span className="text-muted-foreground text-xs">—</span>
        ),
    },
    {
      id: 'counts',
      header: 'Recursos',
      size: 140,
      cell: ({ row }) => {
        const c = row.original._count;
        return c ? (
          <div className="text-xs text-muted-foreground space-x-2">
            <span>{c.warehouses} alm.</span>
            <span>·</span>
            <span>{c.workStations} est.</span>
            <span>·</span>
            <span>{c.workers} emp.</span>
          </div>
        ) : null;
      },
    },
    {
      id: 'dates',
      header: 'Fechas',
      cell: ({ row }) => (
        <span className="text-xs text-muted-foreground">
          {row.original.startDate
            ? new Date(row.original.startDate).toLocaleDateString('es-PE')
            : '—'}
          {' → '}
          {row.original.endDate
            ? new Date(row.original.endDate).toLocaleDateString('es-PE')
            : '—'}
        </span>
      ),
    },
    {
      id: 'actions',
      header: 'Acciones',
      size: 120,
      cell: ({ row }) => (
        <div className="flex gap-1.5">
          <Link href={`/dashboard/obras/${row.original.id}`}>
            <ActionButton icon={Eye} label="Ver detalle" tone="info" />
          </Link>
          <ActionButton
            icon={Edit}
            label="Editar obra"
            tone="accent"
            onClick={() => setEditing(row.original)}
          />
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Obras"
        description="Proyectos o fuentes de trabajo de la empresa"
        icon={Building}
        actions={
          <Button className="gap-2" onClick={() => setShowNew(true)}>
            <Plus className="h-4 w-4" /> Nueva obra
          </Button>
        }
      />

      <div className="flex gap-3">
        <Input
          placeholder="Buscar por código, nombre, cliente o dirección..."
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
            setStatus(v as any);
            setPage(1);
          }}
        >
          <SelectTrigger className="w-48">
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

      <ObraFormDialog open={showNew} onClose={() => setShowNew(false)} />
      <ObraFormDialog open={!!editing} onClose={() => setEditing(null)} obra={editing} />
    </div>
  );
}
