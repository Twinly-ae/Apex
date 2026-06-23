-- Task colors, estimated duration, and ordered sub-steps.
ALTER TABLE "Task" ADD COLUMN "color" TEXT;
ALTER TABLE "Task" ADD COLUMN "estMinutes" INTEGER;

CREATE TABLE "TaskStep" (
    "id" TEXT NOT NULL,
    "taskId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "order" INTEGER NOT NULL DEFAULT 0,
    "done" BOOLEAN NOT NULL DEFAULT false,
    "doneAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "TaskStep_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "TaskStep_taskId_idx" ON "TaskStep"("taskId");
ALTER TABLE "TaskStep" ADD CONSTRAINT "TaskStep_taskId_fkey"
    FOREIGN KEY ("taskId") REFERENCES "Task"("id") ON DELETE CASCADE ON UPDATE CASCADE;
