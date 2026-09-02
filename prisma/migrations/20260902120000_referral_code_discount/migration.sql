-- Персональные условия скидки у каждого промокода (правка владельца).
-- NULL = наследовать глобальные настройки подписки; 0 = у канала скидки нет.
-- Аддитивно и nullable: все существующие коды продолжают работать по
-- глобальным subscription.introDiscountPercent / introMonths без бэкфилла.
ALTER TABLE "referral_codes"
  ADD COLUMN "discountPercent" INTEGER,
  ADD COLUMN "discountMonths"  INTEGER;
