import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import webpush from 'web-push';
import { requireAdminAsync } from '@/lib/admin-session';

// POST - Отправка push-уведомления
export async function POST(request: NextRequest) {
  const denied = await requireAdminAsync(request);
  if (denied) return denied;
  try {
    const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
    const privateKey = process.env.VAPID_PRIVATE_KEY;
    const subject = process.env.VAPID_SUBJECT || 'mailto:admin@trenki-hockey.ru';

    if (!publicKey || !privateKey) {
      return NextResponse.json(
        { error: 'VAPID ключи не настроены на сервере. Добавьте VAPID_PRIVATE_KEY и NEXT_PUBLIC_VAPID_PUBLIC_KEY в .env.production' },
        { status: 500 }
      );
    }

    webpush.setVapidDetails(subject, publicKey, privateKey);
    const body = await request.json();
    const { title, body: messageBody, icon, url, userId } = body;

    if (!title || !messageBody) {
      return NextResponse.json(
        { error: 'Необходимо указать title и body' },
        { status: 400 }
      );
    }

    // Получаем все активные подписки
    const subscriptions = await prisma.pushSubscription.findMany({
      where: userId ? { userId } : {},
    });

    if (subscriptions.length === 0) {
      return NextResponse.json(
        { error: 'Нет активных подписок' },
        { status: 404 }
      );
    }

    // Данные для отправки
    const payload = JSON.stringify({
      title,
      body: messageBody,
      icon: icon || '/icons/icon-192.png',
      badge: '/icons/icon-192.png',
      url: url || '/',
    });

    // Отправляем уведомления всем подписчикам
    const results = await Promise.allSettled(
      subscriptions.map(async (sub: any) => {
        const pushSubscription = {
          endpoint: sub.endpoint,
          keys: {
            p256dh: sub.p256dh,
            auth: sub.auth,
          },
        };

        try {
          await webpush.sendNotification(pushSubscription, payload);
          return { success: true, endpoint: sub.endpoint };
        } catch (error: any) {
          console.error('Ошибка при отправке уведомления:', error);
          
          // Если подписка недействительна - удаляем её
          if (error.statusCode === 410 || error.statusCode === 404) {
            await prisma.pushSubscription.delete({
              where: { endpoint: sub.endpoint },
            });
          }
          
          return { success: false, endpoint: sub.endpoint };
        }
      })
    );

    // Подсчитываем успешные отправки
    const successCount = results.filter(
      (result: any) => result.status === 'fulfilled' && result.value.success
    ).length;

    // Сохраняем в историю отправленных уведомлений
    await prisma.pushNotification.create({
      data: {
        title,
        body: messageBody,
        icon: icon || '/icons/icon-192.png',
        url: url || '/',
        sentCount: successCount,
        sentBy: userId || 'admin',
      },
    });

    return NextResponse.json({
      success: true,
      message: `Уведомление отправлено ${successCount} из ${subscriptions.length} подписчикам`,
      sentCount: successCount,
      totalSubscriptions: subscriptions.length,
      results: results.map((r: any) =>
        r.status === 'fulfilled' ? r.value : { success: false }
      ),
    });

  } catch (error) {
    console.error('Ошибка при отправке push-уведомлений:', error);
    return NextResponse.json(
      { error: 'Ошибка сервера при отправке уведомлений' },
      { status: 500 }
    );
  }
}

// GET - Получение истории отправленных уведомлений
export async function GET() {
  try {
    const notifications = await prisma.pushNotification.findMany({
      orderBy: { createdAt: 'desc' },
      take: 50,
    });

    const subscriptionsCount = await prisma.pushSubscription.count();

    return NextResponse.json({
      notifications,
      subscriptionsCount,
    });

  } catch (error) {
    console.error('Ошибка при получении истории уведомлений:', error);
    return NextResponse.json(
      { error: 'Ошибка сервера' },
      { status: 500 }
    );
  }
}
