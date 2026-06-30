-- Переименование реф-кодов в читаемые англ-слова (просьба босса):
--   igls26 → eagles,  zvezda26 → star,  shkola26 → defender
-- Старые коды и кириллица остаются АЛИАСАМИ (нижний регистр) — печатные QR/ссылки
-- (?ref=igls26) и ручной ввод по-русски (ИГЛС/ЗВЕЗДА/ШКОЛА) продолжают работать.
-- validate матчит code и aliases без учёта регистра.
UPDATE "referral_codes" SET "code" = 'eagles',   "aliases" = ARRAY['igls26', 'иглс']    WHERE "code" = 'igls26';
UPDATE "referral_codes" SET "code" = 'star',     "aliases" = ARRAY['zvezda26', 'звезда'] WHERE "code" = 'zvezda26';
UPDATE "referral_codes" SET "code" = 'defender', "aliases" = ARRAY['shkola26', 'школа']  WHERE "code" = 'shkola26';

-- Бэкфилл уже зарегистрированных под старым кодом → новый канонический,
-- чтобы статистика лагеря в админке не разъехалась между старым и новым кодом.
UPDATE "users" SET "referralCode" = 'eagles'   WHERE "referralCode" = 'igls26';
UPDATE "users" SET "referralCode" = 'star'     WHERE "referralCode" = 'zvezda26';
UPDATE "users" SET "referralCode" = 'defender' WHERE "referralCode" = 'shkola26';
