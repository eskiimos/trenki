import { NextRequest, NextResponse } from 'next/server';
import { clearSessionCookie } from '@/lib/session';
import { clearAccountsCookie } from '@/lib/account-list';
import { clearAddIntentCookie } from '@/lib/add-intent';
import { ADMIN_COOKIE_NAME, destroyAdminSession } from '@/lib/admin-session';
import { isSameOrigin } from '@/lib/same-origin';

export const dynamic = 'force-dynamic';

/**
 * POST /api/auth/logout
 *
 * «Выйти» = чистое устройство:
 *  • снимаем сессию;
 *  • ЦЕЛИКОМ забываем список аккаунтов устройства — иначе после выхода
 *    оставался бы подписанный артефакт, пригодный для переключения;
 *  • гасим админ-сессию (admin_token живёт отдельно, sliding-7-дней и раньше
 *    переживал логаут: на общем устройстве следующий человек открывал /admin).
 *
 * Пользователь после выхода входит по коду — и аккаунты снова накопятся.
 */
export async function POST(request: NextRequest) {
  // Логаут в publicRoutes, поэтому same-origin проверяем явно: иначе с нашего
  // же поддомена можно было бы принудительно разлогинить пользователя.
  if (!isSameOrigin(request, { allowMissingOrigin: true })) {
    return NextResponse.json({ error: 'Запрос отклонён' }, { status: 403 });
  }

  const response = NextResponse.json({ success: true });
  clearSessionCookie(response);
  clearAccountsCookie(response);
  clearAddIntentCookie(response); // «чистое устройство» — значит и без интент-тикета
  // На всякий случай чистим устаревшие cookie
  response.cookies.delete('telegramId');

  const adminToken = request.cookies.get(ADMIN_COOKIE_NAME)?.value;
  if (adminToken) {
    try {
      await destroyAdminSession(adminToken);
    } catch {
      // не блокируем выход, если запись уже удалена
    }
    response.cookies.set(ADMIN_COOKIE_NAME, '', {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 0,
    });
  }

  return response;
}
