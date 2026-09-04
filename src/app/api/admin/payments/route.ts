import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAdminAsync } from '@/lib/admin-session';
import { logger } from '@/lib/logger';

// GET /api/admin/payments — последние платежи (обе кассы) для страницы
// /admin/payments: статус, сумма, кто, выдан ли премиум, был ли возврат.
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const denied = await requireAdminAsync(request);
  if (denied) return denied;
  try {
    const { searchParams } = new URL(request.url);
    const limitRaw = Number(searchParams.get('limit'));
    const limit = Number.isInteger(limitRaw) && limitRaw > 0 ? Math.min(limitRaw, 500) : 100;
    const payments = await prisma.payment.findMany({
      orderBy: { createdAt: 'desc' },
      take: limit,
      select: {
        id: true,
        orderId: true,
        paymentId: true,
        status: true,
        kind: true,
        amountKopecks: true,
        isTest: true,
        errorCode: true,
        premiumGrantedAt: true,
        refundedAt: true,
        refundAmountKopecks: true,
        createdAt: true,
        updatedAt: true,
        user: { select: { id: true, email: true, firstName: true, lastName: true } },
      },
    });
    return NextResponse.json({ payments });
  } catch (error) {
    logger.error('admin/payments GET failed', error);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
