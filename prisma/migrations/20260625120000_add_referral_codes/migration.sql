-- Реферальные каналы + поле источника на пользователе.

-- referral_codes
CREATE TABLE "referral_codes" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "referral_codes_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "referral_codes_code_key" ON "referral_codes"("code");

-- users.referralCode (каким реф-кодом пришёл) + индекс для агрегаций в админке
ALTER TABLE "users" ADD COLUMN "referralCode" TEXT;
CREATE INDEX "users_referralCode_idx" ON "users"("referralCode");

-- Сиды каналов от босса (коды латиницей, label — как просили).
INSERT INTO "referral_codes" ("id", "code", "label", "isActive", "createdAt") VALUES
    ('refc_igls26',   'igls26',   'ИГЛС',             true, CURRENT_TIMESTAMP),
    ('refc_zvezda26', 'zvezda26', 'Звезда хоккея',    true, CURRENT_TIMESTAMP),
    ('refc_shkola26', 'shkola26', 'Школа защитников', true, CURRENT_TIMESTAMP);
