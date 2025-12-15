-- CreateTable
CREATE TABLE "public"."trainer_reviews" (
    "id" TEXT NOT NULL,
    "trainerId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "rating" INTEGER NOT NULL,
    "comment" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "trainer_reviews_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "trainer_reviews_trainerId_userId_key" ON "public"."trainer_reviews"("trainerId", "userId");

-- AddForeignKey
ALTER TABLE "public"."trainer_reviews" ADD CONSTRAINT "trainer_reviews_trainerId_fkey" FOREIGN KEY ("trainerId") REFERENCES "public"."trainers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."trainer_reviews" ADD CONSTRAINT "trainer_reviews_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
