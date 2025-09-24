'use client';

import React, { useState, useRef, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { ArrowLeft, Play, Pause, Heart, MessageCircle, Share, MoreVertical, Volume2, VolumeX } from 'lucide-react';

interface VideoPageProps {
  params: Promise<{
    id: string;
  }>;
}

export default function VideoPage({ params }: VideoPageProps) {
  const [isPlaying, setIsPlaying] = useState(true);
  const [isLiked, setIsLiked] = useState(false);
  const [showComments, setShowComments] = useState(true);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  // const [volume, setVolume] = useState(1);
  const [isMuted, setIsMuted] = useState(true);
  const [videoId, setVideoId] = useState<string>('');

  // Получаем params асинхронно
  useEffect(() => {
    const getParams = async () => {
      const resolvedParams = await params;
      setVideoId(resolvedParams.id);
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
    <div className="min-h-screen bg-[#101530]">
      {/* Header */}
      <header className="flex items-center justify-between p-4 bg-[#101530] shadow-sm border-b border-gray-700" style={{ paddingTop: '90px' }}>
        <Link href="/" className="text-white hover:text-gray-300">
          <ArrowLeft size={24} />
        </Link>
        <h1 className="text-lg font-semibold text-white">Видео</h1>
        <button className="text-white hover:text-gray-300">
          <MoreVertical size={24} />
        </button>
      </header>

      {/* Video Player */}
      <div className="relative bg-black">
        <div 
          className="aspect-video relative"
          onMouseMove={handleVideoInteraction}
          onTouchStart={handleVideoInteraction}
        >
          <video
            ref={videoRef}
            className="w-full h-full object-cover"
            src="/video/trenka.mp4"
            autoPlay
            muted
            playsInline
            onClick={togglePlay}
            onPlay={() => setIsPlaying(true)}
            onPause={() => setIsPlaying(false)}
          />
          
          {/* Play/Pause Overlay */}
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
          
          {/* Video Controls */}
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
        </div>
      </div>

      {/* Video Info */}
      <div className="p-4 bg-[#1a1f3a] border-b border-[#2d3448]">
        <h2 className="text-xl font-bold text-white mb-2">
          {videoId === 'onboarding' ? 'Онбординг в тренажерный зал' : 'Видео тренировка'}
        </h2>
        <p className="text-[#ccd6f6] text-sm mb-4">
          {videoId === 'onboarding' 
            ? 'Первые шаги в тренажерном зале - как начать тренироваться правильно и безопасно'
            : 'Описание видео тренировки'
          }
        </p>

        {/* Trainer Info */}
        <div className="flex items-center space-x-3 mb-4">
          <div className="w-12 h-12 bg-[#2d3448] rounded-full flex items-center justify-center">
            <span className="text-white font-semibold">М</span>
          </div>
          <div className="flex-1">
            <h3 className="font-semibold text-white">Марк Петров</h3>
            <p className="text-sm text-[#8892b0]">Сертифицированный тренер</p>
          </div>
          <button className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium">
            Подписаться
          </button>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center justify-between mb-6">
          <button
            onClick={toggleLike}
            className={`flex items-center space-x-2 px-4 py-2 rounded-lg ${
              isLiked ? 'bg-red-600/20 text-red-400 border border-red-600/30' : 'bg-[#2d3448] text-[#ccd6f6] border border-[#3d4759]'
            }`}
          >
            <Heart size={20} className={isLiked ? 'fill-current' : ''} />
            <span className="text-sm font-medium">125</span>
          </button>
          
          <button
            onClick={() => setShowComments(!showComments)}
            className="flex items-center space-x-2 px-4 py-2 bg-[#2d3448] text-[#ccd6f6] rounded-lg border border-[#3d4759]"
          >
            <MessageCircle size={20} />
            <span className="text-sm font-medium">28</span>
          </button>
          
          <button className="flex items-center space-x-2 px-4 py-2 bg-[#2d3448] text-[#ccd6f6] rounded-lg border border-[#3d4759]">
            <Share size={20} />
            <span className="text-sm font-medium">Поделиться</span>
          </button>
        </div>
      </div>

      {/* Comments Section */}
      {showComments && (
        <div className="bg-[#1a1f3a] border-t border-[#2d3448]">
          <div className="p-4 border-b border-[#2d3448]">
            <h3 className="font-semibold text-white mb-4">Комментарии</h3>
            
            {/* Comment Input */}
            <div className="flex space-x-3 mb-4">
              <div className="w-8 h-8 bg-[#2d3448] rounded-full flex items-center justify-center">
                <span className="text-white text-sm font-semibold">А</span>
              </div>
              <div className="flex-1">
                <input
                  type="text"
                  placeholder="Добавить комментарий..."
                  className="w-full p-3 border border-[#3d4759] rounded-lg bg-[#2d3448] text-white placeholder-[#8892b0] focus:outline-none focus:ring-2 focus:ring-blue-600"
                />
              </div>
            </div>

            {/* Comments List */}
            <div className="space-y-4">
              <div className="flex space-x-3">
                <div className="w-8 h-8 bg-[#2d3448] rounded-full flex items-center justify-center">
                  <span className="text-white text-sm font-semibold">И</span>
                </div>
                <div className="flex-1">
                  <div className="flex items-center space-x-2 mb-1">
                    <span className="font-medium text-white text-sm">Иван Смирнов</span>
                    <span className="text-[#8892b0] text-xs">2 часа назад</span>
                  </div>
                  <p className="text-[#ccd6f6] text-sm">Отличное видео! Очень помогло разобраться с техникой упражнений.</p>
                  <button className="text-blue-400 text-xs mt-1">Ответить</button>
                </div>
              </div>

              <div className="flex space-x-3">
                <div className="w-8 h-8 bg-[#2d3448] rounded-full flex items-center justify-center">
                  <span className="text-white text-sm font-semibold">Е</span>
                </div>
                <div className="flex-1">
                  <div className="flex items-center space-x-2 mb-1">
                    <span className="font-medium text-white text-sm">Елена Кузнецова</span>
                    <span className="text-[#8892b0] text-xs">4 часа назад</span>
                  </div>
                  <p className="text-[#ccd6f6] text-sm">Спасибо за подробное объяснение! Теперь не боюсь идти в зал.</p>
                  <button className="text-blue-400 text-xs mt-1">Ответить</button>
                </div>
              </div>

              <div className="flex space-x-3">
                <div className="w-8 h-8 bg-[#2d3448] rounded-full flex items-center justify-center">
                  <span className="text-white text-sm font-semibold">Д</span>
                </div>
                <div className="flex-1">
                  <div className="flex items-center space-x-2 mb-1">
                    <span className="font-medium text-white text-sm">Дмитрий Волков</span>
                    <span className="text-[#8892b0] text-xs">1 день назад</span>
                  </div>
                  <p className="text-[#ccd6f6] text-sm">Когда следующее видео? Жду продолжения серии!</p>
                  <button className="text-blue-400 text-xs mt-1">Ответить</button>
                </div>
              </div>
            </div>

            {/* Load More Comments */}
            <button className="w-full mt-4 py-2 text-blue-400 text-sm font-medium">
              Показать еще комментарии
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
