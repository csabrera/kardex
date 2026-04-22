import { PrismaClient } from '@prisma/client';

/**
 * Shared Prisma client for tests.
 *
 * Uses the DATABASE_URL from testing/.env.local (or CI env vars).
 * Should point at a DEDICATED TEST DATABASE, never at dev or production.
 */
export const prisma = new PrismaClient({
  log: process.env.DEBUG_PRISMA === 'true' ? ['query', 'error'] : ['error'],
});

/**
 * Truncate all tables and reseed system roles + permissions.
 *
 * Call this in test.beforeEach() when you need a clean slate.
 * In parallel test runs, prefer scoping data by a unique identifier
 * (e.g. `{ code: randomUuid }`) to avoid cross-test interference.
 */
export async function resetDatabase(): Promise<void> {
  // Order matters: delete children before parents (FK constraints).
  // As new models are added in later phases, extend this list.
  await prisma.rolePermission.deleteMany();
  await prisma.user.deleteMany();
  await prisma.permission.deleteMany();
  await prisma.role.deleteMany();
  await prisma.systemSetting.deleteMany();
}

/**
 * Close the Prisma connection. Call in globalTeardown.
 */
export async function disconnectDatabase(): Promise<void> {
  await prisma.$disconnect();
}

/**
 * Assertion helper: fails if table is not empty.
 * Useful to validate cleanup between tests.
 */
export async function assertTableEmpty(table: string): Promise<void> {
  // @ts-expect-error - dynamic access
  const count = await prisma[table].count();
  if (count > 0) {
    throw new Error(`Expected ${table} to be empty, found ${count} rows`);
  }
}
