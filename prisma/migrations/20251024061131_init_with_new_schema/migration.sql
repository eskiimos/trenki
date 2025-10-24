-- CreateEnum
CREATE TYPE "public"."VideoCategory" AS ENUM ('STRENGTH', 'ENDURANCE', 'SPEED', 'TECHNIQUE', 'SKATING', 'SHOOTING', 'PASSING', 'CHECKING', 'GOALKEEPER', 'POWER_PLAY', 'PENALTY_KILL', 'TACTICAL', 'GENERAL');

-- CreateEnum
CREATE TYPE "public"."VideoDifficulty" AS ENUM ('BEGINNER', 'INTERMEDIATE', 'ADVANCED', 'EXPERT');

-- CreateEnum
CREATE TYPE "public"."HockeyPosition" AS ENUM ('GOALTENDER', 'DEFENSEMAN', 'LEFT_WING', 'CENTER', 'RIGHT_WING');

-- CreateEnum
CREATE TYPE "public"."Gender" AS ENUM ('MALE', 'FEMALE', 'NOT_SPECIFIED');

-- CreateEnum
CREATE TYPE "public"."LoadType" AS ENUM ('SPEED', 'POWER', 'MAX_STRENGTH', 'STRENGTH_ENDURANCE', 'ANAEROBIC_ENDURANCE', 'AEROBIC_ENDURANCE', 'AGILITY', 'MOBILITY', 'STATIC_STRETCH', 'DYNAMIC_STRETCH', 'PREHAB', 'TECHNICAL_SKILL');

-- CreateEnum
CREATE TYPE "public"."MuscleGroup" AS ENUM ('LOWER_BODY', 'UPPER_PULL', 'UPPER_PUSH', 'CORE_STABILITY', 'CORE_DYNAMICS', 'PREHAB_SHOULDER', 'PREHAB_KNEE', 'PREHAB_BACK', 'FULL_BODY');

-- CreateEnum
CREATE TYPE "public"."Complexity" AS ENUM ('BEGINNER', 'AMATEUR', 'ADVANCED', 'PRO');

-- CreateEnum
CREATE TYPE "public"."TrainingGoal" AS ENUM ('RECOVERY', 'DEVELOPMENT', 'PEAK');

-- CreateEnum
CREATE TYPE "public"."TagType" AS ENUM ('LOAD', 'MUSCLE', 'COMPLEXITY', 'GOAL');

-- CreateEnum
CREATE TYPE "public"."ModuleType" AS ENUM ('WARMUP', 'FITNESS', 'TECHNIQUE', 'COOLDOWN');

-- CreateEnum
CREATE TYPE "public"."LoadDirection" AS ENUM ('LIGHT', 'MEDIUM', 'HIGH');

-- CreateEnum
CREATE TYPE "public"."LastTrainingTime" AS ENUM ('TODAY', 'YESTERDAY', 'TWO_DAYS_AGO', 'THREE_PLUS_DAYS', 'WEEK_PLUS');

-- CreateEnum
CREATE TYPE "public"."WorkoutStatus" AS ENUM ('PENDING', 'IN_PROGRESS', 'COMPLETED', 'SKIPPED');

-- CreateTable
CREATE TABLE "public"."users" (
    "id" TEXT NOT NULL,
    "telegramId" TEXT NOT NULL,
    "firstName" TEXT,
    "lastName" TEXT,
    "username" TEXT,
    "email" TEXT,
    "emailVerified" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."profiles" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "position" "public"."HockeyPosition",
    "gender" "public"."Gender",
    "number" INTEGER,
    "age" INTEGER,
    "height" INTEGER,
    "weight" INTEGER,
    "strength" INTEGER NOT NULL DEFAULT 0,
    "endurance" INTEGER NOT NULL DEFAULT 0,
    "speed" INTEGER NOT NULL DEFAULT 0,
    "technique" INTEGER NOT NULL DEFAULT 0,
    "skating" INTEGER NOT NULL DEFAULT 0,
    "shooting" INTEGER NOT NULL DEFAULT 0,
    "passing" INTEGER NOT NULL DEFAULT 0,
    "checking" INTEGER NOT NULL DEFAULT 0,
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
    "tags" TEXT[],
    "equipment" TEXT[],
    "level" TEXT,
    "isPublished" BOOLEAN NOT NULL DEFAULT false,
    "viewsCount" INTEGER NOT NULL DEFAULT 0,
    "likesCount" INTEGER NOT NULL DEFAULT 0,
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

-- CreateTable
CREATE TABLE "public"."video_likes" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "videoId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "video_likes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."shorts" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "videoUrl" TEXT NOT NULL,
    "thumbnail" TEXT,
    "trainerId" TEXT,
    "tags" TEXT[],
    "isPublished" BOOLEAN NOT NULL DEFAULT false,
    "viewsCount" INTEGER NOT NULL DEFAULT 0,
    "likesCount" INTEGER NOT NULL DEFAULT 0,
    "order" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "shorts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."short_likes" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "shortId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "short_likes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."short_comments" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "shortId" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "short_comments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."tags" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "description" TEXT,
    "tagType" "public"."TagType" NOT NULL,
    "loadType" "public"."LoadType",
    "muscleGroup" "public"."MuscleGroup",
    "complexity" "public"."Complexity",
    "trainingGoal" "public"."TrainingGoal",
    "icon" TEXT,
    "color" TEXT,
    "order" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tags_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."video_tags" (
    "id" TEXT NOT NULL,
    "videoId" TEXT NOT NULL,
    "tagId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "video_tags_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."short_tags" (
    "id" TEXT NOT NULL,
    "shortId" TEXT NOT NULL,
    "tagId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "short_tags_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."push_subscriptions" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "endpoint" TEXT NOT NULL,
    "p256dh" TEXT NOT NULL,
    "auth" TEXT NOT NULL,
    "userAgent" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "push_subscriptions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."push_notifications" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "icon" TEXT,
    "url" TEXT,
    "sentCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "sentBy" TEXT,

    CONSTRAINT "push_notifications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."training_modules" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "type" "public"."ModuleType" NOT NULL,
    "duration" INTEGER NOT NULL,
    "videoId" TEXT,
    "order" INTEGER NOT NULL DEFAULT 0,
    "loadType" "public"."LoadType",
    "muscleGroup" "public"."MuscleGroup",
    "complexity" "public"."Complexity" NOT NULL DEFAULT 'BEGINNER',
    "rpeMin" INTEGER,
    "rpeMax" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "training_modules_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."user_state_assessments" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "lastTrainingTime" "public"."LastTrainingTime" NOT NULL,
    "energyLevel" INTEGER NOT NULL,
    "muscleReadiness" INTEGER NOT NULL,
    "motivation" INTEGER NOT NULL,
    "availableTime" INTEGER NOT NULL,
    "loadDirection" "public"."LoadDirection" NOT NULL,
    "recommendedRPE" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "user_state_assessments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."workout_sessions" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "assessmentId" TEXT,
    "targetDuration" INTEGER NOT NULL,
    "targetRPE" INTEGER NOT NULL,
    "loadDirection" "public"."LoadDirection" NOT NULL,
    "status" "public"."WorkoutStatus" NOT NULL DEFAULT 'PENDING',
    "completedAt" TIMESTAMP(3),
    "actualDuration" INTEGER,
    "actualRPE" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "workout_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."workout_session_modules" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "moduleId" TEXT NOT NULL,
    "order" INTEGER NOT NULL,
    "completed" BOOLEAN NOT NULL DEFAULT false,
    "actualRPE" INTEGER,

    CONSTRAINT "workout_session_modules_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."user_module_history" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "moduleId" TEXT NOT NULL,
    "completedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "rpe" INTEGER,

    CONSTRAINT "user_module_history_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_telegramId_key" ON "public"."users"("telegramId");

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "public"."users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "profiles_userId_key" ON "public"."profiles"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "favorite_videos_userId_videoId_key" ON "public"."favorite_videos"("userId", "videoId");

-- CreateIndex
CREATE UNIQUE INDEX "video_likes_userId_videoId_key" ON "public"."video_likes"("userId", "videoId");

-- CreateIndex
CREATE UNIQUE INDEX "short_likes_userId_shortId_key" ON "public"."short_likes"("userId", "shortId");

-- CreateIndex
CREATE UNIQUE INDEX "tags_name_key" ON "public"."tags"("name");

-- CreateIndex
CREATE UNIQUE INDEX "video_tags_videoId_tagId_key" ON "public"."video_tags"("videoId", "tagId");

-- CreateIndex
CREATE UNIQUE INDEX "short_tags_shortId_tagId_key" ON "public"."short_tags"("shortId", "tagId");

-- CreateIndex
CREATE UNIQUE INDEX "push_subscriptions_endpoint_key" ON "public"."push_subscriptions"("endpoint");

-- CreateIndex
CREATE INDEX "user_state_assessments_userId_createdAt_idx" ON "public"."user_state_assessments"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "workout_sessions_userId_createdAt_idx" ON "public"."workout_sessions"("userId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "workout_session_modules_sessionId_moduleId_key" ON "public"."workout_session_modules"("sessionId", "moduleId");

-- CreateIndex
CREATE INDEX "user_module_history_userId_completedAt_idx" ON "public"."user_module_history"("userId", "completedAt");

-- CreateIndex
CREATE INDEX "user_module_history_userId_moduleId_idx" ON "public"."user_module_history"("userId", "moduleId");

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

-- AddForeignKey
ALTER TABLE "public"."video_likes" ADD CONSTRAINT "video_likes_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."video_likes" ADD CONSTRAINT "video_likes_videoId_fkey" FOREIGN KEY ("videoId") REFERENCES "public"."videos"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."short_likes" ADD CONSTRAINT "short_likes_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."short_likes" ADD CONSTRAINT "short_likes_shortId_fkey" FOREIGN KEY ("shortId") REFERENCES "public"."shorts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."short_comments" ADD CONSTRAINT "short_comments_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."short_comments" ADD CONSTRAINT "short_comments_shortId_fkey" FOREIGN KEY ("shortId") REFERENCES "public"."shorts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."video_tags" ADD CONSTRAINT "video_tags_videoId_fkey" FOREIGN KEY ("videoId") REFERENCES "public"."videos"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."video_tags" ADD CONSTRAINT "video_tags_tagId_fkey" FOREIGN KEY ("tagId") REFERENCES "public"."tags"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."short_tags" ADD CONSTRAINT "short_tags_shortId_fkey" FOREIGN KEY ("shortId") REFERENCES "public"."shorts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."short_tags" ADD CONSTRAINT "short_tags_tagId_fkey" FOREIGN KEY ("tagId") REFERENCES "public"."tags"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."training_modules" ADD CONSTRAINT "training_modules_videoId_fkey" FOREIGN KEY ("videoId") REFERENCES "public"."videos"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."workout_session_modules" ADD CONSTRAINT "workout_session_modules_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "public"."workout_sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."workout_session_modules" ADD CONSTRAINT "workout_session_modules_moduleId_fkey" FOREIGN KEY ("moduleId") REFERENCES "public"."training_modules"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."user_module_history" ADD CONSTRAINT "user_module_history_moduleId_fkey" FOREIGN KEY ("moduleId") REFERENCES "public"."training_modules"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
