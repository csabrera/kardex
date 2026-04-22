export enum TransferStatus {
  SOLICITADA = 'SOLICITADA',
  APROBADA = 'APROBADA',
  EN_TRANSITO = 'EN_TRANSITO',
  RECIBIDA = 'RECIBIDA',
  RECHAZADA = 'RECHAZADA',
  CANCELADA = 'CANCELADA',
}

export const TRANSFER_STATUS_LABELS: Record<TransferStatus, string> = {
  [TransferStatus.SOLICITADA]: 'Solicitada',
  [TransferStatus.APROBADA]: 'Aprobada',
  [TransferStatus.EN_TRANSITO]: 'En Tránsito',
  [TransferStatus.RECIBIDA]: 'Recibida',
  [TransferStatus.RECHAZADA]: 'Rechazada',
  [TransferStatus.CANCELADA]: 'Cancelada',
};

export const TRANSFER_STATUS_COLORS: Record<TransferStatus, string> = {
  [TransferStatus.SOLICITADA]: 'amber',
  [TransferStatus.APROBADA]: 'blue',
  [TransferStatus.EN_TRANSITO]: 'purple',
  [TransferStatus.RECIBIDA]: 'green',
  [TransferStatus.RECHAZADA]: 'red',
  [TransferStatus.CANCELADA]: 'gray',
};
