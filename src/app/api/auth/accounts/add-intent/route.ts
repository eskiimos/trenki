import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSessionFromRequest } from '@/lib/session';
import { signAddIntent, setAddIntentCookie } from '@/lib/add-intent';
import { ADMIN_COOKIE_NAME, validateAdminSessionToken } from '@/lib/admin-session';
import { isSameOrigin } from '@/lib/same-origin';
import { logger } from '@/lib/logger';

export const dynamic = 'force-dynamic';

/**
 * POST /api/auth/accounts/add-intent
 *
 * Админ нажал «+ Добавить аккаунт». Выдаём короткоживущий подписанный тикет —
 * только с ним следующий вход по коду сохранит админскую запись в списке
 * устройства (см. src/lib/add-intent.ts, почему одного факта «в браузере лежит
 * админская сессия» недостаточно).
 *
 * Требуем: активную сессию, same-origin и РЕАЛЬНЫЙ isAdmin из БД.
 */
export async function POST(request: NextRequest) {
  const session = await getSessionFromRequest(request);
  if (!session?.uid) {
    return NextResponse.json({ error: 'Нужна авторизация' }, { status: 401 });
  }
  if (!isSameOrigin(request)) {
    return NextResponse.json({ error: 'Запрос отклонён' }, { status: 403 });
  }

  const me = await prisma.user.findUnique({
    where: { id: session.uid },
    select: { isAdmin: true },
  });
  if (!me?.isAdmin) {
    // Мульти-аккаунт — фича админов приложения.
    return NextResponse.json({ error: 'Недоступно' }, { status: 403 });
  }

  // Мало флага isAdmin в сессии: сессия лежит в браузере, и «+ Добавить» может
  // нажать любой, кто взял разблокированное устройство админа. Тогда админский
  // доступ законсервировался бы в переключаемую запись, пережил бы перетирание
  // сессии и не оставил следов. Поэтому требуем ОТЗЫВАЕМЫЙ админ-креденшл,
  // который получают только через логин+пароль (/admin/login).
  const adminToken = request.cookies.get(ADMIN_COOKIE_NAME)?.value;
  if (!(await validateAdminSessionToken(adminToken))) {
    return NextResponse.json(
      { error: 'Сначала войди в админ-панель (логин и пароль)', code: 'ADMIN_LOGIN_REQUIRED' },
      { status: 403 },
    );
  }

  const response = NextResponse.json({ success: true });
  setAddIntentCookie(response, await signAddIntent(session.uid));
  logger.info('add-account intent issued', { userId: session.uid });
  return response;
}
