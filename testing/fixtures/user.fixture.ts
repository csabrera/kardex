import { prisma } from '../helpers/db.helper';

export type SystemRoleName = 'ADMIN' | 'JEFE' | 'ALMACENERO' | 'RESIDENTE';

export interface SeedUserInput {
  documentType?: 'DNI' | 'CE' | 'PASAPORTE';
  documentNumber?: string;
  password?: string;
  firstName?: string;
  lastName?: string;
  email?: string;
  role?: SystemRoleName;
  mustChangePassword?: boolean;
}

export interface SeededUser {
  id: string;
  documentType: string;
  documentNumber: string;
  password: string;
  firstName: string;
  lastName: string;
  email: string | null;
  roleName: string;
}

/**
 * Create a user directly in the database (bypassing the API).
 *
 * Useful for:
 * - Setting up users with specific roles quickly
 * - Bootstrapping tests that need an existing user (login)
 *
 * NOTE: Password is stored as `PLACEHOLDER:<password>` until bcrypt is wired
 * up in Fase 2A. After Fase 2A, this fixture will hash the password properly.
 */
export async function seedUser(input: SeedUserInput = {}): Promise<SeededUser> {
  const roleName = input.role ?? 'ADMIN';
  const documentType = input.documentType ?? 'DNI';
  const documentNumber = input.documentNumber ?? generateDocumentNumber(documentType);
  const password = input.password ?? 'TestPassword123!';

  const role = await prisma.role.findUnique({ where: { name: roleName } });
  if (!role) {
    throw new Error(
      `Role "${roleName}" not found. Did you run seedSystemRoles() first?`,
    );
  }

  const user = await prisma.user.create({
    data: {
      documentType,
      documentNumber,
      passwordHash: `PLACEHOLDER:${password}`, // TODO(Fase 2A): bcrypt hash
      firstName: input.firstName ?? 'Test',
      lastName: input.lastName ?? 'User',
      email: input.email,
      roleId: role.id,
      active: true,
      mustChangePassword: input.mustChangePassword ?? false,
    },
  });

  return {
    id: user.id,
    documentType: user.documentType,
    documentNumber: user.documentNumber,
    password,
    firstName: user.firstName,
    lastName: user.lastName,
    email: user.email,
    roleName,
  };
}

/**
 * Seed the 4 system roles + base permissions.
 * Must be called at least once before seedUser().
 */
export async function seedSystemRoles(): Promise<void> {
  const roles = [
    { name: 'ADMIN', description: 'Administrador del sistema', systemRole: true },
    { name: 'JEFE', description: 'Jefe de Almacén', systemRole: true },
    { name: 'ALMACENERO', description: 'Almacenero', systemRole: true },
    { name: 'RESIDENTE', description: 'Residente de Obra', systemRole: true },
  ];

  for (const role of roles) {
    await prisma.role.upsert({
      where: { name: role.name },
      update: {},
      create: role,
    });
  }
}

/**
 * Generate a random valid document number for the given type.
 *
 * Ensures uniqueness between parallel test runs by using a timestamp + random suffix.
 */
export function generateDocumentNumber(type: 'DNI' | 'CE' | 'PASAPORTE'): string {
  const random = Math.floor(Math.random() * 1_000_000);
  const timestamp = Date.now() % 100_000;

  switch (type) {
    case 'DNI':
      // 8 digits
      return String(timestamp * 10 + (random % 10)).padStart(8, '0').slice(-8);
    case 'CE':
      // 9 digits
      return String(timestamp * 100 + (random % 100)).padStart(9, '0').slice(-9);
    case 'PASAPORTE':
      // Alphanumeric uppercase, 8 chars
      return (
        'P' +
        timestamp.toString(36).toUpperCase() +
        random.toString(36).toUpperCase()
      )
        .replace(/[^A-Z0-9]/g, '')
        .slice(0, 8)
        .padEnd(8, 'X');
    default:
      throw new Error(`Unknown document type: ${type as string}`);
  }
}
