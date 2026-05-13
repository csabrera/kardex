'use client';

import { Camera, ClipboardCheck, Hammer } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useCreateInventoryCount } from '@/hooks/use-inventory-counts';
import { useWarehouses } from '@/hooks/use-warehouses';

interface Props {
  open: boolean;
  onClose: () => void;
}

export function NewCountDialog({ open, onClose }: Props) {
  const router = useRouter();
  const { data: warehousesData } = useWarehouses({ pageSize: 100 });
  const [warehouseId, setWarehouseId] = useState('');
  const [notes, setNotes] = useState('');
  const createMut = useCreateInventoryCount();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!warehouseId) return;
    createMut.mutate(
      { warehouseId, notes: notes || undefined },
      {
        onSuccess: (count) => {
          setWarehouseId('');
          setNotes('');
          onClose();
          router.push(`/dashboard/inventarios/${count.id}`);
        },
      },
    );
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Iniciar conteo físico</DialogTitle>
          <DialogDescription>
            Elige el almacén que vas a contar. Solo puede haber un conteo en progreso por
            almacén a la vez.
          </DialogDescription>
        </DialogHeader>

        {/* Pasos del flujo — orienta al usuario antes de iniciar */}
        <div className="rounded-md border bg-muted/30 p-3 space-y-2">
          <p className="text-xs font-semibold text-foreground">¿Qué pasa después?</p>
          <ol className="space-y-2 text-xs text-muted-foreground">
            <li className="flex gap-2">
              <Camera className="h-3.5 w-3.5 mt-0.5 shrink-0 text-info" />
              <span>
                <strong className="text-foreground">1.</strong> El sistema toma una "foto"
                del stock actual del almacén.
              </span>
            </li>
            <li className="flex gap-2">
              <ClipboardCheck className="h-3.5 w-3.5 mt-0.5 shrink-0 text-info" />
              <span>
                <strong className="text-foreground">2.</strong> Vas físicamente a la
                bodega y registras la cantidad real de cada ítem.
              </span>
            </li>
            <li className="flex gap-2">
              <Hammer className="h-3.5 w-3.5 mt-0.5 shrink-0 text-info" />
              <span>
                <strong className="text-foreground">3.</strong> Al cerrar el conteo, el
                stock se ajusta automáticamente para los ítems con diferencia. Queda
                registro de quién contó y cuándo.
              </span>
            </li>
          </ol>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3">
          <div className="space-y-1.5">
            <Label>Almacén a contar *</Label>
            <Select value={warehouseId} onValueChange={setWarehouseId}>
              <SelectTrigger>
                <SelectValue placeholder="Seleccionar almacén" />
              </SelectTrigger>
              <SelectContent>
                {warehousesData?.items.map((w) => (
                  <SelectItem key={w.id} value={w.id}>
                    {w.name} · {w.type === 'CENTRAL' ? 'Principal' : 'Obra'}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label>Notas (opcional)</Label>
            <Input
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Ej: conteo mensual, auditoría Q2..."
              maxLength={500}
            />
            <p className="text-[11px] text-muted-foreground">
              Útil para identificar el motivo del conteo más adelante.
            </p>
          </div>

          <div className="flex justify-end gap-2 pt-2 border-t">
            <Button type="button" variant="outline" onClick={onClose}>
              Cancelar
            </Button>
            <Button type="submit" disabled={!warehouseId || createMut.isPending}>
              {createMut.isPending ? 'Iniciando...' : 'Iniciar conteo'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
