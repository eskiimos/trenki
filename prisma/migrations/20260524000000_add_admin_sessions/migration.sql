-- Серверное хранилище admin-сессий взамен in-memory Map в lib/admin-session.ts.
-- token в cookie — raw hex; в БД хранится sha256(token).
CREATE TABLE "admin_sessions" (
  "tokenHash"  TEXT NOT NULL,
  "createdAt"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "expiresAt"  TIMESTAMP(3) NOT NULL,

  CONSTRAINT "admin_sessions_pkey" PRIMARY KEY ("tokenHash")
);

CREATE INDEX "admin_sessions_expiresAt_idx" ON "admin_sessions" ("expiresAt");
