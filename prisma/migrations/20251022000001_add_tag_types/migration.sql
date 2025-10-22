-- Создаем новые enum типы
CREATE TYPE "MuscleGroup" AS ENUM (
  'LOWER_BODY',
  'UPPER_PULL',
  'UPPER_PUSH',
  'CORE_STABILITY',
  'CORE_DYNAMICS',
  'PREHAB_SHOULDER',
  'PREHAB_KNEE',
  'PREHAB_BACK',
  'FULL_BODY'
);

CREATE TYPE "Complexity" AS ENUM (
  'BEGINNER',
  'AMATEUR',
  'ADVANCED',
  'PRO'
);

CREATE TYPE "TrainingGoal" AS ENUM (
  'RECOVERY',
  'DEVELOPMENT',
  'PEAK'
);

CREATE TYPE "TagType" AS ENUM (
  'LOAD',
  'MUSCLE',
  'COMPLEXITY',
  'GOAL'
);

-- Добавляем новые поля в таблицу tags
ALTER TABLE "tags" ADD COLUMN "tagType" "TagType" NOT NULL DEFAULT 'LOAD';
ALTER TABLE "tags" ALTER COLUMN "loadType" DROP NOT NULL;
ALTER TABLE "tags" ADD COLUMN "muscleGroup" "MuscleGroup";
ALTER TABLE "tags" ADD COLUMN "complexity" "Complexity";
ALTER TABLE "tags" ADD COLUMN "trainingGoal" "TrainingGoal";
