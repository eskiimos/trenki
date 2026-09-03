-- Витрина наград в шапке профиля: вместо одной закреплённой награды — до 5
-- (правка владельца «Начало сентября»: добавлять и убирать самому, пустые
-- слоты — серые «+»). Одиночная закреплённая переезжает первым элементом.
ALTER TABLE "users" ADD COLUMN "pinnedAchievements" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];
UPDATE "users"
   SET "pinnedAchievements" = ARRAY["pinnedAchievement"]
 WHERE "pinnedAchievement" IS NOT NULL AND "pinnedAchievement" <> '';
ALTER TABLE "users" DROP COLUMN "pinnedAchievement";
