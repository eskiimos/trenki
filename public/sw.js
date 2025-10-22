// Service Worker для PWA
const CACHE_NAME = 'trenki-v1';
const RUNTIME_CACHE = 'trenki-runtime-v1';
const VIDEO_CACHE_NAME = 'trenki-videos-v1';

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

  // Пропускаем API запросы к внешним сервисам (кроме видео)
  if (url.hostname.includes('telegram.org') ||
      url.hostname.includes('prisma-data.net')) {
    return;
  }

  // Для офлайн-видео используем Cache-First стратегию
  if (url.pathname.includes('/offline-videos') || 
      request.destination === 'video' ||
      url.pathname.match(/\.(mp4|webm|ogg)$/)) {
    event.respondWith(
      caches.open(VIDEO_CACHE_NAME).then((cache) => {
        return cache.match(request).then((cachedResponse) => {
          if (cachedResponse) {
            console.log('[SW] Serving video from cache:', request.url);
            return cachedResponse;
          }
          
          // Если нет в кэше - идем в сеть
          return fetch(request).then((response) => {
            // Не кэшируем видео автоматически (только через downloadVideo)
            return response;
          });
        });
      })
    );
    return;
  }

  // Для остальных запросов - Network First
  event.respondWith(
    fetch(request)
      .then((response) => {
        // Клонируем ответ для кэша
        const responseToCache = response.clone();
        
        // Кэшируем успешные ответы
        if (response.status === 200) {
          caches.open(RUNTIME_CACHE).then((cache) => {
            cache.put(request, responseToCache);
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
