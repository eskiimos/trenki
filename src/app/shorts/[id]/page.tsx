'use client';

import React, { useState, useRef, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Heart, MessageCircle, Share, Volume2, VolumeX } from 'lucide-react';

interface ShortPageProps {
  params: Promise<{
    id: string;
  }>;
}

interface ShortData {
  id: string;
  title: string;
  description?: string;
  videoUrl: string;
  thumbnail?: string;
  tags: string[];
  viewsCount: number;
  order: number;
  trainerId?: string | null;
  trainer?: {
    id: string;
    name: string;
    lastName: string;
    avatar: string | null;
  };
}

export default function ShortPage({ params }: ShortPageProps) {
  const router = useRouter();
  const [shortId, setShortId] = useState<string>('');
  const [allShorts, setAllShorts] = useState<ShortData[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [isLiked, setIsLiked] = useState(false);
  const [isMuted, setIsMuted] = useState(true);
  const [isDescriptionExpanded, setIsDescriptionExpanded] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  
  // Для свайпа
  const [touchStart, setTouchStart] = useState(0);
  const [touchEnd, setTouchEnd] = useState(0);
  const [isTransitioning, setIsTransitioning] = useState(false);

  // Загружаем все shorts и находим текущий
  useEffect(() => {
    const loadShorts = async () => {
      try {
        setIsLoading(true);
        
        // Получаем ID из params
        const resolvedParams = await params;
        const currentShortId = resolvedParams.id;
        setShortId(currentShortId);
        
        // Загружаем все shorts
        const response = await fetch('/api/shorts');
        if (response.ok) {
          const data = await response.json();
          const shorts = data.shorts || [];
          setAllShorts(shorts);
          
          // Находим индекс текущего short
          const index = shorts.findIndex((s: ShortData) => s.id === currentShortId);
          if (index !== -1) {
            setCurrentIndex(index);
          } else {
            console.error('Short not found');
            router.push('/');
          }
        } else {
          console.error('Failed to load shorts');
          router.push('/');
        }
      } catch (error) {
        console.error('Error loading shorts:', error);
        router.push('/');
      } finally {
        setIsLoading(false);
      }
    };
    loadShorts();
  }, [params, router]);

  // Переключение видео
  const goToNextVideo = useCallback(() => {
    if (isTransitioning || currentIndex >= allShorts.length - 1) return;
    setIsTransitioning(true);
    const nextIndex = currentIndex + 1;
    setCurrentIndex(nextIndex);
    router.push(`/shorts/${allShorts[nextIndex].id}`, { scroll: false });
    setTimeout(() => setIsTransitioning(false), 300);
  }, [currentIndex, allShorts, router, isTransitioning]);

  const goToPrevVideo = useCallback(() => {
    if (isTransitioning || currentIndex <= 0) return;
    setIsTransitioning(true);
    const prevIndex = currentIndex - 1;
    setCurrentIndex(prevIndex);
    router.push(`/shorts/${allShorts[prevIndex].id}`, { scroll: false });
    setTimeout(() => setIsTransitioning(false), 300);
  }, [currentIndex, allShorts, router, isTransitioning]);

  // Обработка свайпа
  const handleTouchStart = (e: React.TouchEvent) => {
    setTouchStart(e.targetTouches[0].clientY);
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    setTouchEnd(e.targetTouches[0].clientY);
  };

  const handleTouchEnd = () => {
    if (!touchStart || !touchEnd) return;
    
    const distance = touchStart - touchEnd;
    const isSwipeUp = distance > 50;
    const isSwipeDown = distance < -50;

    if (isSwipeUp) {
      goToNextVideo();
    }
    if (isSwipeDown) {
      goToPrevVideo();
    }

    setTouchStart(0);
    setTouchEnd(0);
  };

  // Обработка колеса мыши
  const handleWheel = useCallback((e: WheelEvent) => {
    e.preventDefault();
    if (e.deltaY > 0) {
      goToNextVideo();
    } else {
      goToPrevVideo();
    }
  }, [goToNextVideo, goToPrevVideo]);

  useEffect(() => {
    const container = containerRef.current;
    if (container) {
      container.addEventListener('wheel', handleWheel, { passive: false });
      return () => container.removeEventListener('wheel', handleWheel);
    }
  }, [handleWheel]);

  // Получаем текущий short и проверяем тип видео
  const currentShortData = allShorts[currentIndex];
  const isKinescopeVideo = currentShortData?.videoUrl?.includes('kinescope.io') || false;

  // Принудительный автоплей при смене видео
  useEffect(() => {
    if (videoRef.current && !isKinescopeVideo && currentShortData) {
      const playVideo = async () => {
        try {
          await videoRef.current?.play();
        } catch (error) {
          console.log('Autoplay was prevented:', error);
          // Если автоплей заблокирован, показываем кнопку play
        }
      };
      playVideo();
    }
  }, [currentIndex, currentShortData?.id, isKinescopeVideo]);

  const toggleMute = () => {
    if (videoRef.current) {
      videoRef.current.muted = !isMuted;
      setIsMuted(!isMuted);
    }
  };

  const toggleLike = () => {
    setIsLiked(!isLiked);
  };

  // Обработка клика по видео для старта воспроизведения
  const handleVideoClick = () => {
    if (videoRef.current) {
      if (videoRef.current.paused) {
        videoRef.current.play();
      } else {
        videoRef.current.pause();
      }
    }
  };

  if (isLoading) {
    return (
      <div className="h-screen w-screen bg-black flex items-center justify-center">
        <div className="text-white text-lg">Загрузка...</div>
      </div>
    );
  }

  if (allShorts.length === 0 || !currentShortData) {
    return null;
  }

  const shortData = currentShortData;

  return (
    <div 
      ref={containerRef}
      className="h-screen w-screen bg-black relative overflow-hidden"
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
      {/* Видео */}
      <div className="h-full w-full relative">
        {isKinescopeVideo ? (
          // Используем iframe для Kinescope
          <iframe
            src={shortData.videoUrl}
            className="w-full h-full"
            allow="autoplay; fullscreen; picture-in-picture; encrypted-media; gyroscope; accelerometer; clipboard-write;"
            frameBorder="0"
            allowFullScreen
          />
        ) : (
          // Обычный video тег для локальных файлов
          <video
            ref={videoRef}
            key={shortData.id}
            className="w-full h-full object-cover cursor-pointer"
            src={shortData.videoUrl}
            poster={shortData.thumbnail}
            autoPlay
            loop
            muted={isMuted}
            playsInline
            preload="auto"
            onClick={handleVideoClick}
            onLoadedData={() => {
              // Принудительный старт после загрузки
              videoRef.current?.play().catch(err => console.log('Play prevented:', err));
            }}
          />
        )}
      </div>

      {/* Индикатор прогресса */}
      <div className="absolute top-4 left-1/2 transform -translate-x-1/2 flex items-center gap-1 z-20">
        {allShorts.map((_, index) => (
          <div
            key={index}
            className={`h-0.5 w-8 rounded-full transition-all ${
              index === currentIndex ? 'bg-white' : 'bg-white/30'
            }`}
          />
        ))}
      </div>

      {/* Кнопка назад */}
      <Link href="/" className="absolute top-4 left-4 z-10">
        <button className="w-10 h-10 bg-black/50 backdrop-blur-sm rounded-full flex items-center justify-center">
          <ArrowLeft className="text-white" size={20} />
        </button>
      </Link>

      {/* Боковая панель с действиями - только для обычного video */}
      {!isKinescopeVideo && (
        <div className="absolute right-4 bottom-20 flex flex-col gap-6 z-10">
          {/* Лайк */}
          <button 
            onClick={toggleLike}
            className="flex flex-col items-center gap-1"
          >
            <div className="w-12 h-12 bg-black/50 backdrop-blur-sm rounded-full flex items-center justify-center">
              <Heart 
                className={isLiked ? "text-red-500 fill-red-500" : "text-white"} 
                size={24} 
              />
            </div>
            <span className="text-white text-xs">{shortData.viewsCount || 0}</span>
          </button>

          {/* Комментарии */}
          <button className="flex flex-col items-center gap-1">
            <div className="w-12 h-12 bg-black/50 backdrop-blur-sm rounded-full flex items-center justify-center">
              <MessageCircle className="text-white" size={24} />
            </div>
            <span className="text-white text-xs">0</span>
          </button>

          {/* Поделиться */}
          <button className="flex flex-col items-center gap-1">
            <div className="w-12 h-12 bg-black/50 backdrop-blur-sm rounded-full flex items-center justify-center">
              <Share className="text-white" size={24} />
            </div>
          </button>

          {/* Звук */}
          <button onClick={toggleMute} className="flex flex-col items-center gap-1">
            <div className="w-12 h-12 bg-black/50 backdrop-blur-sm rounded-full flex items-center justify-center">
              {isMuted ? (
                <VolumeX className="text-white" size={24} />
              ) : (
                <Volume2 className="text-white" size={24} />
              )}
            </div>
          </button>
        </div>
      )}

      {/* Информация о видео - поверх любого типа видео */}
      <div className="absolute bottom-0 left-0 right-0 p-4 pb-20 bg-gradient-to-t from-black/90 via-black/70 to-transparent z-10 pointer-events-none">
        <div className="pointer-events-auto">
          {/* Аватарка и имя тренера */}
          {shortData.trainer && (
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 rounded-full overflow-hidden bg-gray-700 flex-shrink-0">
                {shortData.trainer.avatar ? (
                  <img 
                    src={shortData.trainer.avatar} 
                    alt={`${shortData.trainer.name} ${shortData.trainer.lastName}`}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-white font-bold">
                    {shortData.trainer.name.charAt(0)}
                  </div>
                )}
              </div>
              <span className="text-white font-semibold text-sm">
                {shortData.trainer.name} {shortData.trainer.lastName}
              </span>
            </div>
          )}

          {/* Название видео */}
          <h2 className="text-white text-base font-bold mb-2">{shortData.title}</h2>
          
          {/* Описание с раскрытием */}
          {shortData.description && (
            <div className="mb-3">
              <p 
                className={`text-white/90 text-sm leading-relaxed ${
                  isDescriptionExpanded ? '' : 'line-clamp-3'
                }`}
              >
                {shortData.description}
              </p>
              {shortData.description.length > 100 && (
                <button
                  onClick={() => setIsDescriptionExpanded(!isDescriptionExpanded)}
                  className="text-white/70 text-xs mt-1 hover:text-white transition-colors"
                >
                  {isDescriptionExpanded ? 'Скрыть' : 'Ещё...'}
                </button>
              )}
            </div>
          )}

          {/* Теги */}
          {shortData.tags.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {shortData.tags.map((tag, index) => (
                <span key={index} className="text-white/80 text-xs">
                  #{tag}
                </span>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Подсказки для навигации */}
      <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 pointer-events-none z-0">
        {currentIndex < allShorts.length - 1 && (
          <div className="text-white/30 text-sm mb-4 flex items-center gap-2">
            <span>↑</span>
            <span>Свайп вверх</span>
          </div>
        )}
        {currentIndex > 0 && (
          <div className="text-white/30 text-sm flex items-center gap-2">
            <span>↓</span>
            <span>Свайп вниз</span>
          </div>
        )}
      </div>
    </div>
  );
}
