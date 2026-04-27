'use client';

import { ArrowLeft, Building, Edit, Plus, Trash2, Warehouse } from 'lucide-react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useState } from 'react';

import { ObraFormDialog } from '@/components/obras/obra-form-dialog';
import { ObraStatusBadge } from '@/components/obras/obra-status-badge';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useConfirm } from '@/components/ui/confirm-provider';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useObra, useDeleteObra } from '@/hooks/use-obras';
import { useCreateWorkStation, useDeleteWorkStation } from '@/hooks/use-work-stations';
import { useWorkers } from '@/hooks/use-workers';

export default function ObraDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;
  const { data: obra, isLoading } = useObra(id);
  const { data: workers } = useWorkers({ obraId: id, pageSize: 50 });
  const deleteObra = useDeleteObra();
  const createStation = useCreateWorkStation();
  const deleteStation = useDeleteWorkStation();
  const confirm = useConfirm();

  const [showEdit, setShowEdit] = useState(false);
  const [showNewStation, setShowNewStation] = useState(false);
  const [stationName, setStationName] = useState('');
  const [stationDesc, setStationDesc] = useState('');

  if (isLoading)
    return <div className="text-sm text-muted-foreground">Cargando obra...</div>;
  if (!obra) return <div className="text-sm text-destructive">Obra no encontrada</div>;

  const handleDelete = async () => {
    const ok = await confirm({
      title: `Eliminar obra "${obra.name}"`,
      description:
        'Esta acción es irreversible. Solo se puede eliminar si la obra no tiene almacenes, empleados ni estaciones activas.',
      confirmText: 'Eliminar obra',
      tone: 'destructive',
    });
    if (!ok) return;
    deleteObra.mutate(id, { onSuccess: () => router.push('/dashboard/obras') });
  };

  const handleAddStation = () => {
    if (!stationName.trim()) return;
    createStation.mutate(
      {
        obraId: id,
        name: stationName.trim(),
        description: stationDesc.trim() || undefined,
      },
      {
        onSuccess: () => {
          setStationName('');
          setStationDesc('');
          setShowNewStation(false);
        },
      },
    );
  };

  return (
    <div className="space-y-4">
      <Link href="/dashboard/obras">
        <Button variant="ghost" size="sm" className="gap-1.5 text-muted-foreground h-7">
          <ArrowLeft className="h-3.5 w-3.5" /> Volver a Obras
        </Button>
      </Link>

      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <Building className="h-6 w-6" /> {obra.name}
            </h1>
            <span className="font-mono text-muted-foreground">{obra.code}</span>
            <ObraStatusBadge status={obra.status} />
          </div>
          {obra.client && (
            <p className="text-sm text-muted-foreground">Cliente: {obra.client}</p>
          )}
          {obra.address && (
            <p className="text-sm text-muted-foreground">{obra.address}</p>
          )}
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowEdit(true)}
            className="gap-1.5"
          >
            <Edit className="h-3.5 w-3.5" /> Editar
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={handleDelete}
            disabled={deleteObra.isPending}
            className="gap-1.5 text-destructive border-destructive/40"
          >
            <Trash2 className="h-3.5 w-3.5" /> Eliminar
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-4">
        {/* Info general */}
        <div className="rounded-lg border bg-card p-4 space-y-2">
          <p className="text-sm font-medium mb-2">Información</p>
          <div className="text-sm space-y-1">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Responsable:</span>
              <span>
                {obra.responsibleUser
                  ? `${obra.responsibleUser.firstName} ${obra.responsibleUser.lastName}`
                  : '—'}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Fecha inicio:</span>
              <span>
                {obra.startDate
                  ? new Date(obra.startDate).toLocaleDateString('es-PE')
                  : '—'}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Fecha fin:</span>
              <span>
                {obra.endDate ? new Date(obra.endDate).toLocaleDateString('es-PE') : '—'}
              </span>
            </div>
          </div>
          {obra.description && (
            <div className="pt-2 mt-2 border-t">
              <p className="text-xs text-muted-foreground">{obra.description}</p>
            </div>
          )}
        </div>

        {/* Almacenes */}
        <div className="rounded-lg border bg-card p-4">
          <div className="flex items-center justify-between mb-2">
            <p className="text-sm font-medium flex items-center gap-1.5">
              <Warehouse className="h-4 w-4" /> Almacenes ({obra.warehouses?.length ?? 0})
            </p>
            <Link href="/dashboard/almacenes">
              <Button variant="ghost" size="sm" className="h-6 text-xs">
                Gestionar
              </Button>
            </Link>
          </div>
          <div className="space-y-1.5">
            {obra.warehouses?.length ? (
              obra.warehouses.map((w) => (
                <div
                  key={w.id}
                  className="text-xs flex justify-between items-center py-1 border-b last:border-b-0"
                >
                  <span>
                    <span className="font-mono text-muted-foreground">{w.code}</span>{' '}
                    {w.name}
                  </span>
                  <Badge variant="outline" className="text-[10px]">
                    {w.type}
                  </Badge>
                </div>
              ))
            ) : (
              <p className="text-xs text-muted-foreground">Sin almacenes asignados</p>
            )}
          </div>
        </div>

        {/* Empleados */}
        <div className="rounded-lg border bg-card p-4">
          <div className="flex items-center justify-between mb-2">
            <p className="text-sm font-medium">
              Empleados ({workers?.items.length ?? 0})
            </p>
            <Link href="/dashboard/empleados">
              <Button variant="ghost" size="sm" className="h-6 text-xs">
                Gestionar
              </Button>
            </Link>
          </div>
          <div className="space-y-1">
            {workers?.items.length ? (
              workers.items.slice(0, 6).map((w) => (
                <div key={w.id} className="text-xs flex justify-between py-0.5">
                  <span>
                    {w.firstName} {w.lastName}
                  </span>
                  <span className="text-muted-foreground">{w.specialty.name}</span>
                </div>
              ))
            ) : (
              <p className="text-xs text-muted-foreground">Sin empleados asignados</p>
            )}
            {(workers?.items.length ?? 0) > 6 && (
              <p className="text-xs text-muted-foreground">
                +{(workers?.items.length ?? 0) - 6} más
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Estaciones de trabajo */}
      <div className="rounded-lg border bg-card p-4">
        <div className="flex items-center justify-between mb-3">
          <div>
            <p className="text-sm font-medium">Estaciones de trabajo</p>
            <p className="text-xs text-muted-foreground">
              Zonas/áreas de esta obra donde se usan las herramientas (Torre A, Sótano,
              Caseta, etc.)
            </p>
          </div>
          <Button size="sm" className="gap-1.5" onClick={() => setShowNewStation(true)}>
            <Plus className="h-3.5 w-3.5" /> Nueva estación
          </Button>
        </div>

        {(obra.workStations?.length ?? 0) === 0 ? (
          <div className="py-8 text-center text-sm text-muted-foreground">
            No hay estaciones de trabajo creadas. Agrega una para poder hacer préstamos de
            herramientas.
          </div>
        ) : (
          <div className="grid grid-cols-3 gap-2">
            {obra.workStations?.map((s) => (
              <div
                key={s.id}
                className="flex items-center justify-between rounded-md border px-3 py-2 text-sm"
              >
                <div>
                  <p className="font-medium">{s.name}</p>
                  {s.description && (
                    <p className="text-xs text-muted-foreground">{s.description}</p>
                  )}
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 text-destructive"
                  onClick={async () => {
                    const ok = await confirm({
                      title: `Eliminar estación "${s.name}"`,
                      description:
                        'No podrá eliminarse si tiene préstamos de herramientas activos.',
                      confirmText: 'Eliminar',
                      tone: 'destructive',
                    });
                    if (ok) deleteStation.mutate(s.id);
                  }}
                  disabled={deleteStation.isPending}
                >
                  <Trash2 className="h-3 w-3" />
                </Button>
              </div>
            ))}
          </div>
        )}
      </div>

      <ObraFormDialog open={showEdit} onClose={() => setShowEdit(false)} obra={obra} />

      {/* Dialog Nueva estación */}
      <Dialog open={showNewStation} onOpenChange={(v) => !v && setShowNewStation(false)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Nueva estación de trabajo</DialogTitle>
            <DialogDescription>
              Zona o área de la obra donde se usarán las herramientas. Ej: Torre A - Piso
              3, Sótano, Caseta.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label>Nombre *</Label>
              <Input
                value={stationName}
                onChange={(e) => setStationName(e.target.value)}
                placeholder="Torre A - Piso 3"
                autoFocus
              />
            </div>
            <div className="space-y-1.5">
              <Label>Descripción</Label>
              <Input
                value={stationDesc}
                onChange={(e) => setStationDesc(e.target.value)}
                placeholder="Opcional"
              />
            </div>
            <div className="flex justify-end gap-2 pt-2 border-t">
              <Button variant="outline" onClick={() => setShowNewStation(false)}>
                Cancelar
              </Button>
              <Button
                onClick={handleAddStation}
                disabled={!stationName.trim() || createStation.isPending}
              >
                Crear estación
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
