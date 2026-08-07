-- Родительский кабинет: роль PARENT + связи «родитель — ребёнок» + инвайты.
--
-- ВАЖНО про enum: ALTER TYPE ... ADD VALUE нельзя использовать в той же
-- транзакции, где новое значение уже применяется. В этой миграции значение
-- 'PARENT' нигде не используется (только добавляется + создаются таблицы),
-- поэтому prisma migrate прогонит её одной транзакцией без проблем.

ALTER TYPE "UserRole" ADD VALUE IF NOT EXISTS 'PARENT';

-- Связь «родитель — ребёнок» (родитель видит прогресс ребёнка read-only)
CREATE TABLE "parent_links" (
    "id" TEXT NOT NULL,
    "parentId" TEXT NOT NULL,
    "childId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "parent_links_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "parent_links_parentId_childId_key" ON "parent_links"("parentId", "childId");
CREATE INDEX "parent_links_childId_idx" ON "parent_links"("childId");

ALTER TABLE "parent_links"
    ADD CONSTRAINT "parent_links_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "parent_links"
    ADD CONSTRAINT "parent_links_childId_fkey" FOREIGN KEY ("childId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Одноразовый инвайт ребёнка для родителя (код на 48 часов)
CREATE TABLE "parent_invites" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "childId" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "usedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "parent_invites_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "parent_invites_code_key" ON "parent_invites"("code");
CREATE INDEX "parent_invites_childId_idx" ON "parent_invites"("childId");

ALTER TABLE "parent_invites"
    ADD CONSTRAINT "parent_invites_childId_fkey" FOREIGN KEY ("childId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
