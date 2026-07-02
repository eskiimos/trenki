'use client';

import React, { useState, useEffect, Suspense, useCallback, useRef } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { getTelegramId } from '@/lib/auth';
import { ShortsPlayer } from '@/components/ShortsPlayer';

// Swiper
import { Swiper, SwiperSlide } from 'swiper/react';
import { Virtual, Mousewheel, Keyboard } from 'swiper/modules';
import type { Swiper as SwiperType } from 'swiper';

// Swiper styles
import 'swiper/css';
import 'swiper/css/virtual';

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
  const startIndex = parseInt(searchParams.get('index') || '0');
  
  const [shorts, setShorts] = useState<ShortData[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [watchedIds, setWatchedIds] = useState<Set<string>>(new Set());
  const swiperRef = useRef<SwiperType | null>(null);
  
  const userId = getTelegramId();

  // Загрузка начальных shorts
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
          setWatchedIds(new Set(loadedShorts.map((s: ShortData) => s.id)));
          
          // Устанавливаем начальный индекс
          if (loadedShorts.length > 0) {
            const idx = Math.min(startIndex, loadedShorts.length - 1);
            setCurrentIndex(Math.max(0, idx));
          }
        }
      } catch (error) {
        console.error('Error loading shorts:', error);
      } finally {
        setIsLoading(false);
      }
    };
    loadShorts();
  }, [userId, startIndex]);

  // Загрузка рекомендаций при приближении к концу
  const loadRecommendations = useCallback(async () => {
    if (isLoadingMore || shorts.length < 3) return;

    try {
      setIsLoadingMore(true);
      const excludeIds = Array.from(watchedIds);
      const params = new URLSearchParams({
        limit: '10',
        offset: '0'
      });

      if (userId) {
        params.append('userId', userId);
      }

      excludeIds.forEach(id => {
        params.append('exclude', id);
      });

      const response = await fetch(`/api/shorts/recommendations?${params}`);
      if (response.ok) {
        const data = await response.json();
        const newShorts = data.shorts || [];
        
        if (newShorts.length > 0) {
          setShorts(prev => [...prev, ...newShorts]);
          setWatchedIds(prev => new Set([...prev, ...newShorts.map((s: ShortData) => s.id)]));
        }
      }
    } catch (error) {
      console.error('Error loading recommendations:', error);
    } finally {
      setIsLoadingMore(false);
    }
  }, [userId, watchedIds, isLoadingMore, shorts.length]);

  // Текущий short
  const currentShort = shorts[currentIndex];

  // Счетчик просмотров
  useEffect(() => {
    if (!currentShort) return;
    
    const timer = setTimeout(async () => {
      try {
        await fetch(`/api/shorts/${currentShort.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'incrementViews' }),
        });
      } catch (error) {
        console.error('Error incrementing views:', error);
      }
    }, 3000);
    
    return () => clearTimeout(timer);
  }, [currentShort?.id]);

  // Лайк
  const handleLike = async () => {
    if (!currentShort) return;

    const id = currentShort.id;
    const wasLiked = !!currentShort.isLiked;
    const baseCount = currentShort.likesCount;

    const setLikeState = (isLiked: boolean, likesCount: number) =>
      setShorts(prev => prev.map((s, i) => (i === currentIndex ? { ...s, isLiked, likesCount } : s)));

    // Оптимистичное обновление
    setLikeState(!wasLiked, wasLiked ? baseCount - 1 : baseCount + 1);

    try {
      // Сессия — по cookie (requireAuthUser на сервере). НЕ полагаемся на
      // telegramId из localStorage: раньше при пустом кэше кидало «войдите»
      // даже с валидной сессией.
      const response = await fetch(`/api/shorts/${id}/likes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });

      if (response.status === 401) {
        setLikeState(wasLiked, baseCount); // откат
        router.push('/login');
        return;
      }
      if (response.ok) {
        const data = await response.json();
        setLikeState(!!data.isLiked, data.likesCount);
      } else {
        setLikeState(wasLiked, baseCount); // откат
      }
    } catch (error) {
      console.error('Error toggling like:', error);
      setLikeState(wasLiked, baseCount); // откат
    }
  };

  // Комментарии
  const handleComment = () => {
    if (currentShort) {
      router.push(`/shorts/${currentShort.id}`);
    }
  };

  // Поделиться
  const handleShare = async () => {
    if (!currentShort) return;
    
    const shareUrl = `${window.location.origin}/shorts/${currentShort.id}`;
    const shareText = currentShort.title;
    
    try {
      if (navigator.share) {
        await navigator.share({
          title: shareText,
          url: shareUrl,
        });
      } else if (navigator.clipboard) {
        await navigator.clipboard.writeText(shareUrl);
        alert('Ссылка скопирована!');
      }
    } catch (error) {
      console.log('Share error:', error);
    }
  };

  // Обработка смены слайда
  const handleSlideChange = useCallback((swiper: SwiperType) => {
    const newIndex = swiper.activeIndex;
    setCurrentIndex(newIndex);
    
    // Загружаем рекомендации когда приближаемся к концу (3 видео до конца)
    if (newIndex >= shorts.length - 3) {
      loadRecommendations();
    }
  }, [shorts.length, loadRecommendations]);

  // Загрузка
  if (isLoading) {
    return (
      <div className="fixed inset-0 bg-black flex items-center justify-center">
        <div className="text-white text-center">
          <div className="w-12 h-12 border-4 border-white/30 border-t-white rounded-full animate-spin mx-auto mb-4"></div>
          <p>Загрузка...</p>
        </div>
      </div>
    );
  }

  // Нет shorts
  if (shorts.length === 0) {
    return (
      <div className="fixed inset-0 bg-black flex items-center justify-center">
        <div className="text-white text-center">
          <p className="text-xl mb-4">Shorts пока нет</p>
          <Link href="/" className="text-blue-400 hover:text-blue-300">
            Вернуться на главную
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 w-screen h-screen overflow-hidden bg-black">
      <Swiper
        modules={[Virtual, Mousewheel, Keyboard]}
        direction="vertical"
        slidesPerView={1}
        spaceBetween={0}
        initialSlide={startIndex}
        virtual={{
          enabled: true,
          addSlidesAfter: 1,
          addSlidesBefore: 1,
        }}
        mousewheel={{
          sensitivity: 1,
          thresholdDelta: 30,
        }}
        keyboard={{
          enabled: true,
        }}
        speed={400}
        resistance={true}
        resistanceRatio={0.85}
        threshold={10}
        touchRatio={1}
        touchAngle={45}
        grabCursor={false}
        cssMode={false}
        onSwiper={(swiper) => {
          swiperRef.current = swiper;
        }}
        onSlideChange={handleSlideChange}
        className="w-full h-full"
        style={{ 
          touchAction: 'pan-y',
        }}
      >
        {shorts.map((short, index) => (
          <SwiperSlide 
            key={short.id} 
            virtualIndex={index}
            className="!h-full"
          >
            <ShortsPlayer
              short={short}
              onLike={handleLike}
              onComment={handleComment}
              onShare={handleShare}
              canSwipeUp={index < shorts.length - 1}
              canSwipeDown={index > 0}
              isActive={index === currentIndex}
            />
          </SwiperSlide>
        ))}
      </Swiper>

      {/* Полоска прогресса */}
      <div className="absolute top-0 left-0 right-0 h-1 bg-white/20 z-50 pointer-events-none">
        <div 
          className="h-full bg-white transition-all duration-300"
          style={{ width: `${((currentIndex + 1) / shorts.length) * 100}%` }}
        />
      </div>

      {/* Индикатор позиции */}
      <div className="absolute bottom-4 right-4 z-40 text-white text-xs bg-black/50 px-3 py-1.5 rounded-full pointer-events-none">
        <div className="flex items-center gap-2">
          <span>{currentIndex + 1} / {shorts.length}</span>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M12 5V19M19 12L12 5M5 12L12 19" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </div>
      </div>

      {/* Индикатор загрузки рекомендаций */}
      {isLoadingMore && (
        <div className="absolute bottom-20 left-1/2 transform -translate-x-1/2 z-40 pointer-events-none">
          <div className="flex items-center gap-2 text-white text-xs bg-black/50 px-3 py-2 rounded-full">
            <div className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
            <span>Загрузка рекомендаций...</span>
          </div>
        </div>
      )}
    </div>
  );
};

export default function ShortsPage() {
  return (
    <Suspense fallback={
      <div className="fixed inset-0 bg-black flex items-center justify-center">
        <div className="w-12 h-12 border-4 border-white/30 border-t-white rounded-full animate-spin"></div>
      </div>
    }>
      <ShortsContent />
    </Suspense>
  );
}
