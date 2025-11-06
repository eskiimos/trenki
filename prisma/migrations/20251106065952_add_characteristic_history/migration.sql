-- CreateTable
CREATE TABLE "public"."characteristic_history" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "sessionId" TEXT,
    "ratingPower" DOUBLE PRECISION NOT NULL,
    "ratingSpeed" DOUBLE PRECISION NOT NULL,
    "ratingEndurance" DOUBLE PRECISION NOT NULL,
    "ratingTechnique" DOUBLE PRECISION NOT NULL,
    "ratingFlexibility" DOUBLE PRECISION NOT NULL,
    "potential" DOUBLE PRECISION NOT NULL,
    "gainPower" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "gainSpeed" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "gainEndurance" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "gainTechnique" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "gainFlexibility" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "eventType" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "characteristic_history_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "characteristic_history_userId_createdAt_idx" ON "public"."characteristic_history"("userId", "createdAt");

-- AddForeignKey
ALTER TABLE "public"."characteristic_history" ADD CONSTRAINT "characteristic_history_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."characteristic_history" ADD CONSTRAINT "characteristic_history_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "public"."workout_sessions"("id") ON DELETE SET NULL ON UPDATE CASCADE;
