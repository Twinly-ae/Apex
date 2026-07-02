-- Focus timer: accumulated actual minutes + running-timer start
ALTER TABLE "Task" ADD COLUMN "actualMinutes" INTEGER;
ALTER TABLE "Task" ADD COLUMN "timerStartedAt" TIMESTAMP(3);
