/*
  Warnings:

  - You are about to drop the column `группаМышц` on the `videos` table. All the data in the column will be lost.
  - You are about to drop the column `сложность` on the `videos` table. All the data in the column will be lost.
  - You are about to drop the column `типМодуля` on the `videos` table. All the data in the column will be lost.
  - You are about to drop the column `типНагрузки` on the `videos` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "public"."profiles" ADD COLUMN     "fatigue" DOUBLE PRECISION NOT NULL DEFAULT 0,
ADD COLUMN     "kMastery" DOUBLE PRECISION,
ADD COLUMN     "lastTrainingDate" TIMESTAMP(3),
ADD COLUMN     "modulesToday" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "potential" DOUBLE PRECISION NOT NULL DEFAULT 0,
ADD COLUMN     "ratingEndurance" DOUBLE PRECISION NOT NULL DEFAULT 0,
ADD COLUMN     "ratingFlexibility" DOUBLE PRECISION NOT NULL DEFAULT 0,
ADD COLUMN     "ratingPower" DOUBLE PRECISION NOT NULL DEFAULT 0,
ADD COLUMN     "ratingSpeed" DOUBLE PRECISION NOT NULL DEFAULT 0,
ADD COLUMN     "ratingTechnique" DOUBLE PRECISION NOT NULL DEFAULT 0,
ADD COLUMN     "rawEndurance" INTEGER,
ADD COLUMN     "rawFlexibility" INTEGER,
ADD COLUMN     "rawPower" INTEGER,
ADD COLUMN     "rawSpeed" INTEGER,
ADD COLUMN     "rawTechnique" INTEGER,
ADD COLUMN     "trainingsToday" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "public"."videos" DROP COLUMN "группаМышц",
DROP COLUMN "сложность",
DROP COLUMN "типМодуля",
DROP COLUMN "типНагрузки";
