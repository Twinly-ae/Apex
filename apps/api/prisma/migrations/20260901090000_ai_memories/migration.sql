-- Long-term AI memory: short facts the agent saves from chat or the user adds
CREATE TABLE "AiMemory" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "source" TEXT NOT NULL DEFAULT 'user',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AiMemory_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "AiMemory_userId_createdAt_idx" ON "AiMemory"("userId", "createdAt");
ALTER TABLE "AiMemory" ADD CONSTRAINT "AiMemory_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
