import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAdminAsync } from '@/lib/admin-session';
import { logger } from '@/lib/logger';

/**
 * POST /api/admin/users/[id]/referral
 * Body: { referralCode: string | null }
 *
 * Привязывает уже зарегистрированного пользователя к реф-каналу задним числом
 * (ручная атрибуция). Принимает канонический code ИЛИ алиас (в т.ч. кириллицу) —
 * резолвит в канонический code, как verify-code, чтобы юзер попал в статистику
 * канала (она матчит по User.referralCode == ReferralCode.code). Пустая строка —
 * снять привязку (null). Только админ.
 */
export async function POST(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const denied = await requireAdminAsync(request);
  if (denied) return denied;

  const { id } = await context.params;
  const target = await prisma.user.findUnique({ where: { id }, select: { id: true } });
  if (!target) return NextResponse.json({ error: 'User not found' }, { status: 404 });

  const body = await request.json().catch(() => null);
  const raw = (body?.referralCode ?? '').toString().trim();

  let canonical: string | null = null;
  let label: string | null = null;

  if (raw !== '') {
    const rc = await prisma.referralCode.findFirst({
      where: {
        OR: [
          { code: { equals: raw, mode: 'insensitive' } },
          { aliases: { has: raw.toLowerCase() } },
        ],
      },
      select: { code: true, label: true },
    });
    if (!rc) {
      return NextResponse.json({ error: 'Реф-код не найден' }, { status: 400 });
    }
    canonical = rc.code;
    label = rc.label;
  }

  await prisma.user.update({ where: { id }, data: { referralCode: canonical } });
  logger.info('admin set user referralCode', { userId: id, referralCode: canonical });

  return NextResponse.json({ success: true, referralCode: canonical, label });
}
