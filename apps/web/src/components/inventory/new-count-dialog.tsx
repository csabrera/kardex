'use client';

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
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Nuevo conteo físico</DialogTitle>
          <DialogDescription>
            Al iniciar el conteo se toma un snapshot del stock actual del almacén. Solo
            puede haber un conteo en progreso por almacén.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-3">
          <div className="space-y-1.5">
            <Label>Almacén *</Label>
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
          </div>

          <div className="flex justify-end gap-2 pt-2 border-t">
            <Button type="button" variant="outline" onClick={onClose}>
              Cancelar
            </Button>
            <Button type="submit" disabled={!warehouseId || createMut.isPending}>
              Iniciar conteo
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
