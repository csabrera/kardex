-- CreateEnum
CREATE TYPE "ToolLoanStatus" AS ENUM ('ACTIVE', 'RETURNED', 'LOST');

-- CreateEnum
CREATE TYPE "ToolLoanCondition" AS ENUM ('BUENO', 'REGULAR', 'DAMAGED');

-- CreateTable
CREATE TABLE "tool_loans" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "itemId" TEXT NOT NULL,
    "warehouseId" TEXT NOT NULL,
    "quantity" DECIMAL(12,3) NOT NULL,
    "borrowerId" TEXT NOT NULL,
    "borrowerNotes" TEXT,
    "loanedById" TEXT NOT NULL,
    "loanedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expectedReturnAt" TIMESTAMP(3) NOT NULL,
    "returnedAt" TIMESTAMP(3),
    "returnedById" TEXT,
    "returnCondition" "ToolLoanCondition",
    "returnNotes" TEXT,
    "status" "ToolLoanStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tool_loans_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tool_loan_sequence" (
    "id" INTEGER NOT NULL DEFAULT 1,
    "lastValue" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "tool_loan_sequence_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "tool_loans_code_key" ON "tool_loans"("code");

-- CreateIndex
CREATE INDEX "tool_loans_itemId_idx" ON "tool_loans"("itemId");

-- CreateIndex
CREATE INDEX "tool_loans_warehouseId_idx" ON "tool_loans"("warehouseId");

-- CreateIndex
CREATE INDEX "tool_loans_borrowerId_idx" ON "tool_loans"("borrowerId");

-- CreateIndex
CREATE INDEX "tool_loans_status_idx" ON "tool_loans"("status");

-- CreateIndex
CREATE INDEX "tool_loans_expectedReturnAt_idx" ON "tool_loans"("expectedReturnAt");

-- AddForeignKey
ALTER TABLE "tool_loans" ADD CONSTRAINT "tool_loans_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "items"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tool_loans" ADD CONSTRAINT "tool_loans_warehouseId_fkey" FOREIGN KEY ("warehouseId") REFERENCES "warehouses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tool_loans" ADD CONSTRAINT "tool_loans_borrowerId_fkey" FOREIGN KEY ("borrowerId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tool_loans" ADD CONSTRAINT "tool_loans_loanedById_fkey" FOREIGN KEY ("loanedById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tool_loans" ADD CONSTRAINT "tool_loans_returnedById_fkey" FOREIGN KEY ("returnedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
