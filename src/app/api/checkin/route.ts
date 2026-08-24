import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAuthUser } from '@/lib/coach/guards';
import { CHECKIN_XP_BY_WEEKDAY, checkinXpForDate } from '@/lib/gamification';

/**
 * Ежедневный чекин (правки «Конец августа»).
 *
 *  GET  — состояние текущей недели для карточки на главной:
 *         { week: [{ date, weekday, xp, checked, isToday }], todayXp, checkedToday }
 *  POST — отметиться сегодня: { xpEarned, alreadyChecked }
 *
 * «Сегодня» считается по User.timezone (фолбэк Europe/Moscow) НА СЕРВЕРЕ —
 * дату с клиента не принимаем (античит: подкрученные часы позволяли бы
 * закрывать субботние +50 в любой день). Лимит 1/день — unique(userId, date).
 * Чекин НЕ даёт день серии и НЕ умножается «Темпом ×2» (решение владельца).
 */
export const dynamic = 'force-dynamic';

/** Локальная календарная дата юзера как UTC-полночь (формат хранения @db.Date). */
function localDateUtc(tz: string, now = new Date()): Date {
  let s: string;
  try {
    s = new Intl.DateTimeFormat('en-CA', { timeZone: tz }).format(now); // YYYY-MM-DD
  } catch {
    s = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Moscow' }).format(now);
  }
  const [y, m, d] = s.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}

async function userTz(userId: string): Promise<string> {
  const u = await prisma.user.findUnique({ where: { id: userId }, select: { timezone: true } });
  return u?.timezone || 'Europe/Moscow';
}

export async function GET(request: NextRequest) {
  try {
    const auth = await requireAuthUser(request);
    if ('response' in auth) return auth.response;

    const tz = await userTz(auth.user.id);
    const today = localDateUtc(tz);
    const DAY_MS = 24 * 60 * 60 * 1000;
    // Понедельник текущей недели (getUTCDay: Пн=1)
    const monday = new Date(today.getTime() - ((today.getUTCDay() + 6) % 7) * DAY_MS);
    const weekEnd = new Date(monday.getTime() + 7 * DAY_MS);

    const checkins = await prisma.dailyCheckin.findMany({
      where: { userId: auth.user.id, date: { gte: monday, lt: weekEnd } },
      select: { date: true },
    });
    const checkedDays = new Set(checkins.map((c) => c.date.getTime()));

    const week = Array.from({ length: 7 }, (_, i) => {
      const date = new Date(monday.getTime() + i * DAY_MS);
      return {
        date: date.toISOString().slice(0, 10),
        weekday: date.getUTCDay(),
        xp: CHECKIN_XP_BY_WEEKDAY[date.getUTCDay()],
        checked: checkedDays.has(date.getTime()),
        isToday: date.getTime() === today.getTime(),
      };
    });

    return NextResponse.json({
      week,
      todayXp: checkinXpForDate(today),
      checkedToday: checkedDays.has(today.getTime()),
    });
  } catch (error) {
    console.error('Ошибка checkin GET:', error);
    return NextResponse.json({ error: 'Ошибка сервера' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const auth = await requireAuthUser(request);
    if ('response' in auth) return auth.response;

    const tz = await userTz(auth.user.id);
    const today = localDateUtc(tz);
    const xpEarned = checkinXpForDate(today);

    // date в ответе — серверная: клиент помечает ячейку недели по ней, а не по
    // своему «сегодня» (открытая через полночь PWA иначе красила вчерашний день)
    const dateStr = today.toISOString().slice(0, 10);
    try {
      await prisma.dailyCheckin.create({
        data: { userId: auth.user.id, date: today },
      });
    } catch (e: unknown) {
      if (e && typeof e === 'object' && (e as { code?: string }).code === 'P2002') {
        return NextResponse.json({ xpEarned: 0, alreadyChecked: true, date: dateStr });
      }
      throw e;
    }

    return NextResponse.json({ xpEarned, alreadyChecked: false, date: dateStr });
  } catch (error) {
    console.error('Ошибка checkin POST:', error);
    return NextResponse.json({ error: 'Ошибка сервера' }, { status: 500 });
  }
}
