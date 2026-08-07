// Сводка геймификации текущего пользователя: XP, уровень, статус-«эволюция»,
// стрик. Всё считается на лету из истории тренировок (XP в БД не хранится —
// см. src/lib/gamification.ts), поэтому роут только читает. Сбор данных —
// общий хелпер getGamificationSummary (переиспользуется родительским кабинетом).

import { NextRequest, NextResponse } from 'next/server';
import { requireAuthUser } from '@/lib/coach/guards';
import { getGamificationSummary } from '@/lib/gamification-server';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const auth = await requireAuthUser(request);
  if ('response' in auth) return auth.response;

  const summary = await getGamificationSummary(auth.user.id);
  return NextResponse.json(summary);
}
