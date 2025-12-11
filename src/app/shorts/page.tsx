'use client';

import React, { useState, useRef, useEffect, Suspense, useCallback } from 'react';
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
  const startIndexParam = parseInt(searchParams.get('index') || '0');
  
  const [shorts, setShorts] = useState<ShortData[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [currentVideoIndex, setCurrentVideoIndex] = useState(0);
  const [isTransitioning, setIsTransitioning] = useState(false);
  
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
  const handleShare = async () => {
    if (!currentShort) return;
    
    const shareUrl = `${window.location.origin}/shorts/${currentShort.id}`;
    const shareText = `${currentShort.title}${currentShort.description ? ` - ${currentShort.description}` : ''}`;
    
    try {
      // 1. Telegram Web App (приоритет для Telegram)
      if (window.Telegram?.WebApp?.initDataUnsafe?.user) {
        window.Telegram.WebApp.openTelegramLink(
          `https://t.me/share/url?url=${encodeURIComponent(shareUrl)}&text=${encodeURIComponent(shareText)}`
        );
        return;
      }
      
      // 2. Web Share API (нативная функция поделиться)
      if (navigator.share) {
        await navigator.share({
          title: currentShort.title,
          text: shareText,
          url: shareUrl,
        });
        return;
      }
      
      // 3. Fallback - копируем в буфер обмена
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(shareUrl);
        alert('✓ Ссылка скопирована в буфер обмена');
      } else {
        // Старый метод для браузеров без Clipboard API
        const textArea = document.createElement('textarea');
        textArea.value = shareUrl;
        textArea.style.position = 'fixed';
        textArea.style.left = '-999999px';
        document.body.appendChild(textArea);
        textArea.select();
        document.execCommand('copy');
        document.body.removeChild(textArea);
        alert('✓ Ссылка скопирована');
      }
    } catch (error) {
      console.error('Error sharing:', error);
      alert('Не удалось поделиться видео');
    }
  };

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
    <div className="relative">
      {/* Shorts Player */}
      <div className={`transition-all duration-200 ease-out ${
        isTransitioning ? 'scale-95 opacity-0' : 'scale-100 opacity-100'
      }`}>
        <ShortsPlayer
          short={currentShort}
          onLike={toggleLike}
          onComment={openComments}
          onShare={handleShare}
          backUrl="/"
        />
      </div>

      {/* Touch/Swipe Area for Navigation */}
      <div 
        className="fixed inset-0 pointer-events-auto z-[60]"
        style={{ touchAction: 'pan-y' }}
        onTouchStart={(e) => {
          const startY = e.touches[0].clientY;
          const startX = e.touches[0].clientX;
          
          const handleTouchEnd = (endEvent: TouchEvent) => {
            const endY = endEvent.changedTouches[0].clientY;
            const endX = endEvent.changedTouches[0].clientX;
            const deltaY = endY - startY;
            const deltaX = Math.abs(endX - startX);
            
            // Проверяем что свайп вертикальный (не горизонтальный)
            if (deltaX < 50) {
              if (deltaY > 80) {
                // Swipe down - previous video
                handleSwipeDown();
              } else if (deltaY < -80) {
                // Swipe up - next video
                handleSwipeUp();
              }
            }
            
            document.removeEventListener('touchend', handleTouchEnd);
          };
          
          document.addEventListener('touchend', handleTouchEnd);
        }}
      />
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
