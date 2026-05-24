import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSessionUserId } from '@/lib/auth-server';

// POST - Сохранение подписки на push-уведомления
export async function POST(request: NextRequest) {
  try {
    const userId = await getSessionUserId(request);
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { subscription, userAgent } = body;

    if (!subscription || !subscription.endpoint || !subscription.keys?.p256dh || !subscription.keys?.auth) {
      return NextResponse.json({ error: 'Некорректные данные подписки' }, { status: 400 });
    }

    const existingSubscription = await prisma.pushSubscription.findUnique({
      where: { endpoint: subscription.endpoint },
    });

    if (existingSubscription) {
      // Подписка с таким endpoint уже есть — проверим, чьё это устройство.
      if (existingSubscription.userId && existingSubscription.userId !== userId) {
        return NextResponse.json(
          { error: 'Эта подписка принадлежит другому пользователю' },
          { status: 403 },
        );
      }
      const updated = await prisma.pushSubscription.update({
        where: { endpoint: subscription.endpoint },
        data: {
          userId,
          p256dh: subscription.keys.p256dh,
          auth: subscription.keys.auth,
          userAgent: userAgent || null,
          updatedAt: new Date(),
        },
      });
      return NextResponse.json({ success: true, message: 'Подписка обновлена', subscription: updated });
    }

    const newSubscription = await prisma.pushSubscription.create({
      data: {
        userId,
        endpoint: subscription.endpoint,
        p256dh: subscription.keys.p256dh,
        auth: subscription.keys.auth,
        userAgent: userAgent || null,
      },
    });

    return NextResponse.json({ success: true, message: 'Подписка создана', subscription: newSubscription });
  } catch (error) {
    console.error('Ошибка при сохранении подписки:', error);
    return NextResponse.json({ error: 'Ошибка сервера при сохранении подписки' }, { status: 500 });
  }
}

// DELETE - Удаление своей подписки
export async function DELETE(request: NextRequest) {
  try {
    const userId = await getSessionUserId(request);
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { endpoint } = body;

    if (!endpoint) {
      return NextResponse.json({ error: 'Не указан endpoint' }, { status: 400 });
    }

    const sub = await prisma.pushSubscription.findUnique({ where: { endpoint } });
    if (!sub) {
      return NextResponse.json({ success: true, message: 'Подписка уже удалена' });
    }
    if (sub.userId && sub.userId !== userId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    await prisma.pushSubscription.delete({ where: { endpoint } });
    return NextResponse.json({ success: true, message: 'Подписка удалена' });
  } catch (error) {
    console.error('Ошибка при удалении подписки:', error);
    return NextResponse.json({ error: 'Ошибка сервера при удалении подписки' }, { status: 500 });
  }
}

// GET - Получение публичного VAPID ключа
export async function GET() {
  const vapidPublicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  if (!vapidPublicKey) {
    return NextResponse.json({ error: 'VAPID ключ не настроен' }, { status: 500 });
  }
  return NextResponse.json({ publicKey: vapidPublicKey });
}
