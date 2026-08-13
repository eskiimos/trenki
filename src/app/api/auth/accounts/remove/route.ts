import { NextRequest, NextResponse } from 'next/server';
import { getSessionFromRequest, clearSessionCookie } from '@/lib/session';
import {
  getAccountsFromRequest,
  writeAccounts,
  removeAccount,
  sameList,
  clearAccountsCookie,
} from '@/lib/account-list';
import { ADMIN_COOKIE_NAME, destroyAdminSession } from '@/lib/admin-session';
import { isSameOrigin } from '@/lib/same-origin';
import { logger } from '@/lib/logger';

export const dynamic = 'force-dynamic';

/**
 * POST /api/auth/accounts/remove  { userId }
 *
 * Убрать аккаунт из списка устройства («забыть» его). Данные пользователя не
 * трогаем — только локальный список переключателя.
 *
 * Требует сессию и same-origin: иначе по чужой cookie можно было бы принудительно
 * разлогинить жертву и затереть её список (CSRF с нашего же поддомена).
 *
 * Cookie переписываем ТОЛЬКО если список реально изменился: безусловная
 * переподпись служила бы оракулом продления срока жизни cookie (холостой вызов
 * с несуществующим id раз в 89 дней).
 */
export async function POST(request: NextRequest) {
  const session = await getSessionFromRequest(request);
  if (!session?.uid) {
    return NextResponse.json({ error: 'Нужна авторизация' }, { status: 401 });
  }
  if (!isSameOrigin(request)) {
    return NextResponse.json({ error: 'Запрос отклонён' }, { status: 403 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Некорректный запрос' }, { status: 400 });
  }

  const raw = (body as { userId?: unknown })?.userId;
  const userId = typeof raw === 'string' && /^[a-z0-9]{20,40}$/i.test(raw) ? raw : null;
  if (!userId) {
    return NextResponse.json({ error: 'userId обязателен' }, { status: 400 });
  }

  const accounts = await getAccountsFromRequest(request);
  const next = removeAccount(accounts, userId);
  const activeCleared = session.uid === userId;

  const response = NextResponse.json({ success: true, activeCleared });

  if (activeCleared) {
    // Убрать САМОГО СЕБЯ = логаут, поэтому политика та же, что в /auth/logout:
    // чистое устройство (сессия + весь список + админ-сессия). Иначе политика
    // разъезжалась бы, и admin_token переживал бы «выход» на этом пути.
    clearSessionCookie(response);
    clearAccountsCookie(response);
    const adminToken = request.cookies.get(ADMIN_COOKIE_NAME)?.value;
    if (adminToken) {
      try {
        await destroyAdminSession(adminToken);
      } catch {
        // запись уже могла быть удалена — выход не блокируем
      }
      response.cookies.set(ADMIN_COOKIE_NAME, '', {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        path: '/',
        maxAge: 0,
      });
    }
  } else if (!sameList(next, accounts)) {
    await writeAccounts(response, next);
  }

  logger.info('account removed from device list', { from: session.uid, activeCleared });
  return response;
}
