BEGIN;

-- Подтверждение членства и первоначальное начисление используют один снимок.
LOCK TABLE "team_members" IN SHARE ROW EXCLUSIVE MODE;

ALTER TABLE "users" ADD COLUMN "teamPackEarnedAt" TIMESTAMP(3);

UPDATE "users" AS u
SET "teamPackEarnedAt" = membership."firstJoinedAt"
FROM (
  SELECT "userId", MIN("joinedAt") AS "firstJoinedAt"
  FROM "team_members"
  WHERE "status" = 'ACTIVE'
  GROUP BY "userId"
) AS membership
WHERE u."id" = membership."userId";

-- Записываем получение в той же транзакции, что и активацию членства.
-- Повторные вступления оставляют дату первой награды.
CREATE FUNCTION record_team_pack_achievement() RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  UPDATE "users"
  SET "teamPackEarnedAt" = NEW."joinedAt"
  WHERE "id" = NEW."userId" AND "teamPackEarnedAt" IS NULL;
  RETURN NEW;
END;
$$;

CREATE TRIGGER team_pack_after_activation
AFTER INSERT OR UPDATE OF "status" ON "team_members"
FOR EACH ROW
WHEN (NEW."status" = 'ACTIVE')
EXECUTE FUNCTION record_team_pack_achievement();

COMMIT;
