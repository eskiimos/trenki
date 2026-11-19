ALTER TABLE "microcycles"
  ADD COLUMN "macrocycleWeek" INTEGER CHECK ("macrocycleWeek" BETWEEN 1 AND 4);

ALTER TABLE "microcycle_days"
  ADD COLUMN "stretchBodyPart" TEXT CHECK ("stretchBodyPart" IN ('lower', 'upper', 'full'));
