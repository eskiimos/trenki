-- Доп. коды для ручного ввода (в т.ч. кириллица), храним в нижнем регистре.
ALTER TABLE "referral_codes" ADD COLUMN "aliases" TEXT[] NOT NULL DEFAULT '{}'::text[];

-- Кириллические промокоды для печатных листовок (босс: «Промокод: ИГЛС»).
UPDATE "referral_codes" SET "aliases" = ARRAY['иглс']   WHERE "code" = 'igls26';
UPDATE "referral_codes" SET "aliases" = ARRAY['звезда'] WHERE "code" = 'zvezda26';
UPDATE "referral_codes" SET "aliases" = ARRAY['школа']  WHERE "code" = 'shkola26';
