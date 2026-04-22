import type { MovementSourceType, MovementType } from '../enums/movement-type';

import type { Item } from './item';
import type { User } from './user';
import type { Warehouse } from './warehouse';

export interface MovementItem {
  id: string;
  movementId: string;
  itemId: string;
  item?: Item;
  quantity: number;
  notes?: string | null;
}

export interface Movement {
  id: string;
  code: string;
  type: MovementType;
  sourceType: MovementSourceType;
  warehouseId: string;
  warehouse?: Warehouse;
  userId: string;
  user?: User;
  date: string;
  reference?: string | null;
  notes?: string | null;
  items: MovementItem[];
  createdAt: string;
  updatedAt: string;
}

export interface KardexEntry {
  movementId: string;
  code: string;
  type: MovementType;
  sourceType: MovementSourceType;
  date: string;
  quantity: number;
  balance: number;
  warehouseId: string;
  warehouseName: string;
  userId: string;
  userName: string;
  notes?: string | null;
}
