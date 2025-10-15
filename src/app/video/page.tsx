'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import BottomNavigation from '@/components/BottomNavigation';
import { Skeleton } from '@/components/Skeleton';

// Функция для форматирования длительности видео
const formatDuration = (seconds: number): string => {
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
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
  equipment: string[];
  level?: string;
  viewsCount: number;
  trainer: {
    id: string;
    name: string;
    lastName: string;
    avatar?: string;
    speciality: string;
  };
  createdAt: string;
}

const VideoPage = () => {
  const [activeFilter, setActiveFilter] = useState('all');
  const [videos, setVideos] = useState<Video[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Загружаем видео при монтировании компонента
  useEffect(() => {
    fetchVideos();
  }, []);

  const fetchVideos = async () => {
    try {
      setIsLoading(true);
      const response = await fetch('/api/videos');
      const data = await response.json();
      setVideos(data.videos || []);
    } catch (error) {
      console.error('Error fetching videos:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const filters = [
    { id: 'all', label: 'Все видео' },
    { id: 'SKATING', label: 'Катание' },
    { id: 'TECHNIQUE', label: 'Техника' },
    { id: 'SHOOTING', label: 'Броски' },
    { id: 'PASSING', label: 'Пас' },
    { id: 'GOALKEEPER', label: 'Вратарь' },
    { id: 'STRENGTH', label: 'Сила' },
    { id: 'ENDURANCE', label: 'Выносливость' },
    { id: 'SPEED', label: 'Скорость' },
    { id: 'TACTICAL', label: 'Тактика' }
  ];

  const filteredVideos = activeFilter === 'all' 
    ? videos 
    : videos.filter(video => video.category === activeFilter);

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
        <header className="flex items-center justify-between p-4 bg-[#101530]" style={{ paddingTop: '90px' }}>
          <div className="flex items-center space-x-2">
            <Skeleton width="w-6" height="h-6" />
            <Skeleton width="w-32" height="h-5" />
          </div>
          <div className="flex items-center space-x-4">
            <Skeleton width="w-6" height="h-6" />
            <Skeleton width="w-6" height="h-6" />
          </div>
        </header>

        {/* Filters Skeleton */}
        <div className="overflow-x-auto px-4 py-3 hide-scrollbar">
          <div className="flex space-x-2">
            {[1, 2, 3, 4, 5].map((i) => (
              <Skeleton key={i} width="w-24" height="h-8" className="rounded-full" />
            ))}
          </div>
        </div>

        {/* Video Cards Skeleton */}
        <div className="mt-4">
          {[1, 2, 3, 4].map((i) => (
            <VideoCardSkeleton key={i} />
          ))}
        </div>

        <BottomNavigation activeTab="video" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#101530] pb-20">
      {/* Header */}
      <header className="flex items-center justify-between p-4 bg-[#101530]" style={{ paddingTop: '90px' }}>
        <div className="flex items-center space-x-2">
          <Link href="/" className="text-white hover:text-gray-300">
            <Image src="/icons/icon-action-back.svg" alt="Назад" width={24} height={24} />
          </Link>
          <h1 className="text-lg font-semibold text-white">Тренеровки</h1>
        </div>
        <div className="flex items-center space-x-4">
          <button className="text-white hover:text-gray-300">
            <Image src="/icons/video/search.svg" alt="Поиск" width={24} height={24} />
          </button>
          <button className="text-white hover:text-gray-300">
            <Image src="/icons/video/Filter.svg" alt="Фильтр" width={24} height={24} />
          </button>
        </div>
      </header>

      {/* Filters */}
            {/* Filters */}
      <div className="py-4">
        <div className="flex space-x-2 overflow-x-auto px-4">
          {filters.map((filter) => (
            <button
              key={filter.id}
              onClick={() => setActiveFilter(filter.id)}
              className={`px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-colors ${
                activeFilter === filter.id
                  ? 'bg-blue-600 text-white'
                  : 'bg-[#2d3448] text-[#ccd6f6] hover:bg-[#3d4759]'
              }`}
            >
              {filter.label}
            </button>
          ))}
        </div>
      </div>

      {/* Video Grid */}
      <div>
        {filteredVideos.length === 0 ? (
          <div className="text-center py-12 px-4">
            <p className="text-gray-400 text-lg">Видео не найдены</p>
            <p className="text-gray-500 text-sm mt-2">Попробуйте выбрать другой фильтр</p>
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            {filteredVideos.map((video) => (
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
              {/* Теги с горизонтальным скроллом */}
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
              </div>                    {/* Trainer info - последняя строка */}
                                  {/* Информация о тренере */}
              <div
                style={{ fontSize: '12px' }}
                className="text-white/60 mt-2"
              >
                <span>
                  {video.trainer.name} {video.trainer.lastName}
                </span>
                <span className="text-white/40"> | </span>
                <span>{video.viewsCount} тыс. лайков</span>
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

      <BottomNavigation activeTab="video" />
    </div>
  );
};

export default VideoPage;