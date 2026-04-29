-- AlterTable
ALTER TABLE "tool_loans" ADD COLUMN     "returnOverrideReason" TEXT;

-- AlterTable
ALTER TABLE "transfers" ADD COLUMN     "cancelOverrideReason" TEXT,
ADD COLUMN     "receiveOverrideReason" TEXT,
ADD COLUMN     "rejectOverrideReason" TEXT;
