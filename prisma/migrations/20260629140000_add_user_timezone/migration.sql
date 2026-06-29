-- Таймзона устройства пользователя (IANA, напр. "Europe/Moscow") для напоминаний
-- в локальное время. Заполняется клиентом (Intl) после входа.
ALTER TABLE "users" ADD COLUMN "timezone" TEXT;
