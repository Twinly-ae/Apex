-- Attach the single Twinly Notion ledger to an explicit business. The unique
-- index permits many unlinked businesses but only one linked business per user.
ALTER TABLE "Business" ADD COLUMN "notionExpenseSource" TEXT;
CREATE UNIQUE INDEX "Business_userId_notionExpenseSource_key"
  ON "Business"("userId", "notionExpenseSource");

-- Match only a business actually named Twinly. A reordered or differently
-- named business is never silently assigned historical Notion expenses.
WITH twinly AS (
  SELECT "id", ROW_NUMBER() OVER (
    PARTITION BY "userId" ORDER BY "createdAt", "id"
  ) AS position
  FROM "Business"
  WHERE lower(trim("name")) = 'twinly'
)
UPDATE "Business" AS b
SET "notionExpenseSource" = 'twinly'
FROM twinly
WHERE b."id" = twinly."id" AND twinly.position = 1;
