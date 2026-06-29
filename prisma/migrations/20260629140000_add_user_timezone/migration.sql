-- Таймзона устройства пользователя (IANA, напр. "Europe/Moscow") для напоминаний
-- в локальное время. Заполняется клиентом (Intl) после входа.
ALTER TABLE "users" ADD COLUMN "timezone" TEXT;

-- Локальная дата (YYYY-MM-DD) последнего отправленного напоминания — дедуп,
-- чтобы почасовой крон не слал повторно в течение дня.
ALTER TABLE "users" ADD COLUMN "lastReminderOn" TEXT;
