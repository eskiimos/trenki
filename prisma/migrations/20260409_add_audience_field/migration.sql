-- CreateEnum
CREATE TYPE "Audience" AS ENUM ('HOCKEY', 'ADAPTIVE', 'ALL');

-- AlterTable: Video
ALTER TABLE "videos" ADD COLUMN "audience" "Audience" NOT NULL DEFAULT 'HOCKEY';

-- AlterTable: Short
ALTER TABLE "shorts" ADD COLUMN "audience" "Audience" NOT NULL DEFAULT 'HOCKEY';
