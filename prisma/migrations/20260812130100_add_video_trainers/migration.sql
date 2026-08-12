-- Соавторы видео (мульти-тренер-коллаб). Ведущий автор остаётся в
-- videos.trainerId (primary — держит все существующие фильтры/чтения); эта
-- таблица хранит полный набор авторов, включая ведущего (order=0).
CREATE TABLE "video_trainers" (
    "id" TEXT NOT NULL,
    "videoId" TEXT NOT NULL,
    "trainerId" TEXT NOT NULL,
    "order" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "video_trainers_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "video_trainers_videoId_trainerId_key" ON "video_trainers"("videoId", "trainerId");

ALTER TABLE "video_trainers" ADD CONSTRAINT "video_trainers_videoId_fkey" FOREIGN KEY ("videoId") REFERENCES "videos"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "video_trainers" ADD CONSTRAINT "video_trainers_trainerId_fkey" FOREIGN KEY ("trainerId") REFERENCES "trainers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Бэкфилл: одна строка (ведущий, order=0) на каждое существующее видео из его
-- текущего trainerId. Идемпотентно (ON CONFLICT) — повторный прогон безопасен.
INSERT INTO "video_trainers" ("id", "videoId", "trainerId", "order", "createdAt")
SELECT 'vt_' || gen_random_uuid()::text, "id", "trainerId", 0, CURRENT_TIMESTAMP
FROM "videos"
ON CONFLICT ("videoId", "trainerId") DO NOTHING;
