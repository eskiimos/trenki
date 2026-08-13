'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { Download, Trash2, Wifi, WifiOff, HardDrive } from 'lucide-react';
import { 
  getAllOfflineVideos, 
  deleteVideo, 
  getTotalSize, 
  formatFileSize,
  checkStorageQuota,
  type OfflineVideo 
} from '@/lib/offlineVideos';

export default function OfflineVideosPage() {
  const [videos, setVideos] = useState<OfflineVideo[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [totalSize, setTotalSize] = useState(0);
  const [storageQuota, setStorageQuota] = useState({ used: 0, available: 0, percentage: 0 });
  const [isOnline, setIsOnline] = useState(true);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  useEffect(() => {
    loadOfflineVideos();
    loadStorageInfo();
    
    // Проверяем статус интернета
    setIsOnline(navigator.onLine);
    
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  const loadOfflineVideos = async () => {
    try {
      setIsLoading(true);
      const offlineVideos = await getAllOfflineVideos();
      // Сортируем по дате скачивания (новые первые)
      offlineVideos.sort((a, b) => b.downloadedAt - a.downloadedAt);
      setVideos(offlineVideos);
    } catch (error) {
      console.error('Error loading offline videos:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const loadStorageInfo = async () => {
    try {
      const size = await getTotalSize();
      setTotalSize(size);
      
      const quota = await checkStorageQuota();
      setStorageQuota(quota);
    } catch (error) {
      console.error('Error loading storage info:', error);
    }
  };

  const handleDelete = async (videoId: string) => {
    if (!confirm('Удалить это видео из офлайн-хранилища?')) {
      return;
    }

    try {
      setDeletingId(videoId);
      await deleteVideo(videoId);
      await loadOfflineVideos();
      await loadStorageInfo();
    } catch (error) {
      console.error('Error deleting video:', error);
      alert('Ошибка при удалении видео');
    } finally {
      setDeletingId(null);
    }
  };

  const formatDate = (timestamp: number) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 60) return `${diffMins} мин назад`;
    if (diffHours < 24) return `${diffHours} ч назад`;
    if (diffDays < 7) return `${diffDays} дн назад`;
    
    return date.toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' });
  };

  return (
    <div className="min-h-screen bg-[#0f1420] text-white pb-20">
      {/* Header */}
      <div className="bg-[#1a1f3a] border-b border-white/5 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 py-4" style={{ paddingTop: 'calc(env(safe-area-inset-top, 0px) + 16px)' }}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Link
                href="/"
                className="w-10 h-10 rounded-full bg-white/5 flex items-center justify-center hover:bg-white/10 transition-colors"
              >
                <Image src="/icons/icon-action-back.svg" alt="Назад" width={24} height={24} />
              </Link>
              <div>
                <h1 className="text-xl font-bold flex items-center gap-2">
                  <Download size={24} className="text-blue-400" />
                  Офлайн-видео
                </h1>
                <p className="text-sm text-gray-400">
                  {videos.length} {videos.length === 1 ? 'видео' : 'видео'}
                </p>
              </div>
            </div>
            
            {/* Статус интернета */}
            <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-sm ${
              isOnline 
                ? 'bg-green-500/10 text-green-400' 
                : 'bg-red-500/10 text-red-400'
            }`}>
              {isOnline ? <Wifi size={16} /> : <WifiOff size={16} />}
              {isOnline ? 'Онлайн' : 'Офлайн'}
            </div>
          </div>
        </div>
      </div>

      {/* Storage Info */}
      <div className="max-w-7xl mx-auto px-4 py-6">
        <div className="bg-[#1a1f3a] rounded-lg p-4 border border-white/5">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <HardDrive size={20} className="text-blue-400" />
              <span className="font-semibold">Хранилище</span>
            </div>
            <span className="text-sm text-gray-400">
              {formatFileSize(totalSize)} скачано
            </span>
          </div>
          
          {/* Progress Bar */}
          {storageQuota.available > 0 && (
            <div>
              <div className="w-full h-2 bg-white/5 rounded-full overflow-hidden">
                <div 
                  className="h-full bg-gradient-to-r from-blue-500 to-purple-500 transition-all duration-300"
                  style={{ width: `${Math.min(storageQuota.percentage, 100)}%` }}
                />
              </div>
              <div className="flex justify-between mt-2 text-xs text-gray-400">
                <span>{formatFileSize(storageQuota.used)} использовано</span>
                <span>{formatFileSize(storageQuota.available)} доступно</span>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Video List */}
      <div className="max-w-7xl mx-auto px-4">
        {isLoading ? (
          <div className="space-y-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="bg-[#1a1f3a] rounded-lg p-4 animate-pulse">
                <div className="flex gap-4">
                  <div className="w-32 h-20 bg-white/5 rounded" />
                  <div className="flex-1 space-y-2">
                    <div className="h-4 bg-white/5 rounded w-3/4" />
                    <div className="h-3 bg-white/5 rounded w-1/2" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : videos.length === 0 ? (
          <div className="text-center py-16">
            <div className="w-20 h-20 mx-auto mb-4 rounded-full bg-white/5 flex items-center justify-center">
              <Download size={32} className="text-gray-400" />
            </div>
            <h3 className="text-xl font-semibold mb-2">Нет скачанных видео</h3>
            <p className="text-gray-400 mb-6">
              Скачайте видео для просмотра без интернета
            </p>
            <Link
              href="/"
              className="inline-flex items-center gap-2 px-6 py-3 bg-blue-600 hover:bg-blue-700 rounded-lg font-semibold transition-colors"
            >
              Перейти к видео
            </Link>
          </div>
        ) : (
          <div className="space-y-4">
            {videos.map((video) => (
              <Link
                key={video.id}
                href={`/video/${video.id}`}
                className="block bg-[#1a1f3a] rounded-lg overflow-hidden border border-white/5 hover:border-blue-500/50 transition-all group"
              >
                <div className="flex gap-4 p-4">
                  {/* Thumbnail */}
                  <div className="relative w-32 h-20 flex-shrink-0 rounded overflow-hidden bg-white/5">
                    {video.thumbnail ? (
                      <Image
                        src={video.thumbnail}
                        alt={video.title}
                        fill
                        className="object-cover"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-gray-500">
                        <Download size={24} />
                      </div>
                    )}
                    {/* Duration Badge */}
                    <div className="absolute bottom-1 right-1 bg-black/70 px-1.5 py-0.5 rounded text-xs">
                      {Math.floor(video.duration / 60)}:{String(video.duration % 60).padStart(2, '0')}
                    </div>
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <h3 className="font-semibold mb-1 line-clamp-1 group-hover:text-blue-400 transition-colors">
                      {video.title}
                    </h3>
                    
                    <div className="flex flex-wrap items-center gap-2 mb-2">
                      {video.trainer && (
                        <span className="text-sm text-gray-400">
                          {video.trainer.name} {video.trainer.lastName}
                        </span>
                      )}
                      <span className="text-gray-600">•</span>
                      <span className="text-sm text-gray-400">
                        {formatDate(video.downloadedAt)}
                      </span>
                    </div>

                    <div className="flex items-center gap-2 text-xs">
                      <span className="px-2 py-0.5 bg-blue-500/20 text-blue-400 rounded">
                        {video.category}
                      </span>
                      <span className="px-2 py-0.5 bg-purple-500/20 text-purple-400 rounded">
                        {video.difficulty}
                      </span>
                      {video.size && (
                        <span className="text-gray-400">
                          {formatFileSize(video.size)}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Delete Button */}
                  <button
                    onClick={(e) => {
                      e.preventDefault();
                      handleDelete(video.id);
                    }}
                    disabled={deletingId === video.id}
                    className="flex-shrink-0 w-10 h-10 rounded-full bg-red-500/10 hover:bg-red-500/20 flex items-center justify-center transition-colors disabled:opacity-50"
                  >
                    {deletingId === video.id ? (
                      <div className="w-5 h-5 border-2 border-red-400 border-t-transparent rounded-full animate-spin" />
                    ) : (
                      <Trash2 size={18} className="text-red-400" />
                    )}
                  </button>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>

      {/* Offline Mode Info */}
      {!isOnline && (
        <div className="fixed bottom-24 left-4 right-4 max-w-md mx-auto">
          <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-4">
            <div className="flex items-start gap-3">
              <WifiOff size={20} className="text-yellow-400 flex-shrink-0 mt-0.5" />
              <div className="flex-1">
                <h4 className="font-semibold text-yellow-400 mb-1">Офлайн-режим</h4>
                <p className="text-sm text-gray-300">
                  Вы можете смотреть только скачанные видео
                </p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
