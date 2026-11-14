ALTER TABLE "workout_session_videos"
  ADD COLUMN "playbackId" TEXT,
  ADD COLUMN "positionSequence" INTEGER NOT NULL DEFAULT 0;
