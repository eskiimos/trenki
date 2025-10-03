'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import BottomNavigation from '@/components/BottomNavigation';

interface Video {
  id: string;
  title: string;
  description?: string;
  duration: string;
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

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#101530] pb-20 flex items-center justify-center">
        <div className="text-white">Загрузка...</div>
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
      <div className="p-4">
        {filteredVideos.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-gray-400 text-lg">Видео не найдены</p>
            <p className="text-gray-500 text-sm mt-2">Попробуйте выбрать другой фильтр</p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
            {filteredVideos.map((video) => (
              <Link key={video.id} href={`/video/${video.id}`}>
              <div className="flex gap-4">
                {/* Video Thumbnail */}
                <div className="relative flex-shrink-0 border border-gray-600 border-opacity-30 rounded-lg overflow-hidden" style={{ width: '190px', height: '107px' }}>
                  <Image
                    src={(video.thumbnail && video.thumbnail.trim() !== '') ? video.thumbnail : '/images/video_prew_2.png'}
                    alt={video.title}
                    fill
                    className="object-cover"
                  />
                  <div className="absolute bottom-2 right-2 bg-black bg-opacity-50 text-white text-xs px-2 py-1 rounded">
                    {video.duration}
                  </div>
                </div>
                
                {/* Video Info */}
                <div className="flex-1 flex flex-col justify-center">
                  {/* Trainer Name with Avatar */}
                  <div className="flex items-center gap-2 mb-2">
                    <Image
                      src={video.trainer.avatar || '/images/avatars/trainer-avatar-1.png'}
                      alt={`${video.trainer.name} ${video.trainer.lastName}`}
                      width={24}
                      height={24}
                      className="rounded-full"
                    />
                    <div className="text-white font-semibold truncate max-w-[150px]" style={{ fontSize: '12px' }}>
                      {video.trainer.name} {video.trainer.lastName}
                    </div>
                  </div>
                  {/* Tags */}
                  <div className="flex flex-wrap gap-2">
                    {video.tags.map((tag, index) => (
                      <span
                        key={index}
                        className="px-3 py-1.5 text-[#AEABBB] bg-[#2d3448] rounded-full"
                        style={{ fontSize: '8px' }}
                      >
                        {tag}
                      </span>
                    ))}
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