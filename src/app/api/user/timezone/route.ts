import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAuthUser } from '@/lib/coach/guards';

// POST /api/user/timezone { timezone: "Europe/Moscow" }
// Сохраняет IANA-таймзону устройства (Intl) на пользователе — для напоминаний в
// локальное время. Клиент шлёт при входе/загрузке, если значение изменилось.
export const dynamic = 'force-dynamic';

function isValidTimeZone(tz: string): boolean {
  if (!tz || tz.length > 64) return false;
  try {
    // бросит RangeError, если таймзона невалидна
    new Intl.DateTimeFormat('en-US', { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}

export async function POST(request: NextRequest) {
  const auth = await requireAuthUser(request);
  if ('response' in auth) return auth.response;

  const body = await request.json().catch(() => ({}));
  const tz = String(body?.timezone || '').trim();
  if (!isValidTimeZone(tz)) {
    return NextResponse.json({ error: 'Некорректная таймзона' }, { status: 400 });
  }

  await prisma.user.update({ where: { id: auth.user.id }, data: { timezone: tz } });
  return NextResponse.json({ ok: true, timezone: tz });
}
