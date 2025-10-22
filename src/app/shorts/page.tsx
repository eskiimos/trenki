'use client';

import React, { useState, useRef, useEffect, Suspense, useCallback } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { ArrowLeft, Heart, MessageCircle, Share, MoreVertical, Volume2, VolumeX } from 'lucide-react';
import { getTelegramId } from '@/lib/auth';
import { isKinescopeUrl, getKinescopeDirectUrl } from '@/lib/videoQuality';

interface ShortData {
  id: string;
  title: string;
  description?: string;
  videoUrl: string;
  thumbnail?: string;
  tags: string[];
  viewsCount: number;
  likesCount: number;
  commentsCount?: number;
  isLiked?: boolean;
  order: number;
  trainerId?: string | null;
  trainer?: {
    id: string;
    name: string;
    lastName: string;
    avatar: string | null;
  };
}

const ShortsContent = () => {
  const router = useRouter();
  const searchParams = useSearchParams();
  const startIndexParam = parseInt(searchParams.get('index') || '0');
  
  const [shorts, setShorts] = useState<ShortData[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [currentVideoIndex, setCurrentVideoIndex] = useState(0);
  const [isMuted, setIsMuted] = useState(true);
  const [isTransitioning, setIsTransitioning] = useState(false);
  
  // Kinescope URLs cache
  const [kinescopeUrls, setKinescopeUrls] = useState<Record<string, string>>({});
  
  const videoRef = useRef<HTMLVideoElement>(null);
  const userId = getTelegramId();

  // Загрузка shorts из API
  useEffect(() => {
    const loadShorts = async () => {
      try {
        setIsLoading(true);
        const url = userId 
          ? `/api/shorts?userId=${userId}`
          : '/api/shorts';
        const response = await fetch(url);
        if (response.ok) {
          const data = await response.json();
          const loadedShorts = data.shorts || [];
          setShorts(loadedShorts);
          
          // Нормализуем индекс
          if (loadedShorts.length > 0) {
            const normalizedIndex = Math.min(startIndexParam, loadedShorts.length - 1);
            setCurrentVideoIndex(normalizedIndex);
          }
        }
      } catch (error) {
        console.error('Error loading shorts:', error);
      } finally {
        setIsLoading(false);
      }
    };
    loadShorts();
  }, [startIndexParam, userId]);

  const currentShort = shorts[currentVideoIndex];

  // Загрузка Kinescope URL
  useEffect(() => {
    const loadKinescopeUrl = async () => {
      if (!currentShort || !isKinescopeUrl(currentShort.videoUrl)) return;
      
      // Проверяем кэш
      if (kinescopeUrls[currentShort.id]) return;
      
      try {
        const result = await getKinescopeDirectUrl(currentShort.videoUrl);
        if (result.directUrl) {
          setKinescopeUrls(prev => ({
            ...prev,
            [currentShort.id]: result.directUrl
          }));
        }
      } catch (error) {
        console.error('Error loading Kinescope URL:', error);
      }
    };
    
    loadKinescopeUrl();
  }, [currentShort, kinescopeUrls]);

  // Получаем видео URL (Kinescope или прямой)
  const getVideoUrl = (short: ShortData) => {
    if (isKinescopeUrl(short.videoUrl) && kinescopeUrls[short.id]) {
      return kinescopeUrls[short.id];
    }
    return short.videoUrl;
  };

  // Увеличиваем счетчик просмотров
  useEffect(() => {
    const incrementViews = async () => {
      if (!currentShort) return;
      
      try {
        await fetch(`/api/shorts/${currentShort.id}`, {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ action: 'incrementViews' }),
        });
      } catch (error) {
        console.error('Error incrementing views:', error);
      }
    };
    
    // Увеличиваем просмотры через 3 секунды просмотра
    const timer = setTimeout(incrementViews, 3000);
    return () => clearTimeout(timer);
  }, [currentShort]);

  // Лайк/дизлайк
  const toggleLike = async () => {
    if (!userId || !currentShort) {
      alert('Пожалуйста, войдите в приложение');
      return;
    }

    const wasLiked = currentShort.isLiked;
    
    // Оптимистичное обновление UI
    setShorts(prev => prev.map((short, idx) => 
      idx === currentVideoIndex 
        ? {
            ...short,
            isLiked: !wasLiked,
            likesCount: wasLiked ? short.likesCount - 1 : short.likesCount + 1
          }
        : short
    ));

    try {
      const response = await fetch(`/api/shorts/${currentShort.id}/likes`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Telegram-User-ID': userId,
        },
      });

      if (response.ok) {
        const data = await response.json();
        // Обновляем с данными сервера
        setShorts(prev => prev.map((short, idx) =>
          idx === currentVideoIndex
            ? { ...short, isLiked: data.isLiked, likesCount: data.likesCount }
            : short
        ));
      } else {
        // Откатываем изменения при ошибке
        setShorts(prev => prev.map((short, idx) =>
          idx === currentVideoIndex
            ? { ...short, isLiked: wasLiked, likesCount: currentShort.likesCount }
            : short
        ));
      }
    } catch (error) {
      console.error('Error toggling like:', error);
      // Откатываем изменения
      setShorts(prev => prev.map((short, idx) =>
        idx === currentVideoIndex
          ? { ...short, isLiked: wasLiked, likesCount: currentShort.likesCount }
          : short
      ));
    }
  };

  const toggleMute = () => {
    if (videoRef.current) {
      videoRef.current.muted = !isMuted;
      setIsMuted(!isMuted);
    }
  };

  const handleVideoEnd = () => {
    if (videoRef.current) {
      videoRef.current.currentTime = 0;
      videoRef.current.play();
    }
  };

  const handleSwipeUp = useCallback(() => {
    if (currentVideoIndex < shorts.length - 1 && !isTransitioning) {
      setIsTransitioning(true);
      setTimeout(() => {
        setCurrentVideoIndex(prev => prev + 1);
        setIsTransitioning(false);
      }, 150);
    }
  }, [currentVideoIndex, shorts.length, isTransitioning]);

  const handleSwipeDown = useCallback(() => {
    if (currentVideoIndex > 0 && !isTransitioning) {
      setIsTransitioning(true);
      setTimeout(() => {
        setCurrentVideoIndex(prev => prev - 1);
        setIsTransitioning(false);
      }, 150);
    }
  }, [currentVideoIndex, isTransitioning]);

  // Открыть комментарии
  const openComments = () => {
    if (currentShort) {
      router.push(`/shorts/${currentShort.id}`);
    }
  };

  // Поделиться
  const handleShare = () => {
    if (!currentShort) return;
    
    const shareUrl = `${window.location.origin}/shorts/${currentShort.id}`;
    const shareText = `${currentShort.title}${currentShort.description ? ` - ${currentShort.description}` : ''}`;
    
    // Telegram Web App share
    if (window.Telegram?.WebApp) {
      window.Telegram.WebApp.openTelegramLink(`https://t.me/share/url?url=${encodeURIComponent(shareUrl)}&text=${encodeURIComponent(shareText)}`);
    } else if (navigator.share) {
      // Web Share API
      navigator.share({
        title: currentShort.title,
        text: shareText,
        url: shareUrl,
      }).catch(console.error);
    } else {
      // Fallback - копируем в буфер
      navigator.clipboard.writeText(shareUrl);
      alert('Ссылка скопирована!');
    }
  };

  useEffect(() => {
    if (videoRef.current && !isTransitioning && currentShort) {
      videoRef.current.currentTime = 0;
      videoRef.current.play().catch(console.error);
    }
  }, [currentVideoIndex, isTransitioning, currentShort]);

  if (isLoading) {
    return (
      <div className="fixed inset-0 bg-[#101530] z-50 flex items-center justify-center">
        <div className="text-white text-center">
          <div className="w-16 h-16 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p>Загрузка...</p>
        </div>
      </div>
    );
  }

  if (shorts.length === 0) {
    return (
      <div className="fixed inset-0 bg-[#101530] z-50 flex items-center justify-center">
        <div className="text-white text-center">
          <p className="text-xl mb-4">Shorts пока нет</p>
          <Link href="/" className="text-blue-400 hover:text-blue-300">
            Вернуться на главную
          </Link>
        </div>
      </div>
    );
  }

  if (!currentShort) return null;

  return (
    <div className="fixed inset-0 bg-[#101530] z-50 flex">
      {/* Header */}
      <div className="absolute top-0 left-0 right-0 z-20 flex items-center justify-between p-4 bg-gradient-to-b from-[#101530]/90 to-transparent" style={{ paddingTop: '90px' }}>
        <Link href="/" className="text-white hover:text-gray-300">
          <ArrowLeft size={24} />
        </Link>
        <h1 className="text-white font-semibold">Треньки</h1>
        <button className="text-white hover:text-gray-300">
          <MoreVertical size={24} />
        </button>
      </div>

      {/* Video Container */}
      <div className="relative w-full h-full flex items-center justify-center overflow-hidden">
        <div className={`w-full h-full transition-all duration-300 ease-out ${
          isTransitioning ? 'scale-95 opacity-50' : 'scale-100 opacity-100'
        }`}>
          <video
            ref={videoRef}
            className="w-full h-full object-cover"
            src={getVideoUrl(currentShort)}
            poster={currentShort.thumbnail}
            autoPlay
            muted={isMuted}
            loop
            playsInline
            onEnded={handleVideoEnd}
            onClick={toggleMute}
          />
        </div>

        {/* UI Overlay */}
        <div className={`absolute inset-0 transition-opacity duration-200 ${
          isTransitioning ? 'opacity-0' : 'opacity-100'
        }`}>
          {/* Right Side Actions */}
          <div className="absolute right-4 bottom-20 flex flex-col items-center space-y-6">
            {/* Like Button */}
            <button
              onClick={toggleLike}
              className="flex flex-col items-center space-y-1"
            >
              <div className={`w-12 h-12 rounded-full flex items-center justify-center transition-all duration-200 border ${
                currentShort.isLiked ? 'bg-red-500 scale-110 border-red-400' : 'bg-white/10 backdrop-blur-sm border-white/20'
              }`}>
                <Heart 
                  size={24} 
                  className={`${currentShort.isLiked ? 'text-white fill-current' : 'text-white'}`} 
                />
              </div>
              <span className="text-white text-xs font-medium">
                {currentShort.likesCount}
              </span>
            </button>

            {/* Comment Button */}
            <button 
              onClick={openComments}
              className="flex flex-col items-center space-y-1"
            >
              <div className="w-12 h-12 bg-white/10 backdrop-blur-sm rounded-full flex items-center justify-center border border-white/20">
                <MessageCircle size={24} className="text-white" />
              </div>
              <span className="text-white text-xs font-medium">
                {currentShort.commentsCount || 0}
              </span>
            </button>

            {/* Share Button */}
            <button 
              onClick={handleShare}
              className="flex flex-col items-center space-y-1"
            >
              <div className="w-12 h-12 bg-white/10 backdrop-blur-sm rounded-full flex items-center justify-center border border-white/20">
                <Share size={24} className="text-white" />
              </div>
              <span className="text-white text-xs font-medium">Поделиться</span>
            </button>

            {/* Volume Button */}
            <button
              onClick={toggleMute}
              className="flex flex-col items-center space-y-1"
            >
              <div className="w-12 h-12 bg-white/10 backdrop-blur-sm rounded-full flex items-center justify-center border border-white/20">
                {isMuted ? (
                  <VolumeX size={24} className="text-white" />
                ) : (
                  <Volume2 size={24} className="text-white" />
                )}
              </div>
            </button>
          </div>

          {/* Bottom Info */}
          <div className="absolute bottom-4 left-4 right-20 text-white">
            {currentShort.trainer && (
              <div className="flex items-center space-x-3 mb-3">
                <div className="w-10 h-10 bg-white/20 rounded-full flex items-center justify-center border border-white/30 overflow-hidden">
                  {currentShort.trainer.avatar ? (
                    <img 
                      src={currentShort.trainer.avatar} 
                      alt={currentShort.trainer.name}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <span className="text-white font-semibold text-sm">
                      {currentShort.trainer.name.charAt(0)}
                    </span>
                  )}
                </div>
                <div>
                  <h3 className="font-semibold text-sm text-white">
                    {currentShort.trainer.name} {currentShort.trainer.lastName}
                  </h3>
                </div>
              </div>
            )}
            <h2 className="font-bold text-base mb-1">{currentShort.title}</h2>
            {currentShort.description && (
              <p className="text-sm mb-2 text-gray-200 line-clamp-2">{currentShort.description}</p>
            )}
            {currentShort.tags && currentShort.tags.length > 0 && (
              <div className="flex flex-wrap gap-2 mt-2">
                {currentShort.tags.slice(0, 3).map((tag, idx) => (
                  <span 
                    key={idx}
                    className="text-xs bg-white/10 backdrop-blur-sm px-2 py-1 rounded-full"
                  >
                    #{tag}
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Touch/Swipe Area for Navigation */}
      <div className="absolute inset-0 pointer-events-none">
        {/* Top half - swipe down for previous */}
        <div 
          className="absolute top-0 left-0 right-0 h-1/2 pointer-events-auto"
          onTouchStart={(e) => {
            const startY = e.touches[0].clientY;
            const handleTouchEnd = (endEvent: TouchEvent) => {
              const endY = endEvent.changedTouches[0].clientY;
              if (endY - startY > 50) {
                handleSwipeDown();
              }
              document.removeEventListener('touchend', handleTouchEnd);
            };
            document.addEventListener('touchend', handleTouchEnd);
          }}
        />
        
        {/* Bottom half - swipe up for next */}
        <div 
          className="absolute bottom-0 left-0 right-0 h-1/2 pointer-events-auto"
          onTouchStart={(e) => {
            const startY = e.touches[0].clientY;
            const handleTouchEnd = (endEvent: TouchEvent) => {
              const endY = endEvent.changedTouches[0].clientY;
              if (startY - endY > 50) {
                handleSwipeUp();
              }
              document.removeEventListener('touchend', handleTouchEnd);
            };
            document.addEventListener('touchend', handleTouchEnd);
          }}
        />
      </div>
    </div>
  );
};

const ShortsPage = () => {
  return (
    <Suspense fallback={
      <div className="fixed inset-0 bg-[#101530] z-50 flex items-center justify-center">
        <div className="text-white text-center">
          <div className="w-16 h-16 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p>Загрузка...</p>
        </div>
      </div>
    }>
      <ShortsContent />
    </Suspense>
  );
};

export default ShortsPage;
