BEGIN;

ALTER TABLE "profiles" ALTER COLUMN "autoGenerateMicrocycle" SET DEFAULT false;

-- The old default was true, so a stored true does not imply an explicit opt-in.
UPDATE "profiles" SET "autoGenerateMicrocycle" = false WHERE "autoGenerateMicrocycle" = true;

COMMIT;
