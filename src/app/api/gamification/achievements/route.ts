// Ачивки текущего пользователя: считаются на лету из истории завершений
// (в БД ничего не хранится — ретроактивная модель, как XP/уровни).
// История — общий хелпер fetchCompletionHistory (та же выборка, что у summary),
// чистый расчёт — computeAchievements (tests/lib/achievements.test.ts).

import { NextRequest, NextResponse } from 'next/server';
import { requireAuthUser } from '@/lib/coach/guards';
import { fetchCompletionHistory } from '@/lib/gamification-server';
import { computeAchievements } from '@/lib/achievements';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const auth = await requireAuthUser(request);
  if ('response' in auth) return auth.response;

  const { workoutAts, moduleAts } = await fetchCompletionHistory(auth.user.id);
  const achievements = computeAchievements(workoutAts, moduleAts.length);
  const unlockedCount = achievements.filter((a) => a.unlocked).length;

  return NextResponse.json({ achievements, unlockedCount, total: achievements.length });
}
