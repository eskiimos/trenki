import type { NextRequest } from 'next/server';
import { getSessionFromRequest } from '@/lib/session';

/**
 * Возвращает userId (User.id) из подписанной сессии или null, если её нет/невалидна.
 * Внимание: НЕ принимаем userId из query/header/body — это позволяло подделать чужой
 * аккаунт. Источник истины — только httpOnly cookie с JWT.
 */
export async function getSessionUserId(request: NextRequest): Promise<string | null> {
  const session = await getSessionFromRequest(request);
  return session?.uid ?? null;
}
