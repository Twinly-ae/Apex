-- Chat threads: group AI messages into conversations
CREATE TABLE "AiConversation" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "title" TEXT NOT NULL DEFAULT 'New chat',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "AiConversation_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "AiConversation_userId_updatedAt_idx" ON "AiConversation"("userId", "updatedAt");
ALTER TABLE "AiConversation" ADD CONSTRAINT "AiConversation_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "AiMessage" ADD COLUMN "conversationId" TEXT;
CREATE INDEX "AiMessage_conversationId_createdAt_idx" ON "AiMessage"("conversationId", "createdAt");
ALTER TABLE "AiMessage" ADD CONSTRAINT "AiMessage_conversationId_fkey"
    FOREIGN KEY ("conversationId") REFERENCES "AiConversation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Fold each user's existing messages into one legacy thread
INSERT INTO "AiConversation" ("id", "userId", "title", "createdAt", "updatedAt")
SELECT gen_random_uuid()::text, "userId", 'Chat', MIN("createdAt"), CURRENT_TIMESTAMP
FROM "AiMessage"
GROUP BY "userId";

UPDATE "AiMessage" m
SET "conversationId" = c."id"
FROM "AiConversation" c
WHERE c."userId" = m."userId" AND m."conversationId" IS NULL;
