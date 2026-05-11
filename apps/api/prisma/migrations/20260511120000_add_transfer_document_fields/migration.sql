-- AlterTable: add guía de remisión fields to transfers
ALTER TABLE "transfers" ADD COLUMN "requiresRecipientDocument" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "transfers" ADD COLUMN "documentUrl" TEXT;
ALTER TABLE "transfers" ADD COLUMN "documentName" TEXT;
