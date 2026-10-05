CREATE TABLE "pose_worker_state" (
  "id" TEXT NOT NULL,
  "heartbeatAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "pose_worker_state_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "pose_reference_jobs" (
  "id" TEXT NOT NULL,
  "videoId" TEXT NOT NULL,
  "sourceUrl" TEXT NOT NULL,
  "referenceUpdatedAt" TIMESTAMP(3),
  "status" "MediaJobStatus" NOT NULL DEFAULT 'QUEUED',
  "stage" TEXT,
  "progress" INTEGER NOT NULL DEFAULT 0,
  "attempts" INTEGER NOT NULL DEFAULT 0,
  "interruptions" INTEGER NOT NULL DEFAULT 0,
  "runToken" TEXT,
  "error" TEXT,
  "retryAt" TIMESTAMP(3),
  "heartbeatAt" TIMESTAMP(3),
  "startedAt" TIMESTAMP(3),
  "finishedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "pose_reference_jobs_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "pose_reference_jobs_videoId_fkey" FOREIGN KEY ("videoId") REFERENCES "videos"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "pose_reference_jobs_videoId_key" ON "pose_reference_jobs"("videoId");
CREATE INDEX "pose_reference_jobs_status_createdAt_idx" ON "pose_reference_jobs"("status", "createdAt");
