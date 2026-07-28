-- СФП-разметка видео: галочка «СФП» + виды спорта, которым подходит тренировка.
-- Аддитивно: у существующих видео isSfp=false и пустой массив sports, бэкфилл не нужен.

CREATE TYPE "Sport" AS ENUM ('HOCKEY', 'FOOTBALL', 'BASKETBALL', 'BOXING');

ALTER TABLE "videos"
  ADD COLUMN "isSfp" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "sports" "Sport"[] DEFAULT ARRAY[]::"Sport"[];
