-- Заявка на вступление: тренер подтверждает игрока перед попаданием в команду.
-- TeamMember теперь создаётся со статусом PENDING; ACTIVE даётся только
-- после подтверждения тренером.

ALTER TYPE "TeamMemberStatus" ADD VALUE IF NOT EXISTS 'PENDING';

CREATE INDEX IF NOT EXISTS "team_members_teamId_status_idx"
  ON "team_members"("teamId", "status");
