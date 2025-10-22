-- CreateEnum для типов нагрузки
CREATE TYPE "LoadType" AS ENUM (
  'SPEED',
  'POWER',
  'MAX_STRENGTH',
  'STRENGTH_ENDURANCE',
  'ANAEROBIC_ENDURANCE',
  'AEROBIC_ENDURANCE',
  'AGILITY',
  'MOBILITY',
  'STATIC_STRETCH',
  'DYNAMIC_STRETCH',
  'PREHAB',
  'TECHNICAL_SKILL'
);

-- CreateTable для тегов
CREATE TABLE "tags" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "description" TEXT,
    "loadType" "LoadType" NOT NULL,
    "icon" TEXT,
    "color" TEXT,
    "order" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tags_pkey" PRIMARY KEY ("id")
);

-- CreateTable для связи Video <-> Tag
CREATE TABLE "video_tags" (
    "id" TEXT NOT NULL,
    "videoId" TEXT NOT NULL,
    "tagId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "video_tags_pkey" PRIMARY KEY ("id")
);

-- CreateTable для связи Short <-> Tag
CREATE TABLE "short_tags" (
    "id" TEXT NOT NULL,
    "shortId" TEXT NOT NULL,
    "tagId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "short_tags_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "tags_name_key" ON "tags"("name");

-- CreateIndex
CREATE UNIQUE INDEX "video_tags_videoId_tagId_key" ON "video_tags"("videoId", "tagId");

-- CreateIndex
CREATE UNIQUE INDEX "short_tags_shortId_tagId_key" ON "short_tags"("shortId", "tagId");

-- AddForeignKey
ALTER TABLE "video_tags" ADD CONSTRAINT "video_tags_videoId_fkey" FOREIGN KEY ("videoId") REFERENCES "videos"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "video_tags" ADD CONSTRAINT "video_tags_tagId_fkey" FOREIGN KEY ("tagId") REFERENCES "tags"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "short_tags" ADD CONSTRAINT "short_tags_shortId_fkey" FOREIGN KEY ("shortId") REFERENCES "shorts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "short_tags" ADD CONSTRAINT "short_tags_tagId_fkey" FOREIGN KEY ("tagId") REFERENCES "tags"("id") ON DELETE CASCADE ON UPDATE CASCADE;
