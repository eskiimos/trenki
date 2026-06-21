import webpush from 'web-push';
import prisma from '@/lib/prisma';

interface PushNotificationPayload {
  title: string;
  body: string;
  url?: string;
  icon?: string;
}

let vapidConfigured = false;

function ensureVapid(): boolean {
  if (vapidConfigured) return true;
  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  const subject = process.env.VAPID_SUBJECT || 'mailto:admin@trenki-hockey.ru';
  if (!publicKey || !privateKey) return false;
  webpush.setVapidDetails(subject, publicKey, privateKey);
  vapidConfigured = true;
  return true;
}

/**
 * Отправляет push-уведомление конкретному пользователю (всем его активным подпискам).
 * Тихо игнорирует ошибки, чтобы не блокировать основной поток.
 */
export async function sendUserPush(
  userId: string,
  payload: PushNotificationPayload
): Promise<void> {
  if (!ensureVapid()) return;

  const subs = await prisma.pushSubscription.findMany({ where: { userId } });
  if (subs.length === 0) return;

  const body = JSON.stringify({
    title: payload.title,
    body: payload.body,
    icon: payload.icon ?? '/icons/icon-192.png',
    badge: '/icons/icon-192.png',
    url: payload.url ?? '/',
  });

  await Promise.allSettled(
    subs.map(async (sub) => {
      try {
        await webpush.sendNotification(
          { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
          body
        );
      } catch (err) {
        const code = (err as { statusCode?: number })?.statusCode;
        if (code === 404 || code === 410) {
          await prisma.pushSubscription.delete({ where: { endpoint: sub.endpoint } }).catch(() => { });
        }
      }
    })
  );
}

/**
 * Рассылает push сразу многим пользователям (по их активным подпискам) —
 * для «доступно новое видео». Чистит мёртвые подписки (404/410). Возвращает
 * примерный охват (сколько юзеров получили и сколько подписок задействовано).
 */
export async function broadcastPush(
  userIds: string[],
  payload: PushNotificationPayload
): Promise<{ recipients: number; subscriptions: number }> {
  if (!ensureVapid() || userIds.length === 0) return { recipients: 0, subscriptions: 0 };

  const subs = await prisma.pushSubscription.findMany({ where: { userId: { in: userIds } } });
  if (subs.length === 0) return { recipients: 0, subscriptions: 0 };

  const body = JSON.stringify({
    title: payload.title,
    body: payload.body,
    icon: payload.icon ?? '/icons/icon-192.png',
    badge: '/icons/icon-192.png',
    url: payload.url ?? '/',
  });

  await Promise.allSettled(
    subs.map(async (sub) => {
      try {
        await webpush.sendNotification(
          { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
          body
        );
      } catch (err) {
        const code = (err as { statusCode?: number })?.statusCode;
        if (code === 404 || code === 410) {
          await prisma.pushSubscription.delete({ where: { endpoint: sub.endpoint } }).catch(() => { });
        }
      }
    })
  );

  const recipients = new Set(subs.map((s) => s.userId).filter(Boolean)).size;
  return { recipients, subscriptions: subs.length };
}
