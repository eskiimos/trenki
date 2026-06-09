-- Опция «авто-генерация микроциклов» в профиле атлета. По умолчанию TRUE —
-- юзеры, прошедшие онбординг до Sprint 5, продолжают получать новый цикл
-- автоматически. Отключить можно в /profile (тогл).

ALTER TABLE "profiles"
  ADD COLUMN "autoGenerateMicrocycle" BOOLEAN NOT NULL DEFAULT true;
