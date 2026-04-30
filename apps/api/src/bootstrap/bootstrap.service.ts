import { Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';

import { PrismaService } from '../prisma/prisma.service';

// ============================================================================
// Bootstrap Service
// ============================================================================
// Self-healing seed at startup. Si la BD no tiene permisos sembrados (caso
// típico: setup wizard creó admin pero no las permissions, o el seed CLI nunca
// corrió en producción), las siembra automáticamente al arrancar el API.
//
// Idempotente: usa `upsert` para roles, permissions y rolePermissions. Si ya
// hay datos, no hace nada en arranques posteriores.
//
// Datos espejados de prisma/seed.ts. Si seed.ts cambia, sincronizar aquí.
// ============================================================================

const SYSTEM_ROLES = [
  {
    name: 'ADMIN',
    description: 'Administrador del sistema con acceso total',
    systemRole: true,
  },
  {
    name: 'ALMACENERO',
    description: 'Almacenero - registra movimientos y gestiona la operación diaria',
    systemRole: true,
  },
  {
    name: 'RESIDENTE',
    description: 'Residente de Obra - recibe transferencias y consulta stock de su obra',
    systemRole: true,
  },
];

const BASE_PERMISSIONS: { resource: string; action: string }[] = [
  // Users
  { resource: 'users', action: 'create' },
  { resource: 'users', action: 'read' },
  { resource: 'users', action: 'update' },
  { resource: 'users', action: 'delete' },
  { resource: 'users', action: 'activate' },
  { resource: 'users', action: 'assign-role' },
  // Roles & Permissions
  { resource: 'roles', action: 'create' },
  { resource: 'roles', action: 'read' },
  { resource: 'roles', action: 'update' },
  { resource: 'roles', action: 'delete' },
  { resource: 'permissions', action: 'read' },
  // Warehouses
  { resource: 'warehouses', action: 'create' },
  { resource: 'warehouses', action: 'read' },
  { resource: 'warehouses', action: 'update' },
  { resource: 'warehouses', action: 'delete' },
  { resource: 'warehouses', action: 'assign-staff' },
  // Categories
  { resource: 'categories', action: 'create' },
  { resource: 'categories', action: 'read' },
  { resource: 'categories', action: 'update' },
  { resource: 'categories', action: 'delete' },
  // Units
  { resource: 'units', action: 'create' },
  { resource: 'units', action: 'read' },
  { resource: 'units', action: 'update' },
  { resource: 'units', action: 'delete' },
  // Items
  { resource: 'items', action: 'create' },
  { resource: 'items', action: 'read' },
  { resource: 'items', action: 'update' },
  { resource: 'items', action: 'delete' },
  { resource: 'items', action: 'import' },
  { resource: 'items', action: 'export' },
  // Stock
  { resource: 'stock', action: 'read' },
  { resource: 'stock', action: 'adjust' },
  // Movements
  { resource: 'movements', action: 'create' },
  { resource: 'movements', action: 'read' },
  { resource: 'movements', action: 'update' },
  { resource: 'movements', action: 'delete' },
  { resource: 'movements', action: 'export' },
  // Transfers
  { resource: 'transfers', action: 'create' },
  { resource: 'transfers', action: 'read' },
  { resource: 'transfers', action: 'receive' },
  { resource: 'transfers', action: 'reject' },
  { resource: 'transfers', action: 'cancel' },
  // Alerts
  { resource: 'alerts', action: 'read' },
  { resource: 'alerts', action: 'update' },
  // Requisitions
  { resource: 'requisitions', action: 'create' },
  { resource: 'requisitions', action: 'read' },
  { resource: 'requisitions', action: 'approve' },
  { resource: 'requisitions', action: 'reject' },
  // Tools
  { resource: 'tools', action: 'read' },
  { resource: 'tools', action: 'loan' },
  { resource: 'tools', action: 'return' },
  // Obras
  { resource: 'obras', action: 'create' },
  { resource: 'obras', action: 'read' },
  { resource: 'obras', action: 'update' },
  { resource: 'obras', action: 'delete' },
  // Work Stations
  { resource: 'work-stations', action: 'create' },
  { resource: 'work-stations', action: 'read' },
  { resource: 'work-stations', action: 'update' },
  { resource: 'work-stations', action: 'delete' },
  // Specialties
  { resource: 'specialties', action: 'create' },
  { resource: 'specialties', action: 'read' },
  { resource: 'specialties', action: 'update' },
  { resource: 'specialties', action: 'delete' },
  // Suppliers
  { resource: 'suppliers', action: 'create' },
  { resource: 'suppliers', action: 'read' },
  { resource: 'suppliers', action: 'update' },
  { resource: 'suppliers', action: 'delete' },
  // Workers & EPP
  { resource: 'workers', action: 'create' },
  { resource: 'workers', action: 'read' },
  { resource: 'workers', action: 'update' },
  { resource: 'workers', action: 'delete' },
  { resource: 'epp', action: 'assign' },
  { resource: 'epp', action: 'read' },
  // Reports
  { resource: 'reports', action: 'read' },
  { resource: 'reports', action: 'export' },
  // Inventory counts
  { resource: 'inventory', action: 'read' },
  { resource: 'inventory', action: 'create' },
  { resource: 'inventory', action: 'count' },
  { resource: 'inventory', action: 'close' },
  { resource: 'inventory', action: 'cancel' },
  // Audit & System
  { resource: 'audit', action: 'read' },
  { resource: 'system', action: 'configure' },
  { resource: 'system', action: 'backup' },
];

const ROLE_PERMISSIONS: Record<string, string[]> = {
  ADMIN: ['*'], // todas las permissions
  ALMACENERO: [
    'warehouses:read',
    'categories:read',
    'units:read',
    'obras:read',
    'specialties:read',
    'permissions:read',
    'users:read',
    'items:create',
    'items:read',
    'items:update',
    'items:import',
    'items:export',
    'stock:read',
    'stock:adjust',
    'movements:create',
    'movements:read',
    'movements:export',
    'transfers:create',
    'transfers:read',
    'transfers:receive',
    'transfers:reject',
    'transfers:cancel',
    'alerts:read',
    'alerts:update',
    'tools:read',
    'tools:loan',
    'tools:return',
    'epp:assign',
    'epp:read',
    'workers:create',
    'workers:read',
    'workers:update',
    'work-stations:read',
    'suppliers:create',
    'suppliers:read',
    'suppliers:update',
    'inventory:read',
    'inventory:create',
    'inventory:count',
    'inventory:close',
    'inventory:cancel',
    'reports:read',
    'reports:export',
  ],
  RESIDENTE: [
    'warehouses:read',
    'categories:read',
    'units:read',
    'items:read',
    'obras:read',
    'specialties:read',
    'suppliers:read',
    'workers:read',
    'permissions:read',
    'work-stations:read',
    'work-stations:create',
    'work-stations:update',
    'work-stations:delete',
    'stock:read',
    'stock:adjust',
    'movements:read',
    'movements:create',
    'transfers:read',
    'transfers:receive',
    'transfers:reject',
    'tools:read',
    'tools:loan',
    'tools:return',
    'epp:read',
    'epp:assign',
    'alerts:read',
    'inventory:read',
    'reports:read',
  ],
};

@Injectable()
export class BootstrapService implements OnApplicationBootstrap {
  private readonly logger = new Logger(BootstrapService.name);

  constructor(private readonly prisma: PrismaService) {}

  async onApplicationBootstrap(): Promise<void> {
    try {
      const permissionCount = await this.prisma.permission.count();

      if (permissionCount > 0) {
        this.logger.log(
          `Bootstrap skipped: ${permissionCount} permissions ya están sembradas.`,
        );
        return;
      }

      this.logger.warn(
        'BD sin permissions — sembrando roles, permissions y assignments...',
      );

      await this.seedRoles();
      await this.seedPermissions();
      await this.assignPermissionsByRole();

      this.logger.log('✓ Bootstrap completed: roles + permissions sembradas.');
    } catch (err) {
      // No tirar para no impedir el arranque del API. El admin puede correr el
      // seed manual si esto falla. Pero loggear bien fuerte.
      this.logger.error('Bootstrap failed', err as Error);
    }
  }

  private async seedRoles(): Promise<void> {
    for (const role of SYSTEM_ROLES) {
      await this.prisma.role.upsert({
        where: { name: role.name },
        update: {},
        create: role,
      });
    }
    this.logger.log(`  ✓ ${SYSTEM_ROLES.length} roles upserted`);
  }

  private async seedPermissions(): Promise<void> {
    for (const perm of BASE_PERMISSIONS) {
      await this.prisma.permission.upsert({
        where: {
          resource_action: { resource: perm.resource, action: perm.action },
        },
        update: {},
        create: perm,
      });
    }
    this.logger.log(`  ✓ ${BASE_PERMISSIONS.length} permissions upserted`);
  }

  private async assignPermissionsByRole(): Promise<void> {
    const allRoles = await this.prisma.role.findMany();
    const allPermissions = await this.prisma.permission.findMany();
    const permMap = new Map(
      allPermissions.map((p) => [`${p.resource}:${p.action}`, p.id]),
    );

    for (const role of allRoles) {
      const allowed = ROLE_PERMISSIONS[role.name];
      if (!allowed) continue;

      const permIds =
        allowed[0] === '*'
          ? allPermissions.map((p) => p.id)
          : allowed
              .map((key) => permMap.get(key))
              .filter((id): id is string => Boolean(id));

      for (const permissionId of permIds) {
        await this.prisma.rolePermission.upsert({
          where: { roleId_permissionId: { roleId: role.id, permissionId } },
          update: {},
          create: { roleId: role.id, permissionId },
        });
      }

      this.logger.log(`  ✓ ${permIds.length} permissions → role ${role.name}`);
    }
  }
}
