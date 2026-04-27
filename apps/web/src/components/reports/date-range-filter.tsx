'use client';

import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

interface Props {
  from: string;
  to: string;
  onChange: (range: { from: string; to: string }) => void;
}

export function DateRangeFilter({ from, to, onChange }: Props) {
  return (
    <div className="flex flex-wrap gap-3">
      <div className="space-y-1.5 min-w-[170px]">
        <Label>Desde</Label>
        <Input
          type="date"
          value={from}
          onChange={(e) => onChange({ from: e.target.value, to })}
        />
      </div>
      <div className="space-y-1.5 min-w-[170px]">
        <Label>Hasta</Label>
        <Input
          type="date"
          value={to}
          onChange={(e) => onChange({ from, to: e.target.value })}
        />
      </div>
    </div>
  );
}

/** Helper: devuelve {from, to} como YYYY-MM-DD con default = últimos 30 días. */
export function getDefaultRange(): { from: string; to: string } {
  const today = new Date();
  const thirtyDaysAgo = new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000);
  const fmt = (d: Date) => d.toISOString().slice(0, 10);
  return { from: fmt(thirtyDaysAgo), to: fmt(today) };
}

/** Convierte YYYY-MM-DD a ISO completo (inicio del from, fin del to). */
export function toIsoRange(from: string, to: string): { from?: string; to?: string } {
  return {
    from: from ? new Date(from + 'T00:00:00').toISOString() : undefined,
    to: to ? new Date(to + 'T23:59:59').toISOString() : undefined,
  };
}
