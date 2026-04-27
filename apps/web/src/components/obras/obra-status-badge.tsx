import { Badge } from '@/components/ui/badge';

import type { ObraStatus } from '@/hooks/use-obras';

const CONFIG: Record<ObraStatus, { label: string; variant: string }> = {
  PLANIFICACION: { label: 'Planificación', variant: 'secondary' },
  ACTIVA: { label: 'Activa', variant: 'success' },
  SUSPENDIDA: { label: 'Suspendida', variant: 'warning' },
  FINALIZADA: { label: 'Finalizada', variant: 'outline' },
};

export function ObraStatusBadge({ status }: { status: ObraStatus }) {
  const cfg = CONFIG[status];
  return <Badge variant={cfg.variant as any}>{cfg.label}</Badge>;
}
