import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAuthUser } from '@/lib/coach/guards';
import { resolveUserPricing } from '@/lib/payments/user-pricing';

/**
 * GET /api/subscription/pricing/me[?childId=...] — персональная цена подписки
 * (промокод тренера + использованные интро-оплаты). Та же логика, что спишет
 * /api/payments/init: показанная цена всегда совпадает со списанной.
 *
 * childId — для родительского кабинета: цена РЕБЁНКА (init с childId списывает
 * именно её; промокод принадлежит атлету). Только свои привязанные дети.
 */
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const auth = await requireAuthUser(request);
  if ('response' in auth) return auth.response;

  const childId = request.nextUrl.searchParams.get('childId');
  let targetId = auth.user.id;
  if (childId) {
    const link = await prisma.parentLink.findUnique({
      where: { parentId_childId: { parentId: auth.user.id, childId } },
      select: { id: true },
    });
    if (!link) {
      return NextResponse.json({ error: 'Можно смотреть цену только своих детей' }, { status: 403 });
    }
    targetId = childId;
  }

  const pricing = await resolveUserPricing(targetId);
  return NextResponse.json(pricing);
}
