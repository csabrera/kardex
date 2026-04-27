'use client';

import {
  ArrowLeft,
  Building,
  Calendar,
  CheckCircle2,
  Clock,
  HardHat,
  Phone,
  Plus,
  RotateCcw,
  Shield,
  User,
  Wrench,
  XCircle,
} from 'lucide-react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useMemo, useState } from 'react';

import { NewEPPAssignmentDialog } from '@/components/epp/new-epp-assignment-dialog';
import { ReplaceEPPDialog } from '@/components/epp/replace-epp-dialog';
import { NewLoanDialog } from '@/components/tool-loans/new-loan-dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  REPLACEMENT_REASON_LABELS,
  useEPPByWorker,
  type EPPAssignment,
} from '@/hooks/use-epp';
import { useToolLoans } from '@/hooks/use-tool-loans';
import { useWorker } from '@/hooks/use-workers';
import { cn } from '@/lib/cn';

export default function WorkerDetailPage() {
  const params = useParams();
  const id = params.id as string;

  const { data: worker, isLoading: workerLoading } = useWorker(id);
  const { data: eppAssignments = [], isLoading: eppLoading } = useEPPByWorker(id);
  const { data: loansPage, isLoading: loansLoading } = useToolLoans({
    borrowerWorkerId: id,
    pageSize: 50,
    enabled: !!id,
  });

  const [toReplace, setToReplace] = useState<EPPAssignment | null>(null);
  const [eppOpen, setEppOpen] = useState(false);
  const [loanOpen, setLoanOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<'info' | 'epp' | 'prestamos'>('info');

  // Agrupar EPP por ítem: las asignaciones del mismo ítem forman una cadena
  // (la más reciente es la vigente; las anteriores quedan como histórico).
  const eppByItem = useMemo(() => {
    const groups = new Map<string, EPPAssignment[]>();
    for (const a of eppAssignments) {
      const list = groups.get(a.itemId) ?? [];
      list.push(a);
      groups.set(a.itemId, list);
    }
    // Ordenar por fecha descendente dentro de cada grupo
    for (const list of groups.values()) {
      list.sort(
        (a, b) => new Date(b.assignedAt).getTime() - new Date(a.assignedAt).getTime(),
      );
    }
    // Convertir a array, ordenado alfabéticamente por nombre del ítem
    return Array.from(groups.values()).sort((a, b) =>
      a[0]!.item.name.localeCompare(b[0]!.item.name),
    );
  }, [eppAssignments]);

  if (workerLoading) {
    return <div className="text-sm text-muted-foreground">Cargando empleado...</div>;
  }
  if (!worker) {
    return <div className="text-sm text-destructive">Empleado no encontrado</div>;
  }

  const activeLoans = loansPage?.items.filter((l) => l.status === 'ACTIVE') ?? [];
  const allLoans = loansPage?.items ?? [];

  return (
    <div className="space-y-6">
      {/* Breadcrumb */}
      <div>
        <Link href="/dashboard/empleados">
          <Button
            variant="ghost"
            size="sm"
            className="gap-1.5 text-muted-foreground h-7 -ml-2"
          >
            <ArrowLeft className="h-3.5 w-3.5" /> Volver a Empleados
          </Button>
        </Link>
      </div>

      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div className="flex items-start gap-4 min-w-0">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-blue-500/10 text-blue-600 dark:text-blue-400 ring-1 ring-blue-500/20">
            <HardHat className="h-6 w-6" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-2xl font-bold tracking-tight leading-tight">
                {worker.firstName} {worker.lastName}
              </h1>
              <Badge variant="outline" className="font-mono text-xs">
                {worker.documentType} {worker.documentNumber}
              </Badge>
              <Badge variant={worker.active ? 'success' : 'secondary'}>
                {worker.active ? 'Activo' : 'Inactivo'}
              </Badge>
            </div>
            <p className="text-sm text-muted-foreground mt-1">{worker.specialty.name}</p>
          </div>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as typeof activeTab)}>
        <TabsList>
          <TabsTrigger value="info" icon={User}>
            Información
          </TabsTrigger>
          <TabsTrigger value="epp" icon={Shield} badge={eppByItem.length}>
            EPP
          </TabsTrigger>
          <TabsTrigger value="prestamos" icon={Wrench} badge={activeLoans.length}>
            Préstamos
          </TabsTrigger>
        </TabsList>

        <TabsContent value="info" className="mt-5">
          {/* Info general */}
          <section className="rounded-xl border bg-card p-5 shadow-sm">
            <header className="flex items-center gap-3 mb-4">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-muted text-muted-foreground ring-1 ring-border">
                <Calendar className="h-4 w-4" />
              </div>
              <div>
                <h2 className="text-sm font-semibold leading-tight">Información</h2>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Datos generales del empleado
                </p>
              </div>
            </header>
            <dl className="grid grid-cols-2 md:grid-cols-3 gap-x-6 gap-y-4 text-sm">
              <InfoRow
                label="Obra actual"
                value={
                  worker.obra ? (
                    <Link
                      href={`/dashboard/obras/${worker.obra.id}`}
                      className="text-accent hover:underline inline-flex items-center gap-1.5"
                    >
                      <Building className="h-3.5 w-3.5" />
                      {worker.obra.name}
                    </Link>
                  ) : (
                    <span className="text-muted-foreground">Sin asignar</span>
                  )
                }
              />
              <InfoRow
                label="Celular"
                value={
                  <span className="inline-flex items-center gap-1.5 font-mono text-xs">
                    <Phone className="h-3.5 w-3.5 text-muted-foreground" />
                    {worker.phone}
                  </span>
                }
              />
              <InfoRow
                label="Especialidad"
                value={<Badge variant="outline">{worker.specialty.name}</Badge>}
              />
              <InfoRow
                label="Fecha de ingreso"
                value={
                  worker.hireDate ? (
                    new Date(worker.hireDate).toLocaleDateString('es-PE', {
                      day: '2-digit',
                      month: 'short',
                      year: 'numeric',
                    })
                  ) : (
                    <span className="text-muted-foreground">—</span>
                  )
                }
              />
              <InfoRow
                label="Dirección"
                value={worker.address ?? <span className="text-muted-foreground">—</span>}
              />
              <InfoRow
                label="Registrado"
                value={new Date(worker.createdAt).toLocaleDateString('es-PE', {
                  day: '2-digit',
                  month: 'short',
                  year: 'numeric',
                })}
              />
              {worker.notes && (
                <div className="col-span-full">
                  <dt className="text-[10px] uppercase tracking-wider text-muted-foreground/70 font-semibold mb-1">
                    Notas
                  </dt>
                  <dd className="text-muted-foreground">{worker.notes}</dd>
                </div>
              )}
            </dl>
          </section>
        </TabsContent>

        <TabsContent value="epp" className="mt-5">
          {/* EPP entregados */}
          <section className="rounded-xl border bg-card shadow-sm">
            <header className="flex items-center justify-between p-5 border-b">
              <div className="flex items-center gap-3">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-accent/10 text-accent ring-1 ring-accent/20">
                  <Shield className="h-4 w-4" />
                </div>
                <div>
                  <h2 className="text-sm font-semibold">
                    Equipos de Protección Personal
                  </h2>
                  <p className="text-xs text-muted-foreground">
                    {eppByItem.length} tipo{eppByItem.length !== 1 ? 's' : ''} de EPP
                    asignado
                    {eppByItem.length !== 1 ? 's' : ''}
                  </p>
                </div>
              </div>
              <Button onClick={() => setEppOpen(true)} className="gap-2">
                <Plus className="h-4 w-4" /> Asignar EPP
              </Button>
            </header>

            {eppLoading ? (
              <div className="p-10 text-center text-sm text-muted-foreground">
                Cargando asignaciones...
              </div>
            ) : eppByItem.length === 0 ? (
              <div className="p-10">
                <EmptyState
                  icon={Shield}
                  title="Sin EPP registrado"
                  description="Este empleado aún no ha recibido Equipo de Protección Personal."
                />
              </div>
            ) : (
              <div className="divide-y">
                {eppByItem.map((group) => {
                  const current = group[0]!;
                  const history = group.slice(1);
                  return (
                    <div key={current.itemId} className="p-5 space-y-3">
                      <div className="flex items-start justify-between gap-3 flex-wrap">
                        <div className="flex items-start gap-3 min-w-0">
                          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-muted ring-1 ring-border">
                            <Shield className="h-4 w-4 text-muted-foreground" />
                          </div>
                          <div className="min-w-0">
                            <Link
                              href={`/dashboard/items/${current.itemId}`}
                              className="font-medium hover:text-accent transition-colors"
                            >
                              {current.item.name}
                            </Link>
                            <p className="text-xs text-muted-foreground">
                              <span className="font-mono">{current.item.code}</span>
                              {' · '}
                              Última entrega:{' '}
                              {new Date(current.assignedAt).toLocaleDateString('es-PE', {
                                day: '2-digit',
                                month: 'short',
                                year: 'numeric',
                              })}
                              {' · '}
                              {Number(current.quantity)} {current.item.unit.abbreviation}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <Badge variant={current.replacesId ? 'warning' : 'info'}>
                            {current.replacesId ? 'Reposición' : 'Inicial'}
                          </Badge>
                          <Button
                            variant="outline"
                            size="sm"
                            className="gap-1.5 h-8"
                            onClick={() => setToReplace(current)}
                          >
                            <RotateCcw className="h-3.5 w-3.5" />
                            Reponer
                          </Button>
                        </div>
                      </div>

                      {history.length > 0 && (
                        <details className="text-xs">
                          <summary className="cursor-pointer text-muted-foreground hover:text-foreground select-none">
                            Ver histórico ({history.length} entrega
                            {history.length !== 1 ? 's' : ''} anterior
                            {history.length !== 1 ? 'es' : ''})
                          </summary>
                          <ol className="mt-2 ml-4 border-l pl-4 space-y-2">
                            {history.map((h) => (
                              <li key={h.id} className="flex items-start gap-2">
                                <span className="font-mono text-[11px] text-muted-foreground shrink-0">
                                  {h.code}
                                </span>
                                <span className="text-muted-foreground">
                                  {new Date(h.assignedAt).toLocaleDateString('es-PE', {
                                    day: '2-digit',
                                    month: 'short',
                                    year: 'numeric',
                                  })}
                                  {' · '}
                                  {Number(h.quantity)} {h.item.unit.abbreviation}
                                  {h.replacementReason &&
                                    ` · ${REPLACEMENT_REASON_LABELS[h.replacementReason]}`}
                                </span>
                              </li>
                            ))}
                          </ol>
                        </details>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </section>
        </TabsContent>

        <TabsContent value="prestamos" className="mt-5">
          {/* Préstamos de herramientas */}
          <section className="rounded-xl border bg-card shadow-sm">
            <header className="flex items-center justify-between p-5 border-b">
              <div className="flex items-center gap-3">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-amber-500/10 text-amber-600 dark:text-amber-400 ring-1 ring-amber-500/20">
                  <Wrench className="h-4 w-4" />
                </div>
                <div>
                  <h2 className="text-sm font-semibold">Préstamos de herramientas</h2>
                  <p className="text-xs text-muted-foreground">
                    {activeLoans.length} activo{activeLoans.length !== 1 ? 's' : ''} ·{' '}
                    {allLoans.length} en total
                  </p>
                </div>
              </div>
              <Button onClick={() => setLoanOpen(true)} className="gap-2">
                <Plus className="h-4 w-4" /> Prestar herramienta
              </Button>
            </header>

            {loansLoading ? (
              <div className="p-10 text-center text-sm text-muted-foreground">
                Cargando préstamos...
              </div>
            ) : allLoans.length === 0 ? (
              <div className="p-10">
                <EmptyState
                  icon={Wrench}
                  title="Sin préstamos registrados"
                  description="Este empleado no tiene herramientas prestadas."
                />
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-muted/40 text-xs uppercase tracking-wider text-muted-foreground">
                    <tr>
                      <th className="text-left px-4 py-2.5 font-medium">Código</th>
                      <th className="text-left px-4 py-2.5 font-medium">Herramienta</th>
                      <th className="text-right px-4 py-2.5 font-medium">Cant.</th>
                      <th className="text-left px-4 py-2.5 font-medium">Estación</th>
                      <th className="text-left px-4 py-2.5 font-medium">
                        Devolver antes
                      </th>
                      <th className="text-left px-4 py-2.5 font-medium">Estado</th>
                    </tr>
                  </thead>
                  <tbody>
                    {allLoans.slice(0, 20).map((l) => {
                      const overdue =
                        l.status === 'ACTIVE' &&
                        new Date(l.expectedReturnAt) < new Date();
                      return (
                        <tr key={l.id} className="border-t hover:bg-muted/20">
                          <td className="px-4 py-2.5 font-mono text-xs font-medium">
                            {l.code}
                          </td>
                          <td className="px-4 py-2.5">
                            <Link
                              href={`/dashboard/items/${l.item.id}`}
                              className="hover:text-accent transition-colors"
                            >
                              {l.item.name}
                            </Link>
                          </td>
                          <td className="px-4 py-2.5 text-right tabular-nums">
                            {Number(l.quantity)} {l.item.unit.abbreviation}
                          </td>
                          <td className="px-4 py-2.5 text-xs">{l.workStation.name}</td>
                          <td
                            className={cn(
                              'px-4 py-2.5 text-xs tabular-nums',
                              overdue
                                ? 'text-destructive font-semibold'
                                : 'text-muted-foreground',
                            )}
                          >
                            {new Date(l.expectedReturnAt).toLocaleString('es-PE', {
                              dateStyle: 'short',
                              timeStyle: 'short',
                            })}
                          </td>
                          <td className="px-4 py-2.5">
                            {l.status === 'RETURNED' ? (
                              <Badge variant="success" className="gap-1">
                                <CheckCircle2 className="h-3 w-3" /> Devuelto
                              </Badge>
                            ) : l.status === 'LOST' ? (
                              <Badge variant="destructive" className="gap-1">
                                <XCircle className="h-3 w-3" /> Perdido
                              </Badge>
                            ) : overdue ? (
                              <Badge variant="destructive" className="gap-1">
                                <Clock className="h-3 w-3" /> Vencido
                              </Badge>
                            ) : (
                              <Badge variant="info" className="gap-1">
                                <Clock className="h-3 w-3" /> Activo
                              </Badge>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </TabsContent>
      </Tabs>

      <ReplaceEPPDialog assignment={toReplace} onClose={() => setToReplace(null)} />
      <NewEPPAssignmentDialog
        open={eppOpen}
        onClose={() => setEppOpen(false)}
        lockedObraId={worker.obra?.id}
      />
      <NewLoanDialog
        open={loanOpen}
        onClose={() => setLoanOpen(false)}
        lockedObraId={worker.obra?.id}
      />
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <dt className="text-[10px] uppercase tracking-wider text-muted-foreground/70 font-semibold mb-1">
        {label}
      </dt>
      <dd>{value}</dd>
    </div>
  );
}
