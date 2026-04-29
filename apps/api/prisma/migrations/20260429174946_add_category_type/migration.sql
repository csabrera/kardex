-- AlterTable
ALTER TABLE "categories" ADD COLUMN     "type" "ItemType";

-- CreateIndex
CREATE INDEX "categories_type_idx" ON "categories"("type");
