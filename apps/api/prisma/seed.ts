import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// ============================================================================
// Seed Script
// ============================================================================
// This seed creates:
// 1. System roles (ADMIN, JEFE, ALMACENERO, RESIDENTE)
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
    name: 'JEFE',
    description: 'Jefe de Almacén - gestiona aprobaciones y reportes',
    systemRole: true,
  },
  {
    name: 'ALMACENERO',
    description: 'Almacenero - registra movimientos en su almacén',
    systemRole: true,
  },
  {
    name: 'RESIDENTE',
    description: 'Residente de Obra - consulta stock y solicita materiales',
    systemRole: true,
  },
];

// Base permissions for Fase 2 (will be extended)
const BASE_PERMISSIONS = [
  // Users
  { resource: 'users', action: 'create' },
  { resource: 'users', action: 'read' },
  { resource: 'users', action: 'update' },
  { resource: 'users', action: 'delete' },
  // Roles
  { resource: 'roles', action: 'read' },
  { resource: 'roles', action: 'update' },
  // System
  { resource: 'system', action: 'configure' },
  { resource: 'audit', action: 'read' },
];

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

async function assignPermissionsToAdmin() {
  console.log('🌱 Assigning all permissions to ADMIN role...');

  const adminRole = await prisma.role.findUnique({ where: { name: 'ADMIN' } });
  if (!adminRole) throw new Error('ADMIN role not found');

  const allPermissions = await prisma.permission.findMany();

  for (const perm of allPermissions) {
    await prisma.rolePermission.upsert({
      where: {
        roleId_permissionId: {
          roleId: adminRole.id,
          permissionId: perm.id,
        },
      },
      update: {},
      create: {
        roleId: adminRole.id,
        permissionId: perm.id,
      },
    });
  }

  console.log(`   ✓ ${allPermissions.length} permissions assigned to ADMIN`);
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

  // Note: bcrypt will be added in Fase 2. For Fase 1C, we just store the password
  // in a placeholder format. Seed will be re-run after Fase 2 completes.
  const placeholderHash = `PLACEHOLDER:${ADMIN_PASSWORD}`;

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

async function main() {
  console.log('\n🚀 Kardex Seed Script Starting...\n');

  await seedRoles();
  await seedPermissions();
  await assignPermissionsToAdmin();
  await seedSystemSettings();
  await seedFirstAdmin();

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
