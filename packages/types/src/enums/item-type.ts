export enum ItemType {
  MATERIAL = 'MATERIAL',
  HERRAMIENTA = 'HERRAMIENTA',
  EPP = 'EPP',
  COMBUSTIBLE = 'COMBUSTIBLE',
  REPUESTO = 'REPUESTO',
  EQUIPO = 'EQUIPO',
}

export const ITEM_TYPE_LABELS: Record<ItemType, string> = {
  [ItemType.MATERIAL]: 'Material',
  [ItemType.HERRAMIENTA]: 'Herramienta',
  [ItemType.EPP]: 'EPP',
  [ItemType.COMBUSTIBLE]: 'Combustible',
  [ItemType.REPUESTO]: 'Repuesto',
  [ItemType.EQUIPO]: 'Equipo',
};
