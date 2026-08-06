-- Закреплённый тренёк: показывается первым в ленте /shorts.
-- Аддитивно, дефолт false — существующие шортсы поведение не меняют.

ALTER TABLE "shorts" ADD COLUMN "isPinned" BOOLEAN NOT NULL DEFAULT false;
