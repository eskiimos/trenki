-- Настройки приложения (key-value), редактируемые из админки.
-- Сейчас хранят ВРЕМЯ уведомлений (см. src/lib/settings.ts):
--   reminder.dailyTime          — "HH:MM" ежедневного напоминания (локальное время юзера)
--   reminder.preworkoutEarlyMin — за сколько минут раннее предтрен. напоминание
--   reminder.preworkoutLateMin  — за сколько минут позднее предтрен. напоминание
CREATE TABLE "app_settings" (
  "key" TEXT NOT NULL,
  "value" TEXT NOT NULL,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "app_settings_pkey" PRIMARY KEY ("key")
);

-- Дефолты = ровно то, что было зашито в коде (поведение не меняется до правок в админке).
INSERT INTO "app_settings" ("key", "value", "updatedAt") VALUES
  ('reminder.dailyTime',          '10:00', CURRENT_TIMESTAMP),
  ('reminder.preworkoutEarlyMin', '30',    CURRENT_TIMESTAMP),
  ('reminder.preworkoutLateMin',  '10',    CURRENT_TIMESTAMP);
