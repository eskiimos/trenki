'use client';

import { useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { getAllOfflineVideos, isVideoDownloaded } from '@/lib/offlineVideos';

/**
 * Компонент для обработки офлайн-режима
 * Автоматически редиректит на страницу офлайн-видео при потере интернета
 */
export default function OfflineHandler() {
  const router = useRouter();
  const pathname = usePathname();
  const [isOnline, setIsOnline] = useState(true);
  const [hasOfflineVideos, setHasOfflineVideos] = useState(false);

  useEffect(() => {
    // Проверяем начальное состояние
    setIsOnline(navigator.onLine);

    // Проверяем наличие скачанных видео
    const checkOfflineVideos = async () => {
      const videos = await getAllOfflineVideos();
      setHasOfflineVideos(videos.length > 0);
    };
    checkOfflineVideos();

    // Обработчики событий онлайн/офлайн
    const handleOnline = () => {
      console.log('[OfflineHandler] Connection restored');
      setIsOnline(true);
    };

    const handleOffline = async () => {
      console.log('[OfflineHandler] Connection lost');
      setIsOnline(false);

      // Проверяем, есть ли скачанные видео
      const videos = await getAllOfflineVideos();
      setHasOfflineVideos(videos.length > 0);

      if (videos.length === 0 || pathname === '/offline-videos') return;

      // Если открыто конкретное /video/[id] и оно уже скачано — не редиректим,
      // плеер сам возьмёт URL из IndexedDB.
      const match = pathname?.match(/^\/video\/([^/]+)/);
      if (match) {
        try {
          const downloaded = await isVideoDownloaded(match[1]);
          if (downloaded) {
            console.log('[OfflineHandler] Текущее видео скачано, остаёмся на странице');
            return;
          }
        } catch {
          // если IDB упал — лучше попробуем редиректнуть на список оффлайн-видео
        }
      }

      console.log('[OfflineHandler] Redirecting to offline videos');
      router.push('/offline-videos');
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [router, pathname]);

  // Показываем уведомление если офлайн и нет скачанных видео
  if (!isOnline && !hasOfflineVideos && pathname !== '/offline-videos') {
    return (
      <div className="fixed top-0 left-0 right-0 z-50 bg-red-500 text-white px-4 py-3 text-center">
        <p className="text-sm font-semibold">
          📡 Нет подключения к интернету
        </p>
        <p className="text-xs mt-1">
          Скачайте видео для просмотра офлайн
        </p>
      </div>
    );
  }

  return null;
}
