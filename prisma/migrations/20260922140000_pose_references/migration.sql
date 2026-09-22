-- Эталон движений тренера по видео (пилот трекинга, п.1 «Середина сентября»).
-- Аддитивно: новая таблица, точки скелета — в Cloudinary, здесь только сводка.

-- CreateTable
CREATE TABLE "pose_references" (
    "id" TEXT NOT NULL,
    "videoId" TEXT NOT NULL,
    "framesUrl" TEXT NOT NULL,
    "framesEncoding" TEXT NOT NULL DEFAULT 'json-gzip',
    "formatVersion" INTEGER NOT NULL DEFAULT 1,
    "model" TEXT NOT NULL,
    "fps" INTEGER NOT NULL,
    "frameCount" INTEGER NOT NULL,
    "durationSec" DOUBLE PRECISION NOT NULL,
    "detectedRatio" DOUBLE PRECISION NOT NULL,
    "legsVisibleRatio" DOUBLE PRECISION NOT NULL,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "pose_references_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "pose_references_videoId_key" ON "pose_references"("videoId");

-- AddForeignKey
ALTER TABLE "pose_references" ADD CONSTRAINT "pose_references_videoId_fkey" FOREIGN KEY ("videoId") REFERENCES "videos"("id") ON DELETE CASCADE ON UPDATE CASCADE;

