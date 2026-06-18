import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAdminAsync } from '@/lib/admin-session';
import { logger } from '@/lib/logger';
import { AccessTier } from '@/generated/prisma';

/**
 * POST /api/admin/users/[id]/access
 *
 * Ручная выдача/снятие премиум-доступа из админки (фундамент под платежи).
 * Пока биллинга нет — это единственный способ дать PREMIUM (комп-аккаунты,
 * бета-тест, ручные продажи). Когда подключим T-Bank — те же поля будет
 * выставлять вебхук оплаты.
 *
 * Body: { tier: 'FREE' | 'PREMIUM', until?: string | null, note?: string }
 *  - until: ISO-дата окончания премиума (только для PREMIUM); пусто = бессрочно.
 *  - note:  пометка для аудита (кто/за что выдал).
 */
export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const denied = await requireAdminAsync(request);
  if (denied) return denied;

  const { id } = await context.params;
  const body = await request.json().catch(() => null);
  if (!body) return NextResponse.json({ error: 'Invalid body' }, { status: 400 });

  const tier = body.tier;
  if (tier !== 'FREE' && tier !== 'PREMIUM') {
    return NextResponse.json({ error: 'tier должен быть FREE или PREMIUM' }, { status: 400 });
  }

  let premiumUntil: Date | null = null;
  if (tier === 'PREMIUM' && body.until) {
    const d = new Date(body.until);
    if (isNaN(d.getTime())) {
      return NextResponse.json({ error: 'Некорректная дата until' }, { status: 400 });
    }
    premiumUntil = d;
  }
  const note =
    tier === 'PREMIUM' && typeof body.note === 'string' && body.note.trim()
      ? body.note.trim().slice(0, 200)
      : null;

  const target = await prisma.user.findUnique({ where: { id }, select: { id: true } });
  if (!target) {
    return NextResponse.json({ error: 'User not found' }, { status: 404 });
  }

  const updated = await prisma.user.update({
    where: { id },
    data: {
      accessTier: tier as AccessTier,
      // На FREE сбрасываем срок и пометку; на PREMIUM — заданный срок (или null = бессрочно).
      premiumUntil: tier === 'PREMIUM' ? premiumUntil : null,
      premiumNote: note,
    },
    select: { id: true, accessTier: true, premiumUntil: true, premiumNote: true },
  });

  logger.info('admin set user access', { userId: id, tier, until: premiumUntil?.toISOString() ?? null });

  return NextResponse.json({ success: true, user: updated });
}
