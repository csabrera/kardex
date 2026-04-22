export enum MovementType {
  ENTRADA = 'ENTRADA',
  SALIDA = 'SALIDA',
  AJUSTE = 'AJUSTE',
}

export enum MovementSourceType {
  COMPRA = 'COMPRA',
  CONSUMO = 'CONSUMO',
  TRANSFERENCIA = 'TRANSFERENCIA',
  AJUSTE = 'AJUSTE',
  DEVOLUCION = 'DEVOLUCION',
  BAJA = 'BAJA',
  REQUISICION = 'REQUISICION',
  INVENTARIO_FISICO = 'INVENTARIO_FISICO',
}

export const MOVEMENT_TYPE_LABELS: Record<MovementType, string> = {
  [MovementType.ENTRADA]: 'Entrada',
  [MovementType.SALIDA]: 'Salida',
  [MovementType.AJUSTE]: 'Ajuste',
};

export const MOVEMENT_SOURCE_LABELS: Record<MovementSourceType, string> = {
  [MovementSourceType.COMPRA]: 'Compra',
  [MovementSourceType.CONSUMO]: 'Consumo',
  [MovementSourceType.TRANSFERENCIA]: 'Transferencia',
  [MovementSourceType.AJUSTE]: 'Ajuste',
  [MovementSourceType.DEVOLUCION]: 'Devolución',
  [MovementSourceType.BAJA]: 'Baja',
  [MovementSourceType.REQUISICION]: 'Requisición',
  [MovementSourceType.INVENTARIO_FISICO]: 'Inventario Físico',
};
