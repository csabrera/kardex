-- Modelo de transferencias parciales: el residente puede recibir < sentQty y la TRF
-- queda PARCIALMENTE_RECIBIDA, permitiendo recepción adicional cuando llegue el resto
-- o cierre como faltante definitivo por el admin con motivo del enum cerrado.

-- AlterEnum: TransferStatus add PARCIALMENTE_RECIBIDA
ALTER TYPE "TransferStatus" ADD VALUE 'PARCIALMENTE_RECIBIDA' AFTER 'EN_TRANSITO';

-- AlterEnum: MovementSource add COMPRA_INCUMPLIDA (registra la baja contable
-- en el Principal cuando el admin cierra una línea como faltante definitivo)
ALTER TYPE "MovementSource" ADD VALUE 'COMPRA_INCUMPLIDA';

-- CreateEnum: estado por línea (TransferItem)
CREATE TYPE "TransferItemStatus" AS ENUM ('PENDIENTE', 'RECIBIDO_COMPLETO', 'RECIBIDO_PARCIAL', 'FALTANTE_DEFINITIVO');

-- CreateEnum: motivos cerrados para clasificar el faltante definitivo
CREATE TYPE "TransferShortageReason" AS ENUM ('INCUMPLIMIENTO_PROVEEDOR', 'DANIO_EN_TRANSPORTE', 'ROBO_O_PERDIDA', 'ERROR_DE_CONTEO', 'OTRO');

-- AlterTable: nuevas columnas en transfer_items
ALTER TABLE "transfer_items" ADD COLUMN "status" "TransferItemStatus" NOT NULL DEFAULT 'PENDIENTE';
ALTER TABLE "transfer_items" ADD COLUMN "shortageReason" "TransferShortageReason";
ALTER TABLE "transfer_items" ADD COLUMN "shortageNotes" TEXT;
ALTER TABLE "transfer_items" ADD COLUMN "closedAt" TIMESTAMP(3);
ALTER TABLE "transfer_items" ADD COLUMN "closedById" TEXT;

-- AddForeignKey
ALTER TABLE "transfer_items" ADD CONSTRAINT "transfer_items_closedById_fkey" FOREIGN KEY ("closedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- CreateIndex
CREATE INDEX "transfer_items_status_idx" ON "transfer_items"("status");

-- Backfill: data histórica. Líneas de transfers ya RECIBIDA quedan como completas.
-- Las que están en RECHAZADA/CANCELADA se quedan PENDIENTE (terminal sin recepción).
UPDATE "transfer_items" ti
SET "status" = 'RECIBIDO_COMPLETO'
FROM "transfers" t
WHERE ti."transferId" = t."id" AND t."status" = 'RECIBIDA';
