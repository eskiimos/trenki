-- Запрос ребёнка на отвязку родителя: ребёнок не рвёт связь сам, только просит.
-- null — запроса нет; дата — запрос ждёт подтверждения родителя в кабинете.
ALTER TABLE "parent_links" ADD COLUMN "unlinkRequestedAt" TIMESTAMP(3);
