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

const BASE_UNITS = [
  { code: 'UND', name: 'Unidad', abbreviation: 'und' },
  { code: 'KG', name: 'Kilogramo', abbreviation: 'kg' },
  { code: 'G', name: 'Gramo', abbreviation: 'g' },
  { code: 'TN', name: 'Tonelada', abbreviation: 'tn' },
  { code: 'M', name: 'Metro', abbreviation: 'm' },
  { code: 'CM', name: 'Centímetro', abbreviation: 'cm' },
  { code: 'MM', name: 'Milímetro', abbreviation: 'mm' },
  { code: 'M2', name: 'Metro cuadrado', abbreviation: 'm²' },
  { code: 'M3', name: 'Metro cúbico', abbreviation: 'm³' },
  { code: 'L', name: 'Litro', abbreviation: 'l' },
  { code: 'ML', name: 'Mililitro', abbreviation: 'ml' },
  { code: 'GL', name: 'Galón', abbreviation: 'gl' },
  { code: 'PAR', name: 'Par', abbreviation: 'par' },
  { code: 'CJA', name: 'Caja', abbreviation: 'cja' },
  { code: 'BLS', name: 'Bolsa', abbreviation: 'bls' },
  { code: 'BLD', name: 'Balde', abbreviation: 'bld' },
  { code: 'ROL', name: 'Rollo', abbreviation: 'rol' },
  { code: 'PLG', name: 'Pulgada', abbreviation: 'plg' },
  { code: 'PZA', name: 'Pieza', abbreviation: 'pza' },
  { code: 'JGO', name: 'Juego', abbreviation: 'jgo' },
];

const BASE_CATEGORIES = [
  {
    code: 'CONSTRUCCION',
    name: 'Materiales de construcción',
    description: 'Cemento, fierro, agregados, ladrillos, etc.',
  },
  {
    code: 'SEGURIDAD',
    name: 'Equipos de protección personal (EPP)',
    description: 'Cascos, guantes, arneses, lentes, etc.',
  },
  {
    code: 'FERRETERIA',
    name: 'Ferretería general',
    description: 'Clavos, tornillos, alambres, herramientas menores',
  },
  {
    code: 'ELECTRICA',
    name: 'Material eléctrico',
    description: 'Cables, interruptores, tomacorrientes, luminarias',
  },
  {
    code: 'GASFITERIA',
    name: 'Gasfitería y plomería',
    description: 'Tuberías, accesorios, grifería',
  },
  {
    code: 'PINTURAS',
    name: 'Pinturas y acabados',
    description: 'Pinturas, barnices, disolventes, brochas',
  },
  { code: 'HERRAMIENTAS', name: 'Herramientas', description: 'Manuales y eléctricas' },
  {
    code: 'REPUESTOS',
    name: 'Repuestos',
    description: 'Repuestos de maquinaria y vehículos',
  },
  {
    code: 'OFICINA',
    name: 'Útiles de oficina',
    description: 'Papelería, útiles, consumibles',
  },
];

const BASE_SPECIALTIES = [
  {
    code: 'ALBANIL',
    name: 'Albañil',
    description: 'Construcción de muros, pisos, enlucidos, asentado de ladrillos',
  },
  {
    code: 'ELECTRICISTA',
    name: 'Electricista',
    description: 'Instalaciones eléctricas, conexiones, tableros',
  },
  {
    code: 'GASFITERO',
    name: 'Gasfitero',
    description: 'Instalaciones sanitarias, tuberías de agua y desagüe',
  },
  {
    code: 'OPERADOR',
    name: 'Operador',
    description: 'Manejo de maquinaria pesada y equipos',
  },
  {
    code: 'MAESTRO_OBRA',
    name: 'Maestro de obra',
    description: 'Supervisor de obra, coordina cuadrilla',
  },
  {
    code: 'OFICIAL',
    name: 'Oficial',
    description: 'Obrero con especialidad, asiste al maestro',
  },
  {
    code: 'AYUDANTE',
    name: 'Ayudante',
    description: 'Apoyo general en obra, sin especialidad específica',
  },
  {
    code: 'SOLDADOR',
    name: 'Soldador',
    description: 'Soldadura de estructuras metálicas, mallas, perfiles',
  },
  {
    code: 'PINTOR',
    name: 'Pintor',
    description: 'Aplicación de pinturas, barnices, acabados',
  },
  {
    code: 'CARPINTERO',
    name: 'Carpintero',
    description: 'Carpintería de obra (encofrados) y mueble',
  },
];

@Injectable()
export class BootstrapService implements OnApplicationBootstrap {
  private readonly logger = new Logger(BootstrapService.name);

  constructor(private readonly prisma: PrismaService) {}

  async onApplicationBootstrap(): Promise<void> {
    try {
      const permissionCount = await this.prisma.permission.count();

      if (permissionCount === 0) {
        this.logger.warn(
          'BD sin permissions — sembrando roles, permissions y assignments...',
        );
        await this.seedRoles();
        await this.seedPermissions();
        await this.assignPermissionsByRole();
      } else {
        this.logger.log(
          `Roles/Permissions OK: ${permissionCount} permissions ya sembradas.`,
        );
      }

      // Catálogos base — cada uno es idempotente y solo siembra si está vacío.
      await this.seedUnits();
      await this.seedCategories();
      await this.seedSpecialties();
      await this.seedSupplierEventual();
      await this.seedMainWarehouse();

      this.logger.log('✓ Bootstrap completed.');
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

  // Cada upsert es idempotente por su `code` único — si ya existe no toca nada,
  // y no pisa registros creados manualmente por el usuario (esos tienen códigos
  // auto-generados tipo CAT-XXXXXX, distintos de los códigos base).
  private async seedUnits(): Promise<void> {
    for (const unit of BASE_UNITS) {
      await this.prisma.unit.upsert({
        where: { code: unit.code },
        update: {},
        create: unit,
      });
    }
    this.logger.log(`  ✓ ${BASE_UNITS.length} units ensured`);
  }

  private async seedCategories(): Promise<void> {
    for (const cat of BASE_CATEGORIES) {
      await this.prisma.category.upsert({
        where: { code: cat.code },
        update: {},
        create: cat,
      });
    }
    this.logger.log(`  ✓ ${BASE_CATEGORIES.length} categories ensured`);
  }

  private async seedSpecialties(): Promise<void> {
    for (const spec of BASE_SPECIALTIES) {
      await this.prisma.specialty.upsert({
        where: { code: spec.code },
        update: {},
        create: spec,
      });
    }
    this.logger.log(`  ✓ ${BASE_SPECIALTIES.length} specialties ensured`);
  }

  private async seedSupplierEventual(): Promise<void> {
    await this.prisma.supplier.upsert({
      where: { code: 'PRV-EVENTUAL' },
      update: {},
      create: {
        code: 'PRV-EVENTUAL',
        name: 'Proveedor eventual - Efectivo',
        notes:
          'Catch-all para compras menores en efectivo sin factura de proveedor registrado.',
        active: true,
      },
    });
    this.logger.log('  ✓ Supplier PRV-EVENTUAL ensured');
  }

  private async seedMainWarehouse(): Promise<void> {
    const existing = await this.prisma.warehouse.findFirst({
      where: { type: 'CENTRAL', deletedAt: null },
    });
    if (existing) return;
    await this.prisma.warehouse.upsert({
      where: { code: 'ALM-PRINCIPAL' },
      update: {},
      create: {
        code: 'ALM-PRINCIPAL',
        name: 'Almacén Principal',
        type: 'CENTRAL',
        description:
          'Inventario matriz de la empresa. Punto de entrada para todas las compras.',
        active: true,
      },
    });
    this.logger.log('  ✓ Almacén Principal seeded');
  }
}
