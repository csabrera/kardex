-- Remove combustible (fuel) from the system
-- Drops fuel_dispatches + fuel_dispatch_sequence, removes COMBUSTIBLE from ItemType enum,
-- and cleans up fuel:* permissions. Safe because: 0 fuel_dispatches, 0 items COMBUSTIBLE.

-- 1. Drop tables (FK to movements/items/warehouses/users/workers/equipment cascades via DROP)
DROP TABLE IF EXISTS "fuel_dispatches";
DROP TABLE IF EXISTS "fuel_dispatch_sequence";

-- 2. Cleanup fuel:* permissions (and their role_permissions joins)
DELETE FROM "role_permissions"
WHERE "permissionId" IN (SELECT "id" FROM "permissions" WHERE "resource" = 'fuel');
DELETE FROM "permissions" WHERE "resource" = 'fuel';

-- 3. Remove COMBUSTIBLE from ItemType enum.
-- PostgreSQL doesn't allow dropping enum values directly, so we recreate the enum.
-- Verified upstream: 0 items use this value. The default on items.type must be
-- dropped before the cast (it can't be recast automatically) and re-added after.
ALTER TABLE "items" ALTER COLUMN "type" DROP DEFAULT;
ALTER TYPE "ItemType" RENAME TO "ItemType_old";
CREATE TYPE "ItemType" AS ENUM ('MATERIAL', 'HERRAMIENTA', 'EPP', 'EQUIPO', 'REPUESTO');
ALTER TABLE "items" ALTER COLUMN "type" TYPE "ItemType" USING ("type"::text::"ItemType");
ALTER TABLE "items" ALTER COLUMN "type" SET DEFAULT 'MATERIAL'::"ItemType";
DROP TYPE "ItemType_old";
