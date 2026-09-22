-- Задания от родителя (формат «счётчик») + кто родитель ребёнку (мама/папа).
-- Аддитивная: новые enum, таблица и nullable-колонка.

-- CreateEnum
CREATE TYPE "ParentRelation" AS ENUM ('MOTHER', 'FATHER', 'OTHER');

-- CreateEnum
CREATE TYPE "ParentTaskStatus" AS ENUM ('ACTIVE', 'COMPLETED', 'CANCELED');

-- AlterTable
ALTER TABLE "parent_links" ADD COLUMN     "relation" "ParentRelation";

-- CreateTable
CREATE TABLE "parent_tasks" (
    "id" TEXT NOT NULL,
    "parentId" TEXT NOT NULL,
    "childId" TEXT NOT NULL,
    "relation" "ParentRelation" NOT NULL DEFAULT 'OTHER',
    "goal" "TrainingGoal" NOT NULL,
    "target" INTEGER NOT NULL,
    "dueDate" TIMESTAMP(3) NOT NULL,
    "status" "ParentTaskStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "parent_tasks_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "parent_tasks_childId_status_idx" ON "parent_tasks"("childId", "status");

-- CreateIndex
CREATE INDEX "parent_tasks_parentId_createdAt_idx" ON "parent_tasks"("parentId", "createdAt");

-- AddForeignKey
ALTER TABLE "parent_tasks" ADD CONSTRAINT "parent_tasks_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "parent_tasks" ADD CONSTRAINT "parent_tasks_childId_fkey" FOREIGN KEY ("childId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

