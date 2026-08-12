-- Опыт тренера: год начала карьеры (источник истины). Опыт = текущий_год −
-- careerStartYear и растёт +1 каждый 1 января БЕЗ крона (деривация на лету, как
-- age-utils.calculateAge из birthDate). Поле experience оставлено deprecated для
-- обратной совместимости (не удаляем — правило CLAUDE.md).
--
-- Бэкфилл существующих тренеров: careerStartYear = 2026 − experience. 2026 —
-- текущий год, зафиксирован ЛИТЕРАЛОМ (не NOW()), чтобы применение миграции в
-- другой год не сместило стаж.
ALTER TABLE "trainers" ADD COLUMN "careerStartYear" INTEGER;
UPDATE "trainers" SET "careerStartYear" = 2026 - "experience" WHERE "careerStartYear" IS NULL;
