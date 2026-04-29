-- Consolidación de ItemType de 5 valores → 3 basados en comportamiento operativo.
-- Mapping:
--   MATERIAL, REPUESTO    → CONSUMO     (consumibles)
--   HERRAMIENTA, EQUIPO   → PRESTAMO    (se prestan y vuelven)
--   EPP                   → ASIGNACION  (se entregan a obreros con reposición)

-- Estrategia segura: convertir columnas a TEXT temporal, mapear valores, recrear enum.

-- 1) Convertir a TEXT para poder mapear sin restricción de enum
ALTER TABLE "items" ALTER COLUMN "type" DROP DEFAULT;
ALTER TABLE "items" ALTER COLUMN "type" TYPE TEXT;
ALTER TABLE "categories" ALTER COLUMN "type" TYPE TEXT;

-- 2) Aplicar el mapping en datos existentes
UPDATE "items"
SET "type" = CASE "type"
  WHEN 'MATERIAL'    THEN 'CONSUMO'
  WHEN 'REPUESTO'    THEN 'CONSUMO'
  WHEN 'HERRAMIENTA' THEN 'PRESTAMO'
  WHEN 'EQUIPO'      THEN 'PRESTAMO'
  WHEN 'EPP'         THEN 'ASIGNACION'
  ELSE 'CONSUMO'
END;

UPDATE "categories"
SET "type" = CASE "type"
  WHEN 'MATERIAL'    THEN 'CONSUMO'
  WHEN 'REPUESTO'    THEN 'CONSUMO'
  WHEN 'HERRAMIENTA' THEN 'PRESTAMO'
  WHEN 'EQUIPO'      THEN 'PRESTAMO'
  WHEN 'EPP'         THEN 'ASIGNACION'
  ELSE NULL
END
WHERE "type" IS NOT NULL;

-- 3) Drop + recreate enum con los nuevos valores
DROP TYPE "ItemType";
CREATE TYPE "ItemType" AS ENUM ('CONSUMO', 'PRESTAMO', 'ASIGNACION');

-- 4) Re-castear columnas al nuevo enum y restaurar default
ALTER TABLE "items" ALTER COLUMN "type" TYPE "ItemType" USING "type"::"ItemType";
ALTER TABLE "items" ALTER COLUMN "type" SET DEFAULT 'CONSUMO';
ALTER TABLE "categories" ALTER COLUMN "type" TYPE "ItemType" USING "type"::"ItemType";
