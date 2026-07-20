-- Промокод команды «СКА Серебряные Львы 2014» для персонального флаера.
-- Канонический слаг ska-sl014 (ссылка /r/ska-sl014, QR ?ref=ska-sl014).
-- На флаере печатается как SKA-SL014 — validate матчит код без учёта регистра,
-- поэтому ручной ввод «SKA-SL014» найдёт этот код. Кириллических алиасов нет.
-- Аддитивно и идемпотентно: существующие коды не трогаем.
INSERT INTO "referral_codes" ("id", "code", "label", "aliases", "isActive", "createdAt") VALUES
  ('refc_ska_sl014', 'ska-sl014', 'СКА Серебряные Львы 2014', ARRAY[]::text[], true, CURRENT_TIMESTAMP)
ON CONFLICT ("code") DO NOTHING;
