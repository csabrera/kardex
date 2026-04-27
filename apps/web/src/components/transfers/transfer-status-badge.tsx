import { Badge } from '@/components/ui/badge';

import type { TransferStatus } from '@/hooks/use-transfers';

const STATUS_CONFIG: Record<TransferStatus, { label: string; variant: string }> = {
  EN_TRANSITO: { label: 'En tránsito', variant: 'warning' },
  RECIBIDA: { label: 'Recibida', variant: 'success' },
  RECHAZADA: { label: 'Rechazada', variant: 'destructive' },
  CANCELADA: { label: 'Cancelada', variant: 'outline' },
};

export function TransferStatusBadge({ status }: { status: TransferStatus }) {
  const cfg = STATUS_CONFIG[status] ?? { label: status, variant: 'outline' };
  return <Badge variant={cfg.variant as any}>{cfg.label}</Badge>;
}
