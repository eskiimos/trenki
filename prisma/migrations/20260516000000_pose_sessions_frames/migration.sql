-- Сохранение записанного скелета для воспроизведения тренеру
ALTER TABLE "pose_sessions"
  ADD COLUMN "fps" INTEGER,
  ADD COLUMN "frames" JSONB;
