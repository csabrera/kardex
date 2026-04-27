'use client';

import { type ColumnDef } from '@tanstack/react-table';
import { Plus, RotateCcw } from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';

import { DataTable } from '@/components/data-table/data-table';
import { rowNumberColumn } from '@/components/data-table/row-number-column';
import { NewEPPAssignmentDialog } from '@/components/epp/new-epp-assignment-dialog';
import { ReplaceEPPDialog } from '@/components/epp/replace-epp-dialog';
import { ActionButton } from '@/components/ui/action-button';
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
  REPLACEMENT_REASON_LABELS,
  useEPPAssignments,
  type EPPAssignment,
} from '@/hooks/use-epp';
import { useObras } from '@/hooks/use-obras';

interface Props {
  headerAction?: React.ReactNode;
  /** Filtra por worker específico (ficha empleado). */
  workerId?: string;
  /** Pre-selecciona obra al abrir Nueva asignación. */
  defaultObraId?: string;
  /** Oculta el filtro de obra cuando ya estás en contexto de una obra. */
  hideObraFilter?: boolean;
}

export function EppPanel({
  headerAction,
  workerId,
  defaultObraId,
  hideObraFilter,
}: Props) {
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [search, setSearch] = useState('');
  const [obraId, setObraId] = useState('_all');
  const debouncedSearch = useDebounce(search, 300);

  const [showNew, setShowNew] = useState(false);
  const [toReplace, setToReplace] = useState<EPPAssignment | null>(null);

  const { data: obrasData } = useObras({ pageSize: 100, enabled: !hideObraFilter });

  const { data, isLoading } = useEPPAssignments({
    page,
    pageSize,
    search: debouncedSearch || undefined,
    obraId: obraId === '_all' ? undefined : obraId,
    workerId,
  } as any);

  const action = headerAction ?? (
    <Button className="gap-2" onClick={() => setShowNew(true)}>
      <Plus className="h-4 w-4" /> Nueva asignación
    </Button>
  );

  const columns: ColumnDef<EPPAssignment>[] = [
    rowNumberColumn<EPPAssignment>({ page, pageSize }),
    {
      accessorKey: 'code',
      header: 'Código',
      size: 110,
      cell: ({ row }) => (
        <span className="font-mono text-sm font-semibold">{row.original.code}</span>
      ),
    },
    ...(workerId
      ? []
      : [
          {
            id: 'worker',
            header: 'Empleado',
            cell: ({ row }: any) => (
              <Link
                href={`/dashboard/empleados/${row.original.workerId}`}
                className="group block -mx-2 px-2 py-1 rounded hover:bg-muted/60 transition-colors"
              >
                <p className="text-sm font-medium group-hover:text-accent transition-colors">
                  {row.original.worker.firstName} {row.original.worker.lastName}
                </p>
                <p className="text-xs text-muted-foreground">
                  {row.original.worker.specialty.name}
                </p>
              </Link>
            ),
          } as ColumnDef<EPPAssignment>,
        ]),
    {
      id: 'item',
      header: 'EPP',
      cell: ({ row }) => (
        <Link
          href={`/dashboard/items/${row.original.itemId}`}
          className="group block -mx-2 px-2 py-1 rounded hover:bg-muted/60 transition-colors"
        >
          <p className="text-sm font-medium group-hover:text-accent transition-colors">
            {row.original.item.name}
          </p>
          <p className="text-xs text-muted-foreground font-mono">
            {row.original.item.code}
          </p>
        </Link>
      ),
    },
    {
      id: 'quantity',
      header: 'Cantidad',
      size: 100,
      cell: ({ row }) => (
        <span className="text-sm font-medium tabular-nums">
          {Number(row.original.quantity).toLocaleString('es-PE', {
            maximumFractionDigits: 3,
          })}{' '}
          {row.original.item.unit.abbreviation}
        </span>
      ),
    },
    {
      id: 'warehouse',
      header: 'Origen',
      cell: ({ row }) => (
        <Link
          href={`/dashboard/almacenes/${row.original.warehouseId}`}
          className="text-sm hover:text-accent transition-colors"
        >
          {row.original.warehouse.name}
        </Link>
      ),
    },
    {
      id: 'reason',
      header: 'Motivo',
      size: 130,
      cell: ({ row }) => {
        if (!row.original.replacesId) {
          return <Badge variant="info">Entrega inicial</Badge>;
        }
        const reason = row.original.replacementReason;
        return (
          <Badge variant="warning">
            Reposición
            {reason ? ` · ${REPLACEMENT_REASON_LABELS[reason]}` : ''}
          </Badge>
        );
      },
    },
    {
      id: 'assignedAt',
      header: 'Fecha',
      size: 150,
      cell: ({ row }) => (
        <span className="text-xs text-muted-foreground tabular-nums">
          {new Date(row.original.assignedAt).toLocaleString('es-PE', {
            dateStyle: 'short',
            timeStyle: 'short',
          })}
        </span>
      ),
    },
    {
      id: 'actions',
      header: 'Acciones',
      size: 80,
      cell: ({ row }) => (
        <ActionButton
          icon={RotateCcw}
          label="Registrar reposición"
          tone="warning"
          onClick={() => setToReplace(row.original)}
        />
      ),
    },
  ];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-3">
          <Input
            placeholder="Buscar por código, empleado o EPP..."
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            className="max-w-sm"
          />
          {!hideObraFilter && (
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
                {obrasData?.items.map((o) => (
                  <SelectItem key={o.id} value={o.id}>
                    {o.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
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

      <NewEPPAssignmentDialog
        open={showNew}
        onClose={() => setShowNew(false)}
        lockedObraId={defaultObraId}
      />
      <ReplaceEPPDialog assignment={toReplace} onClose={() => setToReplace(null)} />
    </div>
  );
}
