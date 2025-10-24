/*
  Warnings:

  - You are about to drop the `workout_session_modules` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "public"."workout_session_modules" DROP CONSTRAINT "workout_session_modules_moduleId_fkey";

-- DropForeignKey
ALTER TABLE "public"."workout_session_modules" DROP CONSTRAINT "workout_session_modules_sessionId_fkey";

-- AlterTable
ALTER TABLE "public"."workout_sessions" ADD COLUMN     "currentVideoIndex" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "startedAt" TIMESTAMP(3),
ADD COLUMN     "totalVideos" INTEGER NOT NULL DEFAULT 0;

-- DropTable
DROP TABLE "public"."workout_session_modules";

-- CreateTable
CREATE TABLE "public"."workout_session_videos" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "videoId" TEXT NOT NULL,
    "order" INTEGER NOT NULL,
    "completed" BOOLEAN NOT NULL DEFAULT false,
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "watchedDuration" INTEGER,
    "actualRPE" INTEGER,

    CONSTRAINT "workout_session_videos_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "workout_session_videos_sessionId_videoId_key" ON "public"."workout_session_videos"("sessionId", "videoId");

-- CreateIndex
CREATE INDEX "workout_sessions_userId_status_idx" ON "public"."workout_sessions"("userId", "status");

-- AddForeignKey
ALTER TABLE "public"."workout_session_videos" ADD CONSTRAINT "workout_session_videos_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "public"."workout_sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."workout_session_videos" ADD CONSTRAINT "workout_session_videos_videoId_fkey" FOREIGN KEY ("videoId") REFERENCES "public"."videos"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
