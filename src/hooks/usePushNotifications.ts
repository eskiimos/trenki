import { useState, useEffect } from 'react';

interface UsePushNotificationsReturn {
  isSupported: boolean;
  isSubscribed: boolean;
  isLoading: boolean;
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

export function usePushNotifications(): UsePushNotificationsReturn {
  const [isSupported, setIsSupported] = useState(false);
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Проверяем поддержку Push API и Service Worker
    const checkSupport = () => {
      const supported =
        'serviceWorker' in navigator &&
        'PushManager' in window &&
        'Notification' in window;
      
      setIsSupported(supported);
      
      if (!supported) {
        setIsLoading(false);
        return;
      }

      checkSubscription();
    };

    checkSupport();
  }, []);

  // Проверка текущей подписки
  const checkSubscription = async () => {
    try {
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.getSubscription();
      setIsSubscribed(!!subscription);
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
      const permission = await Notification.requestPermission();
      
      if (permission !== 'granted') {
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
    error,
    subscribe,
    unsubscribe,
  };
}
