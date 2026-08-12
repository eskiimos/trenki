import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAdminAsync } from '@/lib/admin-session';
import { resetRateLimit } from '@/lib/coach/rate-limit';
import { logger } from '@/lib/logger';

/**
 * POST /api/admin/users/[id]/gamification/reset-limits
 *
 * Сброс дневных лимитов ДЛЯ ТЕСТЕРОВ: обнуляем счётчики в Profile
 * (trainingsToday/modulesToday/lastTrainingDate) и чистим in-memory окно
 * rate-limit генерации (gen-v3), чтобы тестировать без ожидания смены суток.
 */
export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const denied = await requireAdminAsync(request);
  if (denied) return denied;

  const { id } = await context.params;

  // Целевой юзер должен быть тест-аккаунтом — не трогаем реальных.
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

  // updateMany (а не update): не падаем 500, если у тест-аккаунта ещё нет профиля.
  const updated = await prisma.profile.updateMany({
    where: { userId: id },
    data: { trainingsToday: 0, modulesToday: 0, lastTrainingDate: null },
  });

  // Сброс суточного окна gen-v3 (ключ формируется как `gen-v3:${userId}`).
  resetRateLimit(`gen-v3:${id}`);

  logger.info('admin reset daily limits for tester', {
    userId: id,
    profilesUpdated: updated.count,
  });

  return NextResponse.json({ success: true });
}
