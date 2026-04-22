import type { MovementSourceType, MovementType } from '../enums/movement-type';

export interface CreateMovementItemDto {
  itemId: string;
  quantity: number;
  notes?: string;
}

export interface CreateMovementDto {
  type: MovementType;
  sourceType: MovementSourceType;
  warehouseId: string;
  date?: string;
  reference?: string;
  notes?: string;
  items: CreateMovementItemDto[];
}

export interface KardexQueryDto {
  itemId: string;
  warehouseId?: string;
  fromDate?: string;
  toDate?: string;
  movementType?: MovementType;
}
