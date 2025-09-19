-- CreateEnum
CREATE TYPE "public"."VideoCategory" AS ENUM ('STRENGTH', 'ENDURANCE', 'SPEED', 'TECHNIQUE', 'TACTICAL', 'GOALKEEPER', 'GENERAL');

-- CreateEnum
CREATE TYPE "public"."VideoDifficulty" AS ENUM ('BEGINNER', 'INTERMEDIATE', 'ADVANCED', 'EXPERT');

-- CreateTable
CREATE TABLE "public"."users" (
    "id" TEXT NOT NULL,
    "telegramId" TEXT NOT NULL,
    "firstName" TEXT,
    "lastName" TEXT,
    "username" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."profiles" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "position" TEXT,
    "number" INTEGER,
    "age" INTEGER,
    "height" INTEGER,
    "weight" INTEGER,
    "strength" INTEGER NOT NULL DEFAULT 0,
    "endurance" INTEGER NOT NULL DEFAULT 0,
    "speed" INTEGER NOT NULL DEFAULT 0,
    "technique" INTEGER NOT NULL DEFAULT 0,
    "overall" INTEGER NOT NULL DEFAULT 0,
    "dailyProgress" INTEGER NOT NULL DEFAULT 0,
    "maxDailyGoal" INTEGER NOT NULL DEFAULT 10,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "profiles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."trainers" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "lastName" TEXT NOT NULL,
    "speciality" TEXT NOT NULL,
    "experience" INTEGER NOT NULL,
    "rating" DOUBLE PRECISION NOT NULL DEFAULT 5.0,
    "avatar" TEXT,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "trainers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."videos" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "duration" INTEGER NOT NULL,
    "videoUrl" TEXT NOT NULL,
    "thumbnail" TEXT,
    "category" "public"."VideoCategory" NOT NULL,
    "difficulty" "public"."VideoDifficulty" NOT NULL,
    "trainerId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "videos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."training_sessions" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "videoId" TEXT NOT NULL,
    "completed" BOOLEAN NOT NULL DEFAULT false,
    "duration" INTEGER,
    "progress" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "training_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."favorite_videos" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "videoId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "favorite_videos_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_telegramId_key" ON "public"."users"("telegramId");

-- CreateIndex
CREATE UNIQUE INDEX "profiles_userId_key" ON "public"."profiles"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "favorite_videos_userId_videoId_key" ON "public"."favorite_videos"("userId", "videoId");

-- AddForeignKey
ALTER TABLE "public"."profiles" ADD CONSTRAINT "profiles_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."videos" ADD CONSTRAINT "videos_trainerId_fkey" FOREIGN KEY ("trainerId") REFERENCES "public"."trainers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."training_sessions" ADD CONSTRAINT "training_sessions_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."training_sessions" ADD CONSTRAINT "training_sessions_videoId_fkey" FOREIGN KEY ("videoId") REFERENCES "public"."videos"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."favorite_videos" ADD CONSTRAINT "favorite_videos_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."favorite_videos" ADD CONSTRAINT "favorite_videos_videoId_fkey" FOREIGN KEY ("videoId") REFERENCES "public"."videos"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
