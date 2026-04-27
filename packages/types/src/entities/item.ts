import type { ItemType } from '../enums/item-type';

import type { Category, Unit } from './warehouse';

export interface Item {
  id: string;
  code: string;
  name: string;
  description?: string | null;
  categoryId: string;
  category?: Category;
  unitId: string;
  unit?: Unit;
  itemType: ItemType;
  minStock: number;
  maxStock?: number | null;
  active: boolean;
  createdAt: string;
  updatedAt: string;
  deletedAt?: string | null;
}

export interface Stock {
  id: string;
  itemId: string;
  item?: Item;
  warehouseId: string;
  quantity: number;
  reservedQuantity: number;
  version: number;
  updatedAt: string;
}

export interface StockWithItem extends Stock {
  item: Item;
}
