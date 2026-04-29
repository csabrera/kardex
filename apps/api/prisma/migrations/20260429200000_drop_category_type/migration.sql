-- Eliminar Category.type por completo. Decisión 2026-04-29 (parte 8):
-- las categorías son taxonomía libre, ortogonales al Tipo del ítem. Esta columna
-- se agregó en parte 5 y se eliminó tras feedback de UX: complicaba sin aportar valor.
-- El comportamiento de los ítems sigue gobernado por Item.type — la categoría es
-- solo etiqueta de agrupación.

-- DropIndex
DROP INDEX IF EXISTS "categories_type_idx";

-- AlterTable
ALTER TABLE "categories" DROP COLUMN IF EXISTS "type";
