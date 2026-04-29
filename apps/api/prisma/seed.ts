import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const BCRYPT_ROUNDS = 12;

const prisma = new PrismaClient();

// ============================================================================
// Seed Script
// ============================================================================
// This seed creates:
// 1. System roles (ADMIN, ALMACENERO, RESIDENTE)  — Fase 7A: eliminado el rol JEFE
// 2. Base permissions (will grow in later phases)
// 3. First Admin user (if ADMIN_* env vars are defined)
// 4. SystemSetting.SETUP_COMPLETED flag
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

const BASE_PERMISSIONS = [
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
  // Transfers — Fase 7A: flujo simplificado a 2 pasos, sin approve/send
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
  // Tools (loans/returns)
  { resource: 'tools', action: 'read' },
  { resource: 'tools', action: 'loan' },
  { resource: 'tools', action: 'return' },
  // Obras (Proyectos)
  { resource: 'obras', action: 'create' },
  { resource: 'obras', action: 'read' },
  { resource: 'obras', action: 'update' },
  { resource: 'obras', action: 'delete' },
  // Work Stations (Estaciones de trabajo)
  { resource: 'work-stations', action: 'create' },
  { resource: 'work-stations', action: 'read' },
  { resource: 'work-stations', action: 'update' },
  { resource: 'work-stations', action: 'delete' },
  // Specialties (Especialidades)
  { resource: 'specialties', action: 'create' },
  { resource: 'specialties', action: 'read' },
  { resource: 'specialties', action: 'update' },
  { resource: 'specialties', action: 'delete' },
  // Suppliers (Proveedores) — catálogo para trazabilidad de compras
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
  // Inventory counts (Fase 7B)
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

// Permissions per role (resource:action strings)
// Matriz final Fase 7A — eliminado rol JEFE.
//   ADMIN: todo-poderoso
//   ALMACENERO: operación diaria (items, stock, movimientos, transferencias, EPP, equipos, combustible, mantenimientos)
//   RESIDENTE: solo lectura de su obra + recibe transferencias + consulta herramientas
const ROLE_PERMISSIONS: Record<string, string[]> = {
  ADMIN: ['*'], // all permissions — resolved below

  ALMACENERO: [
    // Lectura de maestros estructurales
    'warehouses:read',
    'categories:read',
    'units:read',
    'obras:read',
    'specialties:read',
    'permissions:read',
    'users:read',

    // Ítems del catálogo: alta y mantenimiento completo
    'items:create',
    'items:read',
    'items:update',
    'items:import',
    'items:export',

    // Stock y movimientos: creación y ajustes
    'stock:read',
    'stock:adjust',
    'movements:create',
    'movements:read',
    'movements:export',

    // Transferencias: el almacenero crea, envía y puede recibir/rechazar/cancelar
    'transfers:create',
    'transfers:read',
    'transfers:receive',
    'transfers:reject',
    'transfers:cancel',

    // Alertas (incluye marcar leídas)
    'alerts:read',
    'alerts:update',

    // Herramientas - préstamos
    'tools:read',
    'tools:loan',
    'tools:return',

    // EPP
    'epp:assign',
    'epp:read',

    // Empleados (workers) — registra y actualiza (no elimina)
    'workers:create',
    'workers:read',
    'workers:update',

    // Estaciones de trabajo — solo lectura (las gestiona el residente en /mi-obra)
    'work-stations:read',

    // Proveedores — ALMACENERO crea/lee/actualiza. Elimina queda reservado a ADMIN.
    'suppliers:create',
    'suppliers:read',
    'suppliers:update',

    // Inventarios físicos (Fase 7B) — ejecuta conteos y cierra
    'inventory:read',
    'inventory:create',
    'inventory:count',
    'inventory:close',
    'inventory:cancel',

    // Reportes
    'reports:read',
    'reports:export',
  ],

  RESIDENTE: [
    // Lectura de entidades de su obra
    'warehouses:read',
    'categories:read',
    'units:read',
    'items:read',
    'obras:read',
    'specialties:read',
    'suppliers:read',
    'workers:read',
    'permissions:read',

    // Estaciones de trabajo — el residente gestiona las estaciones de SU obra
    'work-stations:read',
    'work-stations:create',
    'work-stations:update',
    'work-stations:delete',

    // Stock y movimientos — modelo operativo (Fase 7A-ext):
    // el residente puede ajustar stock y registrar consumo/baja en su almacén
    'stock:read',
    'stock:adjust',
    'movements:read',
    'movements:create',

    // Transferencias: recibe las de su obra (+ lectura, reject en recepción)
    'transfers:read',
    'transfers:receive',
    'transfers:reject',

    // Herramientas — presta y devuelve desde el almacén de su obra
    'tools:read',
    'tools:loan',
    'tools:return',

    // EPP — asigna y repone a obreros de su obra
    'epp:read',
    'epp:assign',

    // Consultas operativas
    'alerts:read',
    'inventory:read',

    // Reportes (para su obra)
    'reports:read',
  ],
};

async function seedRoles() {
  console.log('🌱 Seeding system roles...');

  for (const roleData of SYSTEM_ROLES) {
    await prisma.role.upsert({
      where: { name: roleData.name },
      update: {},
      create: roleData,
    });
  }

  console.log(`   ✓ ${SYSTEM_ROLES.length} roles created/verified`);
}

async function seedPermissions() {
  console.log('🌱 Seeding base permissions...');

  for (const perm of BASE_PERMISSIONS) {
    await prisma.permission.upsert({
      where: {
        resource_action: { resource: perm.resource, action: perm.action },
      },
      update: {},
      create: perm,
    });
  }

  console.log(`   ✓ ${BASE_PERMISSIONS.length} permissions created/verified`);
}

async function assignPermissionsByRole() {
  console.log('🌱 Assigning permissions to all roles...');

  const allRoles = await prisma.role.findMany();
  const allPermissions = await prisma.permission.findMany();
  const permMap = new Map(allPermissions.map((p) => [`${p.resource}:${p.action}`, p.id]));

  for (const role of allRoles) {
    const allowed = ROLE_PERMISSIONS[role.name];
    if (!allowed) continue;

    const permIds =
      allowed[0] === '*'
        ? allPermissions.map((p) => p.id)
        : allowed.map((key) => permMap.get(key)).filter((id): id is string => !!id);

    for (const permissionId of permIds) {
      await prisma.rolePermission.upsert({
        where: { roleId_permissionId: { roleId: role.id, permissionId } },
        update: {},
        create: { roleId: role.id, permissionId },
      });
    }

    console.log(`   ✓ ${permIds.length} permissions → ${role.name}`);
  }
}

async function seedFirstAdmin() {
  const {
    ADMIN_DOC_TYPE,
    ADMIN_DOC_NUMBER,
    ADMIN_PASSWORD,
    ADMIN_FIRST_NAME,
    ADMIN_LAST_NAME,
    ADMIN_EMAIL,
  } = process.env;

  if (!ADMIN_DOC_TYPE || !ADMIN_DOC_NUMBER || !ADMIN_PASSWORD) {
    console.log('ℹ️  Skipping first admin seed (ADMIN_* env vars not set)');
    console.log('   → Use the /setup wizard after first deploy');
    return;
  }

  const existingAdmin = await prisma.user.count();
  if (existingAdmin > 0) {
    console.log('ℹ️  At least one user exists — skipping first admin bootstrap');
    return;
  }

  console.log('🌱 Creating first Admin user from env vars...');

  const adminRole = await prisma.role.findUnique({ where: { name: 'ADMIN' } });
  if (!adminRole) throw new Error('ADMIN role not found');

  const placeholderHash = await bcrypt.hash(ADMIN_PASSWORD, BCRYPT_ROUNDS);

  await prisma.user.create({
    data: {
      documentType: ADMIN_DOC_TYPE as 'DNI' | 'CE' | 'PASAPORTE',
      documentNumber: ADMIN_DOC_NUMBER,
      passwordHash: placeholderHash,
      firstName: ADMIN_FIRST_NAME ?? 'Administrador',
      lastName: ADMIN_LAST_NAME ?? 'Principal',
      email: ADMIN_EMAIL,
      roleId: adminRole.id,
      active: true,
      mustChangePassword: true,
    },
  });

  console.log(`   ✓ Admin created: ${ADMIN_DOC_TYPE} ${ADMIN_DOC_NUMBER}`);
  console.log('   ⚠️  mustChangePassword=true — forced password change on first login');

  await prisma.systemSetting.upsert({
    where: { key: 'SETUP_COMPLETED' },
    update: { value: 'true' },
    create: {
      key: 'SETUP_COMPLETED',
      value: 'true',
      description: 'Indicates whether the initial setup wizard has been completed',
    },
  });

  console.log('   ✓ SETUP_COMPLETED flag set to true');
}

async function seedSystemSettings() {
  const existingSettings = await prisma.systemSetting.findMany({
    where: { key: 'SETUP_COMPLETED' },
  });

  if (existingSettings.length === 0) {
    await prisma.systemSetting.create({
      data: {
        key: 'SETUP_COMPLETED',
        value: 'false',
        description: 'Indicates whether the initial setup wizard has been completed',
      },
    });
    console.log('🌱 SETUP_COMPLETED flag initialized to false');
  }
}

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

async function seedUnits() {
  console.log('🌱 Seeding base units...');
  for (const unit of BASE_UNITS) {
    await prisma.unit.upsert({
      where: { code: unit.code },
      update: {},
      create: unit,
    });
  }
  console.log(`   ✓ ${BASE_UNITS.length} units created/verified`);
}

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

async function seedCategories() {
  console.log('🌱 Seeding base categories...');
  for (const cat of BASE_CATEGORIES) {
    await prisma.category.upsert({
      where: { code: cat.code },
      update: {},
      create: cat,
    });
  }
  console.log(`   ✓ ${BASE_CATEGORIES.length} categories created/verified`);
}

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

async function seedSpecialties() {
  console.log('🌱 Seeding base specialties...');
  for (const spec of BASE_SPECIALTIES) {
    await prisma.specialty.upsert({
      where: { code: spec.code },
      update: {},
      create: spec,
    });
  }
  console.log(`   ✓ ${BASE_SPECIALTIES.length} specialties created/verified`);
}

async function seedSuppliers() {
  console.log('🌱 Seeding base suppliers...');
  // "Proveedor eventual - Efectivo" — catch-all para compras menores sin factura
  // de un proveedor registrado (ferretería de la esquina, taxi, etc.).
  await prisma.supplier.upsert({
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
  console.log('   ✓ Proveedor eventual creado/verificado');
}

async function seedMainWarehouse() {
  console.log('🌱 Seeding Almacén Principal...');
  const existing = await prisma.warehouse.findFirst({
    where: { type: 'CENTRAL', deletedAt: null },
  });
  if (existing) {
    console.log(`   ✓ Almacén Principal ya existe: ${existing.code} — ${existing.name}`);
    return;
  }
  const created = await prisma.warehouse.upsert({
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
  console.log(`   ✓ Almacén Principal creado: ${created.code}`);
}

async function main() {
  console.log('\n🚀 Kardex Seed Script Starting...\n');

  await seedRoles();
  await seedPermissions();
  await assignPermissionsByRole();
  await seedSystemSettings();
  await seedFirstAdmin();
  await seedUnits();
  await seedCategories();
  await seedSpecialties();
  await seedSuppliers();
  await seedMainWarehouse();

  console.log('\n✅ Seed completed successfully!\n');
}

main()
  .catch((e) => {
    console.error('\n❌ Seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
