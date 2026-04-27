'use client';

import { type ColumnDef } from '@tanstack/react-table';
import { Edit, HardHat, Plus, Trash2, UserCheck, UserX } from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';

import { DataTable } from '@/components/data-table/data-table';
import { rowNumberColumn } from '@/components/data-table/row-number-column';
import { PageHeader } from '@/components/layout/page-header';
import { ActionButton } from '@/components/ui/action-button';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useConfirm } from '@/components/ui/confirm-provider';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { WorkerFormDialog } from '@/components/workers/worker-form-dialog';
import { useDebounce } from '@/hooks/use-debounce';
import { useObras } from '@/hooks/use-obras';
import { useSpecialties } from '@/hooks/use-specialties';
import {
  useDeleteWorker,
  useUpdateWorker,
  useWorkers,
  type Worker,
} from '@/hooks/use-workers';

export default function EmpleadosPage() {
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [search, setSearch] = useState('');
  const [specialtyId, setSpecialtyId] = useState('_all');
  const [obraId, setObraId] = useState('_all');
  const debouncedSearch = useDebounce(search, 300);
  const [showNew, setShowNew] = useState(false);
  const [editing, setEditing] = useState<Worker | null>(null);

  const { data: specialties } = useSpecialties();
  const { data: obras } = useObras({ pageSize: 100 });
  const { data, isLoading } = useWorkers({
    page,
    pageSize,
    search: debouncedSearch || undefined,
    specialtyId: specialtyId === '_all' ? undefined : specialtyId,
    obraId: obraId === '_all' ? undefined : obraId,
  });

  const updateMut = useUpdateWorker();
  const deleteMut = useDeleteWorker();
  const confirm = useConfirm();

  const toggleActive = (w: Worker) => {
    updateMut.mutate({ id: w.id, dto: { active: !w.active } });
  };

  const handleDelete = async (w: Worker) => {
    const ok = await confirm({
      title: `Eliminar empleado`,
      description: `¿Eliminar a ${w.firstName} ${w.lastName}? Solo se puede si no tiene préstamos activos.`,
      confirmText: 'Eliminar',
      tone: 'destructive',
    });
    if (ok) deleteMut.mutate(w.id);
  };

  const columns: ColumnDef<Worker>[] = [
    rowNumberColumn<Worker>({ page, pageSize }),
    {
      id: 'name',
      header: 'Empleado',
      cell: ({ row }) => (
        <Link
          href={`/dashboard/empleados/${row.original.id}`}
          className="group block -mx-2 px-2 py-1 rounded hover:bg-muted/60 transition-colors"
        >
          <p className="text-sm font-medium group-hover:text-accent transition-colors">
            {row.original.firstName} {row.original.lastName}
          </p>
          <p className="text-xs text-muted-foreground font-mono">
            {row.original.documentType} {row.original.documentNumber}
          </p>
        </Link>
      ),
    },
    {
      id: 'phone',
      header: 'Celular',
      size: 110,
      cell: ({ row }) => <span className="text-sm font-mono">{row.original.phone}</span>,
    },
    {
      id: 'specialty',
      header: 'Especialidad',
      cell: ({ row }) => <Badge variant="outline">{row.original.specialty.name}</Badge>,
    },
    {
      id: 'obra',
      header: 'Obra asignada',
      cell: ({ row }) =>
        row.original.obra ? (
          <span className="text-sm">{row.original.obra.name}</span>
        ) : (
          <span className="text-xs text-muted-foreground">—</span>
        ),
    },
    {
      id: 'status',
      header: 'Estado',
      size: 90,
      cell: ({ row }) => (
        <Badge variant={row.original.active ? 'success' : 'secondary'}>
          {row.original.active ? 'Activo' : 'Inactivo'}
        </Badge>
      ),
    },
    {
      id: 'actions',
      header: 'Acciones',
      size: 160,
      cell: ({ row }) => (
        <div className="flex gap-1.5">
          <ActionButton
            icon={Edit}
            label="Editar empleado"
            tone="accent"
            onClick={() => setEditing(row.original)}
          />
          {row.original.active ? (
            <ActionButton
              icon={UserX}
              label="Desactivar empleado"
              tone="warning"
              onClick={() => toggleActive(row.original)}
              disabled={updateMut.isPending}
            />
          ) : (
            <ActionButton
              icon={UserCheck}
              label="Activar empleado"
              tone="success"
              onClick={() => toggleActive(row.original)}
              disabled={updateMut.isPending}
            />
          )}
          <ActionButton
            icon={Trash2}
            label="Eliminar empleado"
            tone="destructive"
            onClick={() => handleDelete(row.original)}
            disabled={deleteMut.isPending}
          />
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Empleados"
        description="Obreros y personal de obra (no acceden al sistema)"
        icon={HardHat}
        actions={
          <Button className="gap-2" onClick={() => setShowNew(true)}>
            <Plus className="h-4 w-4" /> Nuevo empleado
          </Button>
        }
      />

      <div className="flex gap-3 flex-wrap">
        <Input
          placeholder="Buscar por nombre, documento o celular..."
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setPage(1);
          }}
          className="max-w-sm"
        />
        <Select
          value={specialtyId}
          onValueChange={(v) => {
            setSpecialtyId(v);
            setPage(1);
          }}
        >
          <SelectTrigger className="w-48">
            <SelectValue placeholder="Especialidad" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="_all">Todas las especialidades</SelectItem>
            {specialties?.map((s) => (
              <SelectItem key={s.id} value={s.id}>
                {s.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select
          value={obraId}
          onValueChange={(v) => {
            setObraId(v);
            setPage(1);
          }}
        >
          <SelectTrigger className="w-56">
            <SelectValue placeholder="Obra" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="_all">Todas las obras</SelectItem>
            {obras?.items.map((o) => (
              <SelectItem key={o.id} value={o.id}>
                {o.name}
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

      <WorkerFormDialog open={showNew} onClose={() => setShowNew(false)} />
      <WorkerFormDialog
        open={!!editing}
        onClose={() => setEditing(null)}
        worker={editing}
      />
    </div>
  );
}
