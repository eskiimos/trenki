'use client';

import React, { useState, useRef, useEffect, useCallback } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useRouter, useSearchParams } from 'next/navigation';
import { Heart, MessageCircle, Share, Download, CheckCircle } from 'lucide-react';
import TagsSection from '@/components/TagsSection';
import BottomNavigation from '@/components/BottomNavigation';
import CharacteristicsGainModal from '@/components/CharacteristicsGainModal';
import ScheduleModal from '@/components/ScheduleModal';
import Toast from '@/components/Toast';
import { isKinescopeUrl, getKinescopeDirectUrl } from '@/lib/videoQuality';
import { getTelegramId } from '@/lib/auth';
import { calculateWorkoutGains, CharacteristicType } from '@/lib/characteristics';
import { 
  downloadVideo, 
  isVideoDownloaded, 
  deleteVideo,
  type OfflineVideo 
} from '@/lib/offlineVideos';

interface VideoPageProps {
  params: Promise<{
    id: string;
  }>;
}

interface VideoData {
  id: string;
  title: string;
  description: string;
  videoUrl: string;
  thumbnail: string;
  duration: number;
  likesCount: number;
  trainer: {
    id: string;
    name: string;
    lastName: string;
    speciality: string;
    avatar: string | null;
  };
  tags: string[];
  loadTypes?: string[];
  equipment: string[];
  category: string;
  difficulty: string;
  level: string;
}

export default function VideoPage({ params }: VideoPageProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const fromWorkout = searchParams.get('fromWorkout') === 'true';
  const sessionId = searchParams.get('sessionId');
  const [isPlaying, setIsPlaying] = useState(false);
  const [isLiked, setIsLiked] = useState(false);
  const [likesCount, setLikesCount] = useState(0);
  const [showComments, setShowComments] = useState(true);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [buffered, setBuffered] = useState(0); // Прогресс загрузки видео
  // const [volume, setVolume] = useState(1);
  const [isMuted, setIsMuted] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  // Отслеживание ориентации экрана (ландшафт/портрет) для мобильных устройств
  const [isLandscape, setIsLandscape] = useState(false);
  const [videoId, setVideoId] = useState<string>('');
  const [videoData, setVideoData] = useState<VideoData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [kinescopeDirectUrl, setKinescopeDirectUrl] = useState<string | null>(null);
  const [isKinescopeLoading, setIsKinescopeLoading] = useState(false);
  const [userProfile, setUserProfile] = useState<any>(null);
  
  // Для автоплея следующего видео
  const [allVideos, setAllVideos] = useState<VideoData[]>([]);
  const [nextVideo, setNextVideo] = useState<VideoData | null>(null);
  const [showNextVideoPreview, setShowNextVideoPreview] = useState(false);
  const [countdown, setCountdown] = useState(5);
  const [autoplayEnabled, setAutoplayEnabled] = useState(true);
  const countdownTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Состояние для скачивания видео
  const [isDownloaded, setIsDownloaded] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const [downloadProgress, setDownloadProgress] = useState(0);
  
  // Состояние для модалки прироста характеристик
  const [showGainsModal, setShowGainsModal] = useState(false);
  const [characteristicsGains, setCharacteristicsGains] = useState<any>(null);
  const [newCharacteristics, setNewCharacteristics] = useState<any>(null);
  const [isCompletingModule, setIsCompletingModule] = useState(false);
  const [showScheduleModal, setShowScheduleModal] = useState(false);
  
  // Состояние для Toast уведомлений
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'warning' | 'info' } | null>(null);

  // Получаем params асинхронно и загружаем данные видео
  useEffect(() => {
    const getParams = async () => {
      const resolvedParams = await params;
      setVideoId(resolvedParams.id);
      
      // Загружаем данные видео
      try {
        setIsLoading(true);
        const response = await fetch('/api/videos');
        const data = await response.json();
        const videos = data.videos || [];
        setAllVideos(videos);
        
        const currentVideoIndex = videos.findIndex((v: VideoData) => v.id === resolvedParams.id);
        const video = videos[currentVideoIndex];
        
        if (video) {
          setVideoData(video);
          
          // Находим следующее видео
          if (currentVideoIndex !== -1 && currentVideoIndex < videos.length - 1) {
            setNextVideo(videos[currentVideoIndex + 1]);
          } else {
            // Если это последнее видео, берем первое (цикл)
            setNextVideo(videos[0]);
          }
        }

        // Fetch profile
        const telegramId = getTelegramId();
        if (telegramId) {
          const profileResponse = await fetch(`/api/profile?telegramId=${telegramId}`);
          if (profileResponse.ok) {
            const profileData = await profileResponse.json();
            setUserProfile(profileData.user?.profile);
          }
        }
      } catch (error) {
        console.error('Error loading video:', error);
      } finally {
        setIsLoading(false);
      }
    };
    getParams();
  }, [params]);

  // Проверяем, скачано ли видео
  useEffect(() => {
    const checkDownloadStatus = async () => {
      if (videoId) {
        const downloaded = await isVideoDownloaded(videoId);
        setIsDownloaded(downloaded);
      }
    };
    checkDownloadStatus();
  }, [videoId]);

  // Отслеживание завершения видео (90% или конец)
  const videoCompletedRef = useRef(false);
  const lastProgressUpdateRef = useRef(0);

  // Отмечаем начало видео в тренировке
  useEffect(() => {
    const notifyVideoStart = async () => {
      if (fromWorkout && sessionId && videoId) {
        try {
          console.log('🎬 Starting video in workout:', { sessionId, videoId });
          await fetch('/api/training/update', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              sessionId,
              videoId,
              action: 'start',
            }),
          });
        } catch (error) {
          console.error('Ошибка отметки начала видео:', error);
        }
      }
    };

    if (videoId) {
      notifyVideoStart();
      videoCompletedRef.current = false; // Сброс флага при новом видео
    }
  }, [videoId, fromWorkout, sessionId]);

  // Отслеживание прогресса просмотра видео
  const handleVideoProgress = useCallback(async (currentTime: number, duration: number) => {
    if (!fromWorkout || !sessionId || !videoId || !duration) return;
    
    const progressPercent = (currentTime / duration) * 100;
    
    // Отправляем обновление прогресса каждые 5 секунд
    const now = Date.now();
    if (now - lastProgressUpdateRef.current > 5000) {
      lastProgressUpdateRef.current = now;
      
      try {
        await fetch('/api/training/update', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            sessionId,
            videoId,
            action: 'progress',
            watchedDuration: Math.floor(currentTime),
          }),
        });
      } catch (error) {
        console.error('Ошибка обновления прогресса:', error);
      }
    }

    // Проверяем достижение 90% или завершение видео
    if (!videoCompletedRef.current && progressPercent >= 90) {
      console.log('🎯 Video reached 90%, completing...', { currentTime, duration, progressPercent });
      videoCompletedRef.current = true;
      await completeVideoInWorkout();
    }
  }, [fromWorkout, sessionId, videoId]);

  // Завершение видео в тренировке
  const completeVideoInWorkout = async () => {
    if (!fromWorkout || !sessionId || !videoId) {
      console.log('⚠️ Cannot complete video - missing params:', { fromWorkout, sessionId, videoId });
      return;
    }
    
    try {
      console.log('✅ Completing video in workout:', { sessionId, videoId });
      const response = await fetch('/api/training/update', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId,
          videoId,
          action: 'complete',
        }),
      });

      const data = await response.json();
      console.log('📊 Video completed response:', data);

      if (response.ok) {
        // Возвращаем на страницу тренировки
        console.log('🔄 Redirecting to workout page...');
        setTimeout(() => {
          router.push(`/training/workout?id=${sessionId}`);
        }, 1000); // Небольшая задержка для плавности
      } else {
        console.error('❌ Failed to complete video:', data);
      }
    } catch (error) {
      console.error('Ошибка завершения видео:', error);
    }
  };

  // Загружаем прямую ссылку для Kinescope видео
  useEffect(() => {
    let ignore = false;
    
    // Сбрасываем состояния при смене видео
    setCurrentTime(0);
    setDuration(0);
    setBuffered(0);
    setShowNextVideoPreview(false);
    if (countdownTimerRef.current) {
      clearInterval(countdownTimerRef.current);
    }
    
    const loadKinescopeUrl = async () => {
      if (videoData?.videoUrl && isKinescopeUrl(videoData.videoUrl)) {
        // Проверяем кэш сначала
        const cacheKey = `kinescope_url_${videoData.videoUrl}`;
        const cached = sessionStorage.getItem(cacheKey);
        
        if (cached) {
          try {
            const cachedData = JSON.parse(cached);
            // Используем кэш если он не старше 1 часа
            if (Date.now() - cachedData.timestamp < 3600000) {
              if (!ignore) {
                setKinescopeDirectUrl(cachedData.url);
                console.log('Using cached Kinescope URL');
              }
              return;
            }
          } catch (e) {
            console.error('Error parsing cached Kinescope URL:', e);
          }
        }
        
        setIsKinescopeLoading(true);
        try {
          const result = await getKinescopeDirectUrl(videoData.videoUrl);
          if (!ignore && result.directUrl) {
            setKinescopeDirectUrl(result.directUrl);
            // Кэшируем URL
            sessionStorage.setItem(cacheKey, JSON.stringify({
              url: result.directUrl,
              timestamp: Date.now()
            }));
            console.log('Kinescope URL cached');
          }
        } catch (error) {
          console.error('Error loading Kinescope direct URL:', error);
        } finally {
          if (!ignore) {
            setIsKinescopeLoading(false);
          }
        }
      }
    };

    loadKinescopeUrl();

    return () => {
      ignore = true;
    };
  }, [videoData?.videoUrl]);

  // Отслеживание изменения полноэкранного режима (кроссбраузерное)
  useEffect(() => {
    const handleFullscreenChange = () => {
      const isCurrentlyFullscreen = !!(
        document.fullscreenElement ||
        (document as any).webkitFullscreenElement ||
        (document as any).mozFullScreenElement ||
        (document as any).msFullscreenElement
      );
      setIsFullscreen(isCurrentlyFullscreen);
    };

    // Для iOS - отслеживаем события на video элементе
    const handleWebkitFullscreenChange = () => {
      if (videoRef.current) {
        const isFullscreen = !!(videoRef.current as any).webkitDisplayingFullscreen;
        setIsFullscreen(isFullscreen);
      }
    };

    // Добавляем все возможные события для кроссбраузерности
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    document.addEventListener('webkitfullscreenchange', handleFullscreenChange);
    document.addEventListener('mozfullscreenchange', handleFullscreenChange);
    document.addEventListener('MSFullscreenChange', handleFullscreenChange);
    
    // iOS-специфичные события
    if (videoRef.current) {
      videoRef.current.addEventListener('webkitbeginfullscreen', handleWebkitFullscreenChange);
      videoRef.current.addEventListener('webkitendfullscreen', handleWebkitFullscreenChange);
    }
    
    return () => {
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
      document.removeEventListener('webkitfullscreenchange', handleFullscreenChange);
      document.removeEventListener('mozfullscreenchange', handleFullscreenChange);
      document.removeEventListener('MSFullscreenChange', handleFullscreenChange);
      
      if (videoRef.current) {
        videoRef.current.removeEventListener('webkitbeginfullscreen', handleWebkitFullscreenChange);
        videoRef.current.removeEventListener('webkitendfullscreen', handleWebkitFullscreenChange);
      }
    };
  }, []);

  // Отслеживание ориентации экрана для адаптации под горизонтальный режим
  useEffect(() => {
    const checkOrientation = () => {
      // Проверяем: горизонтальная ориентация И мобильное устройство (ширина < 768px)
      const isLandscapeOrientation = window.matchMedia('(orientation: landscape)').matches;
      const isMobileWidth = window.innerWidth < 768;
      setIsLandscape(isLandscapeOrientation && isMobileWidth);
    };

    // Проверяем при монтировании
    checkOrientation();

    // Слушаем изменения ориентации и размера экрана
    window.addEventListener('resize', checkOrientation);
    window.addEventListener('orientationchange', checkOrientation);
    
    return () => {
      window.removeEventListener('resize', checkOrientation);
      window.removeEventListener('orientationchange', checkOrientation);
    };
  }, []);

  // Загружаем статус лайка при открытии видео
  useEffect(() => {
    const loadLikeStatus = async () => {
      if (!videoId || !videoData) return;

      try {
        const telegramId = getTelegramId();
        if (!telegramId) {
          // Если нет ID пользователя, показываем количество лайков из videoData
          setLikesCount(videoData.likesCount || 0);
          return;
        }

        const response = await fetch(`/api/videos/${videoId}/like`, {
          headers: {
            'X-Telegram-User-ID': telegramId,
          },
        });

        if (response.ok) {
          const data = await response.json();
          setIsLiked(data.isLiked);
          setLikesCount(data.likesCount);
        } else {
          setLikesCount(videoData.likesCount || 0);
        }
      } catch (error) {
        console.error('Error loading like status:', error);
        setLikesCount(videoData.likesCount || 0);
      }
    };

    loadLikeStatus();
  }, [videoId, videoData]);

  // Функция переключения лайка
  const toggleLike = async () => {
    const telegramId = getTelegramId();
    if (!telegramId) {
      alert('Пожалуйста, войдите в приложение');
      return;
    }

    try {
      const response = await fetch(`/api/videos/${videoId}/like`, {
        method: 'POST',
        headers: {
          'X-Telegram-User-ID': telegramId,
        },
      });

      if (response.ok) {
        const data = await response.json();
        setIsLiked(data.isLiked);
        setLikesCount(data.likesCount);
      }
    } catch (error) {
      console.error('Error toggling like:', error);
    }
  };

  // Функция завершения одиночного модуля
  const handleCompleteModule = async () => {
    if (isCompletingModule || !videoId) return;
    
    const telegramId = getTelegramId();
    if (!telegramId) {
      alert('Пожалуйста, войдите в приложение');
      return;
    }
    
    try {
      setIsCompletingModule(true);
      
      const response = await fetch('/api/training/complete-module', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: telegramId,
          videoId: videoId,
        }),
      });
      
      const data = await response.json();
      
      if (response.ok && data.success) {
        // Проверяем, есть ли прирост характеристик
        if (data.gains && data.newCharacteristics) {
          setCharacteristicsGains(data.gains);
          setNewCharacteristics(data.newCharacteristics);
          setShowGainsModal(true);
        } else {
          setToast({ message: '✅ Модуль завершен!', type: 'success' });
        }
      } else if (data.limitReached) {
        setToast({
          message: data.error || 'Достигнут дневной лимит модулей (4). Приходи завтра! 💪',
          type: 'warning'
        });
      } else {
        setToast({ message: 'Ошибка при завершении модуля', type: 'error' });
      }
    } catch (error) {
      console.error('Error completing module:', error);
      setToast({ message: 'Ошибка при завершении модуля', type: 'error' });
    } finally {
      setIsCompletingModule(false);
    }
  };
  
  // Закрытие модалки прироста
  const handleGainsModalClose = () => {
    setShowGainsModal(false);
  };

  // Функция скачивания видео
  const handleDownload = async () => {
    if (isDownloading) return;

    if (isDownloaded) {
      // Если уже скачано - удаляем
      if (confirm('Удалить это видео из офлайн-хранилища?')) {
        try {
          await deleteVideo(videoId);
          setIsDownloaded(false);
          alert('Видео удалено из офлайн-хранилища');
        } catch (error) {
          console.error('Error deleting video:', error);
          alert('Ошибка при удалении видео');
        }
      }
      return;
    }

    // Проверяем поддержку
    if (!('serviceWorker' in navigator) || !('caches' in window)) {
      alert('Ваш браузер не поддерживает офлайн-режим');
      return;
    }

    if (!videoData) {
      alert('Данные видео не загружены');
      return;
    }

    try {
      setIsDownloading(true);
      setDownloadProgress(0);

      const offlineVideo: OfflineVideo = {
        id: videoData.id,
        title: videoData.title,
        description: videoData.description,
        duration: videoData.duration,
        thumbnail: videoData.thumbnail,
        videoUrl: kinescopeDirectUrl || videoData.videoUrl,
        category: videoData.category,
        difficulty: videoData.difficulty,
        trainerId: videoData.trainer?.id,
        trainer: videoData.trainer ? {
          name: videoData.trainer.name,
          lastName: videoData.trainer.lastName,
          avatar: videoData.trainer.avatar || undefined,
        } : undefined,
        downloadedAt: Date.now(),
      };

      await downloadVideo(offlineVideo, (progress) => {
        setDownloadProgress(progress);
      });

      setIsDownloaded(true);
      alert('Видео успешно скачано! Доступно в разделе "Офлайн-видео"');
    } catch (error) {
      console.error('Error downloading video:', error);
      alert('Ошибка при скачивании видео. Попробуйте еще раз.');
    } finally {
      setIsDownloading(false);
      setDownloadProgress(0);
    }
  };

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

  const toggleMute = () => {
    if (videoRef.current) {
      videoRef.current.muted = !isMuted;
      setIsMuted(!isMuted);
    }
    showControlsTemporarily();
  };

  // Проверка поддержки Fullscreen API
  const isFullscreenSupported = () => {
    if (typeof document === 'undefined') return false;
    return !!(
      document.fullscreenEnabled ||
      (document as any).webkitFullscreenEnabled ||
      (document as any).mozFullScreenEnabled ||
      (document as any).msFullscreenEnabled
    );
  };

  // Универсальная функция для fullscreen с кроссбраузерной поддержкой
  const toggleFullscreen = () => {
    if (!isFullscreenSupported()) {
      console.warn('Fullscreen API не поддерживается в этом браузере');
      return;
    }

    if (document.fullscreenElement || (document as any).webkitFullscreenElement || (document as any).mozFullScreenElement || (document as any).msFullscreenElement) {
      // Выход из fullscreen
      if (document.exitFullscreen) {
        document.exitFullscreen().catch(console.error);
      } else if ((document as any).webkitExitFullscreen) {
        (document as any).webkitExitFullscreen();
      } else if ((document as any).mozCancelFullScreen) {
        (document as any).mozCancelFullScreen();
      } else if ((document as any).msExitFullscreen) {
        (document as any).msExitFullscreen();
      }
    } else {
      // Для iOS Safari - используем webkitEnterFullscreen на самом video элементе
      const video = videoRef.current;
      if (video && (video as any).webkitEnterFullscreen) {
        try {
          (video as any).webkitEnterFullscreen();
          return;
        } catch (err) {
          console.error('iOS fullscreen failed:', err);
        }
      }

      // Для остальных браузеров - используем родительский контейнер видео
      const element = videoRef.current?.parentElement;
      if (!element) return;

      if (element.requestFullscreen) {
        element.requestFullscreen().catch(console.error);
      } else if ((element as any).webkitRequestFullscreen) {
        (element as any).webkitRequestFullscreen();
      } else if ((element as any).mozRequestFullScreen) {
        (element as any).mozRequestFullScreen();
      } else if ((element as any).msRequestFullscreen) {
        (element as any).msRequestFullscreen();
      }
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

  // Все обработчики событий видео (timeupdate, progress, canplay и т.д.) теперь inline на video элементе

  const handleVideoEnded = async () => {
    setIsPlaying(false);
    
    // Завершаем видео в тренировке, если ещё не завершено
    if (fromWorkout && sessionId && !videoCompletedRef.current) {
      videoCompletedRef.current = true;
      await completeVideoInWorkout();
      return; // Не запускаем autoplay, возвращаемся к тренировке
    }
    
    if (autoplayEnabled && nextVideo) {
      // Показываем превью и запускаем обратный отсчёт
      startCountdown();
    }
  };

  const startCountdown = () => {
    setShowNextVideoPreview(true);
    setCountdown(5);
    
    countdownTimerRef.current = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          // Переходим к следующему видео
          if (countdownTimerRef.current) {
            clearInterval(countdownTimerRef.current);
          }
          if (nextVideo) {
            router.push(`/video/${nextVideo.id}`);
          }
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  };

  const cancelAutoplay = () => {
    if (countdownTimerRef.current) {
      clearInterval(countdownTimerRef.current);
    }
    setShowNextVideoPreview(false);
    setAutoplayEnabled(false);
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

  // Проверяем метаданные видео при монтировании
  useEffect(() => {
    const video = videoRef.current;
    if (video && video.duration && !isNaN(video.duration)) {
      setDuration(video.duration);
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

  // Очистка таймеров при размонтировании
  useEffect(() => {
    return () => {
      if (hideControlsTimeoutRef.current) {
        clearTimeout(hideControlsTimeoutRef.current);
      }
      if (countdownTimerRef.current) {
        clearInterval(countdownTimerRef.current);
      }
    };
  }, []);

  // Горячие клавиши для управления видео
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!videoRef.current) return;

      switch(e.key.toLowerCase()) {
        case ' ':
        case 'k':
          e.preventDefault();
          togglePlay();
          break;
        case 'arrowleft':
          e.preventDefault();
          videoRef.current.currentTime = Math.max(0, videoRef.current.currentTime - 5);
          showControlsTemporarily();
          break;
        case 'arrowright':
          e.preventDefault();
          videoRef.current.currentTime = Math.min(videoRef.current.duration, videoRef.current.currentTime + 5);
          showControlsTemporarily();
          break;
        case 'j':
          e.preventDefault();
          videoRef.current.currentTime = Math.max(0, videoRef.current.currentTime - 10);
          showControlsTemporarily();
          break;
        case 'l':
          e.preventDefault();
          videoRef.current.currentTime = Math.min(videoRef.current.duration, videoRef.current.currentTime + 10);
          showControlsTemporarily();
          break;
        case 'm':
          e.preventDefault();
          toggleMute();
          break;
        case 'f':
          e.preventDefault();
          if (document.fullscreenElement) {
            document.exitFullscreen();
          } else {
            videoRef.current.parentElement?.requestFullscreen();
          }
          break;
        case '0':
        case 'home':
          e.preventDefault();
          videoRef.current.currentTime = 0;
          showControlsTemporarily();
          break;
        case 'end':
          e.preventDefault();
          videoRef.current.currentTime = videoRef.current.duration;
          showControlsTemporarily();
          break;
        case '1':
        case '2':
        case '3':
        case '4':
        case '5':
        case '6':
        case '7':
        case '8':
        case '9':
          e.preventDefault();
          const percent = parseInt(e.key) * 10;
          videoRef.current.currentTime = (videoRef.current.duration * percent) / 100;
          showControlsTemporarily();
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [togglePlay, toggleMute, showControlsTemporarily]);

  // Отслеживание изменения полноэкранного режима
  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };

    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, []);

  // Отслеживаем поворот экрана и размер окна, чтобы адаптировать UI для мобильного ландшафта
  useEffect(() => {
    const checkLandscape = () => {
      try {
        const mq = window.matchMedia && window.matchMedia('(orientation: landscape)');
        const isOr = mq ? mq.matches : window.innerWidth > window.innerHeight;
        // Считаем мобильным, если ширина меньше 900px (примерно breakpoint md) и ориентация landscape
        setIsLandscape(isOr && window.innerWidth <= 900);
      } catch (e) {
        setIsLandscape(window.innerWidth > window.innerHeight && window.innerWidth <= 900);
      }
    };

    checkLandscape();
    window.addEventListener('orientationchange', checkLandscape);
    window.addEventListener('resize', checkLandscape);
    return () => {
      window.removeEventListener('orientationchange', checkLandscape);
      window.removeEventListener('resize', checkLandscape);
    };
  }, []);

  // Контейнер с адаптацией для ландшафтного режима на мобильных
  const containerClass = `min-h-screen bg-[#101530] pb-20 ${isLandscape ? 'overflow-hidden h-screen' : ''}`;

  const calculateVideoGain = () => {
    if (!userProfile || !videoData?.loadTypes || videoData.loadTypes.length === 0) return null;

    const currentCharacteristics: Record<CharacteristicType, number> = {
      ratingPower: userProfile.ratingPower || 0,
      ratingSpeed: userProfile.ratingSpeed || 0,
      ratingEndurance: userProfile.ratingEndurance || 0,
      ratingTechnique: userProfile.ratingTechnique || 0,
      ratingFlexibility: userProfile.ratingFlexibility || 0,
    };

    const gains = calculateWorkoutGains(
      [videoData.loadTypes],
      currentCharacteristics
    );

    // Суммируем все приросты
    const totalGain = Object.values(gains).reduce((sum, val) => sum + val, 0);
    
    if (totalGain === 0) return null;
    
    return `+${totalGain.toFixed(2)}`;
  };

  return (
    <div className={containerClass}>{/* pb-20 для отступа под таб-бар */}
      {/* Header */}
  <header className={`flex items-center justify-between p-4 bg-[#101530] shadow-sm border-b border-gray-700 ${isLandscape ? 'hidden' : ''}`} style={{ paddingTop: '16px' }}>
        <div className="flex items-center space-x-2">
          <button 
            onClick={() => {
              if (fromWorkout) {
                router.push('/training/workout');
              } else if (autoplayEnabled) {
                router.push('/video');
              } else {
                router.back();
              }
            }} 
            className="text-white hover:text-gray-300"
          >
            <Image src="/icons/icon-action-back.svg" alt="Назад" width={24} height={24} />
          </button>
          <h1 className="text-lg font-semibold text-white">ТРЕНЕРОВКА</h1>
        </div>
      </header>

      {/* Video Player */}
      <div className={isLandscape ? 'fixed inset-0 z-50 bg-black flex items-center justify-center' : 'relative bg-black'}>
        <div 
          className={`${isLandscape ? 'w-full h-full' : 'aspect-video'} relative overflow-hidden`}
          onMouseMove={handleVideoInteraction}
          onTouchStart={handleVideoInteraction}
        >
          {isLoading ? (
            <div className="w-full h-full flex items-center justify-center bg-black">
              <div className="text-white">Загрузка...</div>
            </div>
          ) : isKinescopeLoading ? (
            // Загрузка прямой ссылки Kinescope - показываем превью
            <div className="w-full h-full relative bg-black">
              {videoData?.thumbnail && (
                <Image
                  src={videoData.thumbnail}
                  alt={videoData.title}
                  fill
                  className="object-cover"
                />
              )}
              <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                <div className="text-center">
                  <div className="w-12 h-12 border-4 border-white/30 border-t-white rounded-full animate-spin mx-auto mb-3"></div>
                  <div className="text-white text-sm">Подготовка видео...</div>
                </div>
              </div>
            </div>
          ) : (
            // Используем video тег для всех видео (включая Kinescope с прямыми CDN ссылками)
            <>
              <video
                ref={videoRef}
                className="w-full h-full object-cover"
                src={kinescopeDirectUrl || videoData?.videoUrl || '/video/trenka.mp4'}
                poster={videoData?.thumbnail}
                autoPlay
                muted={isMuted}
                playsInline
                webkit-playsinline="true"
                x-webkit-airplay="allow"
                controlsList="nodownload"
                preload="auto"
                onClick={togglePlay}
                onPlay={() => setIsPlaying(true)}
                onPause={() => setIsPlaying(false)}
                onTimeUpdate={(e) => {
                  const video = e.currentTarget;
                  setCurrentTime(video.currentTime);
                  
                  // Обновляем буферизацию
                  if (video.buffered.length > 0) {
                    const bufferedEnd = video.buffered.end(video.buffered.length - 1);
                    const bufferedPercent = (bufferedEnd / video.duration) * 100;
                    setBuffered(bufferedPercent);
                  }

                  // Отслеживаем прогресс для тренировки
                  if (video.duration) {
                    handleVideoProgress(video.currentTime, video.duration);
                  }
                }}
                onLoadedMetadata={(e) => {
                  const video = e.currentTarget;
                  if (video.duration && !isNaN(video.duration)) {
                    setDuration(video.duration);
                    console.log('Duration set from loadedmetadata:', video.duration);
                  }
                }}
                onCanPlay={(e) => {
                  const video = e.currentTarget;
                  // Пытаемся начать воспроизведение когда видео готово
                  if (!isPlaying) {
                    video.play().then(() => {
                      setIsPlaying(true);
                      console.log('Autoplay started successfully');
                    }).catch(err => {
                      console.log('Autoplay was prevented:', err);
                      // Если autoplay заблокирован, ждем клика пользователя
                      setIsPlaying(false);
                    });
                  }
                }}
                onProgress={(e) => {
                  const video = e.currentTarget;
                  // Обновляем прогресс буферизации
                  if (video.buffered.length > 0) {
                    const bufferedEnd = video.buffered.end(video.buffered.length - 1);
                    const bufferedPercent = (bufferedEnd / video.duration) * 100;
                    setBuffered(bufferedPercent);
                  }
                }}
                onWaiting={() => {
                  console.log('Video is buffering...');
                }}
                onCanPlayThrough={() => {
                  console.log('Video can play through without buffering');
                }}
                onEnded={handleVideoEnded}
              />
              
              {/* Buffering Indicator */}
              {buffered < 100 && buffered > 0 && (
                <div className="absolute top-4 right-4 bg-black/50 backdrop-blur-sm px-3 py-1.5 rounded-full text-white text-xs">
                  Загружено: {Math.round(buffered)}%
                </div>
              )}
              
              {/* Play/Pause Overlay */}
              <div className={`absolute inset-0 bg-gradient-to-b from-transparent to-black/50 flex items-center justify-center transition-opacity duration-300 ${
                showControls ? 'opacity-100' : 'opacity-0'
              }`}>
                <button
                  onClick={togglePlay}
                  className="w-16 h-16 bg-white/20 backdrop-blur-sm rounded-full flex items-center justify-center opacity-80 hover:opacity-100 transition-opacity"
                >
                  <Image
                    src={isPlaying 
                      ? '/icons/video/player/pause.svg'
                      : '/icons/video/player/Play.svg'
                    }
                    alt={isPlaying ? 'Пауза' : 'Воспроизвести'}
                    width={32}
                    height={32}
                  />
                </button>
              </div>
            </>
          )}
          
          {/* Video Controls - для всех видео */}
          <div className={`absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent pt-12 ${isLandscape ? 'pb-8 px-6' : 'pb-4 px-4'} transition-opacity duration-300 ${
            showControls ? 'opacity-100' : 'opacity-0'
          }`}>
            {/* Progress Bar */}
            <div 
              className={`flex-1 bg-white/30 rounded-full cursor-pointer mb-3 hover:h-2 transition-all relative ${isLandscape ? 'h-1.5' : 'h-1'}`}
              onClick={handleSeek}
            >
              {/* Buffered (загруженная часть) */}
              <div 
                className="absolute h-full bg-white/40 rounded-full transition-all"
                style={{ width: `${buffered}%` }}
              ></div>
              {/* Current progress (текущая позиция) */}
              <div 
                className="absolute h-full bg-blue-500 rounded-full transition-all"
                style={{ width: `${duration > 0 ? (currentTime / duration) * 100 : 0}%` }}
              ></div>
            </div>
            
            {/* Control Buttons */}
            <div className="flex items-center justify-between">
              <div className={`flex items-center space-x-3 ${isLandscape ? 'space-x-4' : ''}`}>
                {/* Play/Pause Button */}
                <button 
                  onClick={togglePlay}
                  className={`transition-opacity hover:opacity-80 ${isLandscape ? 'w-12 h-12' : ''}`}
                  title={isPlaying ? 'Пауза' : 'Воспроизвести'}
                >
                  <Image
                    src={isPlaying 
                      ? '/icons/video/player/pause.svg'
                      : '/icons/video/player/Play.svg'
                    }
                    alt={isPlaying ? 'Пауза' : 'Воспроизвести'}
                    width={isLandscape ? 28 : 24}
                    height={isLandscape ? 28 : 24}
                  />
                </button>
                
                {/* Volume Control */}
                <button 
                  onClick={toggleMute} 
                  className="transition-opacity hover:opacity-80"
                  title={isMuted ? 'Включить звук' : 'Выключить звук'}
                >
                  <Image
                    src={isMuted 
                      ? '/icons/video/player/Volume=No.svg'
                      : '/icons/video/player/Volume=Yes.svg'
                    }
                    alt={isMuted ? 'Включить звук' : 'Выключить звук'}
                    width={isLandscape ? 28 : 24}
                    height={isLandscape ? 28 : 24}
                  />
                </button>
                
                {/* Time Display */}
                <span className={`text-white font-medium ${isLandscape ? 'text-base' : 'text-sm'}`}>
                  {formatTime(currentTime)} / {formatTime(duration)}
                </span>
              </div>
              
              <div className={`flex items-center space-x-3 ${isLandscape ? 'space-x-4' : ''}`}>
                {/* Autoplay Toggle */}
                <button 
                  onClick={() => setAutoplayEnabled(!autoplayEnabled)}
                  className="transition-opacity hover:opacity-80"
                  title={autoplayEnabled ? 'Автоплей включен' : 'Автоплей выключен'}
                >
                  <Image
                    src={autoplayEnabled 
                      ? '/icons/video/player/material-symbols_autoplay active.svg'
                      : '/icons/video/player/material-symbols_autoplay def.svg'
                    }
                    alt="Автоплей"
                    width={isLandscape ? 28 : 24}
                    height={isLandscape ? 28 : 24}
                  />
                </button>
                
                {/* Fullscreen Button */}
                <button 
                  onClick={toggleFullscreen}
                  className="transition-opacity hover:opacity-80 disabled:opacity-50"
                  title={isFullscreen ? 'Выход из полноэкранного режима' : 'Полноэкранный режим'}
                  disabled={!isFullscreenSupported()}
                >
                  <Image
                    src={isFullscreen 
                      ? '/icons/video/player/Fulscreen=Yes.svg'
                      : '/icons/video/player/Fulscreen=No.svg'
                    }
                    alt="Полноэкранный режим"
                    width={isLandscape ? 28 : 24}
                    height={isLandscape ? 28 : 24}
                  />
                </button>
              </div>
            </div>
          </div>

          {/* Next Video Preview with Countdown - Overlay */}
          {showNextVideoPreview && nextVideo && (
            <div className="absolute inset-0 bg-[#0A0E1A] p-4 md:p-8 z-50">
              {/* Header - "ДАЛЬШЕ" слева, крестик справа */}
              <div className="flex items-center justify-between mb-6 md:mb-8">
                <h2 className="text-white text-xl md:text-4xl font-bold tracking-wider">ДАЛЬШЕ</h2>
                
                {/* Close Button */}
                <button
                  onClick={cancelAutoplay}
                  className="w-8 h-8 md:w-10 md:h-10 flex items-center justify-center text-white hover:text-gray-300 transition-colors"
                >
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="md:w-7 md:h-7">
                    <line x1="18" y1="6" x2="6" y2="18"></line>
                    <line x1="6" y1="6" x2="18" y2="18"></line>
                  </svg>
                </button>
              </div>
              
              {/* Content: Превью (240px) + Название справа на мобилке */}
              <div className="flex flex-row md:flex-row items-start gap-4 md:gap-8">
                {/* Thumbnail with Countdown - 240px на мобилке */}
                <div className="relative w-60 md:w-[400px] flex-shrink-0">
                  <div className="w-full aspect-video rounded-lg md:rounded-2xl overflow-hidden bg-white/5 backdrop-blur-sm border border-white/10">
                    {nextVideo.thumbnail && (
                      <Image
                        src={nextVideo.thumbnail}
                        alt={nextVideo.title}
                        fill
                        className="object-cover opacity-80"
                      />
                    )}
                    {/* Countdown Circle - в центре превью */}
                    <div className="absolute inset-0 flex items-center justify-center">
                      <div className="relative w-16 h-16 md:w-24 md:h-24">
                        <svg className="w-full h-full transform -rotate-90">
                          <circle
                            cx="32"
                            cy="32"
                            r="28"
                            stroke="rgba(255,255,255,0.15)"
                            strokeWidth="2.5"
                            fill="none"
                            className="md:hidden"
                          />
                          <circle
                            cx="32"
                            cy="32"
                            r="28"
                            stroke="white"
                            strokeWidth="2.5"
                            fill="none"
                            strokeDasharray={`${2 * Math.PI * 28}`}
                            strokeDashoffset={`${2 * Math.PI * 28 * (1 - countdown / 5)}`}
                            className="transition-all duration-1000 ease-linear md:hidden"
                          />
                          <circle
                            cx="48"
                            cy="48"
                            r="42"
                            stroke="rgba(255,255,255,0.15)"
                            strokeWidth="3"
                            fill="none"
                            className="hidden md:block"
                          />
                          <circle
                            cx="48"
                            cy="48"
                            r="42"
                            stroke="white"
                            strokeWidth="3"
                            fill="none"
                            strokeDasharray={`${2 * Math.PI * 42}`}
                            strokeDashoffset={`${2 * Math.PI * 42 * (1 - countdown / 5)}`}
                            className="hidden md:block transition-all duration-1000 ease-linear"
                          />
                        </svg>
                        <div className="absolute inset-0 flex items-center justify-center">
                          <span className="text-white text-2xl md:text-4xl font-bold">{countdown}</span>
                        </div>
                      </div>
                    </div>
                    {/* Timer Badge */}
                    <div className="absolute bottom-2 right-2 md:bottom-3 md:right-3 bg-black/70 backdrop-blur-sm rounded px-2 py-1 md:px-2.5 md:py-1">
                      <span className="text-white text-[10px] md:text-xs font-medium">
                        {nextVideo.duration && !isNaN(nextVideo.duration) && nextVideo.duration > 0 
                          ? `${Math.floor(nextVideo.duration / 60)}:${String(Math.floor(nextVideo.duration % 60)).padStart(2, '0')}` 
                          : '0:00'}
                      </span>
                    </div>
                  </div>
                </div>
                
                {/* Video Title - справа от превью */}
                <div className="flex-1 flex flex-col justify-start">
                  <h3 className="text-white text-sm md:text-xl font-semibold leading-snug mb-3 md:mb-6">
                    {nextVideo.title}
                  </h3>
                  
                  {/* Info - только на десктопе */}
                  <div className="hidden md:flex flex-col gap-5 text-white/60 uppercase tracking-wider text-xs font-medium">
                    <div className="flex flex-col gap-1">
                      <div className="text-[9px] text-white/40">ВИД</div>
                      <div className="text-xs">{nextVideo.category || 'ТРЕНИРОВКИ'}</div>
                    </div>
                    <div className="flex flex-col gap-1">
                      <div className="text-[9px] text-white/40">ТРЕНЕР</div>
                      <div className="text-xs">{nextVideo.trainer.name} {nextVideo.trainer.lastName}</div>
                    </div>
                    <div className="flex flex-col gap-1">
                      <div className="text-[9px] text-white/40">ОБОРУДОВАНИЕ</div>
                      <div className="text-xs">{nextVideo.equipment?.join(', ') || 'НЕТ'}</div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

  {/* Action Icons (скрываем в ландшафтном режиме на мобилках) */}
  <div className={`bg-[#101530] ${isLandscape ? 'hidden' : ''}`}>
        <div className="overflow-x-auto scrollbar-hide">
          <div className="flex items-center gap-3 p-4 min-w-max">
            {/* Like */}
            <button 
              onClick={toggleLike}
              className="bg-[#AEABBB33] rounded-full px-4 py-2 flex items-center gap-2 flex-shrink-0 transition-opacity hover:opacity-80"
            >
              <Image 
                src={isLiked ? '/icons/video/Active=Yes.svg' : '/icons/video/Active=No.svg'} 
                alt="Лайк" 
                width={20} 
                height={20} 
              />
              <span className="text-[#AEABBB] text-xs whitespace-nowrap">
                {likesCount >= 1000 
                  ? `${(likesCount / 1000).toFixed(1)} тыс.` 
                  : likesCount}
              </span>
            </button>
            
            {/* Calendar */}
            <button 
              onClick={() => setShowScheduleModal(true)}
              className="bg-[#AEABBB33] rounded-full px-4 py-2 flex items-center gap-2 flex-shrink-0 hover:opacity-80 transition-opacity"
            >
              <Image src="/icons/video/Type=calendar, Active=No.svg" alt="Календарь" width={20} height={20} />
              <span className="text-[#AEABBB] text-xs whitespace-nowrap">Календарь</span>
            </button>
            
            {/* Download */}
            <button
              onClick={handleDownload}
              disabled={isDownloading}
              className={`rounded-full px-4 py-2 flex items-center gap-2 flex-shrink-0 transition-all ${
                isDownloaded 
                  ? 'bg-green-500/20 hover:bg-green-500/30' 
                  : 'bg-[#AEABBB33] hover:opacity-80'
              } ${isDownloading ? 'opacity-50 cursor-not-allowed' : ''}`}
            >
              {isDownloading ? (
                <>
                  <div className="w-5 h-5 border-2 border-blue-400 border-t-transparent rounded-full animate-spin" />
                  <span className="text-[#AEABBB] text-xs whitespace-nowrap">
                    {Math.round(downloadProgress)}%
                  </span>
                </>
              ) : isDownloaded ? (
                <>
                  <CheckCircle size={20} className="text-green-400" />
                  <span className="text-green-400 text-xs whitespace-nowrap">Скачано</span>
                </>
              ) : (
                <>
                  <Download size={20} className="text-[#AEABBB]" />
                  <span className="text-[#AEABBB] text-xs whitespace-nowrap">Скачать</span>
                </>
              )}
            </button>
            
            {/* Share */}
            <div className="bg-[#AEABBB33] rounded-full px-4 py-2 flex items-center gap-2 flex-shrink-0">
              <Image src="/icons/video/action-share.svg" alt="Поделиться" width={20} height={20} />
              <span className="text-[#AEABBB] text-xs whitespace-nowrap">Поделиться</span>
            </div>
          </div>
        </div>
      </div>

      {/* Tags / Description / Trainer - скрываем при ландшафте на мобилке */}
      <div className={`${isLandscape ? 'hidden' : ''}`}>
      <TagsSection 
        tags={videoData?.tags}
        equipment={videoData?.equipment}
        category={videoData?.category}
        difficulty={videoData?.difficulty}
        level={videoData?.level}
        description={videoData?.description}
        title={videoData?.title}
        trainer={videoData?.trainer ? {
          name: videoData.trainer.name,
          lastName: videoData.trainer.lastName,
          avatar: videoData.trainer.avatar
        } : null}
        gainTag={calculateVideoGain() && (
          <div
            className="px-3 py-1 rounded-full text-xs whitespace-nowrap font-bold flex items-center gap-1 w-fit"
            style={{
              backgroundColor: 'rgba(161, 255, 74, 0.2)',
              color: '#FFFFFF',
            }}
          >
            <Image
              src="/icons/video/energy-active.svg"
              alt="Energy"
              width={12}
              height={12}
            />
            {calculateVideoGain()}
          </div>
        )}
      />
      </div>
      
      {/* Скрываем BottomNavigation в горизонтальном режиме */}
      {!isLandscape && <BottomNavigation activeTab="video" />}
      
      {/* Модалка прироста характеристик */}
      {showGainsModal && characteristicsGains && newCharacteristics && (
        <CharacteristicsGainModal
          gains={characteristicsGains}
          newCharacteristics={newCharacteristics}
          onClose={handleGainsModalClose}
        />
      )}
      
      {/* Модалка планирования тренировки */}
      <ScheduleModal
        isOpen={showScheduleModal}
        onClose={() => setShowScheduleModal(false)}
        videoId={videoId}
      />

      {/* Toast уведомления */}
      {toast && (
        <Toast
          message={toast.message}
          type={toast.type}
          onClose={() => setToast(null)}
        />
      )}
    </div>
  );
}
