-- C-4 «засчитать быструю в цикл», перенос закрытия дня на факт выполнения.
-- Быстрая тренировка-замена несёт id циклового дня-донора; сервер закрывает
-- его при ЗАВЕРШЕНИИ быстрой (/api/training/complete), а не при создании.
-- SetNull: пересборка цикла удаляет его сессии — ссылка не должна мешать.
ALTER TABLE "workout_sessions" ADD COLUMN "closesCycleSessionId" TEXT;

ALTER TABLE "workout_sessions"
  ADD CONSTRAINT "workout_sessions_closesCycleSessionId_fkey"
  FOREIGN KEY ("closesCycleSessionId") REFERENCES "workout_sessions"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "workout_sessions_closesCycleSessionId_idx"
  ON "workout_sessions"("closesCycleSessionId");
