/*
  Warnings:

  - The values [SOLICITADA,APROBADA] on the enum `TransferStatus` will be removed. If these variants are still used in the database, this will fail.
  - Made the column `responsibleUserId` on table `obras` required. This step will fail if there are existing NULL values in that column.

*/
-- CreateEnum
CREATE TYPE "InventoryCountStatus" AS ENUM ('IN_PROGRESS', 'CLOSED', 'CANCELLED');

-- AlterEnum
ALTER TYPE "AlertType" ADD VALUE 'TRANSFER_DISCREPANCIA';

-- AlterEnum
ALTER TYPE "MovementSource" ADD VALUE 'INVENTARIO';

-- AlterEnum
BEGIN;
CREATE TYPE "TransferStatus_new" AS ENUM ('EN_TRANSITO', 'RECIBIDA', 'RECHAZADA', 'CANCELADA');
ALTER TABLE "transfers" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "transfers" ALTER COLUMN "status" TYPE "TransferStatus_new" USING ("status"::text::"TransferStatus_new");
ALTER TYPE "TransferStatus" RENAME TO "TransferStatus_old";
ALTER TYPE "TransferStatus_new" RENAME TO "TransferStatus";
DROP TYPE "TransferStatus_old";
ALTER TABLE "transfers" ALTER COLUMN "status" SET DEFAULT 'EN_TRANSITO';
COMMIT;

-- DropForeignKey
ALTER TABLE "obras" DROP CONSTRAINT "obras_responsibleUserId_fkey";

-- AlterTable
ALTER TABLE "obras" ALTER COLUMN "responsibleUserId" SET NOT NULL;

-- AlterTable
ALTER TABLE "transfers" ALTER COLUMN "status" SET DEFAULT 'EN_TRANSITO';

-- CreateTable
CREATE TABLE "inventory_count_sequences" (
    "id" INTEGER NOT NULL DEFAULT 1,
    "lastValue" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "inventory_count_sequences_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "inventory_counts" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "warehouseId" TEXT NOT NULL,
    "status" "InventoryCountStatus" NOT NULL DEFAULT 'IN_PROGRESS',
    "notes" TEXT,
    "startedById" TEXT NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "closedById" TEXT,
    "closedAt" TIMESTAMP(3),
    "cancelledById" TEXT,
    "cancelledAt" TIMESTAMP(3),
    "adjustmentMovementId" TEXT,

    CONSTRAINT "inventory_counts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "inventory_count_items" (
    "id" TEXT NOT NULL,
    "countId" TEXT NOT NULL,
    "itemId" TEXT NOT NULL,
    "expectedQty" DECIMAL(12,3) NOT NULL,
    "countedQty" DECIMAL(12,3),
    "variance" DECIMAL(12,3),
    "notes" TEXT,

    CONSTRAINT "inventory_count_items_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "inventory_counts_code_key" ON "inventory_counts"("code");

-- CreateIndex
CREATE UNIQUE INDEX "inventory_counts_adjustmentMovementId_key" ON "inventory_counts"("adjustmentMovementId");

-- CreateIndex
CREATE INDEX "inventory_counts_warehouseId_status_idx" ON "inventory_counts"("warehouseId", "status");

-- CreateIndex
CREATE INDEX "inventory_counts_startedById_idx" ON "inventory_counts"("startedById");

-- CreateIndex
CREATE INDEX "inventory_counts_startedAt_idx" ON "inventory_counts"("startedAt");

-- CreateIndex
CREATE INDEX "inventory_count_items_countId_idx" ON "inventory_count_items"("countId");

-- CreateIndex
CREATE UNIQUE INDEX "inventory_count_items_countId_itemId_key" ON "inventory_count_items"("countId", "itemId");

-- AddForeignKey
ALTER TABLE "obras" ADD CONSTRAINT "obras_responsibleUserId_fkey" FOREIGN KEY ("responsibleUserId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_counts" ADD CONSTRAINT "inventory_counts_warehouseId_fkey" FOREIGN KEY ("warehouseId") REFERENCES "warehouses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_counts" ADD CONSTRAINT "inventory_counts_startedById_fkey" FOREIGN KEY ("startedById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_counts" ADD CONSTRAINT "inventory_counts_closedById_fkey" FOREIGN KEY ("closedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_counts" ADD CONSTRAINT "inventory_counts_cancelledById_fkey" FOREIGN KEY ("cancelledById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_counts" ADD CONSTRAINT "inventory_counts_adjustmentMovementId_fkey" FOREIGN KEY ("adjustmentMovementId") REFERENCES "movements"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_count_items" ADD CONSTRAINT "inventory_count_items_countId_fkey" FOREIGN KEY ("countId") REFERENCES "inventory_counts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_count_items" ADD CONSTRAINT "inventory_count_items_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "items"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
