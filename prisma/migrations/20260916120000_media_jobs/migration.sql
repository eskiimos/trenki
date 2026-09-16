-- Очередь серверной обработки видео (перекодирование вместо Kinescope).
-- Аддитивная: новые enum и таблица, старый код их не видит.

-- CreateEnum
CREATE TYPE "MediaJobStatus" AS ENUM ('QUEUED', 'PROCESSING', 'DONE', 'FAILED', 'CANCELED');

-- CreateEnum
CREATE TYPE "MediaJobTarget" AS ENUM ('VIDEO', 'SHORT');

-- CreateTable
CREATE TABLE "media_jobs" (
    "id" TEXT NOT NULL,
    "targetType" "MediaJobTarget" NOT NULL,
    "targetId" TEXT NOT NULL,
    "sourceUrl" TEXT NOT NULL,
    "status" "MediaJobStatus" NOT NULL DEFAULT 'QUEUED',
    "publishOnReady" BOOLEAN NOT NULL DEFAULT false,
    "stage" TEXT,
    "progress" INTEGER NOT NULL DEFAULT 0,
    "resultUrl" TEXT,
    "error" TEXT,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "retryAt" TIMESTAMP(3),
    "interruptions" INTEGER NOT NULL DEFAULT 0,
    "heartbeatAt" TIMESTAMP(3),
    "startedAt" TIMESTAMP(3),
    "finishedAt" TIMESTAMP(3),
    "previousUrl" TEXT,
    "previousDeletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "media_jobs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "media_jobs_targetType_targetId_idx" ON "media_jobs"("targetType", "targetId");

-- CreateIndex
CREATE INDEX "media_jobs_status_createdAt_idx" ON "media_jobs"("status", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "media_jobs_sourceUrl_key" ON "media_jobs"("sourceUrl");

