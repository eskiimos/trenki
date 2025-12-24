'use client';

import React, { useState, useEffect, Suspense, useRef, useCallback } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { getTelegramId } from '@/lib/auth';
import { ShortsPlayer } from '@/components/ShortsPlayer';

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
  const [isDragging, setIsDragging] = useState(false);
  const [dragOffset, setDragOffset] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const touchStartY = useRef(0);
  const touchStartTime = useRef(0);
  const isScrolling = useRef(false);
  const loadMoreTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  
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
  }, [userId]);

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
    if (!userId || !currentShort) {
      alert('Пожалуйста, войдите в приложение');
      return;
    }

    const wasLiked = currentShort.isLiked;
    
    // Оптимистичное обновление
    setShorts(prev => prev.map((s, i) => 
      i === currentIndex 
        ? { ...s, isLiked: !wasLiked, likesCount: wasLiked ? s.likesCount - 1 : s.likesCount + 1 }
        : s
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
        setShorts(prev => prev.map((s, i) =>
          i === currentIndex ? { ...s, isLiked: data.isLiked, likesCount: data.likesCount } : s
        ));
      }
    } catch (error) {
      console.error('Error toggling like:', error);
      // Откат
      setShorts(prev => prev.map((s, i) => 
        i === currentIndex 
          ? { ...s, isLiked: wasLiked, likesCount: currentShort.likesCount }
          : s
      ));
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

  // Свайп вверх - следующее видео
  const handleSwipeUp = useCallback(() => {
    if (isScrolling.current) return;
    isScrolling.current = true;
    
    const nextIndex = currentIndex + 1;
    setCurrentIndex(nextIndex);
    setDragOffset(0);

    // Загружаем рекомендации когда приближаемся к концу (3 видео до конца)
    if (nextIndex >= shorts.length - 3) {
      if (loadMoreTimeoutRef.current) {
        clearTimeout(loadMoreTimeoutRef.current);
      }
      loadMoreTimeoutRef.current = setTimeout(() => {
        loadRecommendations();
      }, 300);
    }

    setTimeout(() => { isScrolling.current = false; }, 600);
  }, [currentIndex, shorts.length, loadRecommendations]);

  // Свайп вниз - предыдущее видео
  const handleSwipeDown = useCallback(() => {
    if (isScrolling.current || currentIndex <= 0) return;
    isScrolling.current = true;
    
    setCurrentIndex(prev => prev - 1);
    setDragOffset(0);
    setTimeout(() => { isScrolling.current = false; }, 600);
  }, [currentIndex]);

  // Обработка touch событий для свайпа с плавным перемещением
  const handleTouchStart = (e: React.TouchEvent) => {
    if (isScrolling.current) return;
    touchStartY.current = e.changedTouches[0].screenY;
    touchStartTime.current = Date.now();
    setIsDragging(true);
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!isDragging || isScrolling.current) return;
    
    const currentY = e.changedTouches[0].screenY;
    const offset = currentY - touchStartY.current;
    
    // Ограничиваем смещение половиной экрана для превью
    const maxOffset = window.innerHeight * 0.5;
    const limitedOffset = Math.max(-maxOffset, Math.min(maxOffset, offset));
    
    setDragOffset(limitedOffset);
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (!isDragging) return;
    setIsDragging(false);
    
    const currentY = e.changedTouches[0].screenY;
    const diff = touchStartY.current - currentY;
    const duration = Date.now() - touchStartTime.current;
    const velocity = Math.abs(diff) / duration;
    
    // Свайп вверх (diff > 0) - нужна минимальная дистанция или скорость
    if ((diff > 80 || (diff > 40 && velocity > 0.5)) && currentIndex < shorts.length - 1) {
      handleSwipeUp();
    }
    // Свайп вниз (diff < 0)
    else if ((diff < -80 || (diff < -40 && velocity > 0.5)) && currentIndex > 0) {
      handleSwipeDown();
    }
    else {
      // Возврат на место
      setDragOffset(0);
    }
  };

  // Обработка клавиатуры (стрелки вверх/вниз)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (isScrolling.current) return;
      
      if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
        e.preventDefault();
      }
      
      if (e.key === 'ArrowUp') {
        handleSwipeUp();
      } else if (e.key === 'ArrowDown') {
        handleSwipeDown();
      }
    };
    
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleSwipeUp, handleSwipeDown]);

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

  if (!currentShort) return null;

  return (
    <div 
      ref={containerRef}
      className="fixed inset-0 w-screen h-screen overflow-hidden bg-black"
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
      {/* Контейнер со слайдом */}
      <div 
        className="relative w-full h-full transition-transform duration-300"
        style={{ 
          transform: `translateY(${dragOffset}px)`,
          transitionDuration: isDragging ? '0ms' : '400ms'
        }}
      >
        {/* Предыдущее видео (чтобы было видно при свайпе вниз) */}
        {currentIndex > 0 && (
          <div className="absolute top-0 left-0 w-full h-full -translate-y-full">
            <ShortsPlayer
              short={shorts[currentIndex - 1]}
              onLike={handleLike}
              onComment={handleComment}
              onShare={handleShare}
              onSwipeUp={handleSwipeUp}
              onSwipeDown={handleSwipeDown}
              canSwipeUp={currentIndex < shorts.length}
              canSwipeDown={currentIndex > 1}
            />
          </div>
        )}

        {/* Основное видео */}
        <div className="relative w-full h-full">
          <ShortsPlayer
            key={currentShort.id}
            short={currentShort}
            onLike={handleLike}
            onComment={handleComment}
            onShare={handleShare}
            onSwipeUp={handleSwipeUp}
            onSwipeDown={handleSwipeDown}
            canSwipeUp={currentIndex < shorts.length - 1}
            canSwipeDown={currentIndex > 0}
          />
        </div>

        {/* Следующее видео (чтобы было видно при свайпе вверх) */}
        {currentIndex < shorts.length - 1 && (
          <div className="absolute top-full left-0 w-full h-full translate-y-0">
            <ShortsPlayer
              short={shorts[currentIndex + 1]}
              onLike={handleLike}
              onComment={handleComment}
              onShare={handleShare}
              onSwipeUp={handleSwipeUp}
              onSwipeDown={handleSwipeDown}
              canSwipeUp={currentIndex + 1 < shorts.length - 1}
              canSwipeDown={currentIndex + 1 > 0}
            />
          </div>
        )}
      </div>

      {/* Полоска прогресса */}
      <div className="absolute top-0 left-0 right-0 h-1 bg-white/20 z-50">
        <div 
          className="h-full bg-white transition-all duration-300"
          style={{ width: `${((currentIndex + 1) / shorts.length) * 100}%` }}
        />
      </div>

      {/* Индикатор позиции + подсказки */}
      <div className="absolute bottom-4 right-4 z-40 text-white text-xs bg-black/50 px-3 py-1.5 rounded-full">
        <div className="flex items-center gap-2">
          <span>{currentIndex + 1} / {shorts.length}</span>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M12 5V19M19 12L12 5M5 12L12 19" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </div>
      </div>

      {/* Индикатор загрузки рекомендаций */}
      {isLoadingMore && (
        <div className="absolute bottom-20 left-1/2 transform -translate-x-1/2 z-40">
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
