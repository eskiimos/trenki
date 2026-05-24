# 📱 Офлайн-режим для видео

## Описание

Реализован полноценный офлайн-режим с возможностью скачивания видео и просмотра их без интернета.

## 🎯 Возможности

### Для пользователей:
- ✅ **Скачивание видео** - кнопка "Скачать" на странице каждого видео
- ✅ **Офлайн-просмотр** - скачанные видео доступны без интернета
- ✅ **Список скачанных** - отдельная страница `/offline-videos` со всеми скачанными видео
- ✅ **Автоматический редирект** - при потере интернета автоматически переходит на страницу офлайн-видео
- ✅ **Индикация статуса** - визуальные индикаторы скачанных видео
- ✅ **Управление хранилищем** - просмотр использованного места и удаление видео
- ✅ **Прогресс скачивания** - отображение процента скачивания в реальном времени

### Технические особенности:
- 📦 **Cache API** - надежное кэширование видео файлов
- 🗄️ **IndexedDB** - хранение метаданных о видео
- ⚙️ **Service Worker** - перехват запросов и отдача кэшированного контента
- 📊 **Storage API** - контроль квоты и использованного места
- 🔄 **Offline First** - приложение работает даже без интернета

## 🏗️ Архитектура

### Компоненты

#### 1. **OfflineVideos Library** (`src/lib/offlineVideos.ts`)
Основная библиотека для управления офлайн-видео:

```typescript
// Проверка статуса
isVideoDownloaded(videoId: string): Promise<boolean>

// Скачивание
downloadVideo(video: OfflineVideo, onProgress?: (progress: number) => void): Promise<void>

// Удаление
deleteVideo(videoId: string): Promise<void>

// Получение списка
getAllOfflineVideos(): Promise<OfflineVideo[]>

// Получение одного видео
getOfflineVideo(videoId: string): Promise<OfflineVideo | null>

// Проверка квоты
checkStorageQuota(): Promise<{ used: number; available: number; percentage: number }>

// Очистка старых видео
clearOldVideos(keepCount: number = 10): Promise<void>
```

#### 2. **Service Worker** (`public/sw.js`)
Обновлен для поддержки офлайн-видео:
- Кэш видео: `trenki-videos-v1`
- Cache-First стратегия для видео
- Автоматический редирект на `/offline-videos` при отсутствии интернета

#### 3. **Offline Videos Page** (`src/app/offline-videos/page.tsx`)
Страница со списком скачанных видео:
- Отображение всех скачанных видео
- Информация о хранилище
- Удаление видео
- Индикация онлайн/офлайн статуса

#### 4. **Offline Handler** (`src/components/OfflineHandler.tsx`)
Глобальный компонент для обработки офлайн-режима:
- Отслеживание состояния интернета
- Автоматический редирект на офлайн-страницу
- Уведомления о статусе подключения

#### 5. **Video Page Updates** (`src/app/video/[id]/page.tsx`)
Добавлен функционал скачивания:
- Кнопка "Скачать" с индикацией статуса
- Прогресс-бар скачивания
- Проверка уже скачанных видео

## 📋 Использование

### Скачивание видео

1. Откройте любое видео
2. Нажмите кнопку "Скачать"
3. Дождитесь завершения скачивания
4. Видео доступно в разделе "Офлайн-видео"

### Просмотр офлайн-видео

**Способ 1: Через главную страницу**
- Нажмите кнопку со стрелкой вниз в шапке
- Откроется список всех скачанных видео

**Способ 2: Автоматически при отсутствии интернета**
- При потере интернета приложение автоматически покажет офлайн-видео
- Вы увидите список доступных для просмотра видео

**Способ 3: Прямой переход**
- Перейдите по адресу `/offline-videos`

### Удаление видео

1. Откройте страницу офлайн-видео
2. Нажмите кнопку корзины у нужного видео
3. Подтвердите удаление

Или:

1. Откройте страницу видео
2. Нажмите кнопку "Скачано"
3. Подтвердите удаление

## 🔧 Технические детали

### IndexedDB Schema

**База данных:** `TrenkiOfflineVideos`
**Object Store:** `videos`

```typescript
interface OfflineVideo {
  id: string;              // Primary Key
  title: string;
  description?: string;
  duration: number;
  thumbnail?: string;
  videoUrl: string;
  category: string;
  difficulty: string;
  trainerId?: string;
  trainer?: {
    name: string;
    lastName: string;
    avatar?: string;
  };
  downloadedAt: number;    // Timestamp, Index
  size?: number;           // Размер в байтах
}
```

### Cache API

**Cache Name:** `trenki-videos-v1`

Хранит:
- Видео файлы (MP4, WebM, OGG)
- Thumbnails (превью)
- Метаданные (через IndexedDB)

### Storage Quota

Типичные квоты браузеров:
- **Chrome/Edge:** ~60% от свободного места на диске
- **Firefox:** ~50% от свободного места на диске
- **Safari:** ~1GB (может запросить больше)

## ⚠️ Ограничения

### Размер видео
- Рекомендуется скачивать видео до 100 МБ
- Для больших видео требуется подтверждение квоты

### Браузеры
- ✅ Chrome/Edge 40+
- ✅ Firefox 44+
- ✅ Safari 11.1+
- ⚠️ iOS Safari (ограничения квоты)

### Telegram WebApp
- Работает в встроенном браузере Telegram
- Может иметь дополнительные ограничения
- Рекомендуется тестировать на целевой платформе

## 🐛 Решение проблем

### Видео не скачивается

1. **Проверьте квоту:**
```typescript
const quota = await checkStorageQuota();
console.log('Available:', formatFileSize(quota.available));
```

2. **Очистите кэш:**
```typescript
await clearOldVideos(5); // Оставить только 5 видео
```

3. **Проверьте поддержку:**
```javascript
if ('serviceWorker' in navigator && 'caches' in window) {
  // Поддерживается
}
```

### Видео не воспроизводится офлайн

1. **Проверьте Service Worker:**
```javascript
navigator.serviceWorker.getRegistration().then(reg => {
  console.log('SW:', reg?.active?.state);
});
```

2. **Проверьте кэш:**
```javascript
const cache = await caches.open('trenki-videos-v1');
const keys = await cache.keys();
console.log('Cached URLs:', keys.map(k => k.url));
```

### Переполнение хранилища

Автоматическая очистка:
```typescript
// При достижении 80% квоты
if (quota.percentage > 80) {
  await clearOldVideos(10); // Удалить старые, оставить 10
}
```

## 📊 Мониторинг

### Логи в консоли

```
[OfflineVideos] Starting download: Название видео
[OfflineVideos] Download completed: Название видео
[OfflineVideos] Deleting video: video-id
[OfflineVideos] Video deleted: video-id
[SW] Serving video from cache: video-url
[OfflineHandler] Connection lost
[OfflineHandler] Redirecting to offline videos
```

### Chrome DevTools

1. **Application → Storage**
   - IndexedDB: `TrenkiOfflineVideos`
   - Cache Storage: `trenki-videos-v1`

2. **Application → Service Workers**
   - Статус: Active
   - Версия: trenki-videos-v1

3. **Network → Offline**
   - Эмуляция офлайн-режима для тестирования

## 🚀 Будущие улучшения

- [ ] Фоновое скачивание (Background Sync API)
- [ ] Скачивание плейлистов
- [ ] Умная очистка (по частоте просмотров)
- [ ] Предзагрузка популярных видео
- [ ] Синхронизация между устройствами
- [ ] Сжатие видео перед скачиванием
- [ ] Поддержка разных качеств видео

## 📝 API Reference

### downloadVideo()

```typescript
await downloadVideo(
  {
    id: 'video-id',
    title: 'Название',
    videoUrl: 'https://...',
    // ... другие поля
  },
  (progress) => {
    console.log(`Downloaded: ${progress}%`);
  }
);
```

### isVideoDownloaded()

```typescript
const isDownloaded = await isVideoDownloaded('video-id');
```

### getAllOfflineVideos()

```typescript
const videos = await getAllOfflineVideos();
// Sorted by downloadedAt DESC
```

### checkStorageQuota()

```typescript
const { used, available, percentage } = await checkStorageQuota();
console.log(`Used: ${used / 1024 / 1024} MB`);
console.log(`Available: ${available / 1024 / 1024} MB`);
console.log(`Percentage: ${percentage}%`);
```

## 🧪 Тестирование

### Эмуляция офлайн-режима

**Chrome DevTools:**
1. F12 → Network
2. Online → Offline
3. Перезагрузить страницу

**Программно:**
```javascript
window.dispatchEvent(new Event('offline'));
```

### Проверка кэша

```javascript
// Получить все кэшированные видео
const cache = await caches.open('trenki-videos-v1');
const requests = await cache.keys();
console.log('Cached videos:', requests.length);
```

### Очистка для тестирования

```javascript
// Удалить все офлайн-данные
await caches.delete('trenki-videos-v1');
indexedDB.deleteDatabase('TrenkiOfflineVideos');
```

## 📞 Поддержка

При возникновении проблем:
1. Проверьте консоль браузера на наличие ошибок
2. Убедитесь, что Service Worker активен
3. Проверьте квоту хранилища
4. Попробуйте очистить кэш и скачать заново

---

**Версия:** 1.0.0  
**Дата:** 22 октября 2025  
**Автор:** Trenki Development Team
