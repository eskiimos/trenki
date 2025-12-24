'use client';

import React, { useState, useEffect, Suspense } from 'react';
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
  const [currentIndex, setCurrentIndex] = useState(0);
  
  const userId = getTelegramId();

  // Загрузка shorts
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
  }, [startIndex, userId]);

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
  const handleSwipeUp = () => {
    if (currentIndex < shorts.length - 1) {
      setCurrentIndex(prev => prev + 1);
    }
  };

  // Свайп вниз - предыдущее видео
  const handleSwipeDown = () => {
    if (currentIndex > 0) {
      setCurrentIndex(prev => prev - 1);
    }
  };

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
