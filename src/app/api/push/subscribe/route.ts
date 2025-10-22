import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

// POST - Сохранение подписки на push-уведомления
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { subscription, userId, userAgent } = body;

    if (!subscription || !subscription.endpoint) {
      return NextResponse.json(
        { error: 'Некорректные данные подписки' },
        { status: 400 }
      );
    }

    // Проверяем, есть ли уже такая подписка
    const existingSubscription = await prisma.pushSubscription.findUnique({
      where: { endpoint: subscription.endpoint },
    });

    if (existingSubscription) {
      // Обновляем существующую подписку
      const updated = await prisma.pushSubscription.update({
        where: { endpoint: subscription.endpoint },
        data: {
          userId: userId || null,
          p256dh: subscription.keys.p256dh,
          auth: subscription.keys.auth,
          userAgent: userAgent || null,
          updatedAt: new Date(),
        },
      });

      return NextResponse.json({ 
        success: true, 
        message: 'Подписка обновлена',
        subscription: updated 
      });
    }

    // Создаём новую подписку
    const newSubscription = await prisma.pushSubscription.create({
      data: {
        userId: userId || null,
        endpoint: subscription.endpoint,
        p256dh: subscription.keys.p256dh,
        auth: subscription.keys.auth,
        userAgent: userAgent || null,
      },
    });

    return NextResponse.json({ 
      success: true, 
      message: 'Подписка создана',
      subscription: newSubscription 
    });

  } catch (error) {
    console.error('Ошибка при сохранении подписки:', error);
    return NextResponse.json(
      { error: 'Ошибка сервера при сохранении подписки' },
      { status: 500 }
    );
  }
}

// DELETE - Удаление подписки
export async function DELETE(request: NextRequest) {
  try {
    const body = await request.json();
    const { endpoint } = body;

    if (!endpoint) {
      return NextResponse.json(
        { error: 'Не указан endpoint' },
        { status: 400 }
      );
    }

    await prisma.pushSubscription.delete({
      where: { endpoint },
    });

    return NextResponse.json({ 
      success: true, 
      message: 'Подписка удалена' 
    });

  } catch (error) {
    console.error('Ошибка при удалении подписки:', error);
    return NextResponse.json(
      { error: 'Ошибка сервера при удалении подписки' },
      { status: 500 }
    );
  }
}

// GET - Получение публичного VAPID ключа
export async function GET() {
  const vapidPublicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  
  if (!vapidPublicKey) {
    return NextResponse.json(
      { error: 'VAPID ключ не настроен' },
      { status: 500 }
    );
  }

  return NextResponse.json({ 
    publicKey: vapidPublicKey 
  });
}
