import type { TransferStatus } from '../enums/transfer-status';

import type { Item } from './item';
import type { User } from './user';
import type { Warehouse } from './warehouse';

export interface TransferItem {
  id: string;
  transferId: string;
  itemId: string;
  item?: Item;
  quantityRequested: number;
  quantitySent?: number | null;
  quantityReceived?: number | null;
}

export interface Transfer {
  id: string;
  code: string;
  originWarehouseId: string;
  originWarehouse?: Warehouse;
  destinationWarehouseId: string;
  destinationWarehouse?: Warehouse;
  status: TransferStatus;
  requestedBy: string;
  requester?: User;
  approvedBy?: string | null;
  approver?: User;
  sentBy?: string | null;
  sender?: User;
  receivedBy?: string | null;
  receiver?: User;
  requestedAt: string;
  approvedAt?: string | null;
  sentAt?: string | null;
  receivedAt?: string | null;
  rejectedAt?: string | null;
  notes?: string | null;
  items: TransferItem[];
  createdAt: string;
  updatedAt: string;
}
