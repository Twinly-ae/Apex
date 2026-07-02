-- Recurring tasks: completing a task with repeat set spawns the next occurrence
ALTER TABLE "Task" ADD COLUMN "repeat" TEXT;
