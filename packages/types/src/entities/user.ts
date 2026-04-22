import type { DocumentType } from '../enums/document-type';

export interface Permission {
  id: string;
  resource: string;
  action: string;
  description?: string;
}

export interface Role {
  id: string;
  name: string;
  description?: string;
  systemRole: boolean;
  permissions?: Permission[];
}

export interface User {
  id: string;
  documentType: DocumentType;
  documentNumber: string;
  firstName: string;
  lastName: string;
  email?: string | null;
  phone?: string | null;
  roleId: string;
  role?: Role;
  active: boolean;
  mustChangePassword: boolean;
  lastLoginAt?: string | null;
  createdAt: string;
  updatedAt: string;
  deletedAt?: string | null;
}

export interface UserPublic {
  id: string;
  documentType: DocumentType;
  documentNumber: string;
  firstName: string;
  lastName: string;
  email?: string | null;
  role?: {
    id: string;
    name: string;
    permissions: string[];
  };
  warehouseIds?: string[];
  mustChangePassword: boolean;
}
