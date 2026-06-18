-- Фундамент монетизации: тариф доступа пользователя (FREE/PREMIUM).
-- Пока выдаётся вручную из админки; когда подключим T-Bank — биллинг будет
-- выставлять premiumUntil. Аддитивно и безопасно: дефолт FREE покрывает всех
-- существующих юзеров, бэкфилл не нужен. Эффективный доступ — hasPremium()
-- в src/lib/access.ts (PREMIUM и (premiumUntil IS NULL ИЛИ premiumUntil > now)).

CREATE TYPE "AccessTier" AS ENUM ('FREE', 'PREMIUM');

ALTER TABLE "users"
  ADD COLUMN "accessTier" "AccessTier" NOT NULL DEFAULT 'FREE',
  ADD COLUMN "premiumUntil" TIMESTAMP(3),
  ADD COLUMN "premiumNote" TEXT;
