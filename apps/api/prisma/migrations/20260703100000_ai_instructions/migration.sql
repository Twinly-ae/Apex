-- Custom AI instructions, injected into every AI feature's system prompt
ALTER TABLE "Settings" ADD COLUMN "aiInstructions" TEXT;
