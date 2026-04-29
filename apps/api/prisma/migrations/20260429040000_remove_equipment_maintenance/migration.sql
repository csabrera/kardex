-- Remove Equipment + Maintenance modules from the system
-- Drops all related tables, sequences, and enums. Cleans up permissions.
-- Safe because: 0 equipment, 0 maintenances, 0 maintenance_items in DB.

-- 1. Drop tables (children first to satisfy FK)
DROP TABLE IF EXISTS "maintenance_items";
DROP TABLE IF EXISTS "maintenances";
DROP TABLE IF EXISTS "maintenance_sequence";
DROP TABLE IF EXISTS "equipment_count_readings";
DROP TABLE IF EXISTS "equipment";
DROP TABLE IF EXISTS "equipment_sequence";

-- 2. Cleanup permissions (and their role_permissions joins)
DELETE FROM "role_permissions"
WHERE "permissionId" IN (
  SELECT "id" FROM "permissions" WHERE "resource" IN ('equipment', 'maintenance')
);
DELETE FROM "permissions" WHERE "resource" IN ('equipment', 'maintenance');

-- 3. Drop enums (no longer referenced by any column)
DROP TYPE IF EXISTS "MaintenanceStatus";
DROP TYPE IF EXISTS "MaintenanceType";
DROP TYPE IF EXISTS "EquipmentStatus";
DROP TYPE IF EXISTS "CountType";
DROP TYPE IF EXISTS "EquipmentType";
