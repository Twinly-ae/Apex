-- Multi-business support. Existing TwinlySale rows are migrated onto a default
-- "Twinly" business per user so no sales data is lost.

-- 1. Business table
CREATE TABLE "Business" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Business_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "Business_userId_idx" ON "Business"("userId");
ALTER TABLE "Business" ADD CONSTRAINT "Business_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- 2. Give every user a default "Twinly" business
INSERT INTO "Business" ("id", "userId", "name", "sortOrder", "createdAt", "updatedAt")
SELECT gen_random_uuid()::text, "id", 'Twinly', 0, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM "User";

-- 3. Link sales to a business: add nullable column, backfill, then enforce
ALTER TABLE "TwinlySale" ADD COLUMN "businessId" TEXT;
UPDATE "TwinlySale" s
SET "businessId" = b."id"
FROM "Business" b
WHERE b."userId" = s."userId" AND b."name" = 'Twinly';
ALTER TABLE "TwinlySale" ALTER COLUMN "businessId" SET NOT NULL;

-- 4. Swap the per-user unique for a per-business unique
DROP INDEX "TwinlySale_userId_day_key";
CREATE INDEX "TwinlySale_userId_idx" ON "TwinlySale"("userId");
CREATE UNIQUE INDEX "TwinlySale_businessId_day_key" ON "TwinlySale"("businessId", "day");

-- 5. Foreign key
ALTER TABLE "TwinlySale" ADD CONSTRAINT "TwinlySale_businessId_fkey"
    FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE CASCADE ON UPDATE CASCADE;
