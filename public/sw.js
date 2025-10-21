// Service Worker для PWA
const CACHE_NAME = 'trenki-v1';
const RUNTIME_CACHE = 'trenki-runtime-v1';

// Ресурсы для кэширования при установке
const STATIC_CACHE_URLS = [
  '/',
  '/manifest.json',
  '/icons/icon-app.svg',
  '/icons/icon-192.png',
  '/icons/icon-512.png',
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
          if (cacheName !== CACHE_NAME && cacheName !== RUNTIME_CACHE) {
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

  // Пропускаем API запросы к внешним сервисам
  if (url.hostname.includes('kinescope') || 
      url.hostname.includes('telegram.org') ||
      url.hostname.includes('prisma-data.net')) {
    return;
  }

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
          
          // Если это HTML страница, показываем offline страницу
          if (request.headers.get('accept').includes('text/html')) {
            return caches.match('/');
          }
          
          return new Response('Offline', {
            status: 503,
            statusText: 'Service Unavailable',
          });
        });
      })
  );
});

// Push уведомления (опционально)
self.addEventListener('push', (event) => {
  const options = {
    body: event.data ? event.data.text() : 'Новое уведомление',
    icon: '/icons/icon-192.png',
    badge: '/icons/icon-192.png',
    vibrate: [200, 100, 200],
    tag: 'trenki-notification',
    requireInteraction: false,
  };

  event.waitUntil(
    self.registration.showNotification('Треньки', options)
  );
});

// Обработка клика по уведомлению
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil(
    clients.openWindow('/')
  );
});
