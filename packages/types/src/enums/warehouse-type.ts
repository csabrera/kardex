export enum WarehouseType {
  CENTRAL = 'CENTRAL',
  OBRA = 'OBRA',
}

export const WAREHOUSE_TYPE_LABELS: Record<WarehouseType, string> = {
  [WarehouseType.CENTRAL]: 'Almacén Central',
  [WarehouseType.OBRA]: 'Obra',
};
