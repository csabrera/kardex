-- Split de nombres (paterno + materno, peruano) + contract end date para User.
-- `lastName` se mantiene como campo derivado computado por el service.

-- 1) User: nuevas columnas
ALTER TABLE "users"
  ADD COLUMN "paternalLastName" TEXT,
  ADD COLUMN "maternalLastName" TEXT,
  ADD COLUMN "contractEndDate" TIMESTAMP(3);

-- 2) Worker: nuevas columnas
ALTER TABLE "workers"
  ADD COLUMN "paternalLastName" TEXT,
  ADD COLUMN "maternalLastName" TEXT;

-- 3) Backfill: copiar lastName existente como paternalLastName.
--    El admin puede editar después para separar paterno/materno correctamente.
UPDATE "users" SET "paternalLastName" = "lastName";
UPDATE "workers" SET "paternalLastName" = "lastName";
