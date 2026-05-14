-- AlterEnum
ALTER TYPE "AlertType" ADD VALUE 'LOAN_VENCIDO';

-- AlterTable
ALTER TABLE "alerts" ADD COLUMN     "toolLoanId" TEXT,
ALTER COLUMN "quantity" DROP NOT NULL,
ALTER COLUMN "threshold" DROP NOT NULL;

-- CreateIndex
CREATE INDEX "alerts_toolLoanId_idx" ON "alerts"("toolLoanId");

-- AddForeignKey
ALTER TABLE "alerts" ADD CONSTRAINT "alerts_toolLoanId_fkey" FOREIGN KEY ("toolLoanId") REFERENCES "tool_loans"("id") ON DELETE SET NULL ON UPDATE CASCADE;
