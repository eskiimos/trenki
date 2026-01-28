-- Проверка данных видео для Алгоритма 2.0
-- Выполните эти запросы в Prisma Studio или напрямую в PostgreSQL

-- 1. Проверить все поля последнего созданного видео
SELECT 
  id,
  title,
  "moduleType",
  "loadType",
  "muscleGroup",
  complexity,
  "rpeMin",
  "rpeMax",
  "ageGroups",
  "trainingGoals",
  "isPublished",
  "createdAt"
FROM videos
ORDER BY "createdAt" DESC
LIMIT 5;

-- 2. Проверить только видео с заполненными полями Алгоритма 2.0
SELECT 
  id,
  title,
  "moduleType",
  "loadType",
  "ageGroups",
  "trainingGoals"
FROM videos
WHERE 
  "moduleType" IS NOT NULL 
  AND "loadType" IS NOT NULL
  AND array_length("ageGroups", 1) > 0
  AND array_length("trainingGoals", 1) > 0
ORDER BY "createdAt" DESC;

-- 3. Статистика по заполненности полей
SELECT 
  COUNT(*) as total_videos,
  COUNT("moduleType") as with_module_type,
  COUNT("loadType") as with_load_type,
  COUNT(CASE WHEN array_length("ageGroups", 1) > 0 THEN 1 END) as with_age_groups,
  COUNT(CASE WHEN array_length("trainingGoals", 1) > 0 THEN 1 END) as with_training_goals,
  COUNT("rpeMin") as with_rpe_min,
  COUNT("rpeMax") as with_rpe_max
FROM videos;

-- 4. Проверить разнообразие целей тренировок
SELECT 
  unnest("trainingGoals") as goal,
  COUNT(*) as count
FROM videos
WHERE array_length("trainingGoals", 1) > 0
GROUP BY goal
ORDER BY count DESC;

-- 5. Проверить разнообразие возрастных групп
SELECT 
  unnest("ageGroups") as age_group,
  COUNT(*) as count
FROM videos
WHERE array_length("ageGroups", 1) > 0
GROUP BY age_group
ORDER BY count DESC;

-- 6. Проверить распределение по типам модулей
SELECT 
  "moduleType",
  COUNT(*) as count
FROM videos
WHERE "moduleType" IS NOT NULL
GROUP BY "moduleType"
ORDER BY count DESC;

-- 7. Проверить RPE диапазоны
SELECT 
  "moduleType",
  MIN("rpeMin") as min_rpe,
  MAX("rpeMax") as max_rpe,
  AVG(("rpeMin" + "rpeMax") / 2.0) as avg_rpe
FROM videos
WHERE "rpeMin" IS NOT NULL AND "rpeMax" IS NOT NULL
GROUP BY "moduleType";
