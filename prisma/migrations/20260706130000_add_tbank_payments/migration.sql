-- Платежи T-Bank (Трек B): аудит заказов + сохранённая карта для рекуррента.
-- Аддитивно: новая таблица + один nullable-столбец на users, бэкфилл не нужен.

ALTER TABLE "users" ADD COLUMN "tbankRebillId" TEXT;

CREATE TABLE "payments" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "paymentId" TEXT,
    "userId" TEXT NOT NULL,
    "amountKopecks" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'NEW',
    "kind" TEXT NOT NULL DEFAULT 'init',
    "isRecurrentInit" BOOLEAN NOT NULL DEFAULT false,
    "rebillId" TEXT,
    "errorCode" TEXT,
    "premiumGrantedAt" TIMESTAMP(3),
    "raw" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "payments_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "payments_orderId_key" ON "payments"("orderId");
CREATE INDEX "payments_userId_createdAt_idx" ON "payments"("userId", "createdAt");
CREATE INDEX "payments_paymentId_idx" ON "payments"("paymentId");

ALTER TABLE "payments" ADD CONSTRAINT "payments_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
