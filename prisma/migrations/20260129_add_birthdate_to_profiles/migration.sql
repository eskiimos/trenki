-- Добавляем дату рождения в profiles (если отсутствует)
BEGIN;

ALTER TABLE "profiles"
  ADD COLUMN IF NOT EXISTS "birthDate" TIMESTAMP(3);

COMMIT;
