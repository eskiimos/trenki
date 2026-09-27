-- Рабочие отрезки эталона (упражнение без объяснений): по ним будет считаться
-- оценка выполнения. Аддитивно: одна nullable-колонка.

-- AlterTable
ALTER TABLE "pose_references" ADD COLUMN     "segments" JSONB;

