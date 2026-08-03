'use client';

import React, { useState, useRef, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
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

interface ShortsPlayerProps {
  short: ShortData;
  onLike: () => void;
  onComment: () => void;
  onShare: () => void;
  canSwipeUp?: boolean;
  canSwipeDown?: boolean;
  isActive?: boolean;
}

// Выбор звука на сессию ленты (модульные переменные переживают смену слайдов,
// сбрасываются при перезагрузке страницы — когда жеста ещё нет и unmute всё
// равно запрещён браузером).
// feedSoundEnabled — включать ли звук автоматически на новых слайдах.
// feedSoundTouched — трогал ли пользователь звук вообще (убирает плашку-приглашение).
let feedSoundEnabled = false;
let feedSoundTouched = false;

export const ShortsPlayer: React.FC<ShortsPlayerProps> = ({
  short,
  onLike,
  onComment,
  onShare,
  canSwipeUp = false,
  canSwipeDown = false,
  isActive = true,
}) => {
  const router = useRouter();
  const videoRef = useRef<HTMLVideoElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  // Ref для актуального значения isActive в обработчиках событий (избегаем stale closure)
  const isActiveRef = useRef(isActive);
  
  const [isPlaying, setIsPlaying] = useState(false);
  const [isMuted, setIsMuted] = useState(true); // Начинаем с muted для автовоспроизведения
  const [showDescription, setShowDescription] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [videoUrl, setVideoUrl] = useState<string>('');

  // Оптимистичный лайк: сердце/счётчик реагируют на тап МГНОВЕННО, не завися от
  // virtual-кэша Swiper и от того, успел ли родитель обновить массив. Ресид при
  // смене шортса и при подтверждении/откате родителем (по props short.*).
  const [likedLocal, setLikedLocal] = useState(!!short.isLiked);
  const [likesLocal, setLikesLocal] = useState(short.likesCount);
  useEffect(() => {
    setLikedLocal(!!short.isLiked);
    setLikesLocal(short.likesCount);
  }, [short.id, short.isLiked, short.likesCount]);
  const handleLikeTap = (e: React.MouseEvent) => {
    e.stopPropagation();
    setLikedLocal((v) => !v);
    setLikesLocal((c) => c + (likedLocal ? -1 : 1));
    onLike();
  };

  // Синхронизируем ref с актуальным значением
  useEffect(() => {
    isActiveRef.current = isActive;
  }, [isActive]);

  // Управление воспроизведением при смене активного слайда
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    if (isActive) {
      // Слайд стал активным — запускаем воспроизведение с muted (надёжный
      // autoplay). Звук включаем ТОЛЬКО если пользователь уже включал его в
      // этой сессии ленты: программный unmute без жеста iOS Safari может
      // остановить воспроизведение («видео само встало на паузу»).
      video.muted = true;
      const playPromise = video.play();
      if (playPromise) {
        playPromise.then(() => {
          // Проверяем ещё раз — пока промис resolve, слайд мог стать неактивным
          if (!isActiveRef.current) return;
          setIsPlaying(true);
          if (feedSoundEnabled) {
            video.muted = false;
            setIsMuted(false);
          }
        }).catch(() => {
          // Autoplay заблокирован — оставляем muted
          setIsPlaying(false);
        });
      }
    } else {
      // Слайд стал неактивным — гарантированно глушим и останавливаем
      video.muted = true;
      video.pause();
      try { video.currentTime = 0; } catch (e) { /* ignore */ }
      setIsPlaying(false);
      setIsMuted(true);
    }
  }, [isActive]);

  // Загрузка URL видео (обработка Kinescope)
  useEffect(() => {
    let cancelled = false;
    const loadVideoUrl = async () => {
      setIsLoading(true);
      
      if (!short.videoUrl) {
        console.error('No video URL provided');
        setIsLoading(false);
        return;
      }

      // Если это Kinescope URL - получаем прямую ссылку
      if (isKinescopeUrl(short.videoUrl)) {
        try {
          const result = await getKinescopeDirectUrl(short.videoUrl);
          if (cancelled) return;
          if (result.directUrl) {
            setVideoUrl(result.directUrl);
          } else {
            setVideoUrl(short.videoUrl);
          }
        } catch (error) {
          console.error('Error loading Kinescope URL:', error);
          if (!cancelled) setVideoUrl(short.videoUrl);
        }
      } else {
        // Обычный URL
        if (!cancelled) setVideoUrl(short.videoUrl);
      }
    };

    loadVideoUrl();
    return () => { cancelled = true; };
  }, [short.videoUrl, short.id]);

  // Воспроизведение видео когда URL готов
  useEffect(() => {
    const video = videoRef.current;
    if (!video || !videoUrl) return;

    setIsLoading(true);
    setIsPlaying(false);

    const handleCanPlay = () => {
      setIsLoading(false);
      // Автовоспроизведение только для активного слайда (читаем актуальное значение через ref)
      if (!isActiveRef.current) {
        // Гарантированно глушим неактивное видео при готовности
        video.muted = true;
        video.pause();
        return;
      }
      
      // Сначала запускаем с muted для гарантированного автовоспроизведения.
      // Unmute — только если звук уже включали в этой сессии (см. коммент выше).
      video.muted = true;
      video.play().then(() => {
        // Проверяем что слайд всё ещё активен
        if (!isActiveRef.current) {
          video.pause();
          video.muted = true;
          return;
        }
        setIsPlaying(true);
        if (feedSoundEnabled) {
          video.muted = false;
          setIsMuted(false);
        }
      }).catch(err => {
        console.log('Autoplay blocked:', err);
        setIsPlaying(false);
      });
    };

    const handleWaiting = () => setIsLoading(true);
    const handlePlaying = () => {
      setIsLoading(false);
      // Если слайд уже неактивен — немедленно ставим на паузу и глушим
      if (!isActiveRef.current) {
        video.muted = true;
        video.pause();
        return;
      }
      setIsPlaying(true);
    };
    const handlePause = () => setIsPlaying(false);
    const handleEnded = () => {
      // Зацикливание только для активного слайда
      if (!isActiveRef.current) return;
      video.currentTime = 0;
      video.play().catch(() => {});
    };
    const handleError = (e: Event) => {
      console.error('Video error:', e, 'URL:', videoUrl);
      setIsLoading(false);
    };

    video.addEventListener('canplay', handleCanPlay);
    video.addEventListener('waiting', handleWaiting);
    video.addEventListener('playing', handlePlaying);
    video.addEventListener('pause', handlePause);
    video.addEventListener('ended', handleEnded);
    video.addEventListener('error', handleError);

    // Устанавливаем src и загружаем
    video.src = videoUrl;
    video.load();

    return () => {
      video.removeEventListener('canplay', handleCanPlay);
      video.removeEventListener('waiting', handleWaiting);
      video.removeEventListener('playing', handlePlaying);
      video.removeEventListener('pause', handlePause);
      video.removeEventListener('ended', handleEnded);
      video.removeEventListener('error', handleError);
      video.pause();
      video.muted = true;
      video.removeAttribute('src');
      video.load();
    };
  }, [videoUrl]);

  // Пауза/воспроизведение по клику
  const togglePlay = () => {
    const video = videoRef.current;
    if (!video) return;
    
    if (video.paused) {
      video.play();
    } else {
      video.pause();
    }
  };

  // Включить/выключить звук. Запоминаем выбор на сессию ленты: следующие
  // слайды стартуют сразу с этим звуком (unmute после жеста браузеры позволяют).
  const [soundTouched, setSoundTouched] = useState(feedSoundTouched);
  const toggleMute = (e: React.MouseEvent) => {
    e.stopPropagation();
    const video = videoRef.current;
    if (!video) return;

    video.muted = !video.muted;
    setIsMuted(video.muted);
    feedSoundEnabled = !video.muted;
    feedSoundTouched = true;
    setSoundTouched(true);
  };

  return (
    <div 
      ref={containerRef}
      className="relative w-full h-full bg-black flex flex-col"
    >
      {/* Header */}
      <div className="absolute top-0 left-0 right-0 z-20 p-4 flex items-center justify-between"
        style={{ paddingTop: 'max(1rem, env(safe-area-inset-top))' }}
      >
        <button
          onClick={() => {
            // Прямой заход по шаренной ссылке: истории нет — back() молча не
            // сработал бы. Уводим в каталог треньков.
            if (window.history.length > 1) router.back();
            else router.push('/shorts-catalog');
          }}
          className="w-10 h-10 flex items-center justify-center bg-black/30 rounded-full"
          aria-label="Назад"
        >
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M15 18L9 12L15 6" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </button>
      </div>

      {/* Video Container - полноэкранный */}
      <div 
        className="absolute inset-0"
        onClick={togglePlay}
      >
        <video
          ref={videoRef}
          className="w-full h-full object-contain"
          poster={short.thumbnail}
          playsInline
          loop
          muted
          preload={isActive ? 'auto' : 'metadata'}
        />

        {/* Loading Spinner */}
        {isLoading && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/50">
            <div className="w-12 h-12 border-4 border-white/30 border-t-white rounded-full animate-spin"></div>
          </div>
        )}

        {/* Приглашение включить звук: лента стартует muted (браузерная политика
            автоплея), и без подсказки пользователь не понимает, что звук есть.
            Показываем, пока звук ни разу не трогали в этой сессии ленты. */}
        {isActive && isMuted && !soundTouched && !isLoading && (
          <button
            onClick={toggleMute}
            className="absolute left-1/2 -translate-x-1/2 z-20 flex items-center gap-2 bg-black/60 backdrop-blur-sm rounded-full px-4 py-2 active:scale-95 transition-transform"
            style={{ top: 'calc(max(1rem, env(safe-area-inset-top)) + 56px)' }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2">
              <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/>
              <path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07"/>
            </svg>
            <span className="text-white text-xs font-bold">Смотреть со звуком</span>
          </button>
        )}

        {/* Play/Pause Icon */}
        {!isPlaying && !isLoading && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div className="w-16 h-16 bg-black/50 rounded-full flex items-center justify-center">
              <svg width="32" height="32" viewBox="0 0 24 24" fill="white">
                <path d="M8 5v14l11-7z"/>
              </svg>
            </div>
          </div>
        )}

        {/* Right Side Actions */}
        <div className="absolute right-4 bottom-32 flex flex-col items-center space-y-4 z-10">
          {/* Mute/Unmute */}
          <button onClick={toggleMute} className="flex flex-col items-center">
            <div className="w-12 h-12 bg-black/40 backdrop-blur-sm rounded-full flex items-center justify-center active:scale-90 transition-transform">
              {isMuted ? (
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2">
                  <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/>
                  <line x1="23" y1="9" x2="17" y2="15"/>
                  <line x1="17" y1="9" x2="23" y2="15"/>
                </svg>
              ) : (
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2">
                  <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/>
                  <path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07"/>
                </svg>
              )}
            </div>
          </button>

          {/* Like */}
          <button onClick={handleLikeTap} className="flex flex-col items-center">
            <div className="w-12 h-12 bg-black/40 backdrop-blur-sm rounded-full flex items-center justify-center active:scale-90 transition-transform">
              <svg width="24" height="24" viewBox="0 0 24 24" fill={likedLocal ? "#ff2d55" : "none"} stroke={likedLocal ? "#ff2d55" : "white"} strokeWidth="2">
                <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>
              </svg>
            </div>
            <span className="text-white text-xs mt-1">{likesLocal}</span>
          </button>

          {/* Comments */}
          <button onClick={(e) => { e.stopPropagation(); onComment(); }} className="flex flex-col items-center">
            <div className="w-12 h-12 bg-black/40 backdrop-blur-sm rounded-full flex items-center justify-center active:scale-90 transition-transform">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2">
                <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"/>
              </svg>
            </div>
            <span className="text-white text-xs mt-1">{short.commentsCount || 0}</span>
          </button>

          {/* Share */}
          <button onClick={(e) => { e.stopPropagation(); onShare(); }} className="flex flex-col items-center">
            <div className="w-12 h-12 bg-black/40 backdrop-blur-sm rounded-full flex items-center justify-center active:scale-90 transition-transform">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2">
                <circle cx="18" cy="5" r="3"/>
                <circle cx="6" cy="12" r="3"/>
                <circle cx="18" cy="19" r="3"/>
                <line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/>
                <line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/>
              </svg>
            </div>
          </button>
        </div>

        {/* Bottom Info */}
        <div className="absolute bottom-4 left-4 right-20 z-10">
          {/* Trainer */}
          {short.trainer && (
            <Link 
              href={`/trainers/${short.trainer.id}`}
              onClick={(e) => e.stopPropagation()}
              className="flex items-center space-x-2 mb-2"
            >
              <div className="w-8 h-8 rounded-full bg-gray-600 overflow-hidden">
                {short.trainer.avatar ? (
                  <img src={short.trainer.avatar} alt="" className="w-full h-full object-cover"/>
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-white text-sm font-bold bg-gradient-to-br from-blue-500 to-purple-600">
                    {short.trainer.name.charAt(0)}
                  </div>
                )}
              </div>
              <span className="text-white font-medium text-sm drop-shadow-lg">
                {short.trainer.name} {short.trainer.lastName}
              </span>
            </Link>
          )}

          {/* Title */}
          <p className="text-white text-sm font-medium mb-1 drop-shadow-lg">{short.title}</p>

          {/* Description */}
          {short.description && (
            <div>
              <p className={`text-white/80 text-xs drop-shadow-lg ${showDescription ? '' : 'line-clamp-2'}`}>
                {short.description}
              </p>
              {short.description.length > 80 && (
                <button 
                  onClick={(e) => { e.stopPropagation(); setShowDescription(!showDescription); }}
                  className="text-white/60 text-xs mt-1"
                >
                  {showDescription ? 'Свернуть' : 'Ещё'}
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
