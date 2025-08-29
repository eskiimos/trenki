'use client';

import React, { useState, useRef, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { ArrowLeft, Play, Pause, Heart, MessageCircle, Share, MoreVertical, Volume2, VolumeX } from 'lucide-react';

interface VideoPageProps {
  params: {
    id: string;
  };
}

export default function VideoPage({ params }: VideoPageProps) {
  const [isPlaying, setIsPlaying] = useState(true);
  const [isLiked, setIsLiked] = useState(false);
  const [showComments, setShowComments] = useState(true);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  // const [volume, setVolume] = useState(1);
  const [isMuted, setIsMuted] = useState(true);
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
    <div className="min-h-screen bg-gray-50" style={{ paddingTop: '140px' }}>
      {/* Header */}
      <header className="flex items-center justify-between p-4 bg-white shadow-sm">
        <Link href="/" className="text-[#303030] hover:text-gray-700">
          <ArrowLeft size={24} />
        </Link>
        <h1 className="text-lg font-semibold text-[#303030]">Видео</h1>
        <button className="text-[#303030] hover:text-gray-700">
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
      <div className="p-4 bg-white">
        <h2 className="text-xl font-bold text-[#303030] mb-2">
          {params.id === 'onboarding' ? 'Онбординг в тренажерный зал' : 'Видео тренировка'}
        </h2>
        <p className="text-[#303030] text-sm mb-4">
          {params.id === 'onboarding' 
            ? 'Первые шаги в тренажерном зале - как начать тренироваться правильно и безопасно'
            : 'Описание видео тренировки'
          }
        </p>

        {/* Trainer Info */}
        <div className="flex items-center space-x-3 mb-4">
          <div className="w-12 h-12 bg-gray-200 rounded-full flex items-center justify-center">
            <span className="text-[#303030] font-semibold">М</span>
          </div>
          <div className="flex-1">
            <h3 className="font-semibold text-[#303030]">Марк Петров</h3>
            <p className="text-sm text-gray-600">Сертифицированный тренер</p>
          </div>
          <button className="px-4 py-2 bg-blue-500 text-white rounded-lg text-sm font-medium">
            Подписаться
          </button>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center justify-between mb-6">
          <button
            onClick={toggleLike}
            className={`flex items-center space-x-2 px-4 py-2 rounded-lg ${
              isLiked ? 'bg-red-100 text-red-600' : 'bg-gray-100 text-[#303030]'
            }`}
          >
            <Heart size={20} className={isLiked ? 'fill-current' : ''} />
            <span className="text-sm font-medium">125</span>
          </button>
          
          <button
            onClick={() => setShowComments(!showComments)}
            className="flex items-center space-x-2 px-4 py-2 bg-gray-100 text-[#303030] rounded-lg"
          >
            <MessageCircle size={20} />
            <span className="text-sm font-medium">28</span>
          </button>
          
          <button className="flex items-center space-x-2 px-4 py-2 bg-gray-100 text-[#303030] rounded-lg">
            <Share size={20} />
            <span className="text-sm font-medium">Поделиться</span>
          </button>
        </div>
      </div>

      {/* Comments Section */}
      {showComments && (
        <div className="bg-white border-t">
          <div className="p-4 border-b">
            <h3 className="font-semibold text-[#303030] mb-4">Комментарии</h3>
            
            {/* Comment Input */}
            <div className="flex space-x-3 mb-4">
              <div className="w-8 h-8 bg-gray-200 rounded-full flex items-center justify-center">
                <span className="text-[#303030] text-sm font-semibold">А</span>
              </div>
              <div className="flex-1">
                <input
                  type="text"
                  placeholder="Добавить комментарий..."
                  className="w-full p-3 border border-gray-300 rounded-lg text-[#303030] placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>

            {/* Comments List */}
            <div className="space-y-4">
              <div className="flex space-x-3">
                <div className="w-8 h-8 bg-gray-200 rounded-full flex items-center justify-center">
                  <span className="text-[#303030] text-sm font-semibold">И</span>
                </div>
                <div className="flex-1">
                  <div className="flex items-center space-x-2 mb-1">
                    <span className="font-medium text-[#303030] text-sm">Иван Смирнов</span>
                    <span className="text-gray-500 text-xs">2 часа назад</span>
                  </div>
                  <p className="text-[#303030] text-sm">Отличное видео! Очень помогло разобраться с техникой упражнений.</p>
                  <button className="text-blue-500 text-xs mt-1">Ответить</button>
                </div>
              </div>

              <div className="flex space-x-3">
                <div className="w-8 h-8 bg-gray-200 rounded-full flex items-center justify-center">
                  <span className="text-[#303030] text-sm font-semibold">Е</span>
                </div>
                <div className="flex-1">
                  <div className="flex items-center space-x-2 mb-1">
                    <span className="font-medium text-[#303030] text-sm">Елена Кузнецова</span>
                    <span className="text-gray-500 text-xs">4 часа назад</span>
                  </div>
                  <p className="text-[#303030] text-sm">Спасибо за подробное объяснение! Теперь не боюсь идти в зал.</p>
                  <button className="text-blue-500 text-xs mt-1">Ответить</button>
                </div>
              </div>

              <div className="flex space-x-3">
                <div className="w-8 h-8 bg-gray-200 rounded-full flex items-center justify-center">
                  <span className="text-[#303030] text-sm font-semibold">Д</span>
                </div>
                <div className="flex-1">
                  <div className="flex items-center space-x-2 mb-1">
                    <span className="font-medium text-[#303030] text-sm">Дмитрий Волков</span>
                    <span className="text-gray-500 text-xs">1 день назад</span>
                  </div>
                  <p className="text-[#303030] text-sm">Когда следующее видео? Жду продолжения серии!</p>
                  <button className="text-blue-500 text-xs mt-1">Ответить</button>
                </div>
              </div>
            </div>

            {/* Load More Comments */}
            <button className="w-full mt-4 py-2 text-blue-500 text-sm font-medium">
              Показать еще комментарии
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
