-- Preserve the legacy preference column and all existing plans. Source was
-- not recorded for legacy cycles, so a nullable explicit-request timestamp
-- distinguishes new manual plans without guessing or deleting user history.
ALTER TABLE "profiles" ALTER COLUMN "autoGenerateMicrocycle" SET DEFAULT false;
ALTER TABLE "microcycles" ADD COLUMN "requestedAt" TIMESTAMP(3);
