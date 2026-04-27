import { Badge } from '@/components/ui/badge';

import type { InventoryCountStatus } from '@/hooks/use-inventory-counts';

const META: Record<
  InventoryCountStatus,
  { label: string; variant: 'info' | 'success' | 'secondary' }
> = {
  IN_PROGRESS: { label: 'En progreso', variant: 'info' },
  CLOSED: { label: 'Cerrado', variant: 'success' },
  CANCELLED: { label: 'Cancelado', variant: 'secondary' },
};

export function InventoryStatusBadge({ status }: { status: InventoryCountStatus }) {
  const m = META[status];
  return (
    <Badge variant={m.variant} className="text-xs">
      {m.label}
    </Badge>
  );
}
