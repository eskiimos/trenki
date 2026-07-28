-- Избранное на ЦЕЛУЮ тренировку от ИИ + параметры сборки у сессии.
-- goal/energyState на workout_sessions нужны для названия «цель · состояние»
-- (раньше нигде не сохранялись — были только во входных данных генерации).
-- Состав избранного — снапшот videoIds, чтобы правки каталога не меняли молча
-- сохранённое занятие. Аддитивно, бэкфилл не нужен.

ALTER TABLE "workout_sessions"
  ADD COLUMN "goal" "TrainingGoal",
  ADD COLUMN "energyState" "EnergyState";

CREATE TABLE "favorite_workouts" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "goal" "TrainingGoal",
    "energyState" "EnergyState",
    "videoIds" TEXT[],
    "sourceSessionId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "favorite_workouts_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "favorite_workouts_userId_createdAt_idx" ON "favorite_workouts"("userId", "createdAt");

ALTER TABLE "favorite_workouts" ADD CONSTRAINT "favorite_workouts_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
