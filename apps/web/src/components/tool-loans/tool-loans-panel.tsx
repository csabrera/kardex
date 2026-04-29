'use client';

import { type ColumnDef } from '@tanstack/react-table';
import { AlertTriangle, CheckCircle2, Clock, Plus, XCircle } from 'lucide-react';
import { useState } from 'react';

import { DataTable } from '@/components/data-table/data-table';
import { rowNumberColumn } from '@/components/data-table/row-number-column';
import { NewLoanDialog } from '@/components/tool-loans/new-loan-dialog';
import { ReturnLoanDialog } from '@/components/tool-loans/return-loan-dialog';
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
import { StatCard } from '@/components/ui/stat-card';
import { useDebounce } from '@/hooks/use-debounce';
import {
  useMarkToolLoanLost,
  useToolLoans,
  useToolLoansSummary,
  type ToolLoan,
  type ToolLoanStatus,
} from '@/hooks/use-tool-loans';

const STATUS_OPTIONS: { value: ToolLoanStatus | '_all' | '_overdue'; label: string }[] = [
  { value: '_all', label: 'Todos los estados' },
  { value: 'ACTIVE', label: 'Activos' },
  { value: '_overdue', label: 'Vencidos' },
  { value: 'RETURNED', label: 'Devueltos' },
  { value: 'LOST', label: 'Perdidos' },
];

function statusBadge(loan: ToolLoan) {
  if (loan.status === 'RETURNED') {
    const v =
      loan.returnCondition === 'DAMAGED'
        ? 'destructive'
        : loan.returnCondition === 'REGULAR'
          ? 'warning'
          : 'success';
    return <Badge variant={v as any}>Devuelto ({loan.returnCondition})</Badge>;
  }
  if (loan.status === 'LOST') return <Badge variant="destructive">Perdido</Badge>;
  const overdue = new Date(loan.expectedReturnAt) < new Date();
  return overdue ? (
    <Badge variant="destructive">Vencido</Badge>
  ) : (
    <Badge variant="info">Activo</Badge>
  );
}

interface Props {
  headerAction?: React.ReactNode;
  /** Filtra por worker específico (usado en /empleados/[id] tab Préstamos). */
  workerId?: string;
  /** Oculta el grid de StatCards (usado cuando va embebido en una ficha). */
  hideSummary?: boolean;
  /** Pre-selecciona obra al abrir el modal de Nuevo préstamo. */
  defaultObraId?: string;
}

export function ToolLoansPanel({
  headerAction,
  workerId,
  hideSummary,
  defaultObraId,
}: Props) {
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<ToolLoanStatus | '_all' | '_overdue'>('_all');
  const debouncedSearch = useDebounce(search, 300);

  const [showNew, setShowNew] = useState(false);
  const [toReturn, setToReturn] = useState<ToolLoan | null>(null);

  const markLost = useMarkToolLoanLost();
  const confirm = useConfirm();
  const { data: summary } = useToolLoansSummary();
  const { data, isLoading } = useToolLoans({
    page,
    pageSize,
    status: status === '_all' || status === '_overdue' ? undefined : status,
    overdueOnly: status === '_overdue' ? true : undefined,
    search: debouncedSearch || undefined,
    borrowerWorkerId: workerId,
  });

  const action = headerAction ?? (
    <Button className="gap-2" onClick={() => setShowNew(true)}>
      <Plus className="h-4 w-4" /> Nuevo préstamo
    </Button>
  );

  const columns: ColumnDef<ToolLoan>[] = [
    rowNumberColumn<ToolLoan>({ page, pageSize }),
    {
      accessorKey: 'code',
      header: 'Código',
      size: 110,
      cell: ({ getValue }) => (
        <span className="font-mono text-sm font-semibold">{getValue() as string}</span>
      ),
    },
    {
      id: 'item',
      header: 'Herramienta',
      cell: ({ row }) => (
        <div>
          <p className="text-sm font-medium">{row.original.item.name}</p>
          <p className="text-xs text-muted-foreground font-mono">
            {row.original.item.code}
          </p>
        </div>
      ),
    },
    {
      id: 'quantity',
      header: 'Cant.',
      size: 80,
      cell: ({ row }) =>
        `${Number(row.original.quantity)} ${row.original.item.unit.abbreviation}`,
    },
    ...(workerId
      ? []
      : [
          {
            id: 'borrower',
            header: 'Empleado',
            cell: ({ row }: any) => (
              <div>
                <p className="text-sm">
                  {row.original.borrowerWorker.firstName}{' '}
                  {row.original.borrowerWorker.lastName}
                </p>
                <p className="text-xs text-muted-foreground">
                  {row.original.borrowerWorker.specialty.name}
                </p>
              </div>
            ),
          } as ColumnDef<ToolLoan>,
        ]),
    {
      id: 'location',
      header: 'Obra / Estación',
      cell: ({ row }) => (
        <div>
          <p className="text-sm">{row.original.warehouse.obra?.name ?? '—'}</p>
          <p className="text-xs text-muted-foreground">{row.original.workStation.name}</p>
        </div>
      ),
    },
    {
      id: 'expectedReturn',
      header: 'Devolver antes de',
      cell: ({ row }) => {
        const overdue =
          row.original.status === 'ACTIVE' &&
          new Date(row.original.expectedReturnAt) < new Date();
        return (
          <span
            className={`text-xs tabular-nums ${overdue ? 'text-destructive font-semibold' : 'text-muted-foreground'}`}
          >
            {new Date(row.original.expectedReturnAt).toLocaleString('es-PE', {
              dateStyle: 'short',
              timeStyle: 'short',
            })}
          </span>
        );
      },
    },
    {
      id: 'status',
      header: 'Estado',
      size: 130,
      cell: ({ row }) => statusBadge(row.original),
    },
    {
      id: 'actions',
      header: 'Acciones',
      size: 140,
      cell: ({ row }) =>
        row.original.status === 'ACTIVE' ? (
          <div className="flex gap-1.5">
            <ActionButton
              icon={CheckCircle2}
              label="Confirmar devolución de la herramienta"
              tone="success"
              onClick={() => setToReturn(row.original)}
            />
            <ActionButton
              icon={XCircle}
              label="Marcar como perdido (irreversible)"
              tone="destructive"
              disabled={markLost.isPending}
              onClick={async () => {
                const ok = await confirm({
                  title: 'Marcar herramienta como perdida',
                  description: `¿Marcar "${row.original.item.name}" como perdida? Esta acción es irreversible y afecta al stock.`,
                  confirmText: 'Marcar como perdida',
                  tone: 'destructive',
                });
                if (ok) markLost.mutate(row.original.id);
              }}
            />
          </div>
        ) : null,
    },
  ];

  return (
    <div className="space-y-4">
      {!hideSummary && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <StatCard
            title="Activos"
            value={summary?.active ?? 0}
            icon={Clock}
            tone="info"
          />
          <StatCard
            title="Vencidos"
            value={summary?.overdue ?? 0}
            icon={AlertTriangle}
            tone="destructive"
          />
          <StatCard
            title="Devueltos"
            value={summary?.returned ?? 0}
            icon={CheckCircle2}
            tone="success"
          />
          <StatCard
            title="Perdidos"
            value={summary?.lost ?? 0}
            icon={XCircle}
            tone="warning"
          />
        </div>
      )}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-3">
          <Input
            placeholder="Buscar por código, herramienta o responsable..."
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

      <NewLoanDialog
        open={showNew}
        onClose={() => setShowNew(false)}
        lockedObraId={defaultObraId}
      />
      <ReturnLoanDialog loan={toReturn} onClose={() => setToReturn(null)} />
    </div>
  );
}
