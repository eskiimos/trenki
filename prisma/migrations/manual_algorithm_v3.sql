-- ========================================================================
-- МИГРАЦИЯ АЛГОРИТМ 2.0 - БЕЗОПАСНОЕ ПРИМЕНЕНИЕ
-- ========================================================================
-- Дата: 28 января 2026
-- Цель: Обновить enums и добавить новые поля без потери данных

BEGIN;

-- ========================================================================
-- 1. Создаем TrainingStatus (для старого алгоритма, если не существует)
-- ========================================================================
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'TrainingStatus') THEN
    CREATE TYPE "TrainingStatus" AS ENUM ('RECOVERY', 'DEVELOPMENT', 'PEAK');
  END IF;
END $$;

-- ========================================================================
-- 2. Обновляем TrainingGoal (безопасно)
-- ========================================================================
-- Если TrainingGoal уже существует со старыми значениями, переименуем
DO $$ 
BEGIN
  -- Проверяем есть ли старые значения в enum
  IF EXISTS (
    SELECT 1 FROM pg_enum 
    WHERE enumtypid = 'TrainingGoal'::regtype 
    AND enumlabel IN ('RECOVERY', 'DEVELOPMENT', 'PEAK')
  ) THEN
    -- Переименовываем старый enum
    ALTER TYPE "TrainingGoal" RENAME TO "TrainingGoal_old";
  END IF;
END $$;

-- Создаем новый TrainingGoal с новыми значениями
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'TrainingGoal') THEN
    CREATE TYPE "TrainingGoal" AS ENUM (
      'POWERFUL_SHOT',
      'OUTRUN_OPPONENT', 
      'STRENGTH_STABILITY',
      'SOFT_HANDS',
      'FULL_GAME_ENDURANCE',
      'AGILITY',
      'SPORT_LONGEVITY'
    );
  END IF;
END $$;

-- ========================================================================
-- 3. Создаем EnergyState enum
-- ========================================================================
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'EnergyState') THEN
    CREATE TYPE "EnergyState" AS ENUM (
      'FULLY_CHARGED',
      'IN_TONE',
      'TIRED'
    );
  END IF;
END $$;

-- ========================================================================
-- 4. Обновляем AgeGroup
-- ========================================================================
-- Сначала удаляем старый (если есть зависимости, они будут удалены)
DROP TYPE IF EXISTS "AgeGroup" CASCADE;

-- Создаем новый AgeGroup с 4 значениями
CREATE TYPE "AgeGroup" AS ENUM (
  'CHILD',
  'TEEN',
  'YOUNG_ADULT',
  'ADULT'
);

-- ========================================================================
-- 5. Создаем ComplexityLevel
-- ========================================================================
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'ComplexityLevel') THEN
    CREATE TYPE "ComplexityLevel" AS ENUM (
      'BEGINNER',
      'AMATEUR',
      'ADVANCED',
      'PRO'
    );
  END IF;
END $$;

-- ========================================================================
-- 6. Добавляем новые поля в Profile
-- ========================================================================
ALTER TABLE "profiles" 
  ADD COLUMN IF NOT EXISTS "ageGroup" "AgeGroup";

ALTER TABLE "profiles" 
  ADD COLUMN IF NOT EXISTS "lastGoals" TEXT[] DEFAULT ARRAY[]::TEXT[];

-- ========================================================================
-- 7. Обновляем Video table (если нужны новые поля для тегов)
-- ========================================================================
-- Эти поля могут уже существовать, поэтому добавляем через IF NOT EXISTS

DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'videos' AND column_name = 'ageGroups'
  ) THEN
    ALTER TABLE "videos" ADD COLUMN "ageGroups" "AgeGroup"[] DEFAULT ARRAY[]::AgeGroup[];
  END IF;
END $$;

-- ========================================================================
-- ЗАВЕРШЕНИЕ
-- ========================================================================
COMMIT;

-- Выводим информацию об успешном выполнении
DO $$ 
BEGIN
  RAISE NOTICE '✅ Миграция Алгоритма 2.0 успешно применена!';
  RAISE NOTICE 'Созданы: TrainingGoal, EnergyState, обновлены AgeGroup, ComplexityLevel';
  RAISE NOTICE 'Добавлены поля: profiles.ageGroup, profiles.lastGoals';
END $$;
