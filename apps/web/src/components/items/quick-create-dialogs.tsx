'use client';

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
import { useCreateCategory } from '@/hooks/use-categories';
import { useCreateSupplier } from '@/hooks/use-suppliers';
import { useCreateUnit } from '@/hooks/use-units';

/**
 * Sub-modales de creación rápida: se abren desde comboboxes en el formulario
 * de Item / Entrada cuando el usuario no encuentra la opción que necesita.
 *
 * Devuelven el id del registro creado via `onCreated(id)` para que el caller
 * lo seleccione automáticamente sin cerrar el form principal.
 */

interface BaseProps {
  open: boolean;
  onClose: () => void;
  /** Llamado con el id del registro recién creado */
  onCreated?: (id: string) => void;
}

// ────────────────────────────────────────────────────────────────
// Categoría — taxonomía libre, independiente del Tipo del ítem
// ────────────────────────────────────────────────────────────────
export function QuickCreateCategoryDialog({ open, onClose, onCreated }: BaseProps) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const createMut = useCreateCategory();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    createMut.mutate(
      {
        name: name.trim(),
        description: description.trim() || undefined,
      },
      {
        onSuccess: (created: any) => {
          onCreated?.(created.id);
          setName('');
          setDescription('');
          onClose();
        },
      },
    );
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Nueva categoría</DialogTitle>
          <DialogDescription>
            Se creará y seleccionará automáticamente en el formulario.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <Label>Nombre *</Label>
            <Input
              autoFocus
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Agregados"
              required
            />
          </div>
          <div className="space-y-1.5">
            <Label>Descripción</Label>
            <Input
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Opcional"
            />
          </div>
          <div className="flex justify-end gap-2 pt-2 border-t">
            <Button type="button" variant="outline" onClick={onClose}>
              Cancelar
            </Button>
            <Button type="submit" disabled={createMut.isPending || !name.trim()}>
              {createMut.isPending ? 'Creando...' : 'Crear categoría'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ────────────────────────────────────────────────────────────────
// Unidad
// ────────────────────────────────────────────────────────────────
export function QuickCreateUnitDialog({ open, onClose, onCreated }: BaseProps) {
  const [name, setName] = useState('');
  const [abbreviation, setAbbreviation] = useState('');
  const createMut = useCreateUnit();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !abbreviation.trim()) return;
    createMut.mutate(
      {
        name: name.trim(),
        abbreviation: abbreviation.trim(),
      },
      {
        onSuccess: (created: any) => {
          onCreated?.(created.id);
          setName('');
          setAbbreviation('');
          onClose();
        },
      },
    );
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Nueva unidad de medida</DialogTitle>
          <DialogDescription>
            Se creará y seleccionará automáticamente en el formulario.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5 col-span-2">
              <Label>Nombre *</Label>
              <Input
                autoFocus
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Kilogramo"
                required
              />
            </div>
            <div className="space-y-1.5 col-span-2">
              <Label>Abreviatura *</Label>
              <Input
                value={abbreviation}
                onChange={(e) => setAbbreviation(e.target.value)}
                placeholder="kg"
                required
              />
              <p className="text-[11px] text-muted-foreground">
                Sigla corta usada en reportes (ej: kg, m, bol, cja).
              </p>
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-2 border-t">
            <Button type="button" variant="outline" onClick={onClose}>
              Cancelar
            </Button>
            <Button
              type="submit"
              disabled={createMut.isPending || !name.trim() || !abbreviation.trim()}
            >
              {createMut.isPending ? 'Creando...' : 'Crear unidad'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ────────────────────────────────────────────────────────────────
// Proveedor
// ────────────────────────────────────────────────────────────────
export function QuickCreateSupplierDialog({ open, onClose, onCreated }: BaseProps) {
  const [name, setName] = useState('');
  const [taxId, setTaxId] = useState('');
  const [phone, setPhone] = useState('');
  const createMut = useCreateSupplier();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    createMut.mutate(
      {
        name: name.trim(),
        taxId: taxId.trim() || undefined,
        phone: phone.trim() || undefined,
      },
      {
        onSuccess: (created) => {
          onCreated?.(created.id);
          setName('');
          setTaxId('');
          setPhone('');
          onClose();
        },
      },
    );
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Nuevo proveedor</DialogTitle>
          <DialogDescription>
            Se creará y seleccionará automáticamente. Podrás completar el resto de datos
            después desde Proveedores.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <Label>Razón social *</Label>
            <Input
              autoFocus
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Cementos Pacasmayo S.A.A."
              required
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>RUC / Documento</Label>
              <Input
                value={taxId}
                onChange={(e) => setTaxId(e.target.value)}
                placeholder="20100070970"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Teléfono</Label>
              <Input
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="+51 987 654 321"
              />
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-2 border-t">
            <Button type="button" variant="outline" onClick={onClose}>
              Cancelar
            </Button>
            <Button type="submit" disabled={createMut.isPending || !name.trim()}>
              {createMut.isPending ? 'Creando...' : 'Crear proveedor'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
