-- Attachments polimórficos: Movement (compras) + Transfer (guías de remisión).

-- 1) Enum nuevo
CREATE TYPE "AttachmentOwnerType" AS ENUM ('MOVEMENT', 'TRANSFER');

-- 2) Tabla principal
CREATE TABLE "attachments" (
    "id" TEXT NOT NULL,
    "filename" TEXT NOT NULL,
    "originalName" TEXT NOT NULL,
    "mimetype" TEXT NOT NULL,
    "size" INTEGER NOT NULL,
    "ownerType" "AttachmentOwnerType" NOT NULL,
    "ownerId" TEXT NOT NULL,
    "uploadedById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "attachments_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "attachments_ownerType_ownerId_idx" ON "attachments"("ownerType", "ownerId");
CREATE INDEX "attachments_uploadedById_idx" ON "attachments"("uploadedById");

ALTER TABLE "attachments"
  ADD CONSTRAINT "attachments_uploadedById_fkey"
  FOREIGN KEY ("uploadedById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- 3) Backfill: convertir Transfer.documentUrl → fila Attachment.
--    El uploader histórico se asume = requestedById de la transferencia (el admin que la creó).
INSERT INTO "attachments" (
  "id",
  "filename",
  "originalName",
  "mimetype",
  "size",
  "ownerType",
  "ownerId",
  "uploadedById",
  "createdAt"
)
SELECT
  -- cuid-like fallback; Prisma usa cuid normalmente pero aquí Postgres genera un random hex.
  'attbf' || substr(md5(random()::text), 1, 20),
  t."documentUrl",
  COALESCE(t."documentName", t."documentUrl"),
  -- inferir mimetype por extensión más común
  CASE
    WHEN lower(t."documentUrl") LIKE '%.pdf' THEN 'application/pdf'
    WHEN lower(t."documentUrl") LIKE '%.png' THEN 'image/png'
    WHEN lower(t."documentUrl") LIKE '%.jpg' OR lower(t."documentUrl") LIKE '%.jpeg' THEN 'image/jpeg'
    WHEN lower(t."documentUrl") LIKE '%.gif' THEN 'image/gif'
    WHEN lower(t."documentUrl") LIKE '%.webp' THEN 'image/webp'
    ELSE 'application/octet-stream'
  END,
  0, -- size desconocido en datos legacy
  'TRANSFER'::"AttachmentOwnerType",
  t."id",
  t."requestedById",
  t."createdAt"
FROM "transfers" t
WHERE t."documentUrl" IS NOT NULL;

-- 4) Drop columnas legacy del Transfer.
ALTER TABLE "transfers" DROP COLUMN "documentUrl";
ALTER TABLE "transfers" DROP COLUMN "documentName";
