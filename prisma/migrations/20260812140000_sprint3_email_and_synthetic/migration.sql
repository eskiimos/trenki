-- Sprint 3: email-кампании (согласие/отписка + дедуп триггерных писем) и метка
-- синтетических тренировок (админ-накрутка прогресса для тестеров).
-- Всё аддитивно, бэкфилл не нужен (безопасные DEFAULT).

ALTER TABLE "users" ADD COLUMN "emailOptOut" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "users" ADD COLUMN "welcomeEmailSentAt" TIMESTAMP(3);
ALTER TABLE "users" ADD COLUMN "firstWorkoutEmailSentAt" TIMESTAMP(3);
ALTER TABLE "users" ADD COLUMN "lastInactivityEmailAt" TIMESTAMP(3);

-- Синтетические (засеянные админом) тренировки — считаются в XP/уровень/стрик
-- тестера, но ИСКЛЮЧАЮТСЯ из лиги, чтобы не искажать рейтинг реальных сверстников.
ALTER TABLE "workout_sessions" ADD COLUMN "synthetic" BOOLEAN NOT NULL DEFAULT false;
