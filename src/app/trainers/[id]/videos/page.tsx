'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { plural } from '@/lib/plural';
import Image from 'next/image';
import { useParams } from 'next/navigation';
import BottomNavigation from '@/components/BottomNavigation';
import { calculateWorkoutGains, CharacteristicType } from '@/lib/characteristics';
import { getTelegramId } from '@/lib/auth';

// Функция для форматирования длительности видео
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
}

interface Trainer {
  id: string;
  name: string;
  lastName: string;
}

const TrainerVideosPage = () => {
  const params = useParams();
  const trainerId = params.id as string;
  
  const [trainer, setTrainer] = useState<Trainer | null>(null);
  const [videos, setVideos] = useState<Video[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [userProfile, setUserProfile] = useState<any>(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        setIsLoading(true);
        
        // Fetch trainer info
        const trainerResponse = await fetch(`/api/trainers/${trainerId}`);
        const trainerData = await trainerResponse.json();
        setTrainer(trainerData.trainer);
        
        // Fetch videos for this trainer
        const videosResponse = await fetch(`/api/videos?trainerId=${trainerId}`);
        const videosData = await videosResponse.json();
        setVideos(videosData.videos || []);

        // Fetch profile
        const profileResponse = await fetch('/api/profile');
        if (profileResponse.ok) {
          const profileData = await profileResponse.json();
          setUserProfile(profileData.user?.profile);
        }
      } catch (error) {
        console.error('Error fetching data:', error);
      } finally {
        setIsLoading(false);
      }
    };

    if (trainerId) {
      fetchData();
    }
  }, [trainerId]);

  const calculateVideoGain = (loadTypes: string[]) => {
    if (!userProfile || !loadTypes || loadTypes.length === 0) return null;

    const currentCharacteristics: Record<CharacteristicType, number> = {
      ratingPower: userProfile.ratingPower || 0,
      ratingSpeed: userProfile.ratingSpeed || 0,
      ratingEndurance: userProfile.ratingEndurance || 0,
      ratingTechnique: userProfile.ratingTechnique || 0,
      ratingFlexibility: userProfile.ratingFlexibility || 0,
    };

    const gains = calculateWorkoutGains(
      [loadTypes],
      currentCharacteristics
    );

    // Суммируем все приросты
    const totalGain = Object.values(gains).reduce((sum: number, val: number) => sum + val, 0);
    
    if (totalGain === 0) return null;
    
    return `+${totalGain.toFixed(2)}`;
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#101530] flex items-center justify-center">
        <div className="text-white text-xl">Загрузка...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#101530] pb-20">
      {/* Header */}
      <header 
        className="flex items-center justify-between p-4 bg-[#101530] sticky top-0 z-10" 
        style={{ 
          paddingTop: 'calc(env(safe-area-inset-top, 0px) + 16px)',
          paddingLeft: 'max(16px, env(safe-area-inset-left))',
          paddingRight: 'max(16px, env(safe-area-inset-right))'
        }}
      >
        <div className="flex items-center space-x-2">
          <Link href={`/trainers/${trainerId}`} className="text-white hover:text-gray-300">
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
            {trainer?.name} {trainer?.lastName}
          </h1>
        </div>
      </header>

      {/* Video List */}
      <div
        style={{
          paddingLeft: 'max(0px, env(safe-area-inset-left))',
          paddingRight: 'max(0px, env(safe-area-inset-right))'
        }}
      >
        {videos.length === 0 ? (
          <div className="text-center py-12 px-4">
            <p className="text-gray-400 text-lg">Видео не найдены</p>
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            {videos.map((video) => (
              <Link key={video.id} href={`/video/${video.id}`}>
                <div>
                  {/* Video Thumbnail */}
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
                    {/* Title */}
                    <h3 className="text-white text-base font-semibold line-clamp-2 leading-tight mb-2">
                      {video.title.toUpperCase()}
                    </h3>
                    
                    {/* Tags - горизонтальный скролл */}
                    <div
                      className="overflow-x-auto -mx-4 px-4 mb-2"
                      style={{
                        scrollbarWidth: 'none',
                        msOverflowStyle: 'none',
                      }}
                    >
                      <div className="flex gap-2 w-max">
                        {/* Gain Tag */}
                        {calculateVideoGain(video.loadTypes) && (
                          <div
                            className="px-3 py-1 rounded-full text-xs whitespace-nowrap font-bold flex items-center gap-1"
                            style={{
                              backgroundColor: 'rgba(161, 255, 74, 0.2)',
                              color: '#FFFFFF',
                            }}
                          >
                            <Image
                              src="/icons/video/energy-active.svg"
                              alt="Energy"
                              width={12}
                              height={12}
                            />
                            {calculateVideoGain(video.loadTypes)}
                          </div>
                        )}
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
                    
                    {/* Equipment info */}
                    <div
                      style={{ fontSize: '12px' }}
                      className="text-white/60 mt-2"
                    >
                      <span>
                        {video.likesCount >= 1000
                          ? `${(video.likesCount / 1000).toFixed(1)} тыс. лайков`
                          : `${video.likesCount} ${plural(video.likesCount, ['лайк', 'лайка', 'лайков'])}`}
                      </span>
                      <span className="text-white/40"> | </span>
                      <span>оборудование ({video.equipment.join(', ')})</span>
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

export default TrainerVideosPage;
