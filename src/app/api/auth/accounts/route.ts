import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSessionFromRequest } from '@/lib/session';
import { getAccountsFromRequest, writeAccounts, sameList } from '@/lib/account-list';

export const dynamic = 'force-dynamic';

/**
 * GET /api/auth/accounts
 *
 * Аккаунты, авторизованные на ЭТОМ устройстве (для переключателя).
 *
 * ТРЕБУЕТ АКТИВНОЙ СЕССИИ: без неё роут раскрывал бы ФИО и email до 5 человек
 * (аудитория — несовершеннолетние) и служил бы разведкой перед переключением.
 *
 * НИКОГДА не добавляет записи в подписанный список — писатель ровно один,
 * verify-code (успешный вход по коду). Здесь список может только СОКРАЩАТЬСЯ
 * (исчезнувшие пользователи). Иначе угнанная сессия обменивалась бы тут на
 * долгоживущий ключ.
 */
export async function GET(request: NextRequest) {
  const session = await getSessionFromRequest(request);
  if (!session?.uid) {
    return NextResponse.json({ activeId: null, accounts: [] }, { status: 401 });
  }

  const stored = await getAccountsFromRequest(request);

  // Текущий аккаунт показываем всегда, даже если его нет в списке (вошёл до
  // появления фичи). В cookie при этом ничего не пишем — см. коммент выше.
  const ids = Array.from(new Set([session.uid, ...stored.map((a) => a.id)]));

  const users = await prisma.user.findMany({
    where: { id: { in: ids } },
    select: { id: true, firstName: true, lastName: true, email: true, role: true, isAdmin: true },
  });
  const byId = new Map(users.map((u) => [u.id, u]));

  const accounts = ids
    .filter((id) => byId.has(id))
    .map((id) => {
      const u = byId.get(id)!;
      const name = [u.firstName, u.lastName].filter(Boolean).join(' ') || u.email || 'Без имени';
      return {
        id: u.id,
        name,
        email: u.email,
        role: u.role,
        isActive: u.id === session.uid,
        // В админ-аккаунт переключиться нельзя — только вход по коду. Отдаём
        // флаг, чтобы UI показал это заранее, а не ошибкой после тапа.
        canSwitch: u.id !== session.uid && !u.isAdmin,
      };
    });

  const response = NextResponse.json({ activeId: session.uid, accounts });

  // Единственная запись здесь — вычистка исчезнувших пользователей.
  const alive = stored.filter((a) => byId.has(a.id));
  if (!sameList(alive, stored)) {
    await writeAccounts(response, alive);
  }
  return response;
}
