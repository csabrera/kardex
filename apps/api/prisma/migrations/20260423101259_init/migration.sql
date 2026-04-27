/*
  Warnings:

  - The values [DEPOSITO] on the enum `WarehouseType` will be removed. If these variants are still used in the database, this will fail.
  - You are about to drop the column `borrowerId` on the `tool_loans` table. All the data in the column will be lost.
  - Added the required column `borrowerWorkerId` to the `tool_loans` table without a default value. This is not possible if the table is not empty.
  - Added the required column `workStationId` to the `tool_loans` table without a default value. This is not possible if the table is not empty.

*/
-- CreateEnum
CREATE TYPE "ObraStatus" AS ENUM ('PLANIFICACION', 'ACTIVA', 'SUSPENDIDA', 'FINALIZADA');

-- AlterEnum
BEGIN;
CREATE TYPE "WarehouseType_new" AS ENUM ('CENTRAL', 'OBRA');
ALTER TABLE "warehouses" ALTER COLUMN "type" DROP DEFAULT;
ALTER TABLE "warehouses" ALTER COLUMN "type" TYPE "WarehouseType_new" USING ("type"::text::"WarehouseType_new");
ALTER TYPE "WarehouseType" RENAME TO "WarehouseType_old";
ALTER TYPE "WarehouseType_new" RENAME TO "WarehouseType";
DROP TYPE "WarehouseType_old";
ALTER TABLE "warehouses" ALTER COLUMN "type" SET DEFAULT 'CENTRAL';
COMMIT;

-- DropForeignKey
ALTER TABLE "tool_loans" DROP CONSTRAINT "tool_loans_borrowerId_fkey";

-- DropIndex
DROP INDEX "tool_loans_borrowerId_idx";

-- AlterTable
ALTER TABLE "tool_loans" DROP COLUMN "borrowerId",
ADD COLUMN     "borrowerWorkerId" TEXT NOT NULL,
ADD COLUMN     "workStationId" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "warehouses" ADD COLUMN     "obraId" TEXT;

-- CreateTable
CREATE TABLE "obras" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "address" TEXT,
    "client" TEXT,
    "description" TEXT,
    "startDate" TIMESTAMP(3),
    "endDate" TIMESTAMP(3),
    "status" "ObraStatus" NOT NULL DEFAULT 'PLANIFICACION',
    "responsibleUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "obras_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "specialties" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "specialties_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "workers" (
    "id" TEXT NOT NULL,
    "documentType" "DocumentType" NOT NULL,
    "documentNumber" TEXT NOT NULL,
    "firstName" TEXT NOT NULL,
    "lastName" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "address" TEXT,
    "birthDate" TIMESTAMP(3),
    "hireDate" TIMESTAMP(3),
    "notes" TEXT,
    "specialtyId" TEXT NOT NULL,
    "obraId" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "workers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "work_stations" (
    "id" TEXT NOT NULL,
    "obraId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "work_stations_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "obras_code_key" ON "obras"("code");

-- CreateIndex
CREATE INDEX "obras_status_idx" ON "obras"("status");

-- CreateIndex
CREATE INDEX "obras_responsibleUserId_idx" ON "obras"("responsibleUserId");

-- CreateIndex
CREATE INDEX "obras_deletedAt_idx" ON "obras"("deletedAt");

-- CreateIndex
CREATE UNIQUE INDEX "specialties_code_key" ON "specialties"("code");

-- CreateIndex
CREATE INDEX "specialties_deletedAt_idx" ON "specialties"("deletedAt");

-- CreateIndex
CREATE INDEX "workers_specialtyId_idx" ON "workers"("specialtyId");

-- CreateIndex
CREATE INDEX "workers_obraId_idx" ON "workers"("obraId");

-- CreateIndex
CREATE INDEX "workers_active_idx" ON "workers"("active");

-- CreateIndex
CREATE INDEX "workers_deletedAt_idx" ON "workers"("deletedAt");

-- CreateIndex
CREATE UNIQUE INDEX "workers_documentType_documentNumber_deletedAt_key" ON "workers"("documentType", "documentNumber", "deletedAt");

-- CreateIndex
CREATE INDEX "work_stations_obraId_idx" ON "work_stations"("obraId");

-- CreateIndex
CREATE INDEX "work_stations_deletedAt_idx" ON "work_stations"("deletedAt");

-- CreateIndex
CREATE UNIQUE INDEX "work_stations_obraId_name_deletedAt_key" ON "work_stations"("obraId", "name", "deletedAt");

-- CreateIndex
CREATE INDEX "tool_loans_workStationId_idx" ON "tool_loans"("workStationId");

-- CreateIndex
CREATE INDEX "tool_loans_borrowerWorkerId_idx" ON "tool_loans"("borrowerWorkerId");

-- CreateIndex
CREATE INDEX "warehouses_obraId_idx" ON "warehouses"("obraId");

-- AddForeignKey
ALTER TABLE "warehouses" ADD CONSTRAINT "warehouses_obraId_fkey" FOREIGN KEY ("obraId") REFERENCES "obras"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tool_loans" ADD CONSTRAINT "tool_loans_workStationId_fkey" FOREIGN KEY ("workStationId") REFERENCES "work_stations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tool_loans" ADD CONSTRAINT "tool_loans_borrowerWorkerId_fkey" FOREIGN KEY ("borrowerWorkerId") REFERENCES "workers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "obras" ADD CONSTRAINT "obras_responsibleUserId_fkey" FOREIGN KEY ("responsibleUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "workers" ADD CONSTRAINT "workers_specialtyId_fkey" FOREIGN KEY ("specialtyId") REFERENCES "specialties"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "workers" ADD CONSTRAINT "workers_obraId_fkey" FOREIGN KEY ("obraId") REFERENCES "obras"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "work_stations" ADD CONSTRAINT "work_stations_obraId_fkey" FOREIGN KEY ("obraId") REFERENCES "obras"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
