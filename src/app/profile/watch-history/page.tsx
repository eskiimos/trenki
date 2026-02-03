'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import BottomNavigation from '@/components/BottomNavigation';
import { Skeleton } from '@/components/Skeleton';
import { getTelegramId } from '@/lib/auth';

// Функция для форматирования длительности видео в YouTube формате (MM:SS или H:MM:SS)
const formatDuration = (seconds: number): string => {
  if (!seconds || seconds <= 0) return '0:00';
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;
  
  if (hours > 0) {
    return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }
  return `${minutes}:${secs.toString().padStart(2, '0')}`;
};

interface Video {
  id: string;
  title: string;
  description?: string;
  duration: number;
  videoUrl: string;
  thumbnail?: string;
  category: string;
  difficulty: string;
  tags: string[];
  loadTypes: string[];
  equipment: string[];
  level?: string;
  viewsCount: number;
  likesCount: number;
  trainer: {
    id: string;
    name: string;
    lastName: string;
    avatar?: string;
    speciality: string;
  };
  createdAt: string;
  watchedAt: string;
  isPublished: boolean;
  rpeMin?: number;
  rpeMax?: number;
}

const WatchHistoryPage = () => {
  const [videos, setVideos] = useState<Video[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchWatchHistory = async () => {
      try {
        setIsLoading(true);
        const telegramId = getTelegramId();
        
        if (!telegramId) {
          setIsLoading(false);
          return;
        }

        // Первый запрос к /api/profile для получения userId
        const profileResponse = await fetch(`/api/profile?telegramId=${telegramId}`);
        if (!profileResponse.ok) {
          throw new Error('Failed to fetch profile');
        }

        const profileData = await profileResponse.json();
        const userId = profileData.user?.id;

        if (!userId) {
          setIsLoading(false);
          return;
        }

        // Второй запрос к /api/profile/watch-history для получения истории
        const historyResponse = await fetch(`/api/profile/watch-history?userId=${userId}&limit=50`);
        if (!historyResponse.ok) {
          throw new Error('Failed to fetch watch history');
        }

        const historyData = await historyResponse.json();
        setVideos(historyData.videos || []);
      } catch (error) {
        console.error('Error fetching watch history:', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchWatchHistory();
  }, []);

  // Skeleton компонент для видео карточки
  const VideoCardSkeleton = () => (
    <div className="mb-6">
      {/* Превью видео */}
      <div className="relative w-full aspect-video mb-3">
        <Skeleton width="w-full" height="h-full" />
      </div>
      
      {/* Контент */}
      <div className="px-4 py-3">
        {/* Аватар + Заголовок */}
        <div className="flex items-center gap-3 mb-2">
          <Skeleton width="w-10" height="h-10" rounded />
          <div className="flex-1 space-y-2">
            <Skeleton width="w-3/4" height="h-4" />
            <Skeleton width="w-1/2" height="h-4" />
          </div>
        </div>
        
        {/* Теги */}
        <div className="flex gap-2 mb-2">
          <Skeleton width="w-20" height="h-6" className="rounded-full" />
          <Skeleton width="w-24" height="h-6" className="rounded-full" />
          <Skeleton width="w-16" height="h-6" className="rounded-full" />
        </div>
        
        {/* Информация о тренере */}
        <Skeleton width="w-full" height="h-3" />
      </div>
    </div>
  );

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#101530] pb-20">
        {/* Header */}
        <header className="flex items-center justify-between p-4 bg-[#101530]" style={{ paddingTop: 'calc(env(safe-area-inset-top, 0px) + 16px)' }}>
          <div className="flex items-center space-x-2">
            <Link href="/profile" className="text-white hover:text-gray-300">
              <Image src="/icons/icon-action-back.svg" alt="Назад" width={24} height={24} />
            </Link>
            <Skeleton width="w-48" height="h-5" />
          </div>
        </header>

        {/* Video Cards Skeleton */}
        <div className="mt-4">
          {[1, 2, 3, 4].map((i) => (
            <VideoCardSkeleton key={i} />
          ))}
        </div>

        <BottomNavigation activeTab="profile" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#101530] pb-20">
      {/* Header */}
      <header className="flex items-center justify-between p-4 bg-[#101530]" style={{ paddingTop: 'calc(env(safe-area-inset-top, 0px) + 16px)' }}>
        <div className="flex items-center space-x-2">
          <Link href="/profile" className="text-white hover:text-gray-300">
            <Image src="/icons/icon-action-back.svg" alt="Назад" width={24} height={24} />
          </Link>
          <h1 
            className="text-white uppercase"
            style={{
              fontFamily: 'Overpass',
              fontWeight: 700,
              fontSize: '12px',
              lineHeight: '120%',
              letterSpacing: '0.5px',
              verticalAlign: 'middle',
              textTransform: 'uppercase'
            }}
          >
            История просмотров
          </h1>
        </div>
      </header>

      {/* Video Grid */}
      <div>
        {videos.length === 0 ? (
          <div className="text-center py-12 px-4">
            <p className="text-gray-400 text-lg">История пуста</p>
            <p className="text-gray-500 text-sm mt-2">Здесь будут появляться видео, которые вы смотрели</p>
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            {videos.map((video) => (
              <Link key={video.id} href={`/video/${video.id}`}>
                <div>
                  {/* Video Thumbnail - 100% ширины экрана */}
                  <div className="relative w-full aspect-video">
                    <Image
                      src={(video.thumbnail && video.thumbnail.trim() !== '') ? video.thumbnail : '/images/video_prew_2.png'}
                      alt={video.title}
                      fill
                      className="object-cover"
                    />
                    {/* Duration badge */}
                    <div className="absolute bottom-3 right-3 bg-black/70 backdrop-blur-sm text-white text-sm font-medium px-2.5 py-1 rounded-lg">
                      {formatDuration(video.duration)}
                    </div>
                  </div>
                  
                  {/* Video Info */}
                  <div className="px-4 py-3">
                    {/* Trainer Avatar + Title на одной строке */}
                    <div className="flex items-center gap-3 mb-2">
                      <div className="w-10 h-10 rounded-full overflow-hidden flex-shrink-0 bg-gray-700">
                        {video.trainer.avatar ? (
                          <Image
                            src={video.trainer.avatar}
                            alt={`${video.trainer.name} ${video.trainer.lastName}`}
                            width={40}
                            height={40}
                            className="object-cover w-full h-full"
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-white font-bold">
                            {video.trainer.name.charAt(0)}
                          </div>
                        )}
                      </div>
                      <h3 className="text-white text-base font-semibold line-clamp-2 leading-tight flex-1">
                        {video.title.toUpperCase()}
                      </h3>
                    </div>
                    
                    {/* Tags - горизонтальный скролл */}
                    <div
                      className="overflow-x-auto -mx-4 px-4 mb-2"
                      style={{
                        scrollbarWidth: 'none',
                        msOverflowStyle: 'none',
                      }}
                    >
                      <div className="flex gap-2 w-max">
                        {video.tags.map((tag) => (
                          <span
                            key={tag}
                            className="px-3 py-1 rounded-full text-xs whitespace-nowrap"
                            style={{
                              backgroundColor: '#AEABBB33',
                              color: '#AEABBB',
                            }}
                          >
                            {tag}
                          </span>
                        ))}
                      </div>
                    </div>

                    {/* Trainer info - последняя строка */}
                    <div
                      style={{ fontSize: '12px' }}
                      className="text-white/60 mt-2"
                    >
                      <span>
                        {video.trainer.name} {video.trainer.lastName}
                      </span>
                      <span className="text-white/40"> | </span>
                      <span>
                        {video.likesCount >= 1000 
                          ? `${(video.likesCount / 1000).toFixed(1)} тыс.` 
                          : video.likesCount} лайков
                      </span>
                      <span className="text-white/40"> | </span>
                      <span>оборудование ({video.equipment.join(' / ')})</span>
                    </div>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>

      <BottomNavigation activeTab="profile" />
    </div>
  );
};

export default WatchHistoryPage;
