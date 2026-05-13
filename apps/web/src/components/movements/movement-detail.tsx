'use client';

import { Badge } from '@/components/ui/badge';
import { DocumentViewButton } from '@/components/ui/file-upload';
import type { Movement, MovementType } from '@/hooks/use-movements';

const TYPE_VARIANT: Record<MovementType, string> = {
  ENTRADA: 'success',
  SALIDA: 'destructive',
  AJUSTE: 'warning',
};

const TYPE_LABELS: Record<MovementType, string> = {
  ENTRADA: 'Entrada',
  SALIDA: 'Salida',
  AJUSTE: 'Ajuste',
};

export const SOURCE_LABELS: Record<string, string> = {
  COMPRA: 'Compra',
  CONSUMO: 'Consumo',
  TRANSFERENCIA: 'Transferencia',
  AJUSTE: 'Ajuste',
  INVENTARIO: 'Inventario',
  DEVOLUCION: 'Devolución',
  BAJA: 'Baja',
  LOST_LOAN: 'Pérdida de préstamo',
  COMPRA_INCUMPLIDA: 'Compra incumplida',
  DEVOLUCION_PARCIAL_TRF: 'Devolución parcial TRF',
};

/**
 * Vista de detalle de un Movement: meta-data, lista de ítems con stock antes/después,
 * y adjuntos (cuando aplica). Usado desde:
 * - `ItemMovementsDialog` (almacén-principal → dropdown Ver movimientos)
 * - Ficha del ítem `/items/[id]` (tabs Kardex y Compras)
 * - Página `/dashboard/compras` (Nivel B)
 */
export function MovementDetail({ movement }: { movement: Movement }) {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4 text-sm">
        <div>
          <p className="text-muted-foreground">Código</p>
          <p className="font-mono font-semibold">{movement.code}</p>
        </div>
        <div>
          <p className="text-muted-foreground">Tipo</p>
          <Badge variant={TYPE_VARIANT[movement.type] as any}>
            {TYPE_LABELS[movement.type]}
          </Badge>
        </div>
        <div>
          <p className="text-muted-foreground">Almacén</p>
          <p>{movement.warehouse.name}</p>
        </div>
        <div>
          <p className="text-muted-foreground">Motivo</p>
          <p>{SOURCE_LABELS[movement.source] ?? movement.source}</p>
        </div>
        {movement.supplier && (
          <div>
            <p className="text-muted-foreground">Proveedor</p>
            <p>{movement.supplier.name}</p>
          </div>
        )}
        <div>
          <p className="text-muted-foreground">Usuario</p>
          <p>
            {movement.user.firstName} {movement.user.lastName}
          </p>
        </div>
        <div>
          <p className="text-muted-foreground">Fecha</p>
          <p>{new Date(movement.createdAt).toLocaleString('es-PE')}</p>
        </div>
        {movement.notes && (
          <div className="col-span-2">
            <p className="text-muted-foreground">Observaciones</p>
            <p>{movement.notes}</p>
          </div>
        )}
      </div>

      <div>
        <p className="text-sm font-medium mb-2">Ítems del movimiento</p>
        <div className="rounded-md border overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-muted/50">
              <tr>
                <th className="px-3 py-2 text-left text-muted-foreground font-medium">
                  Ítem
                </th>
                <th className="px-3 py-2 text-right text-muted-foreground font-medium">
                  Cantidad
                </th>
                <th className="px-3 py-2 text-right text-muted-foreground font-medium">
                  Costo unit.
                </th>
                <th className="px-3 py-2 text-right text-muted-foreground font-medium">
                  Stock después
                </th>
              </tr>
            </thead>
            <tbody>
              {movement.items.map((mi) => {
                const qty = Number(mi.quantity);
                const cost = Number(mi.unitCost ?? 0);
                return (
                  <tr key={mi.id} className="border-t">
                    <td className="px-3 py-2">
                      <span className="font-mono text-xs text-muted-foreground mr-1">
                        {mi.item.code}
                      </span>
                      {mi.item.name}
                    </td>
                    <td className="px-3 py-2 text-right font-medium tabular-nums">
                      {qty.toLocaleString('es-PE', { maximumFractionDigits: 3 })}{' '}
                      {mi.item.unit.abbreviation}
                    </td>
                    <td className="px-3 py-2 text-right text-muted-foreground tabular-nums">
                      {cost > 0
                        ? `S/ ${cost.toLocaleString('es-PE', { maximumFractionDigits: 2 })}`
                        : '—'}
                    </td>
                    <td className="px-3 py-2 text-right font-medium tabular-nums">
                      {Number(mi.stockAfter).toLocaleString('es-PE', {
                        maximumFractionDigits: 3,
                      })}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {movement.attachments && movement.attachments.length > 0 && (
        <div>
          <p className="text-sm font-medium mb-2">
            Adjuntos ({movement.attachments.length})
          </p>
          <div className="flex flex-wrap gap-2">
            {movement.attachments.map((a) => (
              <DocumentViewButton
                key={a.id}
                filename={a.filename}
                originalName={a.originalName}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
