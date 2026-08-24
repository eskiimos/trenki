-- Спринт C («Конец августа»).

-- 1. Пропуск модуля в ИИ-тренировке: skipped НЕ равен completed — пропущенный
--    модуль не даёт XP/прироста, но не блокирует завершение сессии (PARTIAL).
ALTER TABLE "workout_session_videos"
  ADD COLUMN "skipped" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "skippedAt" TIMESTAMP(3);

-- 2. Ежедневный чекин: факт тапа с локальной (по таймзоне юзера) датой.
--    XP не хранится — выводится из даты (checkinXp). Unique = лимит 1/день.
CREATE TABLE "daily_checkins" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "date" DATE NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "daily_checkins_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "daily_checkins_userId_fkey" FOREIGN KEY ("userId")
    REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "daily_checkins_userId_date_key"
  ON "daily_checkins"("userId", "date");
