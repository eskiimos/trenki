import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAdminAsync } from '@/lib/admin-session';
import { getGamificationSummary } from '@/lib/gamification-server';
import { logger } from '@/lib/logger';

/**
 * POST /api/admin/users/[id]/gamification/streak
 *
 * Накрутка стрика ДЛЯ ТЕСТЕРОВ: XP/уровень/стрик в БД не хранятся, а
 * деривируются из COMPLETED-сессий (см. '@/lib/gamification-server'). Поэтому
 * «собрать стрик» = засеять по одной синтетической COMPLETED-сессии на каждый
 * из последних `days` календарных дней (completedAt = локальный полдень).
 * Это даёт computeStreak=days и начисляет XP (с «Темпом ×2» с 3-го дня подряд).
 *
 * Идемпотентно: сначала сносим ВСЮ прежнюю синтетику юзера, затем сеем заново.
 * ВНИМАНИЕ: streak и level (соседний роут) оба чистят всю синтетику — они
 * взаимоисключающи, применяй по одному (это ок для теста).
 *
 * Body: { days: number } (clamp 1..60)
 */
export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const denied = await requireAdminAsync(request);
  if (denied) return denied;

  const { id } = await context.params;

  const body = await request.json().catch(() => null);
  if (!body || typeof body.days !== 'number' || !Number.isFinite(body.days)) {
    return NextResponse.json({ error: 'days должен быть числом' }, { status: 400 });
  }
  const days = Math.max(1, Math.min(60, Math.floor(body.days)));

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

  // Идемпотентность: сносим прежнюю накрутку целиком.
  const removed = await prisma.workoutSession.deleteMany({
    where: { userId: id, synthetic: true },
  });

  // По одной COMPLETED-сессии на день: today, today-1, …, today-(days-1),
  // completedAt = локальный полдень (устойчив к DST и к границам дня).
  const now = new Date();
  const data = Array.from({ length: days }, (_, i) => {
    const d = new Date(now);
    d.setDate(d.getDate() - i);
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
  await prisma.workoutSession.createMany({ data });

  logger.info('admin seeded synthetic streak for tester', {
    userId: id,
    days,
    removedPrevSynthetic: removed.count,
  });

  const summary = await getGamificationSummary(id);
  return NextResponse.json({ success: true, ...summary });
}
