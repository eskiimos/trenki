-- Полноценное 4-модульное назначение от тренера:
--   * training_assignments.videoId становится опциональным (когда задание это
--     полноценная сессия, оно ссылается на workout_sessions, а не на одно видео)
--   * training_assignments.workoutSessionId — связь с готовой 4-модульной
--     сессией (warmup + fitness + technique + cooldown в WorkoutSessionVideo[])
--   * workout_sessions.coachId — кто создал сессию (NULL для самосгенерированных)

-- 1. videoId — теперь nullable
ALTER TABLE "training_assignments" ALTER COLUMN "videoId" DROP NOT NULL;

-- 2. workoutSessionId — опциональная связь с полноценной сессией
ALTER TABLE "training_assignments" ADD COLUMN "workoutSessionId" TEXT;

ALTER TABLE "training_assignments"
  ADD CONSTRAINT "training_assignments_workoutSessionId_fkey"
  FOREIGN KEY ("workoutSessionId") REFERENCES "workout_sessions"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

CREATE UNIQUE INDEX "training_assignments_workoutSessionId_key"
  ON "training_assignments"("workoutSessionId");

-- 3. coachId на WorkoutSession (опционально)
ALTER TABLE "workout_sessions" ADD COLUMN "coachId" TEXT;

ALTER TABLE "workout_sessions"
  ADD CONSTRAINT "workout_sessions_coachId_fkey"
  FOREIGN KEY ("coachId") REFERENCES "users"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "workout_sessions_coachId_idx" ON "workout_sessions"("coachId");
