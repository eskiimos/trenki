import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAdminAsync } from '@/lib/admin-session';
import { xpForLevel, XP_PER_COMPLETED_WORKOUT } from '@/lib/gamification';
import { getGamificationSummary } from '@/lib/gamification-server';
import { logger } from '@/lib/logger';

/**
 * POST /api/admin/users/[id]/gamification/level
 *
 * Накрутка уровня ДЛЯ ТЕСТЕРОВ: XP/уровень не хранятся, а деривируются из
 * COMPLETED-сессий. Чтобы поднять до уровня N, считаем нужный суммарный XP
 * (Σ xpForLevel(i), i=1..N-1) и сеем Math.ceil(needed/100) синтетических
 * COMPLETED-сессий (каждая без модулей = ровно +100 XP при ×1).
 *
 * Сессии датируем В ДАЛЁКОМ ПРОШЛОМ и на НЕсоседних днях (today-(60+i*3)), чтобы:
 *  - НЕ включить «Темп ×2» (нужны 3 подряд идущих дня — тут гэп в 3 дня);
 *  - НЕ повлиять на текущий стрик (>60 дней назад — не сегодня/вчера).
 *
 * Идемпотентно: сначала сносим ВСЮ прежнюю синтетику юзера.
 * ВНИМАНИЕ: level и streak (соседний роут) оба чистят всю синтетику — они
 * взаимоисключающи, применяй по одному (это ок для теста).
 *
 * Body: { level: number } (clamp 1..60)
 */
export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const denied = await requireAdminAsync(request);
  if (denied) return denied;

  const { id } = await context.params;

  const body = await request.json().catch(() => null);
  if (!body || typeof body.level !== 'number' || !Number.isFinite(body.level)) {
    return NextResponse.json({ error: 'level должен быть числом' }, { status: 400 });
  }
  const level = Math.max(1, Math.min(60, Math.floor(body.level)));

  // Целевой юзер должен быть тест-аккаунтом — накрутка НЕ портит реальных.
  const target = await prisma.user.findUnique({
    where: { id },
    select: { id: true, isTester: true, isAdmin: true },
  });
  if (!target) {
    return NextResponse.json({ error: 'User not found' }, { status: 404 });
  }
  if (!target.isTester && !target.isAdmin) {
    return NextResponse.json(
      { error: 'Накрутка только для тест-аккаунтов (isTester/isAdmin)' },
      { status: 400 },
    );
  }

  // Суммарный XP для перехода на уровень N = Σ стоимостей уровней 1..N-1.
  let neededXp = 0;
  for (let i = 1; i < level; i += 1) neededXp += xpForLevel(i);
  const sessionCount = Math.ceil(neededXp / XP_PER_COMPLETED_WORKOUT);

  // Идемпотентность: сносим прежнюю накрутку целиком.
  const removed = await prisma.workoutSession.deleteMany({
    where: { userId: id, synthetic: true },
  });

  const now = new Date();
  const data = Array.from({ length: sessionCount }, (_, i) => {
    // Далёкое прошлое + гэпы в 3 дня: ни темпа ×2, ни влияния на стрик.
    const d = new Date(now);
    d.setDate(d.getDate() - (60 + i * 3));
    d.setHours(12, 0, 0, 0);
    return {
      userId: id,
      status: 'COMPLETED' as const,
      synthetic: true,
      completedAt: d,
      startedAt: d,
      targetDuration: 0,
      targetRPE: 5,
      loadDirection: 'MEDIUM' as const,
      totalVideos: 0,
      currentVideoIndex: 0,
    };
  });
  if (data.length > 0) {
    await prisma.workoutSession.createMany({ data });
  }

  logger.info('admin seeded synthetic level for tester', {
    userId: id,
    level,
    sessionCount,
    neededXp,
    removedPrevSynthetic: removed.count,
  });

  const summary = await getGamificationSummary(id);
  return NextResponse.json({ success: true, ...summary });
}
