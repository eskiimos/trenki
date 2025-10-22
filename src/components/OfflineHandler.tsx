'use client';

import { useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { getAllOfflineVideos } from '@/lib/offlineVideos';

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

      // Если есть офлайн-видео и мы не на странице офлайн-видео
      // редиректим туда
      if (videos.length > 0 && pathname !== '/offline-videos') {
        console.log('[OfflineHandler] Redirecting to offline videos');
        router.push('/offline-videos');
      }
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
