export enum UserRole {
  ADMIN = 'ADMIN',
  JEFE = 'JEFE',
  ALMACENERO = 'ALMACENERO',
  RESIDENTE = 'RESIDENTE',
}

export const USER_ROLE_VALUES = Object.values(UserRole);

export const USER_ROLE_LABELS: Record<UserRole, string> = {
  [UserRole.ADMIN]: 'Administrador',
  [UserRole.JEFE]: 'Jefe de Almacén',
  [UserRole.ALMACENERO]: 'Almacenero',
  [UserRole.RESIDENTE]: 'Residente de Obra',
};
