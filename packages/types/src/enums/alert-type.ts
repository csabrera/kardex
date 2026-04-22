export enum AlertType {
  STOCK_MINIMO = 'STOCK_MINIMO',
  VENCIMIENTO = 'VENCIMIENTO',
  MANTENIMIENTO = 'MANTENIMIENTO',
  EPP_BAJO = 'EPP_BAJO',
  PRESTAMO_VENCIDO = 'PRESTAMO_VENCIDO',
}

export enum AlertLevel {
  INFO = 'INFO',
  WARNING = 'WARNING',
  CRITICAL = 'CRITICAL',
}

export const ALERT_TYPE_LABELS: Record<AlertType, string> = {
  [AlertType.STOCK_MINIMO]: 'Stock por debajo del mínimo',
  [AlertType.VENCIMIENTO]: 'Próximo vencimiento',
  [AlertType.MANTENIMIENTO]: 'Mantenimiento pendiente',
  [AlertType.EPP_BAJO]: 'EPP bajo en stock',
  [AlertType.PRESTAMO_VENCIDO]: 'Préstamo de herramienta vencido',
};

export const ALERT_LEVEL_COLORS: Record<AlertLevel, string> = {
  [AlertLevel.INFO]: 'blue',
  [AlertLevel.WARNING]: 'amber',
  [AlertLevel.CRITICAL]: 'red',
};
