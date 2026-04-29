-- Eliminar jerarquía padre-hijo de Category. Decisión 2026-04-29:
-- nunca se usó en UI (form de categoría no permitía asignar parent),
-- todas las categorías existentes tienen parentId = NULL. Cero datos a perder.

-- DropForeignKey
ALTER TABLE "categories" DROP CONSTRAINT IF EXISTS "categories_parentId_fkey";

-- DropIndex
DROP INDEX IF EXISTS "categories_parentId_idx";

-- AlterTable
ALTER TABLE "categories" DROP COLUMN IF EXISTS "parentId";
