'use client';

import {
  AlertCircle,
  ArrowRight,
  CheckCircle2,
  PackagePlus,
  XCircle,
} from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { DocumentViewButton, FileUpload } from '@/components/ui/file-upload';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  SHORTAGE_REASON_LABEL,
  useReceiveTransfer,
  useRejectTransfer,
  useTransfer,
  type Transfer,
  type TransferItemStatus,
} from '@/hooks/use-transfers';
import { useAuthStore } from '@/stores/use-auth-store';

import { CloseAsShortageDialog } from './close-as-shortage-dialog';
import { ReceiveAdditionalDialog } from './receive-additional-dialog';
import { TransferStatusBadge } from './transfer-status-badge';

interface Props {
  transfer: Transfer;
  onClose: () => void;
}

const ITEM_STATUS_META: Record<
  TransferItemStatus,
  { label: string; variant: 'success' | 'info' | 'warning' | 'destructive' | 'outline' }
> = {
  PENDIENTE: { label: 'Pendiente', variant: 'warning' },
  RECIBIDO_COMPLETO: { label: 'Completo', variant: 'success' },
  RECIBIDO_PARCIAL: { label: 'Parcial', variant: 'info' },
  FALTANTE_DEFINITIVO: { label: 'Baja', variant: 'destructive' },
};

export function TransferDetail({ transfer: snapshot, onClose }: Props) {
  // Refetch al abrir + reacción automática a invalidaciones por WebSocket.
  // Snapshot como fallback para evitar flash de loading.
  const { data: fresh } = useTransfer(snapshot.id);
  const t = fresh ?? snapshot;

  const [rejectionReason, setRejectionReason] = useState('');
  const [showReject, setShowReject] = useState(false);
  const [overrideReason, setOverrideReason] = useState('');
  const [overrideError, setOverrideError] = useState<string | null>(null);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [receivedQtys, setReceivedQtys] = useState<Record<string, string>>(() =>
    Object.fromEntries(
      snapshot.items.map((i) => [i.id, String(Number(i.sentQty ?? i.requestedQty))]),
    ),
  );
  const [recipientDoc, setRecipientDoc] = useState<{
    filename: string;
    originalName: string;
  } | null>(null);
  const [showAdditional, setShowAdditional] = useState(false);
  const [showCloseShortage, setShowCloseShortage] = useState(false);

  const user = useAuthStore((s) => s.user);
  const needsOverride = user?.role?.name === 'ADMIN';
  const isAdmin = user?.role?.name === 'ADMIN';

  const receive = useReceiveTransfer();
  const reject = useRejectTransfer();

  const getSentQty = (itemId: string) =>
    Number(
      t.items.find((i) => i.id === itemId)?.sentQty ??
        t.items.find((i) => i.id === itemId)?.requestedQty ??
        0,
    );

  const getLineError = (itemId: string): string | null => {
    const qty = Number(receivedQtys[itemId]);
    const sentQty = getSentQty(itemId);
    if (isNaN(qty) || qty <= 0) return 'La cantidad debe ser mayor a 0';
    if (qty > sentQty) return `No puede superar lo enviado (${sentQty})`;
    return null;
  };

  const isLineDiscrepancy = (itemId: string) => {
    const qty = Number(receivedQtys[itemId]);
    return !isNaN(qty) && Math.abs(getSentQty(itemId) - qty) > 0.0001;
  };

  const hasDiscrepancy = t.items.some((i) => isLineDiscrepancy(i.id));
  const hasLineErrors = t.items.some((i) => getLineError(i.id) !== null);

  const validateOverride = () => {
    if (!needsOverride) return true;
    const trimmed = overrideReason.trim();
    if (trimmed.length < 5) {
      setOverrideError('Requerido como administrador (mínimo 5 caracteres)');
      return false;
    }
    setOverrideError(null);
    return true;
  };

  const needsDocument =
    t.status === 'EN_TRANSITO' && t.requiresRecipientDocument && !t.documentUrl;

  const handleReceive = () => {
    setIsSubmitted(true);
    if (hasLineErrors) return;
    if (needsDocument && !recipientDoc) return;
    if (!validateOverride()) return;
    receive.mutate(
      {
        id: t.id,
        items: t.items.map((i) => ({
          transferItemId: i.id,
          receivedQty: Number(receivedQtys[i.id] ?? 0),
        })),
        overrideReason: needsOverride ? overrideReason.trim() : undefined,
        documentUrl: recipientDoc?.filename ?? undefined,
        documentName: recipientDoc?.originalName ?? undefined,
      },
      {
        onSuccess: (updated: Transfer) => {
          if (updated.status === 'PARCIALMENTE_RECIBIDA') {
            toast.warning(
              'Recepción parcial registrada · queda saldo pendiente de completar',
            );
          } else {
            toast.success('Recepción confirmada · stock actualizado');
          }
          onClose();
        },
      },
    );
  };

  const handleReject = () => {
    if (!rejectionReason.trim()) return;
    if (!validateOverride()) return;
    reject.mutate(
      {
        id: t.id,
        reason: rejectionReason,
        overrideReason: needsOverride ? overrideReason.trim() : undefined,
      },
      { onSuccess: onClose },
    );
  };

  // Timeline 2 pasos: Enviada → Recibida. Si parcial, segundo paso queda "en progreso".
  const timeline = [
    {
      label: 'Enviada',
      date: t.sentAt ?? t.createdAt,
      done: true,
    },
    {
      label:
        t.status === 'PARCIALMENTE_RECIBIDA'
          ? 'En recepción'
          : t.status === 'RECIBIDA'
            ? 'Recibida'
            : 'Recibida',
      date: t.receivedAt,
      done: t.status === 'RECIBIDA',
      inProgress: t.status === 'PARCIALMENTE_RECIBIDA',
    },
  ];

  const showReceiveInputs = t.status === 'EN_TRANSITO';
  const showLineStatus = t.status === 'PARCIALMENTE_RECIBIDA' || t.status === 'RECIBIDA';

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
              className={`flex flex-col items-center text-xs ${
                step.done
                  ? 'text-green-600'
                  : step.inProgress
                    ? 'text-blue-600'
                    : 'text-muted-foreground'
              }`}
            >
              <div
                className={`h-6 w-6 rounded-full flex items-center justify-center text-[10px] font-bold border-2 ${
                  step.done
                    ? 'bg-green-100 border-green-500 text-green-700'
                    : step.inProgress
                      ? 'bg-blue-100 border-blue-500 text-blue-700'
                      : 'border-muted bg-muted/30'
                }`}
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
                className={`h-0.5 w-8 mt-[-14px] ${
                  step.done ? 'bg-green-400' : 'bg-muted'
                }`}
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
                {showReceiveInputs && (
                  <th className="px-3 py-2 text-center text-muted-foreground font-medium">
                    Recibido <span className="text-destructive">*</span>
                  </th>
                )}
                {showLineStatus && (
                  <>
                    <th className="px-3 py-2 text-right text-muted-foreground font-medium">
                      Recibido
                    </th>
                    <th className="px-3 py-2 text-right text-muted-foreground font-medium">
                      Pendiente
                    </th>
                    <th className="px-3 py-2 text-center text-muted-foreground font-medium">
                      Estado
                    </th>
                  </>
                )}
              </tr>
            </thead>
            <tbody>
              {t.items.map((item) => {
                const sentQty = Number(item.sentQty ?? item.requestedQty);
                const recvdQty = Number(item.receivedQty ?? 0);
                const pendingQty = Math.max(sentQty - recvdQty, 0);
                const discrepancy = showReceiveInputs && isLineDiscrepancy(item.id);
                const lineError =
                  showReceiveInputs && isSubmitted ? getLineError(item.id) : null;
                const meta = ITEM_STATUS_META[item.status];
                return (
                  <tr key={item.id} className="border-t">
                    <td className="px-3 py-2">
                      <div className="flex items-center gap-2">
                        <div>
                          <span className="font-mono text-xs text-muted-foreground mr-1">
                            {item.item.code}
                          </span>
                          {item.item.name}
                        </div>
                        {showReceiveInputs && !lineError && (
                          <span
                            className={`text-[11px] font-semibold px-1.5 py-0.5 rounded-full shrink-0 ${
                              discrepancy
                                ? 'text-amber-700 bg-amber-100 dark:bg-amber-900/40 dark:text-amber-300'
                                : 'text-green-700 bg-green-100 dark:bg-green-900/40 dark:text-green-300'
                            }`}
                          >
                            {discrepancy ? '⚠ Disc.' : '✓'}
                          </span>
                        )}
                      </div>
                      {item.shortageReason && (
                        <div className="text-[10px] text-muted-foreground mt-0.5">
                          Cerrado: {SHORTAGE_REASON_LABEL[item.shortageReason]}
                          {item.shortageNotes ? ` · ${item.shortageNotes}` : ''}
                        </div>
                      )}
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums">
                      {sentQty.toLocaleString('es-PE', { maximumFractionDigits: 3 })}{' '}
                      {item.item.unit.abbreviation}
                    </td>
                    {showReceiveInputs && (
                      <td className="px-3 py-2">
                        <div className="space-y-1">
                          <Input
                            type="number"
                            step="0.001"
                            min="0.001"
                            max={sentQty}
                            className={`h-7 text-sm text-right w-28 ml-auto ${
                              lineError
                                ? 'border-destructive'
                                : discrepancy
                                  ? 'border-amber-400'
                                  : ''
                            }`}
                            value={receivedQtys[item.id] ?? ''}
                            onChange={(e) =>
                              setReceivedQtys((p) => ({
                                ...p,
                                [item.id]: e.target.value,
                              }))
                            }
                          />
                          {lineError && (
                            <p className="text-[11px] text-destructive text-right">
                              {lineError}
                            </p>
                          )}
                        </div>
                      </td>
                    )}
                    {showLineStatus && (
                      <>
                        <td className="px-3 py-2 text-right tabular-nums font-medium">
                          {recvdQty.toLocaleString('es-PE', {
                            maximumFractionDigits: 3,
                          })}{' '}
                          <span className="text-[11px] text-muted-foreground">
                            {item.item.unit.abbreviation}
                          </span>
                        </td>
                        <td className="px-3 py-2 text-right tabular-nums">
                          {item.status === 'RECIBIDO_PARCIAL' ? (
                            <span className="font-semibold text-amber-700 dark:text-amber-300">
                              {pendingQty.toLocaleString('es-PE', {
                                maximumFractionDigits: 3,
                              })}
                            </span>
                          ) : (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </td>
                        <td className="px-3 py-2 text-center">
                          <Badge variant={meta.variant as any} className="text-[10px]">
                            {meta.label}
                          </Badge>
                        </td>
                      </>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Banner discrepancia (solo cuando EN_TRANSITO y hay diferencias) */}
      {showReceiveInputs && hasDiscrepancy && !hasLineErrors && (
        <div className="rounded-md border border-amber-300 bg-amber-50 dark:bg-amber-950/30 p-3 text-xs">
          <p className="font-medium text-amber-900 dark:text-amber-200 flex items-center gap-1.5">
            ⚠ Lo no recibido quedará como pendiente
          </p>
          <p className="text-amber-800 dark:text-amber-200/80 mt-1">
            La transferencia pasará a estado <strong>Parcialmente recibida</strong>.
            Cuando llegue el resto podrás completarla, o un administrador puede cerrarla
            como faltante definitivo.
          </p>
        </div>
      )}

      {t.notes && (
        <div>
          <Label className="text-xs text-muted-foreground">Observaciones</Label>
          <p className="text-sm mt-0.5">{t.notes}</p>
        </div>
      )}

      {/* Guía de remisión */}
      {t.documentUrl && t.documentName && (
        <div className="space-y-1.5">
          <Label className="text-xs text-muted-foreground">Guía de remisión</Label>
          <DocumentViewButton filename={t.documentUrl} originalName={t.documentName} />
        </div>
      )}

      {/* Gate: el residente debe subir la guía antes de confirmar */}
      {needsDocument && (
        <div className="rounded-md border border-amber-300 bg-amber-50 dark:bg-amber-950/30 p-3 space-y-2">
          <p className="text-xs font-medium text-amber-900 dark:text-amber-200 flex items-center gap-1.5">
            <AlertCircle className="h-3.5 w-3.5 shrink-0" />
            Se requiere adjuntar la guía de remisión para confirmar la recepción
          </p>
          <FileUpload
            value={recipientDoc}
            onChange={setRecipientDoc}
            disabled={receive.isPending}
          />
          {isSubmitted && !recipientDoc && (
            <p className="text-xs text-destructive">
              Debes adjuntar la guía antes de continuar
            </p>
          )}
        </div>
      )}

      {t.rejectionReason && (
        <div className="rounded-md bg-destructive/10 border border-destructive/20 px-3 py-2">
          <p className="text-xs text-destructive font-medium">
            Motivo de rechazo: {t.rejectionReason}
          </p>
        </div>
      )}

      {/* Banner de excepción cuando admin opera fuera del flujo normal */}
      {needsOverride && t.status === 'EN_TRANSITO' && (
        <div className="rounded-md border border-amber-300 bg-amber-50/70 dark:bg-amber-950/30 p-3 space-y-2">
          <div className="flex items-start gap-2">
            <AlertCircle className="h-4 w-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
            <div className="text-xs text-amber-900 dark:text-amber-100 space-y-1">
              <p className="font-medium">
                Estás operando esta transferencia como administrador
              </p>
              <p className="text-amber-800 dark:text-amber-200/90">
                Recibir o rechazar es responsabilidad del residente de la obra. Deja
                constancia del motivo antes de confirmar.
              </p>
            </div>
          </div>
          <div className="space-y-1.5 pl-6">
            <Label htmlFor="transferOverrideReason" className="text-xs">
              Motivo de excepción *
            </Label>
            <Textarea
              id="transferOverrideReason"
              value={overrideReason}
              onChange={(e) => {
                setOverrideReason(e.target.value.toUpperCase());
                setOverrideError(null);
              }}
              placeholder="EJ: RESIDENTE AUSENTE — RECEPCIÓN URGENTE PARA INICIO DE OBRA"
              rows={2}
              className="text-sm resize-none"
            />
            {overrideError && <p className="text-xs text-destructive">{overrideError}</p>}
          </div>
        </div>
      )}

      {/* Acciones */}
      <div className="flex flex-wrap gap-2 pt-2 border-t">
        {/* Recibir / rechazar — primer paso */}
        {t.status === 'EN_TRANSITO' && (
          <Button
            size="sm"
            onClick={handleReceive}
            disabled={
              receive.isPending ||
              (isSubmitted && hasLineErrors) ||
              (isSubmitted && needsDocument && !recipientDoc)
            }
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

        {/* Parcial — recepción adicional + cerrar como faltante */}
        {t.status === 'PARCIALMENTE_RECIBIDA' && (
          <Button size="sm" onClick={() => setShowAdditional(true)} className="gap-1.5">
            <PackagePlus className="h-3.5 w-3.5" /> Recibir lo faltante
          </Button>
        )}

        {t.status === 'PARCIALMENTE_RECIBIDA' && isAdmin && (
          <Button
            size="sm"
            variant="outline"
            className="gap-1.5 text-destructive border-destructive/40"
            onClick={() => setShowCloseShortage(true)}
          >
            <XCircle className="h-3.5 w-3.5" /> Cerrar líneas como faltante
          </Button>
        )}
      </div>

      {/* Sub-modales */}
      {t.status === 'PARCIALMENTE_RECIBIDA' && (
        <>
          <ReceiveAdditionalDialog
            transfer={t}
            open={showAdditional}
            onClose={() => setShowAdditional(false)}
          />
          <CloseAsShortageDialog
            transfer={t}
            open={showCloseShortage}
            onClose={() => setShowCloseShortage(false)}
          />
        </>
      )}
    </div>
  );
}
