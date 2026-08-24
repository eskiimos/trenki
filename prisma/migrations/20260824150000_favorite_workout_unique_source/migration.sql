-- Дабл-тап по звёздочке избранного: два POST могли пройти проверку findFirst
-- до create друг друга и создать дубль (userId, sourceSessionId). Сначала
-- дедуп существующих (оставляем самую раннюю запись), затем уникальный индекс.
-- NULL-значения sourceSessionId (legacy) уникальность не нарушают.
DELETE FROM "favorite_workouts" fw
USING "favorite_workouts" d
WHERE fw."userId" = d."userId"
  AND fw."sourceSessionId" = d."sourceSessionId"
  AND fw."sourceSessionId" IS NOT NULL
  AND (fw."createdAt" > d."createdAt"
       OR (fw."createdAt" = d."createdAt" AND fw."id" > d."id"));

CREATE UNIQUE INDEX "favorite_workouts_userId_sourceSessionId_key"
  ON "favorite_workouts"("userId", "sourceSessionId");
