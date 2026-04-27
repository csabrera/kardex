'use client';

import { CheckCircle2, XCircle, ArrowRight } from 'lucide-react';
import { useState } from 'react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  useReceiveTransfer,
  useRejectTransfer,
  type Transfer,
} from '@/hooks/use-transfers';

import { TransferStatusBadge } from './transfer-status-badge';

interface Props {
  transfer: Transfer;
  onClose: () => void;
}

export function TransferDetail({ transfer: t, onClose }: Props) {
  const [rejectionReason, setRejectionReason] = useState('');
  const [showReject, setShowReject] = useState(false);
  const [receivedQtys, setReceivedQtys] = useState<Record<string, number>>(() =>
    Object.fromEntries(t.items.map((i) => [i.id, Number(i.sentQty ?? i.requestedQty)])),
  );

  const receive = useReceiveTransfer();
  const reject = useRejectTransfer();

  const handleReceive = () => {
    receive.mutate(
      {
        id: t.id,
        items: t.items.map((i) => ({
          transferItemId: i.id,
          receivedQty: receivedQtys[i.id] ?? 0,
        })),
      },
      { onSuccess: onClose },
    );
  };

  const handleReject = () => {
    if (!rejectionReason.trim()) return;
    reject.mutate({ id: t.id, reason: rejectionReason }, { onSuccess: onClose });
  };

  // Flujo de 2 pasos: Enviada (sale del origen) → Recibida (llega al destino)
  const timeline = [
    {
      label: 'Enviada',
      date: t.sentAt ?? t.createdAt,
      user: t.sentBy ?? t.requestedBy,
      done: true,
    },
    { label: 'Recibida', date: t.receivedAt, user: t.receivedBy, done: !!t.receivedAt },
  ];

  return (
    <div className="space-y-5">
      {/* Cabecera */}
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <span className="font-mono font-bold text-lg">{t.code}</span>
            <TransferStatusBadge status={t.status} />
          </div>
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <span>{t.fromWarehouse.name}</span>
            <ArrowRight className="h-3.5 w-3.5" />
            <span className="font-medium text-foreground">{t.toWarehouse.name}</span>
          </div>
        </div>
      </div>

      {/* Timeline */}
      <div className="flex gap-2 overflow-x-auto pb-1">
        {timeline.map((step, i) => (
          <div key={step.label} className="flex items-center gap-1 shrink-0">
            <div
              className={`flex flex-col items-center text-xs ${step.done ? 'text-green-600' : 'text-muted-foreground'}`}
            >
              <div
                className={`h-6 w-6 rounded-full flex items-center justify-center text-[10px] font-bold border-2 ${step.done ? 'bg-green-100 border-green-500 text-green-700' : 'border-muted bg-muted/30'}`}
              >
                {i + 1}
              </div>
              <span className="mt-0.5">{step.label}</span>
              {step.date && (
                <span className="text-[10px] text-muted-foreground">
                  {new Date(step.date).toLocaleDateString('es-PE')}
                </span>
              )}
            </div>
            {i < timeline.length - 1 && (
              <div
                className={`h-0.5 w-8 mt-[-14px] ${step.done ? 'bg-green-400' : 'bg-muted'}`}
              />
            )}
          </div>
        ))}
      </div>

      {/* Ítems */}
      <div>
        <p className="text-sm font-medium mb-2">Ítems</p>
        <div className="rounded-md border overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-muted/50">
              <tr>
                <th className="px-3 py-2 text-left text-muted-foreground font-medium">
                  Ítem
                </th>
                <th className="px-3 py-2 text-right text-muted-foreground font-medium">
                  Enviado
                </th>
                {t.status === 'RECIBIDA' && (
                  <th className="px-3 py-2 text-right text-muted-foreground font-medium">
                    Recibido
                  </th>
                )}
                {t.status === 'EN_TRANSITO' && (
                  <th className="px-3 py-2 text-center text-muted-foreground font-medium">
                    Cant. a recibir
                  </th>
                )}
              </tr>
            </thead>
            <tbody>
              {t.items.map((item) => (
                <tr key={item.id} className="border-t">
                  <td className="px-3 py-2">
                    <span className="font-mono text-xs text-muted-foreground mr-1">
                      {item.item.code}
                    </span>
                    {item.item.name}
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums">
                    {Number(item.sentQty ?? item.requestedQty).toLocaleString('es-PE', {
                      maximumFractionDigits: 3,
                    })}{' '}
                    {item.item.unit.abbreviation}
                  </td>
                  {t.status === 'RECIBIDA' && (
                    <td className="px-3 py-2 text-right tabular-nums font-medium">
                      {item.receivedQty != null
                        ? `${Number(item.receivedQty).toLocaleString('es-PE', { maximumFractionDigits: 3 })} ${item.item.unit.abbreviation}`
                        : '—'}
                    </td>
                  )}
                  {t.status === 'EN_TRANSITO' && (
                    <td className="px-3 py-2">
                      <Input
                        type="number"
                        step="0.001"
                        min="0"
                        className="h-7 text-sm text-right w-28 ml-auto"
                        value={receivedQtys[item.id] ?? 0}
                        onChange={(e) =>
                          setReceivedQtys((p) => ({
                            ...p,
                            [item.id]: parseFloat(e.target.value) || 0,
                          }))
                        }
                      />
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {t.notes && (
        <div>
          <Label className="text-xs text-muted-foreground">Observaciones</Label>
          <p className="text-sm mt-0.5">{t.notes}</p>
        </div>
      )}
      {t.rejectionReason && (
        <div className="rounded-md bg-destructive/10 border border-destructive/20 px-3 py-2">
          <p className="text-xs text-destructive font-medium">
            Motivo de rechazo: {t.rejectionReason}
          </p>
        </div>
      )}

      {/* Acciones — flujo simplificado de 2 pasos */}
      <div className="flex flex-wrap gap-2 pt-2 border-t">
        {t.status === 'EN_TRANSITO' && (
          <Button
            size="sm"
            onClick={handleReceive}
            disabled={receive.isPending}
            className="gap-1.5"
          >
            <CheckCircle2 className="h-3.5 w-3.5" /> Confirmar recepción
          </Button>
        )}

        {t.status === 'EN_TRANSITO' && !showReject && (
          <Button
            size="sm"
            variant="outline"
            className="gap-1.5 text-destructive border-destructive/40"
            onClick={() => setShowReject(true)}
          >
            <XCircle className="h-3.5 w-3.5" /> Rechazar (devolver stock al origen)
          </Button>
        )}

        {showReject && (
          <div className="flex gap-2 w-full items-center">
            <Input
              placeholder="Motivo del rechazo..."
              value={rejectionReason}
              onChange={(e) => setRejectionReason(e.target.value)}
              className="flex-1"
            />
            <Button
              size="sm"
              variant="destructive"
              onClick={handleReject}
              disabled={!rejectionReason.trim() || reject.isPending}
            >
              Confirmar
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setShowReject(false)}>
              Cancelar
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
