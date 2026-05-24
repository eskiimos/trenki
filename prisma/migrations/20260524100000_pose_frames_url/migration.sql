-- Перенос pose-кадров из Postgres JSONB в Cloudinary.
-- Колонка frames оставлена для бэкомпата и плавного бэкфилла.
ALTER TABLE "pose_sessions"
  ADD COLUMN "framesUrl" TEXT,
  ADD COLUMN "framesEncoding" TEXT;
