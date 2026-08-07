-- Еженедельный email-дайджест родителю: дедуп-метка последней отправки.
-- Крон /api/cron/parent-digest шлёт не чаще раза в ~неделю (lastParentDigestAt < now-6d).
ALTER TABLE "users" ADD COLUMN "lastParentDigestAt" TIMESTAMP(3);
