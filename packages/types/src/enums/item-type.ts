export enum ItemType {
  MATERIAL = 'MATERIAL',
  HERRAMIENTA = 'HERRAMIENTA',
  EPP = 'EPP',
  REPUESTO = 'REPUESTO',
  EQUIPO = 'EQUIPO',
}

export const ITEM_TYPE_LABELS: Record<ItemType, string> = {
  [ItemType.MATERIAL]: 'Material',
  [ItemType.HERRAMIENTA]: 'Herramienta',
  [ItemType.EPP]: 'EPP',
  [ItemType.REPUESTO]: 'Repuesto',
  [ItemType.EQUIPO]: 'Equipo',
};
