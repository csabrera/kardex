-- CreateEnum
CREATE TYPE "MovementType" AS ENUM ('ENTRADA', 'SALIDA', 'AJUSTE');

-- CreateEnum
CREATE TYPE "MovementSource" AS ENUM ('COMPRA', 'CONSUMO', 'TRANSFERENCIA', 'AJUSTE', 'DEVOLUCION', 'BAJA');

-- CreateEnum
CREATE TYPE "AlertType" AS ENUM ('STOCK_BAJO', 'STOCK_CRITICO');

-- CreateTable
CREATE TABLE "movement_sequences" (
    "type" "MovementType" NOT NULL,
    "lastValue" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "movement_sequences_pkey" PRIMARY KEY ("type")
);

-- CreateTable
CREATE TABLE "movements" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "type" "MovementType" NOT NULL,
    "source" "MovementSource" NOT NULL,
    "warehouseId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "movements_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "movement_items" (
    "id" TEXT NOT NULL,
    "movementId" TEXT NOT NULL,
    "itemId" TEXT NOT NULL,
    "quantity" DECIMAL(12,3) NOT NULL,
    "unitCost" DECIMAL(12,2),
    "stockBefore" DECIMAL(12,3) NOT NULL,
    "stockAfter" DECIMAL(12,3) NOT NULL,

    CONSTRAINT "movement_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "alerts" (
    "id" TEXT NOT NULL,
    "type" "AlertType" NOT NULL,
    "itemId" TEXT NOT NULL,
    "warehouseId" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "quantity" DECIMAL(12,3) NOT NULL,
    "threshold" DECIMAL(12,3) NOT NULL,
    "read" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "alerts_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "movements_code_key" ON "movements"("code");

-- CreateIndex
CREATE INDEX "movements_type_idx" ON "movements"("type");

-- CreateIndex
CREATE INDEX "movements_warehouseId_idx" ON "movements"("warehouseId");

-- CreateIndex
CREATE INDEX "movements_userId_idx" ON "movements"("userId");

-- CreateIndex
CREATE INDEX "movements_createdAt_idx" ON "movements"("createdAt");

-- CreateIndex
CREATE INDEX "movement_items_movementId_idx" ON "movement_items"("movementId");

-- CreateIndex
CREATE INDEX "movement_items_itemId_idx" ON "movement_items"("itemId");

-- CreateIndex
CREATE INDEX "alerts_itemId_idx" ON "alerts"("itemId");

-- CreateIndex
CREATE INDEX "alerts_warehouseId_idx" ON "alerts"("warehouseId");

-- CreateIndex
CREATE INDEX "alerts_read_idx" ON "alerts"("read");

-- CreateIndex
CREATE INDEX "alerts_createdAt_idx" ON "alerts"("createdAt");

-- AddForeignKey
ALTER TABLE "movements" ADD CONSTRAINT "movements_warehouseId_fkey" FOREIGN KEY ("warehouseId") REFERENCES "warehouses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "movements" ADD CONSTRAINT "movements_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "movement_items" ADD CONSTRAINT "movement_items_movementId_fkey" FOREIGN KEY ("movementId") REFERENCES "movements"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "movement_items" ADD CONSTRAINT "movement_items_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "items"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "alerts" ADD CONSTRAINT "alerts_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "items"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "alerts" ADD CONSTRAINT "alerts_warehouseId_fkey" FOREIGN KEY ("warehouseId") REFERENCES "warehouses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
