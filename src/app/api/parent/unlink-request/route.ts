// Запрос ребёнка на отвязку родителя. Ребёнок НЕ может разорвать связь сам —
// только попросить: связь рвётся после подтверждения родителем в кабинете
// (POST /api/parent/unlink, action: 'confirm').
//   POST   {linkId} — поставить запрос (идемпотентно) + письмо родителю;
//   DELETE ?linkId= — отменить свой ожидающий запрос.

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAuthUser } from '@/lib/coach/guards';
import { sendEmail, getUnlinkRequestEmailTemplate } from '@/lib/email';
import { logger } from '@/lib/logger';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  const auth = await requireAuthUser(request);
  if ('response' in auth) return auth.response;
  const user = auth.user;

  const body = await request.json().catch(() => ({}));
  const linkId = typeof body.linkId === 'string' ? body.linkId : '';
  if (!linkId) {
    return NextResponse.json({ error: 'linkId обязателен' }, { status: 400 });
  }

  try {
    // childId=я: чужую связь запросить нельзя (не IDOR).
    const link = await prisma.parentLink.findFirst({
      where: { id: linkId, childId: user.id },
      select: {
        id: true,
        unlinkRequestedAt: true,
        parent: { select: { email: true } },
      },
    });
    if (!link) {
      return NextResponse.json({ error: 'Связь не найдена' }, { status: 404 });
    }

    // Идемпотентно: повторный запрос не двигает дату и не спамит родителя.
    if (link.unlinkRequestedAt) {
      return NextResponse.json({ success: true, unlinkRequestedAt: link.unlinkRequestedAt });
    }

    const unlinkRequestedAt = new Date();
    await prisma.parentLink.update({
      where: { id: link.id },
      data: { unlinkRequestedAt },
    });

    // Письмо родителю — best effort: сбой почты не роняет запрос.
    if (link.parent.email) {
      const childName =
        [user.firstName, user.lastName].filter(Boolean).join(' ') || 'Ваш ребёнок';
      const result = await sendEmail({
        to: link.parent.email,
        subject: `${childName} просит отвязать вас в Треньках`,
        html: getUnlinkRequestEmailTemplate(childName),
      });
      if (!result.success) {
        logger.warn('unlink request email failed', { userId: user.id, linkId });
      }
    } else {
      logger.warn('unlink request: parent has no email', { userId: user.id, linkId });
    }

    logger.info('unlink requested by child', { userId: user.id, linkId });
    return NextResponse.json({ success: true, unlinkRequestedAt });
  } catch (error) {
    logger.error('unlink request failed', error);
    return NextResponse.json({ error: 'Внутренняя ошибка сервера' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  const auth = await requireAuthUser(request);
  if ('response' in auth) return auth.response;
  const userId = auth.user.id;

  const linkId = request.nextUrl.searchParams.get('linkId');
  if (!linkId) {
    return NextResponse.json({ error: 'linkId обязателен' }, { status: 400 });
  }

  try {
    // updateMany с childId=я: чужой запрос отменить нельзя.
    const result = await prisma.parentLink.updateMany({
      where: { id: linkId, childId: userId, unlinkRequestedAt: { not: null } },
      data: { unlinkRequestedAt: null },
    });
    if (result.count === 0) {
      return NextResponse.json({ error: 'Запрос не найден' }, { status: 404 });
    }
    logger.info('unlink request cancelled by child', { userId, linkId });
    return NextResponse.json({ success: true });
  } catch (error) {
    logger.error('unlink request cancel failed', error);
    return NextResponse.json({ error: 'Внутренняя ошибка сервера' }, { status: 500 });
  }
}
