-- CreateTable
CREATE TABLE "pose_sessions" (
  "id" TEXT NOT NULL,
  "athleteId" TEXT NOT NULL,
  "videoId" TEXT NOT NULL,
  "durationSec" INTEGER NOT NULL DEFAULT 0,
  "framesCount" INTEGER NOT NULL DEFAULT 0,
  "avgConfidence" DOUBLE PRECISION,
  "coachId" TEXT,
  "coachRating" INTEGER,
  "coachComment" TEXT,
  "reviewedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "pose_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "pose_sessions_athleteId_createdAt_idx" ON "pose_sessions"("athleteId", "createdAt");
CREATE INDEX "pose_sessions_videoId_idx" ON "pose_sessions"("videoId");

-- AddForeignKey
ALTER TABLE "pose_sessions"
  ADD CONSTRAINT "pose_sessions_athleteId_fkey"
  FOREIGN KEY ("athleteId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "pose_sessions"
  ADD CONSTRAINT "pose_sessions_coachId_fkey"
  FOREIGN KEY ("coachId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "pose_sessions"
  ADD CONSTRAINT "pose_sessions_videoId_fkey"
  FOREIGN KEY ("videoId") REFERENCES "videos"("id") ON DELETE CASCADE ON UPDATE CASCADE;
