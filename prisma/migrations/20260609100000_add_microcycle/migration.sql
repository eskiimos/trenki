-- Микроцикл: 5 тренировок (Пн-Пт) на одну неделю, сгенерированных AI под
-- характеристики атлета. Структура: Microcycle = "обёртка" + 5 MicrocycleDay,
-- каждая ссылается на свой WorkoutSession через nullable workoutSessionId
-- (если AI не нашёл подходящие модули — день остаётся пустым).

-- ============================================================
-- ENUMS
-- ============================================================

-- Намерение тренировки на день — задаёт ощущение от занятия и под него
-- подбираются параметры (RPE, длительность, тип нагрузки). Реальный mapping
-- intent → (TrainingGoal, EnergyState) — в src/lib/microcycle/intents.ts.
CREATE TYPE "MicrocycleIntent" AS ENUM (
  'IN_TONE',    -- ⚡️ в тонусе (понедельник)
  'WARMUP',     -- 🏃 разминка/зарядка (вторник)
  'CHARGED',    -- 🔋 заряжен (среда — пиковая нагрузка)
  'STRETCH',    -- 🧘 растяжка (четверг)
  'TIRED'       -- 😴 устал (пятница — лёгкая)
);

CREATE TYPE "MicrocycleStatus" AS ENUM (
  'ACTIVE',     -- цикл активен (week ещё не закончилась)
  'COMPLETED',  -- неделя закончилась, ждём фидбэка
  'ARCHIVED'    -- фидбэк дан, цикл закрыт
);

-- Заполняется атлетом после цикла (Sprint 3). Влияет на параметры
-- следующего цикла (Sprint 4).
CREATE TYPE "MicrocycleFeedback" AS ENUM (
  'EASY',       -- было легко → усложняем следующий
  'NORMAL',     -- нормально → повторяем
  'HARD'        -- тяжело → упрощаем
);

-- ============================================================
-- TABLES
-- ============================================================

CREATE TABLE "microcycles" (
  "id"                TEXT NOT NULL,
  "userId"            TEXT NOT NULL,
  "weekStartDate"     DATE NOT NULL,                                -- понедельник недели цикла
  "cycleNumber"       INTEGER NOT NULL,                             -- 1, 2, 3... у конкретного юзера
  "status"            "MicrocycleStatus" NOT NULL DEFAULT 'ACTIVE',
  "feedback"          "MicrocycleFeedback",                         -- заполняется в Sprint 3
  "adjustmentFactor"  DOUBLE PRECISION,                             -- коэф. адаптации применённый при генерации (Sprint 4)
  "createdAt"         TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"         TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "microcycles_pkey" PRIMARY KEY ("id")
);

-- Один цикл на (юзер, неделя) — повторная генерация заменит существующий.
CREATE UNIQUE INDEX "microcycles_userId_weekStartDate_key"
  ON "microcycles"("userId", "weekStartDate");

-- Для быстрой выборки последних циклов юзера.
CREATE INDEX "microcycles_userId_cycleNumber_idx"
  ON "microcycles"("userId", "cycleNumber" DESC);

ALTER TABLE "microcycles"
  ADD CONSTRAINT "microcycles_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "users"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;


CREATE TABLE "microcycle_days" (
  "id"                TEXT NOT NULL,
  "microcycleId"      TEXT NOT NULL,
  "dayOfWeek"         INTEGER NOT NULL,                  -- 1=Пн, 2=Вт, ..., 5=Пт
  "intent"            "MicrocycleIntent" NOT NULL,
  "workoutSessionId"  TEXT,                              -- nullable: если генерация для этого дня не нашла модулей
  "createdAt"         TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "microcycle_days_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "microcycle_days_dayOfWeek_check" CHECK ("dayOfWeek" BETWEEN 1 AND 5)
);

-- Один день недели — одна запись в цикле.
CREATE UNIQUE INDEX "microcycle_days_microcycleId_dayOfWeek_key"
  ON "microcycle_days"("microcycleId", "dayOfWeek");

-- Одна WorkoutSession может принадлежать только одному дню (если вообще).
CREATE UNIQUE INDEX "microcycle_days_workoutSessionId_key"
  ON "microcycle_days"("workoutSessionId")
  WHERE "workoutSessionId" IS NOT NULL;

ALTER TABLE "microcycle_days"
  ADD CONSTRAINT "microcycle_days_microcycleId_fkey"
  FOREIGN KEY ("microcycleId") REFERENCES "microcycles"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "microcycle_days"
  ADD CONSTRAINT "microcycle_days_workoutSessionId_fkey"
  FOREIGN KEY ("workoutSessionId") REFERENCES "workout_sessions"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
