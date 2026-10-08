ALTER TABLE "Task" ADD COLUMN "goalId" TEXT;

CREATE INDEX "Task_goalId_done_idx" ON "Task"("goalId", "done");

ALTER TABLE "Task" ADD CONSTRAINT "Task_goalId_fkey"
  FOREIGN KEY ("goalId") REFERENCES "Goal"("id") ON DELETE SET NULL ON UPDATE CASCADE;
