-- CreateEnum
CREATE TYPE "EquipmentType" AS ENUM ('MAQUINARIA_PESADA', 'VEHICULO', 'EQUIPO_MENOR', 'HERRAMIENTA_ELECTRICA', 'OTRO');

-- CreateEnum
CREATE TYPE "CountType" AS ENUM ('HOROMETRO', 'KILOMETRAJE', 'NONE');

-- CreateEnum
CREATE TYPE "EquipmentStatus" AS ENUM ('OPERATIVO', 'EN_MANTENIMIENTO', 'AVERIADO', 'BAJA');

-- CreateEnum
CREATE TYPE "MaintenanceType" AS ENUM ('PREVENTIVO', 'CORRECTIVO');

-- CreateEnum
CREATE TYPE "MaintenanceStatus" AS ENUM ('PROGRAMADO', 'EN_CURSO', 'COMPLETADO', 'CANCELADO');

-- CreateTable
CREATE TABLE "equipment" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" "EquipmentType" NOT NULL DEFAULT 'OTRO',
    "brand" TEXT,
    "model" TEXT,
    "serialNumber" TEXT,
    "year" INTEGER,
    "countType" "CountType" NOT NULL DEFAULT 'HOROMETRO',
    "currentCount" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "initialCount" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "initialCountDate" TIMESTAMP(3),
    "acquisitionDate" TIMESTAMP(3),
    "acquisitionCost" DECIMAL(14,2),
    "status" "EquipmentStatus" NOT NULL DEFAULT 'OPERATIVO',
    "obraId" TEXT,
    "notes" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "equipment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "equipment_sequence" (
    "id" INTEGER NOT NULL DEFAULT 1,
    "lastValue" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "equipment_sequence_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "equipment_count_readings" (
    "id" TEXT NOT NULL,
    "equipmentId" TEXT NOT NULL,
    "countValue" DECIMAL(12,2) NOT NULL,
    "source" TEXT NOT NULL,
    "sourceId" TEXT,
    "notes" TEXT,
    "recordedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "recordedById" TEXT,

    CONSTRAINT "equipment_count_readings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "fuel_dispatches" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "equipmentId" TEXT NOT NULL,
    "itemId" TEXT NOT NULL,
    "warehouseId" TEXT NOT NULL,
    "quantity" DECIMAL(12,3) NOT NULL,
    "countReading" DECIMAL(12,2) NOT NULL,
    "operatorWorkerId" TEXT,
    "dispatchedById" TEXT NOT NULL,
    "movementId" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "fuel_dispatches_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "fuel_dispatch_sequence" (
    "id" INTEGER NOT NULL DEFAULT 1,
    "lastValue" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "fuel_dispatch_sequence_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "maintenances" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "equipmentId" TEXT NOT NULL,
    "type" "MaintenanceType" NOT NULL,
    "description" TEXT NOT NULL,
    "status" "MaintenanceStatus" NOT NULL DEFAULT 'PROGRAMADO',
    "scheduledDate" TIMESTAMP(3),
    "scheduledCount" DECIMAL(12,2),
    "startedAt" TIMESTAMP(3),
    "countAtStart" DECIMAL(12,2),
    "completedAt" TIMESTAMP(3),
    "countAtEnd" DECIMAL(12,2),
    "cancelledAt" TIMESTAMP(3),
    "cancelReason" TEXT,
    "totalCost" DECIMAL(14,2),
    "technicianId" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "maintenances_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "maintenance_items" (
    "id" TEXT NOT NULL,
    "maintenanceId" TEXT NOT NULL,
    "itemId" TEXT NOT NULL,
    "warehouseId" TEXT NOT NULL,
    "quantity" DECIMAL(12,3) NOT NULL,
    "movementId" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "maintenance_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "maintenance_sequence" (
    "id" INTEGER NOT NULL DEFAULT 1,
    "lastValue" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "maintenance_sequence_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "equipment_code_key" ON "equipment"("code");

-- CreateIndex
CREATE INDEX "equipment_type_idx" ON "equipment"("type");

-- CreateIndex
CREATE INDEX "equipment_status_idx" ON "equipment"("status");

-- CreateIndex
CREATE INDEX "equipment_obraId_idx" ON "equipment"("obraId");

-- CreateIndex
CREATE INDEX "equipment_deletedAt_idx" ON "equipment"("deletedAt");

-- CreateIndex
CREATE INDEX "equipment_count_readings_equipmentId_recordedAt_idx" ON "equipment_count_readings"("equipmentId", "recordedAt");

-- CreateIndex
CREATE UNIQUE INDEX "fuel_dispatches_code_key" ON "fuel_dispatches"("code");

-- CreateIndex
CREATE UNIQUE INDEX "fuel_dispatches_movementId_key" ON "fuel_dispatches"("movementId");

-- CreateIndex
CREATE INDEX "fuel_dispatches_equipmentId_idx" ON "fuel_dispatches"("equipmentId");

-- CreateIndex
CREATE INDEX "fuel_dispatches_itemId_idx" ON "fuel_dispatches"("itemId");

-- CreateIndex
CREATE INDEX "fuel_dispatches_warehouseId_idx" ON "fuel_dispatches"("warehouseId");

-- CreateIndex
CREATE INDEX "fuel_dispatches_createdAt_idx" ON "fuel_dispatches"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "maintenances_code_key" ON "maintenances"("code");

-- CreateIndex
CREATE INDEX "maintenances_equipmentId_idx" ON "maintenances"("equipmentId");

-- CreateIndex
CREATE INDEX "maintenances_status_idx" ON "maintenances"("status");

-- CreateIndex
CREATE INDEX "maintenances_type_idx" ON "maintenances"("type");

-- CreateIndex
CREATE INDEX "maintenances_scheduledDate_idx" ON "maintenances"("scheduledDate");

-- CreateIndex
CREATE UNIQUE INDEX "maintenance_items_movementId_key" ON "maintenance_items"("movementId");

-- CreateIndex
CREATE INDEX "maintenance_items_maintenanceId_idx" ON "maintenance_items"("maintenanceId");

-- CreateIndex
CREATE INDEX "maintenance_items_itemId_idx" ON "maintenance_items"("itemId");

-- AddForeignKey
ALTER TABLE "equipment" ADD CONSTRAINT "equipment_obraId_fkey" FOREIGN KEY ("obraId") REFERENCES "obras"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "equipment_count_readings" ADD CONSTRAINT "equipment_count_readings_equipmentId_fkey" FOREIGN KEY ("equipmentId") REFERENCES "equipment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fuel_dispatches" ADD CONSTRAINT "fuel_dispatches_equipmentId_fkey" FOREIGN KEY ("equipmentId") REFERENCES "equipment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fuel_dispatches" ADD CONSTRAINT "fuel_dispatches_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "items"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fuel_dispatches" ADD CONSTRAINT "fuel_dispatches_warehouseId_fkey" FOREIGN KEY ("warehouseId") REFERENCES "warehouses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fuel_dispatches" ADD CONSTRAINT "fuel_dispatches_operatorWorkerId_fkey" FOREIGN KEY ("operatorWorkerId") REFERENCES "workers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fuel_dispatches" ADD CONSTRAINT "fuel_dispatches_dispatchedById_fkey" FOREIGN KEY ("dispatchedById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fuel_dispatches" ADD CONSTRAINT "fuel_dispatches_movementId_fkey" FOREIGN KEY ("movementId") REFERENCES "movements"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "maintenances" ADD CONSTRAINT "maintenances_equipmentId_fkey" FOREIGN KEY ("equipmentId") REFERENCES "equipment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "maintenances" ADD CONSTRAINT "maintenances_technicianId_fkey" FOREIGN KEY ("technicianId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "maintenance_items" ADD CONSTRAINT "maintenance_items_maintenanceId_fkey" FOREIGN KEY ("maintenanceId") REFERENCES "maintenances"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "maintenance_items" ADD CONSTRAINT "maintenance_items_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "items"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "maintenance_items" ADD CONSTRAINT "maintenance_items_warehouseId_fkey" FOREIGN KEY ("warehouseId") REFERENCES "warehouses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "maintenance_items" ADD CONSTRAINT "maintenance_items_movementId_fkey" FOREIGN KEY ("movementId") REFERENCES "movements"("id") ON DELETE SET NULL ON UPDATE CASCADE;
