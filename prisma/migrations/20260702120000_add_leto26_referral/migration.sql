-- Единый летний промокод для флаера (просьба босса): один код на все лагеря.
-- Слаг leto26 — для ссылки /r/leto26 и QR ?ref=leto26. Кириллический алиас
-- 'лето26' — для ручного ввода; validate.promo подставит «ЛЕТО26» в поле входа.
-- Камповые коды (eagles/star/defender) остаются активными — не трогаем.
INSERT INTO "referral_codes" ("id", "code", "label", "aliases", "isActive", "createdAt") VALUES
  ('refc_leto26', 'leto26', 'Лето 2026', ARRAY['лето26'], true, CURRENT_TIMESTAMP)
ON CONFLICT ("code") DO NOTHING;
