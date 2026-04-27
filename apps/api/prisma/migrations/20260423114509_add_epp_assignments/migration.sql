-- CreateEnum
CREATE TYPE "ReplacementReason" AS ENUM ('PERDIDA', 'DANADO', 'DESGASTE', 'OTRO');

-- CreateTable
CREATE TABLE "epp_assignments" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "workerId" TEXT NOT NULL,
    "itemId" TEXT NOT NULL,
    "warehouseId" TEXT NOT NULL,
    "quantity" DECIMAL(12,3) NOT NULL,
    "assignedById" TEXT NOT NULL,
    "assignedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "replacesId" TEXT,
    "replacementReason" "ReplacementReason",
    "movementId" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "epp_assignments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "epp_sequence" (
    "id" INTEGER NOT NULL DEFAULT 1,
    "lastValue" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "epp_sequence_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "epp_assignments_code_key" ON "epp_assignments"("code");

-- CreateIndex
CREATE UNIQUE INDEX "epp_assignments_movementId_key" ON "epp_assignments"("movementId");

-- CreateIndex
CREATE INDEX "epp_assignments_workerId_idx" ON "epp_assignments"("workerId");

-- CreateIndex
CREATE INDEX "epp_assignments_itemId_idx" ON "epp_assignments"("itemId");

-- CreateIndex
CREATE INDEX "epp_assignments_warehouseId_idx" ON "epp_assignments"("warehouseId");

-- CreateIndex
CREATE INDEX "epp_assignments_assignedAt_idx" ON "epp_assignments"("assignedAt");

-- CreateIndex
CREATE INDEX "epp_assignments_replacesId_idx" ON "epp_assignments"("replacesId");

-- AddForeignKey
ALTER TABLE "epp_assignments" ADD CONSTRAINT "epp_assignments_workerId_fkey" FOREIGN KEY ("workerId") REFERENCES "workers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "epp_assignments" ADD CONSTRAINT "epp_assignments_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "items"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "epp_assignments" ADD CONSTRAINT "epp_assignments_warehouseId_fkey" FOREIGN KEY ("warehouseId") REFERENCES "warehouses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "epp_assignments" ADD CONSTRAINT "epp_assignments_assignedById_fkey" FOREIGN KEY ("assignedById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "epp_assignments" ADD CONSTRAINT "epp_assignments_replacesId_fkey" FOREIGN KEY ("replacesId") REFERENCES "epp_assignments"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "epp_assignments" ADD CONSTRAINT "epp_assignments_movementId_fkey" FOREIGN KEY ("movementId") REFERENCES "movements"("id") ON DELETE SET NULL ON UPDATE CASCADE;
