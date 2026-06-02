// Библиотека для управления офлайн-видео

const DB_NAME = 'TrenkiOfflineVideos';
const DB_VERSION = 1;
const STORE_NAME = 'videos';
// ВАЖНО: должно совпадать с VIDEO_CACHE_NAME в public/sw.js, иначе
// activate-handler сервис-воркера удалит этот кэш при обновлении версии
// и атлет потеряет скачанные оффлайн-видео.
const VIDEO_CACHE_NAME = 'trenki-videos-v3';

export interface OfflineVideo {
  id: string;
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
  downloadedAt: number;
  size?: number;
}

// Открытие базы данных IndexedDB
function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        const objectStore = db.createObjectStore(STORE_NAME, { keyPath: 'id' });
        objectStore.createIndex('downloadedAt', 'downloadedAt', { unique: false });
      }
    };
  });
}

// Проверка, скачано ли видео
export async function isVideoDownloaded(videoId: string): Promise<boolean> {
  try {
    const db = await openDB();
    const transaction = db.transaction([STORE_NAME], 'readonly');
    const store = transaction.objectStore(STORE_NAME);
    
    return new Promise((resolve, reject) => {
      const request = store.get(videoId);
      request.onsuccess = () => resolve(!!request.result);
      request.onerror = () => reject(request.error);
    });
  } catch (error) {
    console.error('Error checking video download status:', error);
    return false;
  }
}

// Скачивание видео
export async function downloadVideo(video: OfflineVideo, onProgress?: (progress: number) => void): Promise<void> {
  try {
    console.log('[OfflineVideos] Starting download:', video.title);

    // Проверяем поддержку Service Worker и Cache API
    if (!('serviceWorker' in navigator) || !('caches' in window)) {
      throw new Error('Ваш браузер не поддерживает офлайн-режим');
    }

    // Скачиваем видео файл
    const response = await fetch(video.videoUrl);
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const contentLength = response.headers.get('content-length');
    const total = contentLength ? parseInt(contentLength, 10) : 0;

    // Читаем поток с отслеживанием прогресса
    const reader = response.body?.getReader();
    if (!reader) {
      throw new Error('Не удалось получить reader для видео');
    }

    const chunks: BlobPart[] = [];
    let receivedLength = 0;

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      chunks.push(value as BlobPart);
      receivedLength += value.length;

      if (onProgress && total > 0) {
        const progress = (receivedLength / total) * 100;
        onProgress(progress);
      }
    }

    // Собираем все чанки в один Blob
    const blob = new Blob(chunks, { type: response.headers.get('content-type') || 'video/mp4' });
    
    // Сохраняем в Cache API
    const cache = await caches.open(VIDEO_CACHE_NAME);
    const cacheResponse = new Response(blob, {
      headers: response.headers,
    });
    await cache.put(video.videoUrl, cacheResponse);

    // Также кэшируем thumbnail если есть
    if (video.thumbnail) {
      try {
        await cache.add(video.thumbnail);
      } catch (error) {
        console.warn('Could not cache thumbnail:', error);
      }
    }

    // Сохраняем метаданные в IndexedDB
    const db = await openDB();
    const transaction = db.transaction([STORE_NAME], 'readwrite');
    const store = transaction.objectStore(STORE_NAME);

    const videoData: OfflineVideo = {
      ...video,
      downloadedAt: Date.now(),
      size: blob.size,
    };

    await new Promise((resolve, reject) => {
      const request = store.put(videoData);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });

    console.log('[OfflineVideos] Download completed:', video.title);
    if (onProgress) onProgress(100);
  } catch (error) {
    console.error('[OfflineVideos] Download failed:', error);
    throw error;
  }
}

// Удаление видео
export async function deleteVideo(videoId: string): Promise<void> {
  try {
    console.log('[OfflineVideos] Deleting video:', videoId);

    // Получаем данные видео из IndexedDB
    const video = await getOfflineVideo(videoId);
    if (!video) {
      throw new Error('Видео не найдено');
    }

    // Удаляем из Cache API
    const cache = await caches.open(VIDEO_CACHE_NAME);
    await cache.delete(video.videoUrl);
    
    if (video.thumbnail) {
      await cache.delete(video.thumbnail);
    }

    // Удаляем из IndexedDB
    const db = await openDB();
    const transaction = db.transaction([STORE_NAME], 'readwrite');
    const store = transaction.objectStore(STORE_NAME);

    await new Promise((resolve, reject) => {
      const request = store.delete(videoId);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });

    console.log('[OfflineVideos] Video deleted:', videoId);
  } catch (error) {
    console.error('[OfflineVideos] Delete failed:', error);
    throw error;
  }
}

// Получение одного офлайн-видео
export async function getOfflineVideo(videoId: string): Promise<OfflineVideo | null> {
  try {
    const db = await openDB();
    const transaction = db.transaction([STORE_NAME], 'readonly');
    const store = transaction.objectStore(STORE_NAME);

    return new Promise((resolve, reject) => {
      const request = store.get(videoId);
      request.onsuccess = () => resolve(request.result || null);
      request.onerror = () => reject(request.error);
    });
  } catch (error) {
    console.error('Error getting offline video:', error);
    return null;
  }
}

// Получение всех офлайн-видео
export async function getAllOfflineVideos(): Promise<OfflineVideo[]> {
  try {
    const db = await openDB();
    const transaction = db.transaction([STORE_NAME], 'readonly');
    const store = transaction.objectStore(STORE_NAME);

    return new Promise((resolve, reject) => {
      const request = store.getAll();
      request.onsuccess = () => resolve(request.result || []);
      request.onerror = () => reject(request.error);
    });
  } catch (error) {
    console.error('Error getting offline videos:', error);
    return [];
  }
}

// Получение общего размера всех скачанных видео
export async function getTotalSize(): Promise<number> {
  try {
    const videos = await getAllOfflineVideos();
    return videos.reduce((total, video) => total + (video.size || 0), 0);
  } catch (error) {
    console.error('Error calculating total size:', error);
    return 0;
  }
}

// Форматирование размера файла
export function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 Bytes';
  
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  
  return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i];
}

// Проверка доступной квоты
export async function checkStorageQuota(): Promise<{ used: number; available: number; percentage: number }> {
  try {
    if ('storage' in navigator && 'estimate' in navigator.storage) {
      const estimate = await navigator.storage.estimate();
      const used = estimate.usage || 0;
      const available = estimate.quota || 0;
      const percentage = available > 0 ? (used / available) * 100 : 0;
      
      return { used, available, percentage };
    }
  } catch (error) {
    console.error('Error checking storage quota:', error);
  }
  
  return { used: 0, available: 0, percentage: 0 };
}

// Очистка старых видео (если места не хватает)
export async function clearOldVideos(keepCount: number = 10): Promise<void> {
  try {
    const videos = await getAllOfflineVideos();
    
    // Сортируем по дате скачивания (старые сначала)
    videos.sort((a, b) => a.downloadedAt - b.downloadedAt);
    
    // Удаляем самые старые
    const videosToDelete = videos.slice(0, Math.max(0, videos.length - keepCount));
    
    for (const video of videosToDelete) {
      await deleteVideo(video.id);
    }
    
    console.log(`[OfflineVideos] Cleaned up ${videosToDelete.length} old videos`);
  } catch (error) {
    console.error('Error clearing old videos:', error);
    throw error;
  }
}
