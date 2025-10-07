'use client';

import React, { useState, useRef, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Heart, MessageCircle, Share, Volume2, VolumeX } from 'lucide-react';

import { useTelegram } from '@/hooks/useTelegram';
import { isKinescopeUrl, getKinescopeDirectUrl } from '@/lib/videoQuality';

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

interface Comment {
  id: string;
  text: string;
  createdAt: string;
  user: {
    id: string;
    telegramId: string;
    firstName: string | null;
    lastName: string | null;
    username: string | null;
  };
}

export default function ShortPage({ params }: ShortPageProps) {
  const router = useRouter();
  const { user } = useTelegram();
  const userId = user?.id?.toString() || '123456789'; // fallback для разработки
  
  const [shortId, setShortId] = useState<string>('');
  const [allShorts, setAllShorts] = useState<ShortData[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [isLiked, setIsLiked] = useState(false);
  const [likesCount, setLikesCount] = useState(0);
  const [isMuted, setIsMuted] = useState(true);
  const [isDescriptionExpanded, setIsDescriptionExpanded] = useState(false);
  
  // Комментарии
  const [showComments, setShowComments] = useState(false);
  const [isClosingComments, setIsClosingComments] = useState(false);
  const [comments, setComments] = useState<Comment[]>([]);
  const [commentsCount, setCommentsCount] = useState(0);
  const [newComment, setNewComment] = useState('');
  const [isLoadingComments, setIsLoadingComments] = useState(false);
  
  const videoRef = useRef<HTMLVideoElement>(null);
  const preloadNextVideoRef = useRef<HTMLVideoElement>(null);
  const preloadPrevVideoRef = useRef<HTMLVideoElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  
  // Для свайпа (вертикального и горизонтального)
  const [touchStart, setTouchStart] = useState(0);
  const [touchEnd, setTouchEnd] = useState(0);
  const [touchStartX, setTouchStartX] = useState(0);
  const [touchEndX, setTouchEndX] = useState(0);
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
    // Обновляем URL без перезагрузки
    window.history.pushState({}, '', `/shorts/${allShorts[nextIndex].id}`);
    setTimeout(() => setIsTransitioning(false), 300);
  }, [currentIndex, allShorts, isTransitioning]);

  const goToPrevVideo = useCallback(() => {
    if (isTransitioning || currentIndex <= 0) return;
    setIsTransitioning(true);
    const prevIndex = currentIndex - 1;
    setCurrentIndex(prevIndex);
    // Обновляем URL без перезагрузки
    window.history.pushState({}, '', `/shorts/${allShorts[prevIndex].id}`);
    setTimeout(() => setIsTransitioning(false), 300);
  }, [currentIndex, allShorts, isTransitioning]);

  // Обработка свайпа (вертикального и горизонтального)
  const handleTouchStart = useCallback((e: TouchEvent) => {
    setTouchStart(e.touches[0].clientY);
    setTouchStartX(e.touches[0].clientX);
    setTouchEnd(0);
    setTouchEndX(0);
  }, []);

  const handleTouchMove = useCallback((e: TouchEvent) => {
    setTouchEnd(e.touches[0].clientY);
    setTouchEndX(e.touches[0].clientX);
  }, []);

  const handleTouchEnd = useCallback(() => {
    if (!touchStart || !touchEnd) return;
    
    const distanceY = touchStart - touchEnd;
    const distanceX = touchStartX - touchEndX;
    
    // Проверяем, какой свайп более выраженный
    const isVerticalSwipe = Math.abs(distanceY) > Math.abs(distanceX);
    
    if (isVerticalSwipe) {
      // Вертикальный свайп (переключение видео)
      const isSwipeUp = distanceY > 50;
      const isSwipeDown = distanceY < -50;

      if (isSwipeUp) {
        goToNextVideo();
      } else if (isSwipeDown) {
        goToPrevVideo();
      }
    } else {
      // Горизонтальный свайп (выход)
      const isSwipeRight = distanceX < -100; // Свайп слева направо
      
      if (isSwipeRight) {
        router.push('/');
      }
    }

    setTouchStart(0);
    setTouchEnd(0);
    setTouchStartX(0);
    setTouchEndX(0);
  }, [touchStart, touchEnd, touchStartX, touchEndX, currentIndex, allShorts.length, goToNextVideo, goToPrevVideo, router]);

  // Добавляем обработчики touch событий
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    
    const onTouchStart = (e: TouchEvent) => handleTouchStart(e);
    const onTouchMove = (e: TouchEvent) => handleTouchMove(e);
    const onTouchEnd = () => handleTouchEnd();

    container.addEventListener('touchstart', onTouchStart, { passive: true });
    container.addEventListener('touchmove', onTouchMove, { passive: true });
    container.addEventListener('touchend', onTouchEnd, { passive: true });

    return () => {
      container.removeEventListener('touchstart', onTouchStart);
      container.removeEventListener('touchmove', onTouchMove);
      container.removeEventListener('touchend', onTouchEnd);
    };
  }, [handleTouchStart, handleTouchMove, handleTouchEnd]);

  // Обработка колеса мыши с debounce
  const lastWheelTime = useRef(0);
  const handleWheel = useCallback((e: WheelEvent) => {
    e.preventDefault();
    
    const now = Date.now();
    if (now - lastWheelTime.current < 500) return; // Debounce 500ms
    
    lastWheelTime.current = now;
    
    if (e.deltaY > 0) {
      goToNextVideo();
    } else if (e.deltaY < 0) {
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
  const [kinescopeDirectUrl, setKinescopeDirectUrl] = useState<string | null>(null);
  const [isKinescopeLoading, setIsKinescopeLoading] = useState(false);
  const isKinescopeVideo = isKinescopeUrl(currentShortData?.videoUrl || '');

  // Получаем прямую ссылку для Kinescope
  useEffect(() => {
    let ignore = false;
    if (isKinescopeVideo && currentShortData?.videoUrl) {
      setIsKinescopeLoading(true);
      getKinescopeDirectUrl(currentShortData.videoUrl)
        .then((data) => {
          if (!ignore) setKinescopeDirectUrl(data.directUrl);
        })
        .catch(() => {
          if (!ignore) setKinescopeDirectUrl(null);
        })
        .finally(() => {
          if (!ignore) setIsKinescopeLoading(false);
        });
    } else {
      setKinescopeDirectUrl(null);
    }
    return () => { ignore = true; };
  }, [currentShortData?.videoUrl, isKinescopeVideo]);

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

  // Загружаем информацию о лайках и комментариях для текущего short
  useEffect(() => {
    const loadShortDetails = async () => {
      const currentShort = allShorts[currentIndex];
      if (!currentShort) return;

      const userId = '123456789';
      
      try {
        const response = await fetch(`/api/shorts/${currentShort.id}?userId=${userId}`);
        if (response.ok) {
          const data = await response.json();
          setIsLiked(data.short.isLiked || false);
          setLikesCount(data.short.likesCount || 0);
          setCommentsCount(data.short.commentsCount || 0);
        }
      } catch (error) {
        console.error('Error loading short details:', error);
      }
    };

    loadShortDetails();
  }, [currentIndex, allShorts]);

  const toggleMute = () => {
    if (videoRef.current) {
      videoRef.current.muted = !isMuted;
      setIsMuted(!isMuted);
    }
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

  // Работа с лайками
  const toggleLike = async () => {
    const currentShort = allShorts[currentIndex];
    if (!currentShort) return;

    // Для демо используем фиксированный userId (в реальном приложении берём из Telegram)
    const userId = '123456789';

    try {
      if (isLiked) {
        // Убираем лайк
        const response = await fetch(`/api/shorts/${currentShort.id}/likes?userId=${userId}`, {
          method: 'DELETE',
        });

        if (response.ok) {
          setIsLiked(false);
          setLikesCount(prev => Math.max(0, prev - 1));
        }
      } else {
        // Ставим лайк
        const response = await fetch(`/api/shorts/${currentShort.id}/likes`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ userId }),
        });

        if (response.ok) {
          setIsLiked(true);
          setLikesCount(prev => prev + 1);
        }
      }
    } catch (error) {
      console.error('Error toggling like:', error);
    }
  };

  // Загрузка комментариев
  const loadComments = async () => {
    const currentShort = allShorts[currentIndex];
    if (!currentShort) return;

    setIsLoadingComments(true);
    try {
      const response = await fetch(`/api/shorts/${currentShort.id}/comments`);
      if (response.ok) {
        const data = await response.json();
        setComments(data.comments || []);
        setCommentsCount(data.commentsCount || 0);
      }
    } catch (error) {
      console.error('Error loading comments:', error);
    } finally {
      setIsLoadingComments(false);
    }
  };

  // Добавление комментария
  const handleAddComment = async () => {
    if (!newComment.trim()) return;

    const currentShort = allShorts[currentIndex];
    if (!currentShort) return;

    const userId = '123456789'; // В реальном приложении берём из Telegram

    try {
      const response = await fetch(`/api/shorts/${currentShort.id}/comments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, text: newComment }),
      });

      if (response.ok) {
        setNewComment('');
        loadComments(); // Перезагружаем комментарии
        setCommentsCount(prev => prev + 1);
      }
    } catch (error) {
      console.error('Error adding comment:', error);
    }
  };

  // Удаление комментария
  const handleDeleteComment = async (commentId: string) => {
    const currentShort = allShorts[currentIndex];
    if (!currentShort) return;

    if (!confirm('Удалить комментарий?')) return;

    try {
      const response = await fetch(
        `/api/shorts/${currentShort.id}/comments/${commentId}?userId=${userId}`,
        { method: 'DELETE' }
      );

      if (response.ok) {
        loadComments();
        setCommentsCount(prev => Math.max(0, prev - 1));
      }
    } catch (error) {
      console.error('Error deleting comment:', error);
    }
  };

  // Открытие модального окна с комментариями
  const openComments = () => {
    setShowComments(true);
    setIsClosingComments(false);
    loadComments();
  };

  // Закрытие модального окна с анимацией
  const closeComments = () => {
    setIsClosingComments(true);
    setTimeout(() => {
      setShowComments(false);
      setIsClosingComments(false);
    }, 300); // Должно совпадать с длительностью анимации
  };

  // Preload следующего и предыдущего видео (включая Kinescope)
  useEffect(() => {
    // Preload следующего видео
    const nextIndex = currentIndex + 1;
    if (nextIndex < allShorts.length) {
      const nextShort = allShorts[nextIndex];
      if (isKinescopeUrl(nextShort?.videoUrl)) {
        getKinescopeDirectUrl(nextShort.videoUrl).then(data => {
          if (preloadNextVideoRef.current) {
            preloadNextVideoRef.current.src = data.directUrl;
            preloadNextVideoRef.current.load();
          }
        });
      } else if (nextShort?.videoUrl && preloadNextVideoRef.current) {
        preloadNextVideoRef.current.src = nextShort.videoUrl;
        preloadNextVideoRef.current.load();
      }
    }

    // Preload предыдущего видео
    const prevIndex = currentIndex - 1;
    if (prevIndex >= 0) {
      const prevShort = allShorts[prevIndex];
      if (isKinescopeUrl(prevShort?.videoUrl)) {
        getKinescopeDirectUrl(prevShort.videoUrl).then(data => {
          if (preloadPrevVideoRef.current) {
            preloadPrevVideoRef.current.src = data.directUrl;
            preloadPrevVideoRef.current.load();
          }
        });
      } else if (prevShort?.videoUrl && preloadPrevVideoRef.current) {
        preloadPrevVideoRef.current.src = prevShort.videoUrl;
        preloadPrevVideoRef.current.load();
      }
    }
  }, [currentIndex, allShorts]);

  // Обработка клавиатуры для десктопа
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      switch(e.key) {
        case 'ArrowUp':
          e.preventDefault();
          goToPrevVideo();
          break;
        case 'ArrowDown':
          e.preventDefault();
          goToNextVideo();
          break;
        case ' ':
        case 'Space':
          e.preventDefault();
          handleVideoClick();
          break;
        case 'ArrowLeft':
          // Перемотка назад на 5 секунд
          if (videoRef.current && !isKinescopeVideo) {
            e.preventDefault();
            videoRef.current.currentTime = Math.max(0, videoRef.current.currentTime - 5);
          }
          break;
        case 'ArrowRight':
          // Перемотка вперед на 5 секунд
          if (videoRef.current && !isKinescopeVideo) {
            e.preventDefault();
            videoRef.current.currentTime = Math.min(
              videoRef.current.duration, 
              videoRef.current.currentTime + 5
            );
          }
          break;
        case 'm':
        case 'M':
          e.preventDefault();
          toggleMute();
          break;
        case 'Escape':
          e.preventDefault();
          router.push('/');
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [goToNextVideo, goToPrevVideo, handleVideoClick, toggleMute, isKinescopeVideo, router]);

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
    >
      {/* Видео */}
      <div className="h-full w-full relative">
        {isKinescopeVideo ? (
          isKinescopeLoading || !kinescopeDirectUrl ? (
            <div className="w-full h-full flex items-center justify-center text-white">Загрузка видео...</div>
          ) : (
            <video
              ref={videoRef}
              key={shortData.id + '-kinescope'}
              className="w-full h-full object-cover cursor-pointer"
              src={kinescopeDirectUrl}
              poster={shortData.thumbnail}
              autoPlay
              loop
              muted={isMuted}
              playsInline
              preload="auto"
              onClick={handleVideoClick}
              onLoadedData={() => {
                videoRef.current?.play().catch(err => console.log('Play prevented:', err));
              }}
            />
          )
        ) : (
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
              videoRef.current?.play().catch(err => console.log('Play prevented:', err));
            }}
          />
        )}
      </div>

      {/* Прозрачный overlay на весь экран для перехвата свайпов */}
      <div 
        className="fixed inset-0 w-screen h-screen z-[15]"
        style={{ 
          touchAction: 'pan-y',
          WebkitTouchCallout: 'none',
          WebkitUserSelect: 'none',
          userSelect: 'none',
          pointerEvents: 'auto'
        }}
        onTouchStart={(e) => handleTouchStart(e.nativeEvent)}
        onTouchMove={(e) => handleTouchMove(e.nativeEvent)}
        onTouchEnd={() => handleTouchEnd()}
      />

      {/* Заголовок ТРЕНЬКИ */}
      <div className="absolute left-1/2 transform -translate-x-1/2 z-30 pointer-events-none" style={{ top: '100px' }}>
        <h1 className="text-white text-lg font-bold tracking-wider">ТРЕНЬКИ</h1>
      </div>

      {/* Кнопка назад */}
      <Link href="/" className="absolute left-4 z-30 pointer-events-auto" style={{ top: '100px' }}>
        <button className="w-10 h-10 bg-black/50 backdrop-blur-sm rounded-full flex items-center justify-center">
          <ArrowLeft className="text-white" size={20} />
        </button>
      </Link>

      {/* Нижняя панель с информацией и действиями */}
      <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/90 via-black/70 to-transparent z-30 pointer-events-none">
        <div className="flex items-end gap-4 p-4 pb-6 pointer-events-auto">
          {/* Информация о видео - слева */}
          <div className="flex-1 min-w-0">
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
                  className={`text-white/90 text-sm leading-relaxed transition-all duration-300 ease-in-out ${
                    isDescriptionExpanded ? 'max-h-[500px]' : 'line-clamp-3 max-h-[60px]'
                  }`}
                  style={{
                    overflow: 'hidden'
                  }}
                >
                  {shortData.description}
                </p>
                {shortData.description.length > 100 && (
                  <button
                    onClick={() => setIsDescriptionExpanded(!isDescriptionExpanded)}
                    className="text-white/70 text-xs mt-1 hover:text-white transition-all duration-200"
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

          {/* Боковая панель с действиями - справа */}
          <div className="flex flex-col gap-4 flex-shrink-0">
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
              <span className="text-white text-xs font-semibold">{likesCount}</span>
            </button>

            {/* Комментарии */}
            <button 
              onClick={openComments}
              className="flex flex-col items-center gap-1"
            >
              <div className="w-12 h-12 bg-black/50 backdrop-blur-sm rounded-full flex items-center justify-center">
                <MessageCircle className="text-white" size={24} />
              </div>
              <span className="text-white text-xs font-semibold">{commentsCount}</span>
            </button>

            {/* Поделиться */}
            <button className="flex flex-col items-center gap-1">
              <div className="w-12 h-12 bg-black/50 backdrop-blur-sm rounded-full flex items-center justify-center">
                <Share className="text-white" size={24} />
              </div>
            </button>
          </div>
        </div>
      </div>

      {/* Скрытые video элементы для preload следующего и предыдущего видео */}
      <video
        ref={preloadNextVideoRef}
        className="hidden"
        preload="auto"
        muted
        playsInline
      />
      <video
        ref={preloadPrevVideoRef}
        className="hidden"
        preload="auto"
        muted
        playsInline
      />

      {/* Модальное окно с комментариями */}
      {showComments && (
        <div className={`fixed inset-0 z-50 flex items-end md:items-center md:justify-center ${isClosingComments ? 'animate-fadeOut' : 'animate-fadeIn'}`}>
          {/* Overlay */}
          <div 
            className={`absolute inset-0 bg-black/70 transition-opacity duration-300 ${isClosingComments ? 'opacity-0' : 'opacity-100'}`}
            onClick={closeComments}
          />
          
          {/* Модальное окно */}
          <div className={`relative w-full md:w-[600px] bg-[#1a1f3a] rounded-t-3xl md:rounded-3xl max-h-[80vh] flex flex-col ${isClosingComments ? 'animate-slideDown md:animate-fadeOut' : 'animate-slideUp md:animate-fadeIn'}`}>
            {/* Заголовок */}
            <div className="flex items-center justify-between p-4 border-b border-gray-700">
              <h2 className="text-xl font-bold text-white">
                Комментарии ({commentsCount})
              </h2>
              <button
                onClick={closeComments}
                className="text-gray-400 hover:text-white text-2xl w-8 h-8 flex items-center justify-center transition-colors"
              >
                ×
              </button>
            </div>

            {/* Список комментариев */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {isLoadingComments ? (
                <div className="text-center text-gray-400 py-8">Загрузка...</div>
              ) : comments.length === 0 ? (
                <div className="text-center text-gray-400 py-8">
                  Нет комментариев. Будьте первым!
                </div>
              ) : (
                comments.map((comment) => (
                  <div key={comment.id} className="bg-[#101530] rounded-lg p-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="font-semibold text-white text-sm">
                            {comment.user.firstName || comment.user.username || 'Пользователь'}
                          </span>
                          <span className="text-xs text-gray-500">
                            {new Date(comment.createdAt).toLocaleDateString('ru-RU', {
                              day: 'numeric',
                              month: 'short',
                              hour: '2-digit',
                              minute: '2-digit'
                            })}
                          </span>
                        </div>
                        <p className="text-white text-sm">{comment.text}</p>
                      </div>
                      {comment.user.telegramId === userId && (
                        <button
                          onClick={() => handleDeleteComment(comment.id)}
                          className="text-red-400 hover:text-red-300 text-xs"
                        >
                          Удалить
                        </button>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* Форма добавления комментария */}
            <div className="p-4 border-t border-gray-700">
              <div className="flex gap-2">
                <input
                  type="text"
                  value={newComment}
                  onChange={(e) => setNewComment(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && handleAddComment()}
                  placeholder="Напишите комментарий..."
                  className="flex-1 px-4 py-2 rounded-full bg-[#101530] border border-gray-700 text-white placeholder-gray-500 focus:outline-none focus:border-blue-500"
                />
                <button
                  onClick={handleAddComment}
                  disabled={!newComment.trim()}
                  className="px-6 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 disabled:cursor-not-allowed rounded-full text-white font-semibold transition-colors"
                >
                  Отправить
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
