'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import BottomNavigation from '@/components/BottomNavigation';

const VideoPage = () => {
  const [activeFilter, setActiveFilter] = useState('all');

  // Временные данные для видео
  const videos = [
    {
      id: 1,
      title: 'Основы техники катания',
      duration: '8:44',
      thumbnail: '/images/video_prew_2.png',
      category: 'technique',
      tags: ['Тип тренировки', 'Оборудование', 'Уровень', 'Тренер']
    },
    {
      id: 2,
      title: 'Тренировка вратаря',
      duration: '8:44',
      thumbnail: '/images/video_prew_2.png', 
      category: 'goalkeeper',
      tags: ['Тип тренировки', 'Оборудование', 'Уровень', 'Тренер']
    },
    {
      id: 'onboarding',
      title: 'Онбординг в тренажерный зал',
      duration: '8:44',
      thumbnail: '/images/video_prew_2.png',
      category: 'training',
      tags: ['Тип тренировки', 'Оборудование', 'Уровень', 'Тренер']
    }
  ];

  const filters = [
    { id: 'all', label: 'Все видео' },
    { id: 'technique', label: 'Техника' },
    { id: 'training', label: 'Тренировки' },
    { id: 'goalkeeper', label: 'Вратарь' },
    { id: 'fitness', label: 'Фитнес' },
    { id: 'beginner', label: 'Новичок' },
    { id: 'advanced', label: 'Продвинутый' },
    { id: 'cardio', label: 'Кардио' },
    { id: 'strength', label: 'Силовая' }
  ];

  const filteredVideos = activeFilter === 'all' 
    ? videos 
    : videos.filter(video => video.category === activeFilter);

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
        <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
          {filteredVideos.map((video) => (
            <Link key={video.id} href={`/video/${video.id}`}>
              <div className="flex gap-4">
                {/* Video Thumbnail */}
                <div className="relative flex-shrink-0 border border-gray-600 border-opacity-30 rounded-lg overflow-hidden" style={{ width: '190px', height: '107px' }}>
                  <Image
                    src={video.thumbnail}
                    alt={video.title}
                    fill
                    className="object-cover"
                  />
                  <div className="absolute bottom-2 right-2 bg-black bg-opacity-70 text-white text-xs px-2 py-1 rounded">
                    {video.duration}
                  </div>
                </div>
                
                {/* Video Info */}
                <div className="flex-1 flex flex-col justify-center">
                  {/* Title */}
                  <h3 className="text-white text-base font-medium mb-3 leading-tight">
                    {video.title}
                  </h3>
                  
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
      </div>

      <BottomNavigation activeTab="video" />
    </div>
  );
};

export default VideoPage;