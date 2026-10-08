ALTER TABLE "Goal" ADD COLUMN "horizon" TEXT NOT NULL DEFAULT 'other';

-- University courses and their weekly classes / one-off deadlines.
CREATE TABLE "Course" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Course_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "UniItem" (
    "id" TEXT NOT NULL,
    "courseId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "dueAt" TIMESTAMP(3),
    "weekday" INTEGER,
    "startTime" TEXT,
    "endTime" TEXT,
    "location" TEXT,
    "notes" TEXT,
    "done" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "UniItem_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "Course_userId_idx" ON "Course"("userId");
CREATE INDEX "UniItem_courseId_dueAt_idx" ON "UniItem"("courseId", "dueAt");

ALTER TABLE "Course" ADD CONSTRAINT "Course_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "UniItem" ADD CONSTRAINT "UniItem_courseId_fkey"
    FOREIGN KEY ("courseId") REFERENCES "Course"("id") ON DELETE CASCADE ON UPDATE CASCADE;
