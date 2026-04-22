import type { WarehouseType } from '../enums/warehouse-type';

export interface Warehouse {
  id: string;
  code: string;
  name: string;
  type: WarehouseType;
  address?: string | null;
  managerId?: string | null;
  active: boolean;
  createdAt: string;
  updatedAt: string;
  deletedAt?: string | null;
}

export interface Category {
  id: string;
  code: string;
  name: string;
  parentId?: string | null;
  itemType: string;
  children?: Category[];
  createdAt: string;
  updatedAt: string;
}

export interface Unit {
  id: string;
  code: string;
  name: string;
  symbol: string;
  createdAt: string;
  updatedAt: string;
}
