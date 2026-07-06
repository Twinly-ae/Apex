-- Activity status: sick / injured / on-a-break pauses training pressure
ALTER TABLE "Settings" ADD COLUMN "activityStatus" TEXT NOT NULL DEFAULT 'active';
ALTER TABLE "Settings" ADD COLUMN "statusUntil" TIMESTAMP(3);
