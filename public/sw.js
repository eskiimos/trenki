// Service Worker для PWA
const CACHE_NAME = 'trenki-v3';
const RUNTIME_CACHE = 'trenki-runtime-v3';
const VIDEO_CACHE_NAME = 'trenki-videos-v3';

// Реестр РЕАЛЬНО скачанных видео (ключи VIDEO_CACHE_NAME). Нужен, чтобы SW
// перехватывал только офлайн-ролики. Раньше перехватывались ВСЕ медиа-запросы:
// для нескачанного видео это гарантированный промах кэша + проксирование каждого
// byte-range запроса через SW — отсюда «долго грузит» и лишние ребуферы.
let downloadedVideoUrls = new Set();
// Промис-латч ленивой инициализации. Воркер усыпляется по простою и при
// пробуждении скрипт перевычисляется заново, а 'activate' повторно НЕ приходит —
// поэтому реестр надо уметь поднимать из кэша на первом же медиа-запросе,
// иначе скачанные ролики перестают играть офлайн.
let registryReady = null;

async function refreshDownloadedVideos() {
  try {
    const cache = await caches.open(VIDEO_CACHE_NAME);
    const keys = await cache.keys();
    downloadedVideoUrls = new Set(keys.map((r) => r.url));
  } catch (e) {
    downloadedVideoUrls = new Set();
  }
}

function ensureRegistry() {
  if (!registryReady) registryReady = refreshDownloadedVideos();
  return registryReady;
}

// Поднимаем реестр СРАЗУ при старте/пробуждении воркера. Проверка в fetch должна
// быть синхронной, поэтому реестр обязан наполниться как можно раньше: 'activate'
// приходит только один раз на версию SW, а воркер усыпляется по простою.
ensureRegistry();

// Страница сообщает о скачивании/удалении ролика, чтобы реестр не устаревал.
self.addEventListener('message', (event) => {
  const data = event.data || {};
  if (data.type === 'VIDEO_CACHED' && data.url) {
    // Реестр мог быть ещё не поднят — сначала инициализируем, потом добавляем.
    event.waitUntil(ensureRegistry().then(() => {
      downloadedVideoUrls.add(new URL(data.url, self.location.origin).href);
    }));
  } else if (data.type === 'VIDEO_REMOVED' && data.url) {
    event.waitUntil(ensureRegistry().then(() => {
      downloadedVideoUrls.delete(new URL(data.url, self.location.origin).href);
    }));
  } else if (data.type === 'VIDEOS_REFRESH') {
    registryReady = refreshDownloadedVideos();
    event.waitUntil(registryReady);
  }
});

// Ресурсы для кэширования при установке
const STATIC_CACHE_URLS = [
  '/',
  '/manifest.json',
  '/icons/icon-app.svg',
  '/icons/icon-192.png',
  '/icons/icon-512.png',
  '/offline-videos',
];

// Установка Service Worker
self.addEventListener('install', (event) => {
  console.log('[SW] Installing Service Worker...');
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log('[SW] Caching static assets');
      return cache.addAll(STATIC_CACHE_URLS);
    })
  );
  self.skipWaiting();
});

// Активация Service Worker
self.addEventListener('activate', (event) => {
  console.log('[SW] Activating Service Worker...');
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME && cacheName !== RUNTIME_CACHE && cacheName !== VIDEO_CACHE_NAME) {
            console.log('[SW] Deleting old cache:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => {
      registryReady = refreshDownloadedVideos(); // поднимаем реестр скачанных роликов
      return registryReady;
    })
  );
  self.clients.claim();
});

// Fetch - стратегия Network First с Fallback на Cache
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Пропускаем chrome-extension и не-http(s) запросы
  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    return;
  }

  // Cache.put поддерживает только GET — любые другие методы пропускаем
  // без вмешательства, иначе валится TypeError при попытке кешировать POST/PUT/DELETE
  if (request.method !== 'GET') {
    return;
  }

  // Пропускаем API запросы к внешним сервисам (кроме видео)
  if (url.hostname.includes('telegram.org') ||
      url.hostname.includes('prisma-data.net')) {
    return;
  }

  // Пропускаем внутренние API запросы - они должны идти напрямую без кэширования
  if (url.pathname.startsWith('/api/')) {
    return;
  }

  // Офлайн-видео: Cache-First ТОЛЬКО для реально скачанных роликов. Остальные
  // медиа-запросы не перехватываем вовсе — пусть идут нативным путём браузера
  // (быстрее, корректные range-запросы, меньше ребуферов).
  const isMediaRequest =
    request.destination === 'video' || url.pathname.match(/\.(mp4|webm|ogg)$/);

  if (isMediaRequest) {
    // КРИТИЧНО: решение о перехвате — СИНХРОННОЕ. Нельзя уходить в await и потом
    // отдавать fetch(request): переотправка range-запроса к CDN через SW ломает
    // воспроизведение (браузер ждёт 206, а получает переотправленный/opaque
    // ответ). Не наш офлайн-ролик — вообще не вмешиваемся, пусть играет нативно.
    if (!downloadedVideoUrls.has(url.href)) return;

    event.respondWith(
      caches.open(VIDEO_CACHE_NAME).then((cache) =>
        cache.match(request).then((cached) => cached || fetch(request)),
      ),
    );
    return;
  }

  // Для остальных запросов - Network First
  event.respondWith(
    fetch(request)
      .then((response) => {
        // Клонируем ответ для кэша
        const responseToCache = response.clone();
        
        // Кэшируем успешные ответы (только GET — отфильтровано выше)
        if (response.status === 200) {
          caches.open(RUNTIME_CACHE).then((cache) => {
            cache.put(request, responseToCache).catch(() => {});
          });
        }
        
        return response;
      })
      .catch(() => {
        // При ошибке сети пытаемся взять из кэша
        return caches.match(request).then((cachedResponse) => {
          if (cachedResponse) {
            console.log('[SW] Serving from cache:', request.url);
            return cachedResponse;
          }
          
          // Если это HTML страница и нет связи - редирект на офлайн-видео
          if (request.headers.get('accept') && request.headers.get('accept').includes('text/html')) {
            return caches.match('/offline-videos').then((offlinePage) => {
              return offlinePage || caches.match('/');
            });
          }
          
          return new Response('Offline', {
            status: 503,
            statusText: 'Service Unavailable',
          });
        });
      })
  );
});

// Push уведомления
self.addEventListener('push', (event) => {
  console.log('[SW] Push notification received');
  
  let notificationData = {
    title: 'Треньки',
    body: 'Новое уведомление',
    icon: '/icons/icon-192.png',
    badge: '/icons/icon-192.png',
    url: '/',
  };
  
  // Парсим данные из push-уведомления
  if (event.data) {
    try {
      const data = event.data.json();
      notificationData = {
        title: data.title || notificationData.title,
        body: data.body || notificationData.body,
        icon: data.icon || notificationData.icon,
        badge: data.badge || notificationData.badge,
        url: data.url || notificationData.url,
      };
    } catch (e) {
      console.error('[SW] Error parsing push data:', e);
    }
  }
  
  const options = {
    body: notificationData.body,
    icon: notificationData.icon,
    badge: notificationData.badge,
    vibrate: [200, 100, 200],
    tag: 'trenki-notification',
    requireInteraction: false,
    data: {
      url: notificationData.url,
    },
  };

  event.waitUntil(
    self.registration.showNotification(notificationData.title, options)
  );
});

// Преобразование base64url VAPID-ключа в Uint8Array (копия логики из
// usePushNotifications.ts — в SW нет доступа к модулям приложения).
function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/\-/g, '+').replace(/_/g, '/');
  const rawData = atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

// Пересоздание push-подписки. Браузер может ротировать endpoint (событие
// pushsubscriptionchange) — без переподписки уведомления молча перестают приходить.
// Ключ берём с сервера (в SW нет сборочных env Next), затем сохраняем новую подписку.
async function resubscribe() {
  try {
    const res = await fetch('/api/push/vapid');
    if (!res.ok) return;
    const { key } = await res.json();
    if (!key) return;

    const subscription = await self.registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(key),
    });

    await fetch('/api/push/subscribe', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        subscription: subscription.toJSON(),
        userAgent: self.navigator ? self.navigator.userAgent : undefined,
      }),
    });
  } catch (e) {
    console.error('[SW] resubscribe failed:', e);
  }
}

// Браузер ротировал endpoint — переподписываемся и досылаем новую подписку на сервер.
self.addEventListener('pushsubscriptionchange', (event) => {
  event.waitUntil(resubscribe());
});

// Обработка клика по уведомлению
self.addEventListener('notificationclick', (event) => {
  console.log('[SW] Notification clicked');
  event.notification.close();
  
  const urlToOpen = event.notification.data?.url || '/';
  
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true })
      .then((clientList) => {
        // Если есть открытое окно - фокусируемся на нём и переходим по URL
        for (const client of clientList) {
          if (client.url === urlToOpen && 'focus' in client) {
            return client.focus();
          }
        }
        // Если нет - открываем новое окно
        if (clients.openWindow) {
          return clients.openWindow(urlToOpen);
        }
      })
  );
});
