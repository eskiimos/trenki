-- Возвраты (тест-кейсы T-Bank 3/8 и реальные возвраты из кабинета банка):
-- refundedAt — атомарный флаг «премиум по заказу откачен» (идемпотентность
-- между Cancel из админки и REFUNDED-нотификацией), refundAmountKopecks — аудит.
ALTER TABLE "payments" ADD COLUMN "refundedAt" TIMESTAMP(3);
ALTER TABLE "payments" ADD COLUMN "refundAmountKopecks" INTEGER;
