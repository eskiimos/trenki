'use client';

import React, { useState, useRef, useEffect, useCallback } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { Play, Pause, Heart, MessageCircle, Share, Volume2, VolumeX } from 'lucide-react';
import TagsSection from '@/components/TagsSection';
import BottomNavigation from '@/components/BottomNavigation';

interface VideoPageProps {
  params: Promise<{
    id: string;
  }>;
}

interface VideoData {
  id: string;
  title: string;
  description: string;
  videoUrl: string;
  thumbnail: string;
  duration: number;
  trainer: {
    id: string;
    name: string;
    lastName: string;
    speciality: string;
    avatar: string | null;
  };
  tags: string[];
  equipment: string[];
  category: string;
  difficulty: string;
  level: string;
}

export default function VideoPage({ params }: VideoPageProps) {
  const router = useRouter();
  const [isPlaying, setIsPlaying] = useState(true);
  const [isLiked, setIsLiked] = useState(false);
  const [showComments, setShowComments] = useState(true);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  // const [volume, setVolume] = useState(1);
  const [isMuted, setIsMuted] = useState(true);
  const [videoId, setVideoId] = useState<string>('');
  const [videoData, setVideoData] = useState<VideoData | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Получаем params асинхронно и загружаем данные видео
  useEffect(() => {
    const getParams = async () => {
      const resolvedParams = await params;
      setVideoId(resolvedParams.id);
      
      // Загружаем данные видео
      try {
        setIsLoading(true);
        const response = await fetch('/api/videos');
        const data = await response.json();
        const video = data.videos.find((v: VideoData) => v.id === resolvedParams.id);
        if (video) {
          setVideoData(video);
        }
      } catch (error) {
        console.error('Error loading video:', error);
      } finally {
        setIsLoading(false);
      }
    };
    getParams();
  }, [params]);
  const [showControls, setShowControls] = useState(true);
  const videoRef = useRef<HTMLVideoElement>(null);
  const hideControlsTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const togglePlay = () => {
    if (videoRef.current) {
      if (isPlaying) {
        videoRef.current.pause();
      } else {
        videoRef.current.play();
      }
      setIsPlaying(!isPlaying);
    }
    showControlsTemporarily();
  };

  const toggleLike = () => {
    setIsLiked(!isLiked);
  };

  const toggleMute = () => {
    if (videoRef.current) {
      videoRef.current.muted = !isMuted;
      setIsMuted(!isMuted);
    }
    showControlsTemporarily();
  };

    const showControlsTemporarily = useCallback(() => {
    setShowControls(true);
    
    // Очищаем предыдущий таймер
    if (hideControlsTimeoutRef.current) {
      clearTimeout(hideControlsTimeoutRef.current);
    }

    // Скрываем через 3 секунды
    hideControlsTimeoutRef.current = setTimeout(() => {
      setShowControls(false);
    }, 3000);
  }, []);

  const handleVideoInteraction = () => {
    showControlsTemporarily();
  };

  const handleTimeUpdate = () => {
    if (videoRef.current) {
      setCurrentTime(videoRef.current.currentTime);
    }
  };

  const handleLoadedMetadata = () => {
    if (videoRef.current) {
      setDuration(videoRef.current.duration);
    }
  };

  const handleSeek = (e: React.MouseEvent<HTMLDivElement>) => {
    if (videoRef.current) {
      const rect = e.currentTarget.getBoundingClientRect();
      const pos = (e.clientX - rect.left) / rect.width;
      videoRef.current.currentTime = pos * duration;
    }
    showControlsTemporarily();
  };

  const formatTime = (time: number) => {
    const minutes = Math.floor(time / 60);
    const seconds = Math.floor(time % 60);
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  useEffect(() => {
    const video = videoRef.current;
    if (video) {
      video.addEventListener('timeupdate', handleTimeUpdate);
      video.addEventListener('loadedmetadata', handleLoadedMetadata);
      
      return () => {
        video.removeEventListener('timeupdate', handleTimeUpdate);
        video.removeEventListener('loadedmetadata', handleLoadedMetadata);
      };
    }
  }, []);

  // Скрываем элементы управления при запуске видео
  useEffect(() => {
    if (isPlaying) {
      showControlsTemporarily();
    } else {
      setShowControls(true);
      if (hideControlsTimeoutRef.current) {
        clearTimeout(hideControlsTimeoutRef.current);
      }
    }
  }, [isPlaying, showControlsTemporarily]);

  // Очистка таймера при размонтировании
  useEffect(() => {
    return () => {
      if (hideControlsTimeoutRef.current) {
        clearTimeout(hideControlsTimeoutRef.current);
      }
    };
  }, []);

  return (
    <div className="min-h-screen bg-[#101530] pb-20">{/* pb-20 для отступа под таб-бар */}
      {/* Header */}
      <header className="flex items-center justify-between p-4 bg-[#101530] shadow-sm border-b border-gray-700" style={{ paddingTop: '90px' }}>
        <div className="flex items-center space-x-2">
          <button onClick={() => router.back()} className="text-white hover:text-gray-300">
            <Image src="/icons/icon-action-back.svg" alt="Назад" width={24} height={24} />
          </button>
          <h1 className="text-lg font-semibold text-white">ТРЕНЕРОВКА</h1>
        </div>
        <div className="flex items-center space-x-4">
            <Image src="/icons/video/action-calendar.svg" alt="Календарь" width={24} height={24} />
            <Image src="/icons/video/action-save.svg" alt="Сохранить" width={24} height={24} />
            <Image src="/icons/video/action-share.svg" alt="Поделиться" width={24} height={24} />
            <Image src="/icons/video/action-like.svg" alt="Лайк" width={24} height={24} />
        </div>
      </header>

      {/* Video Player */}
      <div className="relative bg-black">
        <div 
          className="aspect-video relative"
          onMouseMove={handleVideoInteraction}
          onTouchStart={handleVideoInteraction}
        >
          {isLoading ? (
            <div className="w-full h-full flex items-center justify-center bg-black">
              <div className="text-white">Загрузка...</div>
            </div>
          ) : videoData?.videoUrl?.includes('kinescope.io') ? (
            // Используем iframe для Kinescope
            <iframe
              src={videoData.videoUrl}
              className="w-full h-full"
              allow="autoplay; fullscreen; picture-in-picture; encrypted-media; gyroscope; accelerometer; clipboard-write;"
              frameBorder="0"
              allowFullScreen
            />
          ) : (
            // Обычный video тег для локальных файлов или прямых ссылок
            <>
              <video
                ref={videoRef}
                className="w-full h-full object-cover"
                src={videoData?.videoUrl || '/video/trenka.mp4'}
                autoPlay
                muted
                playsInline
                onClick={togglePlay}
                onPlay={() => setIsPlaying(true)}
                onPause={() => setIsPlaying(false)}
              />
              
              {/* Play/Pause Overlay - только для обычного video */}
              <div className={`absolute inset-0 bg-gradient-to-b from-transparent to-black/50 flex items-center justify-center transition-opacity duration-300 ${
                showControls ? 'opacity-100' : 'opacity-0'
              }`}>
                <button
                  onClick={togglePlay}
                  className="w-16 h-16 bg-white/20 backdrop-blur-sm rounded-full flex items-center justify-center opacity-80 hover:opacity-100 transition-opacity"
                >
                  {isPlaying ? (
                    <Pause size={32} className="text-white" />
                  ) : (
                    <Play size={32} className="text-white ml-1" />
                  )}
                </button>
              </div>
            </>
          )}
          
          {/* Video Controls - только для обычного video, не для Kinescope */}
          {!videoData?.videoUrl?.includes('kinescope.io') && (
            <div className={`absolute bottom-4 left-4 right-4 transition-opacity duration-300 ${
              showControls ? 'opacity-100' : 'opacity-0'
            }`}>
              <div className="flex items-center space-x-4">
                <div 
                  className="flex-1 h-1 bg-white/30 rounded-full cursor-pointer"
                  onClick={handleSeek}
                >
                  <div 
                    className="h-full bg-white rounded-full transition-all"
                    style={{ width: `${duration > 0 ? (currentTime / duration) * 100 : 0}%` }}
                  ></div>
                </div>
                <span className="text-white text-sm">
                  {formatTime(currentTime)} / {formatTime(duration)}
                </span>
                <button onClick={toggleMute} className="text-white">
                  {isMuted ? <VolumeX size={20} /> : <Volume2 size={20} />}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      <TagsSection 
        tags={videoData?.tags}
        equipment={videoData?.equipment}
        category={videoData?.category}
        difficulty={videoData?.difficulty}
        level={videoData?.level}
        description={videoData?.description}
        trainer={videoData?.trainer ? {
          name: videoData.trainer.name,
          lastName: videoData.trainer.lastName,
          avatar: videoData.trainer.avatar
        } : null}
      />
      
      <BottomNavigation activeTab="video" />
    </div>
  );
}
