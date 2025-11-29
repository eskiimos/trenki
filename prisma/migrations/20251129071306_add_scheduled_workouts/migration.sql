-- CreateTable
CREATE TABLE "public"."scheduled_workouts" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "videoId" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "completed" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "scheduled_workouts_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "scheduled_workouts_userId_date_idx" ON "public"."scheduled_workouts"("userId", "date");

-- AddForeignKey
ALTER TABLE "public"."scheduled_workouts" ADD CONSTRAINT "scheduled_workouts_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."scheduled_workouts" ADD CONSTRAINT "scheduled_workouts_videoId_fkey" FOREIGN KEY ("videoId") REFERENCES "public"."videos"("id") ON DELETE CASCADE ON UPDATE CASCADE;
