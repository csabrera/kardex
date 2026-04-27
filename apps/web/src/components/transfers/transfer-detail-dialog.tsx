'use client';

import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';

import { TransferDetail } from './transfer-detail';

import type { Transfer } from '@/hooks/use-transfers';

interface Props {
  transfer: Transfer | null;
  onClose: () => void;
}

/**
 * Modal flotante con el detalle completo de una transferencia.
 * Incluye los botones de acción (Confirmar / Rechazar) si está EN_TRANSITO.
 */
export function TransferDetailDialog({ transfer, onClose }: Props) {
  return (
    <Dialog open={!!transfer} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Detalle de transferencia</DialogTitle>
        </DialogHeader>
        {transfer && <TransferDetail transfer={transfer} onClose={onClose} />}
      </DialogContent>
    </Dialog>
  );
}
