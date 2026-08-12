import { useState, useEffect } from 'react';

type PushPermission = NotificationPermission | 'default';

interface UsePushNotificationsReturn {
  isSupported: boolean;
  isSubscribed: boolean;
  isLoading: boolean;
  /** Текущее значение Notification.permission ('default' | 'granted' | 'denied'). */
  permission: PushPermission;
  error: string | null;
  subscribe: () => Promise<void>;
  unsubscribe: () => Promise<void>;
}

// Функция для преобразования base64 VAPID ключа в Uint8Array
function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding)
    .replace(/\-/g, '+')
    .replace(/_/g, '/');

  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);

  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray as Uint8Array;
}

// Идемпотентная (и молчаливая при ошибке) отправка существующей подписки на сервер.
// Нужна, чтобы восстановить строку в БД, потерянную из-за 410-прунинга или сброса
// базы: без ре-синка в UI горит «зелёный тумблер», а на сервере подписки нет.
async function resyncSubscription(subscription: PushSubscription): Promise<void> {
  try {
    await fetch('/api/push/subscribe', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        subscription: subscription.toJSON(),
        userAgent: navigator.userAgent,
      }),
    });
  } catch {
    // Молча — ре-синк не должен ломать UI.
  }
}

function readPermission(): PushPermission {
  if (typeof window === 'undefined' || !('Notification' in window)) return 'default';
  return Notification.permission;
}

export function usePushNotifications(): UsePushNotificationsReturn {
  const [isSupported, setIsSupported] = useState(false);
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [permission, setPermission] = useState<PushPermission>('default');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Проверяем поддержку Push API и Service Worker
    const checkSupport = () => {
      const supported =
        'serviceWorker' in navigator &&
        'PushManager' in window &&
        'Notification' in window;

      setIsSupported(supported);
      setPermission(readPermission());

      if (!supported) {
        setIsLoading(false);
        return;
      }

      checkSubscription();
    };

    checkSupport();
  }, []);

  // Проверка текущей подписки + ре-синк локальной подписки на сервер
  const checkSubscription = async () => {
    try {
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.getSubscription();
      setIsSubscribed(!!subscription);
      setPermission(readPermission());

      // Локальная подписка есть — всегда переотправляем её на сервер (идемпотентно,
      // молча). Так сверяем локальное состояние с БД и не оставляем «зелёный тумблер»
      // без строки на сервере.
      if (subscription) {
        void resyncSubscription(subscription);
      }
    } catch (err) {
      console.error('Ошибка при проверке подписки:', err);
      setError('Ошибка при проверке подписки');
    } finally {
      setIsLoading(false);
    }
  };

  // Подписка на push-уведомления
  const subscribe = async () => {
    if (!isSupported) {
      setError('Push-уведомления не поддерживаются');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      // Запрашиваем разрешение на уведомления
      const perm = await Notification.requestPermission();
      setPermission(perm);

      if (perm !== 'granted') {
        setError('Разрешение на уведомления не предоставлено');
        setIsLoading(false);
        return;
      }

      // VAPID public key — статичная env-переменная, не нужно дёргать сервер
      const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
      if (!publicKey) {
        throw new Error('NEXT_PUBLIC_VAPID_PUBLIC_KEY не настроен');
      }

      // Регистрируем Service Worker
      const registration = await navigator.serviceWorker.ready;

      // Подписываемся на push-уведомления
      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(publicKey) as unknown as BufferSource,
      });

      // Отправляем подписку на сервер
      const saveResponse = await fetch('/api/push/subscribe', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          subscription: subscription.toJSON(),
          userAgent: navigator.userAgent,
        }),
      });

      if (!saveResponse.ok) {
        throw new Error('Не удалось сохранить подписку на сервере');
      }

      setIsSubscribed(true);
      console.log('✅ Подписка на push-уведомления успешна');

    } catch (err: any) {
      console.error('Ошибка при подписке:', err);
      setError(err.message || 'Ошибка при подписке на уведомления');
    } finally {
      setIsLoading(false);
    }
  };

  // Отписка от push-уведомлений
  const unsubscribe = async () => {
    if (!isSupported) {
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.getSubscription();

      if (subscription) {
        // Отписываемся на клиенте
        await subscription.unsubscribe();

        // Удаляем подписку с сервера
        await fetch('/api/push/subscribe', {
          method: 'DELETE',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            endpoint: subscription.endpoint,
          }),
        });

        setIsSubscribed(false);
        console.log('✅ Отписка от push-уведомлений успешна');
      }
    } catch (err: any) {
      console.error('Ошибка при отписке:', err);
      setError(err.message || 'Ошибка при отписке от уведомлений');
    } finally {
      setIsLoading(false);
    }
  };

  return {
    isSupported,
    isSubscribed,
    isLoading,
    permission,
    error,
    subscribe,
    unsubscribe,
  };
}
