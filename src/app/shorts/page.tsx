'use client';

import React, { useState, useEffect, Suspense, useCallback, useRef } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { ShortsPlayer } from '@/components/ShortsPlayer';
import { ShortsSheet } from '@/components/ShortsSheet';
import BottomNavigation from '@/components/BottomNavigation';
import Toast from '@/components/Toast';

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
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  const swiperRef = useRef<SwiperType | null>(null);

  // Шит «описание + комментарии» (Instagram-стиль): видео сжимается в карточку
  // сверху, ниже выезжает шит. Пока шит открыт — свайпы ленты заблокированы.
  // Закрытие с exit-анимацией: шит остаётся смонтированным ~300мс со slideDown
  // (тот же паттерн, что у шторки настроек плеера в video/[id]).
  const [sheetShortId, setSheetShortId] = useState<string | null>(null);
  const [sheetClosing, setSheetClosing] = useState(false);
  const sheetCloseTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const SHEET_ANIM_MS = 300; // = длительность .animate-slideDown/.animate-slideUp

  const openSheet = useCallback((shortId: string) => {
    if (sheetCloseTimerRef.current) {
      clearTimeout(sheetCloseTimerRef.current);
      sheetCloseTimerRef.current = null;
    }
    setSheetClosing(false);
    setSheetShortId(shortId);
    // Блокируем навигацию по ленте, пока открыт шит (иначе карточка уедет на
    // другой тренёк, а шит останется со старыми комментариями)
    const swiper = swiperRef.current;
    if (swiper) {
      swiper.allowTouchMove = false;
      swiper.mousewheel?.disable();
      swiper.keyboard?.disable();
    }
  }, []);

  const closeSheet = useCallback(() => {
    if (!sheetShortId || sheetCloseTimerRef.current) return; // уже закрыто/закрывается
    setSheetClosing(true);
    // Возвращаем управление лентой сразу — карточка уже разворачивается обратно
    const swiper = swiperRef.current;
    if (swiper) {
      swiper.allowTouchMove = true;
      swiper.mousewheel?.enable();
      swiper.keyboard?.enable();
    }
    sheetCloseTimerRef.current = setTimeout(() => {
      sheetCloseTimerRef.current = null;
      setSheetShortId(null);
      setSheetClosing(false);
    }, SHEET_ANIM_MS);
  }, [sheetShortId]);

  useEffect(() => () => {
    if (sheetCloseTimerRef.current) clearTimeout(sheetCloseTimerRef.current);
  }, []);

  // Комментарий добавлен в шите — обновляем счётчик на кнопке рейла
  const handleCommentAdded = useCallback((shortId: string) => {
    setShorts(prev => prev.map(s =>
      s.id === shortId ? { ...s, commentsCount: (s.commentsCount || 0) + 1 } : s
    ));
  }, []);

  // userId в query больше не передаём: сервер берёт пользователя из httpOnly-
  // cookie сессии (isLiked и т.п.), query-параметр он игнорировал.

  // Загрузка начальных shorts
  useEffect(() => {
    const loadShorts = async () => {
      try {
        setIsLoading(true);
        const response = await fetch('/api/shorts');
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
  }, [startIndex]);

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
  }, [watchedIds, isLoadingMore, shorts.length]);

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
        setToast({ message: 'Ссылка скопирована', type: 'success' });
      }
    } catch (error) {
      // Отмена share-шита пользователем — не ошибка
      if ((error as Error)?.name !== 'AbortError') {
        console.log('Share error:', error);
      }
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
          <p className="text-xl mb-4">Треньков пока нет</p>
          <Link href="/" className="text-blue-400 hover:text-blue-300">
            Вернуться на главную
          </Link>
        </div>
      </div>
    );
  }

  const sheetShort = sheetShortId ? shorts.find(s => s.id === sheetShortId) ?? null : null;
  // Пока идёт exit-анимация шита, карточка уже разворачивается обратно
  const sheetOpenVisual = sheetShortId !== null && !sheetClosing;

  return (
    <div className="fixed inset-0 w-screen h-screen overflow-hidden bg-black">
      {/* Лента заканчивается НАД тапбаром (как в Instagram Reels): видео и
          кнопки рейла не перекрываются навигацией. 72px — реальная высота
          контента тапбара (12 паддинг + 48 иконки + 12), safe-area добавляется
          сверху; иначе нижние 16px видео и полоса прогресса прятались бы за баром. */}
      <div
        className="absolute left-0 right-0 top-0 overflow-hidden"
        style={{ bottom: 'calc(env(safe-area-inset-bottom, 0px) + 72px)' }}
      >
        {/* Обёртка ленты: при открытом шите плавно сжимается в карточку сверху
            (видео продолжает играть), при закрытии так же плавно растягивается
            обратно — transition по top/width/height/border-radius. */}
        <div
          className="absolute overflow-hidden transition-all duration-300 ease-out"
          style={sheetOpenVisual ? {
            top: 'calc(env(safe-area-inset-top, 0px) + 8px)',
            left: '50%',
            transform: 'translateX(-50%)',
            width: 'calc(38vh * 9 / 16)',
            height: '38vh',
            borderRadius: 16,
          } : {
            top: 0,
            left: 0,
            transform: 'translateX(0)',
            width: '100%',
            height: '100%',
            borderRadius: 0,
          }}
        >
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
                  onOpenSheet={() => openSheet(short.id)}
                  onShare={handleShare}
                  canSwipeUp={index < shorts.length - 1}
                  canSwipeDown={index > 0}
                  isActive={index === currentIndex}
                  compact={sheetShortId === short.id}
                />
              </SwiperSlide>
            ))}
          </Swiper>

          {/* Тап по свёрнутой карточке видео закрывает шит и возвращает фулскрин
              (перехватывает тапы плеера: пауза/double-tap лайк не срабатывают) */}
          {sheetOpenVisual && (
            <button
              className="absolute inset-0 z-30"
              onClick={closeSheet}
              aria-label="Развернуть видео"
            />
          )}
        </div>
      </div>

      {/* Служебные индикаторы (позиция «N / M», полоса прогресса ленты, плашка
          «Загрузка рекомендаций») убраны по UI-ревью 2026-07-31: лента бесконечная,
          знаменатель рос при подгрузке и счётчики врали; подгрузка бесшовная и не
          требует индикации. */}

      {/* Тапбар всегда виден в ленте (как в Instagram Reels). Открытый шит
          (z-50) перекрывает его вместе с полем ввода. */}
      <BottomNavigation activeTab="shorts" />

      {sheetShort && (
        <ShortsSheet
          short={sheetShort}
          closing={sheetClosing}
          onClose={closeSheet}
          onCommentAdded={() => handleCommentAdded(sheetShort.id)}
        />
      )}

      {toast && (
        <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />
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
