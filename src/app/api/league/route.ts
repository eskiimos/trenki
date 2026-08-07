// Лига для самого спортсмена: своя недельная таблица когорты по году
// рождения (профиль, секция «Лига»). Сборка — общий хелпер
// '@/lib/league-server' (тот же, что у /api/parent/league).

import { NextRequest, NextResponse } from 'next/server';
import { requireAuthUser } from '@/lib/coach/guards';
import { buildLeagueForUser } from '@/lib/league-server';
import { logger } from '@/lib/logger';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const auth = await requireAuthUser(request);
  if ('response' in auth) return auth.response;

  try {
    return NextResponse.json(await buildLeagueForUser(auth.user.id));
  } catch (error) {
    logger.error('league fetch failed', error);
    return NextResponse.json({ error: 'Внутренняя ошибка сервера' }, { status: 500 });
  }
}
