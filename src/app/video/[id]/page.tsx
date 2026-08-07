'use client';

import React, { useState, useRef, useEffect, useCallback } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  Heart, ChevronLeft, Play, Pause, RotateCcw, RotateCw,
  Volume2, VolumeX, Maximize, Minimize, Smartphone, CalendarPlus, Share2,
  Zap, WifiOff, Check, X, Loader2, Settings2,
} from 'lucide-react';
import TagsSection from '@/components/TagsSection';
import VideoComments from '@/components/VideoComments';
import BottomNavigation from '@/components/BottomNavigation';
import CharacteristicsGainModal from '@/components/CharacteristicsGainModal';
import ScheduleModal from '@/components/ScheduleModal';
import Toast from '@/components/Toast';
import { isKinescopeUrl, getKinescopeDirectUrl } from '@/lib/videoQuality';
import { calculateWorkoutGains, CharacteristicType } from '@/lib/characteristics';
import { openSubscriptionModal } from '@/lib/subscription-modal';
// Кнопки «Скачать» и «Камера» (PoseTracker) убраны 2026-07-31 — функционал пока
// не используется. isVideoDownloaded/getOfflineVideo остаются: уже скачанные
// видео продолжают играть офлайн.
import { isVideoDownloaded, getOfflineVideo } from '@/lib/offlineVideos';

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
  rpeMin?: number | null;
  rpeMax?: number | null;
  moduleType?: string | null;
  loadType?: string | null;
  muscleGroup?: string | null;
}

// O-3: сохранение тайм-кода просмотра в localStorage, чтобы при обновлении/
// выходе/возврате видео продолжалось примерно с места остановки.
const POS_PREFIX = 'video_pos_';
const posKey = (id: string) => POS_PREFIX + id;

// Подсказка «поверни телефон» — показываем один раз НА УСТРОЙСТВО, а не при
// каждом запуске видео. Ключ в localStorage; при недоступном localStorage
// (Safari private mode) деградируем до показа раз за сессию.
const ROTATE_HINT_KEY = 'trenki_rotate_hint_shown';

function saveVideoPosition(id: string, t: number, d: number, endEpsilonSec: number) {
  try {
    if (!id || !d || isNaN(d) || isNaN(t)) return;
    // Не храним: вступление (t<5) ИЛИ позицию у самого конца (в пределах
    // endEpsilonSec) — иначе возобновление у конца давало бы мгновенный/повторный
    // зачёт потенциала.
    if (t < 5 || t >= d - endEpsilonSec) {
      localStorage.removeItem(posKey(id));
      return;
    }
    localStorage.setItem(posKey(id), JSON.stringify({ t }));
  } catch {
    // localStorage недоступен — просто не сохраняем позицию
  }
}

function loadVideoPosition(id: string): number | null {
  try {
    const raw = id ? localStorage.getItem(posKey(id)) : null;
    if (!raw) return null;
    const v = JSON.parse(raw);
    return typeof v?.t === 'number' && isFinite(v.t) ? v.t : null;
  } catch {
    return null;
  }
}

function clearVideoPosition(id: string) {
  try {
    if (id) localStorage.removeItem(posKey(id));
  } catch {
    // no-op
  }
}

export default function VideoPage({ params }: VideoPageProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const fromWorkout = searchParams.get('fromWorkout') === 'true';
  const sessionId = searchParams.get('sessionId');
  const [isPlaying, setIsPlaying] = useState(false);
  const [isLiked, setIsLiked] = useState(false);
  const [likesCount, setLikesCount] = useState(0);
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
  
  // Для рекомендации следующего видео в конце просмотра (без автоплея)
  const [nextVideo, setNextVideo] = useState<VideoData | null>(null);
  const [showNextVideoPreview, setShowNextVideoPreview] = useState(false);

  // Режим просмотра: «Тренировка» (без перемотки, идёт в зачёт потенциала) /
  // «Просмотр» (с перемоткой, БЕЗ начисления потенциала; просмотр всё равно
  // пишется в историю). Переключается кнопкой «Режим» в плеере.
  // В тренировке (fromWorkout) — всегда «Тренировка», перемотка запрещена.
  const [watchMode, setWatchMode] = useState<'training' | 'view'>('training');
  // Единый шит настроек (Режим + Качество) — вместо двух отдельных меню в панели
  const [showSettings, setShowSettings] = useState(false);
  const showSettingsRef = useRef(false); // зеркало для таймера автоскрытия контролов
  // Микроанимация закрытия шита/поповера настроек: на время exit-анимации шит
  // остаётся смонтированным с классом slideDown/fadeOut, размонтируется по таймеру.
  const [settingsClosing, setSettingsClosing] = useState(false);
  const settingsCloseTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const SETTINGS_ANIM_MS = 300; // = длительность .animate-slideDown/.animate-fadeOut

  const closeSettings = useCallback(() => {
    if (!showSettingsRef.current || settingsCloseTimerRef.current) return; // уже закрыто/закрывается
    setSettingsClosing(true);
    settingsCloseTimerRef.current = setTimeout(() => {
      settingsCloseTimerRef.current = null;
      setShowSettings(false);
      setSettingsClosing(false);
    }, SETTINGS_ANIM_MS);
  }, []);
  const canSeek = !fromWorkout && watchMode === 'view';
  const canSeekRef = useRef(false); // зеркало canSeek для хоткеев без stale-стейта
  // Завершение/зачёт — по РЕАЛЬНОМУ концу ролика: когда до конца осталось ≤ этого.
  // onEnded — основной путь (100%), а near-end порог — страховка для Android, где
  // onEnded в конце часто не приходит (ребуфер/уход в фон). Раньше стоял 90% → видео
  // обрывалось за ~10% до конца (баг «правой отпрыгали, а левая 5 секунд и вылетает»).
  const END_EPSILON_SEC = 0.5;

  // Скачано ли видео в офлайн (питает офлайн-баннер и выбор источника
  // воспроизведения; сама кнопка «Скачать» убрана — см. комментарий ниже).
  const [isDownloaded, setIsDownloaded] = useState(false);

  // Online/offline для баннера «нет сети, видео не скачано»
  const [isOffline, setIsOffline] = useState(false);
  useEffect(() => {
    setIsOffline(typeof navigator !== 'undefined' && !navigator.onLine);
    const onOnline = () => setIsOffline(false);
    const onOffline = () => setIsOffline(true);
    window.addEventListener('online', onOnline);
    window.addEventListener('offline', onOffline);
    return () => {
      window.removeEventListener('online', onOnline);
      window.removeEventListener('offline', onOffline);
    };
  }, []);


  // Состояние для модалки прироста характеристик
  const [showGainsModal, setShowGainsModal] = useState(false);
  const [characteristicsGains, setCharacteristicsGains] = useState<any>(null);
  const [newCharacteristics, setNewCharacteristics] = useState<any>(null);
  const [isCompletingModule, setIsCompletingModule] = useState(false);
  const [showScheduleModal, setShowScheduleModal] = useState(false);
  
  // Состояние для Toast уведомлений
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'warning' | 'info' } | null>(null);
  
  // Пилюля «поверни телефон» (бывшая полноэкранная подсказка PWA)
  const [showFullscreenHint, setShowFullscreenHint] = useState(false);
  // Таймер автоскрытия пилюли — чтобы повторные показы не накладывались
  const rotateHintTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Показывает ненавязчивую пилюлю «поверни телефон» на 3 секунды.
  // НЕ блокирует контролы (в отличие от старого полноэкранного оверлея).
  const showRotateHint = useCallback(() => {
    setShowFullscreenHint(true);
    if (rotateHintTimerRef.current) clearTimeout(rotateHintTimerRef.current);
    rotateHintTimerRef.current = setTimeout(() => {
      rotateHintTimerRef.current = null;
      setShowFullscreenHint(false);
    }, 3000);
  }, []);

  // Состояние для управления качеством видео
  const [availableQualities, setAvailableQualities] = useState<Record<string, string>>({});
  const [selectedQuality, setSelectedQuality] = useState<string>('');

  // Тач/драг по скрабберу — кружок показываем только пока пользователь его держит
  const [isScrubbing, setIsScrubbing] = useState(false);

  // Double-tap seek
  const doubleTapTimerRef = useRef<NodeJS.Timeout | null>(null);
  const [seekFlash, setSeekFlash] = useState<'left' | 'right' | null>(null);
  const seekFlashTimerRef = useRef<NodeJS.Timeout | null>(null);

  const playerContainerRef = useRef<HTMLDivElement>(null);

  // Получаем params асинхронно и загружаем данные видео
  useEffect(() => {
    let cancelled = false;
    const getParams = async () => {
      const resolvedParams = await params;
      setVideoId(resolvedParams.id);

      // Главный путь: дёргаем ТОЛЬКО нужное видео — не ждём массив всех.
      // На больших каталогах это ускоряет первый кадр в разы и сразу
      // даёт thumbnail для poster'а пока резолвится Kinescope direct URL.
      try {
        setIsLoading(true);
        const response = await fetch(`/api/videos/${resolvedParams.id}`);
        // Видео-занятия платные: 402 → показать подписку и вернуть в каталог.
        if (response.status === 402) {
          openSubscriptionModal('video');
          router.replace('/video');
          return;
        }
        if (response.ok) {
          const video = await response.json();
          setVideoData(video);
        }
      } catch (error) {
        console.error('Error loading video:', error);
      } finally {
        setIsLoading(false);
      }

      // В фоне (не блокируем UI) подтягиваем nextVideo и список всех — нужны
      // только для оверлея «следующее видео» в конце просмотра. Профиль тоже
      // лениво.
      // Каталог нужен ТОЛЬКО для оверлея «следующее видео» в конце просмотра, а
      // запрос тяжёлый (весь список без пагинации). Откладываем — иначе он
      // конкурирует за сеть с первыми чанками видео и плеер стартует медленнее.
      void (async () => {
        await new Promise((r) => setTimeout(r, 8000));
        if (cancelled) return;
        try {
          const listRes = await fetch('/api/videos', { cache: 'no-store' });
          if (!listRes.ok) return;
          const listData = await listRes.json();
          const videos: VideoData[] = listData.videos || [];
          const idx = videos.findIndex((v) => v.id === resolvedParams.id);
          if (idx !== -1 && idx < videos.length - 1) {
            setNextVideo(videos[idx + 1]);
          } else if (videos.length > 0) {
            setNextVideo(videos[0]);
          }
        } catch (e) {
          console.error('next video fetch failed', e);
        }
      })();

      void (async () => {
        try {
          const profileResponse = await fetch('/api/profile');
          if (profileResponse.ok) {
            const profileData = await profileResponse.json();
            setUserProfile(profileData.user?.profile);
          }
        } catch (e) {
          console.error('profile fetch failed', e);
        }
      })();
    };
    getParams();
    return () => {
      cancelled = true;
    };
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
  // Продолжение модуля тренировки с места обрыва. Источник истины — СЕРВЕР
  // (WorkoutSessionVideo.watchedDuration, приходит в ответе action:'start'), а не
  // localStorage: иначе свободный просмотр этого же ролика подарил бы «перемотку»
  // внутри тренировки и ложный зачёт потенциала.
  const workoutResumeRef = useRef(0);
  const workoutResumeReadyRef = useRef(false);
  
  // Отслеживание достижения 80% для начисления баллов (обычный просмотр)
  const gainsCreditedRef = useRef(false);

  // Ставит видео на сохранённую серверную позицию модуля. Вызывается и из
  // onCanPlay, и из ответа start-POST (кто успеет позже) — латч resumeAppliedRef
  // гарантирует однократность. Позицию у самого конца игнорируем: иначе вход в
  // модуль сразу давал бы повторный зачёт.
  const applyWorkoutResume = useCallback(() => {
    if (!fromWorkout) return;
    if (resumeAppliedRef.current) return;
    if (!workoutResumeReadyRef.current) return;
    const video = videoRef.current;
    if (!video || !video.duration || isNaN(video.duration)) return;

    resumeAppliedRef.current = true;
    const at = workoutResumeRef.current;
    if (at >= 5 && at < video.duration - END_EPSILON_SEC && video.currentTime < 5) {
      seekingProgrammaticRef.current = true;
      video.currentTime = at;
    }
  }, [fromWorkout]);

  // Отмечаем начало видео в тренировке или записываем просмотр
  useEffect(() => {
    // Сброс позиции продолжения — ЗДЕСЬ, до отправки start-POST: этот эффект
    // владеет videoId, поэтому ответ POST-а (который заполнит рефы) не может
    // прийти раньше сброса и быть затёртым.
    workoutResumeRef.current = 0;
    workoutResumeReadyRef.current = false;

    const notifyVideoStart = async () => {
      if (fromWorkout && sessionId && videoId) {
        try {
          const res = await fetch('/api/training/update', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              sessionId,
              videoId,
              action: 'start',
            }),
          });
          // Сервер вернул, сколько уже просмотрено этого модуля — продолжаем с него.
          const d = await res.json().catch(() => null);
          workoutResumeRef.current = typeof d?.resumeAt === 'number' ? d.resumeAt : 0;
          workoutResumeReadyRef.current = true;
          // Гонка: canplay мог случиться раньше ответа — тогда применяем позицию тут.
          applyWorkoutResume();
        } catch (error) {
          console.error('Ошибка отметки начала видео:', error);
          workoutResumeReadyRef.current = true; // не блокируем воспроизведение
        }
      } else if (!fromWorkout && videoId) {
        // Записываем обычный просмотр в историю (userId сервер берёт из сессии)
        try {
          await fetch('/api/profile/record-watch', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ videoId }),
          });
        } catch (error) {
          console.error('Ошибка записи просмотра:', error);
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
    if (!duration) return;

    // Для тренировки — прогресс каждые 5с + завершение по РЕАЛЬНОМУ концу.
    if (fromWorkout && sessionId && videoId) {
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

      // Завершаем/засчитываем ТОЛЬКО когда ролик доигран до конца (зачёт на 100%).
      // onEnded (handleVideoEnded) — основной путь; этот near-end тик — страховка
      // для Android, где onEnded в конце часто не приходит. Оба латчатся одним
      // videoCompletedRef, чтобы не задвоить complete/переход.
      if (!videoCompletedRef.current && currentTime >= duration - END_EPSILON_SEC) {
        videoCompletedRef.current = true; // оптимистично — против дублей на соседних тиках
        const ok = await completeVideoInWorkout();
        // При сбое (сеть/не-ok) снимаем флаг: даём onEnded и следующим тикам повторить.
        if (!ok) videoCompletedRef.current = false;
      }
    }
    // Для обычного просмотра — порог для начисления потенциала. Потенциал
    // начисляем ТОЛЬКО в тренировочном режиме. В тестовом — без прибавки
    // (просмотр уже записан в историю на старте, record-watch). Флаг латчим
    // только когда реально пытались начислить, иначе test→training терял бы зачёт.
    else if (!fromWorkout && videoId) {
      if (!gainsCreditedRef.current && watchMode === 'training' && !seekedInPlaythroughRef.current && currentTime >= duration - END_EPSILON_SEC) {
        gainsCreditedRef.current = true; // оптимистично — против дублей
        const ok = await creditGainsForWatching();
        if (!ok) gainsCreditedRef.current = false; // при сбое — повтор на следующем тике
      }
    }
  }, [fromWorkout, sessionId, videoId, watchMode]);

  // Завершение видео в тренировке. Возвращает true только при успехе —
  // вызывающий код по false снимает videoCompletedRef и повторяет (onEnded/тик).
  const completeVideoInWorkout = async (): Promise<boolean> => {
    if (!fromWorkout || !sessionId || !videoId) {
      console.log('⚠️ Cannot complete video - missing params:', { fromWorkout, sessionId, videoId });
      return false;
    }

    try {
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

      if (response.ok) {
        // Возвращаем на страницу тренировки
        setTimeout(() => {
          router.push(`/training/workout?id=${sessionId}`);
        }, 1000); // Небольшая задержка для плавности
        return true;
      }
      console.error('❌ Failed to complete video:', data);
      return false;
    } catch (error) {
      console.error('Ошибка завершения видео:', error);
      return false;
    }
  };

  // Начисление потенциала при просмотре видео (обычный просмотр, не тренировка).
  // Возвращает true, если зачёт можно считать завершённым (успех ИЛИ дневной
  // лимит — повторять бессмысленно). false → сетевой/иной сбой, нужен повтор.
  const creditGainsForWatching = async (): Promise<boolean> => {
    if (!videoId || fromWorkout) return false;

    try {
      setIsCompletingModule(true);

      const response = await fetch('/api/training/complete-module', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          videoId: videoId,
          sessionId: null, // Обычный просмотр, не тренировка
        }),
      });

      const data = await response.json();

      if (response.ok && data.success) {
        // Показываем модалку с приростом характеристик
        setCharacteristicsGains(data.gains);
        setNewCharacteristics(data.newCharacteristics);
        setShowGainsModal(true);

        // Обновляем локальный профиль
        setUserProfile((prev: any) => ({
          ...prev,
          ...data.newCharacteristics,
        }));
        return true;
      } else if (data.limitReached) {
        setToast({
          message: data.error || 'Достигнут дневной лимит',
          type: 'warning',
        });
        return true; // лимит — терминальное состояние на сегодня, не повторяем
      }
      console.error('❌ Failed to credit gains:', data);
      return false;
    } catch (error) {
      console.error('Ошибка начисления очков:', error);
      setToast({
        message: 'Ошибка начисления очков',
        type: 'error',
      });
      return false;
    } finally {
      setIsCompletingModule(false);
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
    videoCompletedRef.current = false;
    gainsCreditedRef.current = false;
    resumeAppliedRef.current = false; // O-3: для нового видео заново применим resume
    lastPosSaveRef.current = 0;
    // ВНИМАНИЕ: workoutResumeRef/ReadyRef здесь НЕ сбрасываем. Этот эффект висит
    // на videoData, а ответ start-POST может прийти раньше — сброс затирал бы уже
    // полученную позицию, и продолжение с места обрыва терялось. Их сбрасывает
    // эффект, владеющий videoId (там же, где шлётся start-POST).
    seekedInPlaythroughRef.current = false;
    setWatchMode('training'); // каждое новое видео стартует в режиме «Тренировка»
    setShowSettings(false);

    const loadKinescopeUrl = async () => {
      if (videoData?.videoUrl && isKinescopeUrl(videoData.videoUrl)) {
        // Offline-fallback: если нет сети ИЛИ видео уже скачано — берём прямую
        // CDN-ссылку из IndexedDB, не дёргаем /api/kinescope/metadata.
        // Сам видео-blob хранится в Cache API по этому URL, SW отдаст его без сети.
        const isOnline = typeof navigator !== 'undefined' ? navigator.onLine : true;
        if (!isOnline || (videoId && (await isVideoDownloaded(videoId)))) {
          try {
            const offline = videoId ? await getOfflineVideo(videoId) : null;
            if (offline?.videoUrl && !ignore) {
              setKinescopeDirectUrl(offline.videoUrl);
              setIsKinescopeLoading(false);
              return;
            }
          } catch (e) {
            console.warn('[OFFLINE] Не удалось взять видео из IndexedDB:', e);
          }
          // Если оффлайн и нет в IndexedDB — попытка fetch всё равно упадёт,
          // но пропускать молча тоже плохо: даём дальше упасть в catch ниже.
        }

        // Проверяем кэш сначала (localStorage переживает перезагрузку, в отличие от sessionStorage)
        const cacheKey = `kinescope_url_${videoData.videoUrl}`;
        // Дефолтное качество — 480p для быстрого старта
        const PREFERRED_QUALITY = '480p';
        const pickQuality = (qs: Record<string, string>): string => {
          // Приоритет: 480p → 720p → 360p → 1080p → первое доступное
          const order = ['480p', '720p', '360p', '1080p', 'original'];
          for (const q of order) {
            if (qs[q]) return q;
          }
          return Object.keys(qs)[0] || '';
        };

        let cached: string | null = null;
        try {
          cached = localStorage.getItem(cacheKey) || sessionStorage.getItem(cacheKey);
        } catch (e) { /* ignore */ }
        
        if (cached) {
          try {
            const cachedData = JSON.parse(cached);
            // Используем кэш если он не старше 1 часа
            if (Date.now() - cachedData.timestamp < 3600000) {
              if (!ignore) {
                if (cachedData.availableQualities && Object.keys(cachedData.availableQualities).length > 0) {
                  const qs = cachedData.availableQualities;
                  setAvailableQualities(qs);
                  const defaultQ = pickQuality(qs);
                  if (defaultQ) {
                    setSelectedQuality(defaultQ);
                    // Устанавливаем src ОДИН раз — без промежуточной установки
                    setKinescopeDirectUrl(qs[defaultQ]);
                  } else {
                    setKinescopeDirectUrl(cachedData.url);
                  }
                } else {
                  setKinescopeDirectUrl(cachedData.url);
                }
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
            // Выбираем качество ОДИН раз и устанавливаем src единственный раз —
            // это убирает повторную загрузку в <video> и ускоряет старт
            const qs = result.availableQualities || {};
            let finalUrl = result.directUrl;
            
            if (Object.keys(qs).length > 0) {
              setAvailableQualities(qs);
              const defaultQ = pickQuality(qs);
              if (defaultQ && qs[defaultQ]) {
                setSelectedQuality(defaultQ);
                finalUrl = qs[defaultQ];
              }
            }
            
            setKinescopeDirectUrl(finalUrl);
            
            // Кэшируем в localStorage (переживёт перезагрузку)
            try {
              localStorage.setItem(cacheKey, JSON.stringify({
                url: finalUrl,
                availableQualities: result.availableQualities,
                timestamp: Date.now()
              }));
            } catch (e) { /* localStorage may be full */ }
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

  // Закрытие шита настроек при клике вне его. Небольшая задержка — чтобы клик
  // открытия не закрыл шит сразу.
  useEffect(() => {
    if (!showSettings) return;
    const close = () => closeSettings();
    const t = setTimeout(() => document.addEventListener('click', close), 0);
    return () => {
      clearTimeout(t);
      document.removeEventListener('click', close);
    };
  }, [showSettings, closeSettings]);

  // Пока шит настроек открыт — пиним контролы видимыми (таймер автоскрытия в
  // showControlsTemporarily проверяет showSettingsRef и не прячет их). После
  // закрытия — перезапускаем автоскрытие, но только если видео играет (на паузе
  // контролы и так пинятся отдельным эффектом).
  useEffect(() => {
    showSettingsRef.current = showSettings;
    if (showSettings) {
      setShowControls(true);
      if (hideControlsTimeoutRef.current) clearTimeout(hideControlsTimeoutRef.current);
    } else if (videoRef.current && !videoRef.current.paused) {
      showControlsTemporarily();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showSettings]);

  // Загружаем статус лайка при открытии видео
  useEffect(() => {
    const loadLikeStatus = async () => {
      if (!videoId || !videoData) return;

      try {
        const response = await fetch(`/api/videos/${videoId}/like`);

        if (response.ok) {
          const data = await response.json();
          setIsLiked(data.isLiked);
          setLikesCount(data.likesCount);
        } else {
          // Нет сессии или ошибка — показываем количество из videoData без isLiked
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
    try {
      const response = await fetch(`/api/videos/${videoId}/like`, {
        method: 'POST',
      });

      if (response.status === 401) {
        router.push('/login');
        return;
      }

      if (response.ok) {
        const data = await response.json();
        setIsLiked(data.isLiked);
        setLikesCount(data.likesCount);
      }
    } catch (error) {
      console.error('Error toggling like:', error);
    }
  };

  // Закрытие модалки прироста
  const handleGainsModalClose = () => {
    setShowGainsModal(false);
  };

  // Кнопка «Скачать» убрана 2026-07-31 (функционал пока не используется).
  // Оффлайн-инфраструктура (offline-video lib, isDownloaded, SW-кэш) сохранена —
  // уже скачанные видео продолжают играть офлайн. Вернуть скачивание: git history.

  // Поделиться видео: нативный share-шит, фолбэк — копирование ссылки в буфер.
  // Ссылка чистая (без fromWorkout/sessionId) — получатель откроет обычный просмотр.
  const handleShare = async () => {
    const url = `${window.location.origin}/video/${videoId}`;
    try {
      if (navigator.share) {
        await navigator.share({ title: videoData?.title || 'Треньки', url });
      } else if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(url);
        setToast({ message: 'Ссылка скопирована', type: 'success' });
      } else {
        setToast({ message: 'Не удалось поделиться ссылкой', type: 'error' });
      }
    } catch (error) {
      // Отмена нативного share-шита пользователем — не ошибка
      if ((error as DOMException)?.name !== 'AbortError') {
        setToast({ message: 'Не удалось поделиться ссылкой', type: 'error' });
      }
    }
  };

  const [showControls, setShowControls] = useState(true);
  const [isBuffering, setIsBuffering] = useState(false); // спиннер при буферизации видео (#4)
  const videoRef = useRef<HTMLVideoElement>(null);
  const hideControlsTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const showControlsRef = useRef(true); // зеркало showControls для тап-логики без stale-стейта (#1)
  const isBufferingRef = useRef(false); // зеркало isBuffering — чтобы onTimeUpdate не читал stale-стейт
  // Дебаунс спиннера буферизации: реальная задержка видна не сразу, а через
  // BUFFER_SPINNER_DELAY_MS. Короткие ребуферы проходят незаметно.
  const bufferingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const BUFFER_SPINNER_DELAY_MS = 400;
  const cancelBufferingSoon = useCallback(() => {
    if (bufferingTimerRef.current) {
      clearTimeout(bufferingTimerRef.current);
      bufferingTimerRef.current = null;
    }
  }, []);
  const showBufferingSoon = useCallback(() => {
    if (bufferingTimerRef.current) return;
    bufferingTimerRef.current = setTimeout(() => {
      bufferingTimerRef.current = null;
      setIsBuffering(true);
    }, BUFFER_SPINNER_DELAY_MS);
  }, []);
  // Снимаем отложенный показ, когда видео поехало / размонтировались.
  useEffect(() => cancelBufferingSoon, [cancelBufferingSoon]);
  const hasShownHintRef = useRef(false); // Флаг для показа подсказки только один раз
  const pendingSeekRef = useRef<number | null>(null); // Позиция для восстановления после смены качества
  const resumeAppliedRef = useRef(false); // O-3: позицию из localStorage применяем один раз на видео
  const lastPosSaveRef = useRef(0); // O-3: троттлинг сохранения позиции
  // Была ли перемотка в текущем проходе. Если да — потенциал за этот просмотр не
  // начисляем, даже если юзер вернул режим «Тренировка». Иначе: перемотал в
  // «Просмотре» на конец → переключил режим → получил полный зачёт за 0 работы.
  const seekedInPlaythroughRef = useRef(false);
  // Программная установка позиции (resume, смена качества) — не считается перемоткой.
  const seekingProgrammaticRef = useRef(false);

  // Держим ref в синхроне с showControls — нужно для решения show/hide внутри
  // отложенного single-tap обработчика (замыкание видит свежее значение).
  useEffect(() => {
    showControlsRef.current = showControls;
  }, [showControls]);
  useEffect(() => {
    isBufferingRef.current = isBuffering;
  }, [isBuffering]);
  useEffect(() => {
    canSeekRef.current = canSeek;
  }, [canSeek]);

  const togglePlay = () => {
    if (videoRef.current) {
      if (isPlaying) {
        videoRef.current.pause();
      } else {
        videoRef.current.play();

        // Подсказка «поверни телефон» — один раз НА УСТРОЙСТВО (localStorage),
        // а не при каждом запуске видео. Фолбэк при недоступном Fullscreen API
        // (toggleFullscreen) показывает её всегда, независимо от этого флага.
        if (!hasShownHintRef.current) {
          hasShownHintRef.current = true;
          let alreadySeen = false;
          try {
            alreadySeen = localStorage.getItem(ROTATE_HINT_KEY) === '1';
          } catch {
            // localStorage недоступен (Safari private mode) — покажем раз за сессию
          }
          if (!alreadySeen) {
            try {
              localStorage.setItem(ROTATE_HINT_KEY, '1');
            } catch {
              // no-op
            }
            showRotateHint();
          }
        }
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

  // Перемотка на 10 секунд назад
  const skipBackward = () => {
    if (!canSeekRef.current) return; // тренировочный режим — перемотка запрещена
    if (videoRef.current) {
      videoRef.current.currentTime = Math.max(0, videoRef.current.currentTime - 10);
    }
    showControlsTemporarily();
  };

  // Перемотка на 10 секунд вперед
  const skipForward = () => {
    if (!canSeekRef.current) return; // тренировочный режим — перемотка запрещена
    if (videoRef.current) {
      videoRef.current.currentTime = Math.min(videoRef.current.duration, videoRef.current.currentTime + 10);
    }
    showControlsTemporarily();
  };

  // NB: единый обработчик горячих клавиш — handleKeyDown ниже (стрелки/J/L/
  // пробел/цифры). Раньше был второй дублирующий listener (handleKeyPress),
  // из-за чего одна стрелка перематывала на 15с, а пробел двойным togglePlay
  // не срабатывал. Удалён в пользу handleKeyDown.

  // Проверка поддержки Fullscreen API
  const checkFullscreenSupport = () => {
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
    const supported = checkFullscreenSupport();
    
    if (!supported) {
      // Если fullscreen не поддерживается, показываем сообщение о повороте телефона
      showRotateHint();
      console.warn('Fullscreen API не поддерживается, показываем подсказку');
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
          showRotateHint();
        }
      }

      // Для остальных браузеров - используем родительский контейнер видео
      const element = videoRef.current?.parentElement;
      if (!element) return;

      if (element.requestFullscreen) {
        element.requestFullscreen().catch(() => showRotateHint());
      } else if ((element as any).webkitRequestFullscreen) {
        (element as any).webkitRequestFullscreen();
      } else if ((element as any).mozRequestFullScreen) {
        (element as any).mozRequestFullScreen();
      } else if ((element as any).msRequestFullscreen) {
        (element as any).msRequestFullscreen();
      } else {
        showRotateHint();
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

    // Скрываем через 3 секунды. Пока открыт шит настроек — не прячем.
    hideControlsTimeoutRef.current = setTimeout(() => {
      if (showSettingsRef.current) return;
      setShowControls(false);
    }, 3000);
  }, []);

  const handleVideoInteraction = () => {
    showControlsTemporarily();
  };

  // Все обработчики событий видео (timeupdate, progress, canplay и т.д.) теперь inline на video элементе

  const handleVideoEnded = async () => {
    setIsPlaying(false);
    setIsBuffering(false);
    clearVideoPosition(videoId); // O-3: досмотрено — не возобновляем с конца
    // Ролик доигран — начинается новый «проход». Снимаем метку перемотки, иначе
    // честный повторный просмотр того же видео уже никогда не начислил бы потенциал.
    seekedInPlaythroughRef.current = false;

    // В тренировке всегда выходим к странице тренировки БЕЗ превью следующего.
    // (near-end тик мог уже завершить видео и запланировать переход — тогда просто
    // выходим, не мигая рекомендацией; иначе — завершаем здесь.)
    if (fromWorkout && sessionId) {
      if (!videoCompletedRef.current) {
        videoCompletedRef.current = true;
        const ok = await completeVideoInWorkout();
        if (!ok) videoCompletedRef.current = false; // сбой — позволяем повторить
      }
      return;
    }

    // Свободный просмотр: зачёт потенциала по РЕАЛЬНОМУ концу (страховка к near-end
    // тику в handleVideoProgress; латч gainsCreditedRef защищает от дубля).
    if (!fromWorkout && videoId && !gainsCreditedRef.current && watchMode === 'training' && !seekedInPlaythroughRef.current) {
      gainsCreditedRef.current = true;
      const ok = await creditGainsForWatching();
      if (!ok) gainsCreditedRef.current = false;
    }

    // Автоплея нет: в конце просто показываем рекомендацию следующего видео
    // (обложка + название, без воспроизведения). Переход — по тапу.
    if (nextVideo) {
      setShowNextVideoPreview(true);
    }
  };

  const closeRecommendation = () => {
    setShowNextVideoPreview(false);
  };

  // Функция для смены качества видео
  const handleQualityChange = (quality: string) => {
    if (!availableQualities[quality] || !videoRef.current) return;

    // Сохраняем текущую позицию — восстановим в onCanPlay
    pendingSeekRef.current = videoRef.current.currentTime;

    setSelectedQuality(quality);
    setKinescopeDirectUrl(availableQualities[quality]);
    closeSettings();
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

  // Один раз при старте показываем контролы и прячем через 3с.
  useEffect(() => {
    showControlsTemporarily();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ВАЖНО (Android): НЕ пере-показываем контролы на каждый flip isPlaying.
  // На слабой сети буферизация дёргает play/pause → раньше эффект каждый раз
  // звал showControlsTemporarily/setShowControls → контролы «мигали».
  // Теперь: только на реальной ПАУЗЕ пиним контролы видимыми; при игре
  // ничего не делаем (показ — по тапу/кнопке).
  useEffect(() => {
    if (!isPlaying) {
      setShowControls(true);
      if (hideControlsTimeoutRef.current) {
        clearTimeout(hideControlsTimeoutRef.current);
      }
    }
  }, [isPlaying]);

  // Очистка таймеров при размонтировании
  useEffect(() => {
    return () => {
      if (hideControlsTimeoutRef.current) {
        clearTimeout(hideControlsTimeoutRef.current);
      }
      if (doubleTapTimerRef.current) {
        clearTimeout(doubleTapTimerRef.current);
      }
      if (seekFlashTimerRef.current) {
        clearTimeout(seekFlashTimerRef.current);
      }
      if (rotateHintTimerRef.current) {
        clearTimeout(rotateHintTimerRef.current);
      }
      if (settingsCloseTimerRef.current) {
        clearTimeout(settingsCloseTimerRef.current);
      }
    };
  }, []);

  // Горячие клавиши для управления видео
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!videoRef.current) return;

      // Не перехватываем клавиши, когда пользователь печатает в поле ввода.
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement ||
        (e.target instanceof HTMLElement && e.target.isContentEditable)
      ) {
        return;
      }

      // Тренировочный режим: перемотка запрещена — глушим все seek-клавиши.
      const seekKeys = ['arrowleft', 'arrowright', 'j', 'l', '0', 'home', 'end',
        '1', '2', '3', '4', '5', '6', '7', '8', '9'];
      if (!canSeekRef.current && seekKeys.includes(e.key.toLowerCase())) {
        e.preventDefault();
        return;
      }

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

  // Сколько качеств реально доступно — определяет, есть ли секция «Качество»
  const hasQualityChoice = Object.keys(availableQualities).length > 1;

  // Содержимое единого шита настроек: секции «Режим» (не в тренировке) и
  // «Качество» (если есть выбор). Пояснения режимов сохранены — они объясняют
  // правила перемотки и начисления потенциала. Рендерится и в нижнем шите
  // (портрет), и в компактном поповере (ландшафт).
  const settingsSections = (
    <>
      {!fromWorkout && (
        <div className="py-1">
          <div
            className="px-4 pt-2 pb-1 text-[10px] font-bold uppercase text-white/40"
            style={{ fontFamily: 'Overpass', letterSpacing: '0.5px' }}
          >
            Режим
          </div>
          {([
            {
              key: 'training' as const,
              title: 'Тренировка',
              hint: 'Без перемотки. Занятие идёт в зачёт роста потенциала.',
            },
            {
              key: 'view' as const,
              title: 'Просмотр',
              hint: 'Можно перематывать, но очки потенциала не начисляются.',
            },
          ]).map((m) => (
            <button
              key={m.key}
              onClick={() => {
                setWatchMode(m.key);
                closeSettings();
                showControlsTemporarily();
              }}
              className={`w-full text-left px-4 py-2.5 transition-colors ${
                watchMode === m.key ? 'bg-white/10' : 'hover:bg-white/10'
              }`}
            >
              <div className="flex items-center justify-between">
                <span className={`text-sm font-semibold ${watchMode === m.key ? 'text-[#A1FF4A]' : 'text-white'}`}>
                  {m.title}
                </span>
                {watchMode === m.key && (
                  <Check size={12} className="text-[#A1FF4A]" strokeWidth={2.5} />
                )}
              </div>
              <div className="text-[11px] leading-snug text-white/60 mt-0.5">{m.hint}</div>
            </button>
          ))}
        </div>
      )}

      {hasQualityChoice && (
        <div className={`py-1 ${!fromWorkout ? 'border-t border-white/10' : ''}`}>
          <div
            className="px-4 pt-2 pb-1 text-[10px] font-bold uppercase text-white/40"
            style={{ fontFamily: 'Overpass', letterSpacing: '0.5px' }}
          >
            Качество
          </div>
          {(['1080p', '720p', '480p', '360p'] as const)
            .filter(q => availableQualities[q])
            .map((quality) => (
              <button
                key={quality}
                onClick={() => handleQualityChange(quality)}
                className={`w-full flex items-center justify-between px-4 py-2.5 text-sm transition-colors ${
                  selectedQuality === quality
                    ? 'text-[#A1FF4A] bg-white/10 font-semibold'
                    : 'text-white/80 hover:bg-white/10 hover:text-white'
                }`}
              >
                <span>{quality}</span>
                {selectedQuality === quality && (
                  <Check size={12} className="text-[#A1FF4A]" strokeWidth={2.5} />
                )}
              </button>
            ))}
        </div>
      )}
    </>
  );

  return (
    <div className={containerClass}>{/* pb-20 для отступа под таб-бар */}
      {/* Header */}
  <header className={`flex items-center justify-between p-4 bg-[#101530] shadow-sm border-b border-gray-700 ${isLandscape ? 'hidden' : ''}`} style={{ paddingTop: 'calc(env(safe-area-inset-top, 0px) + 16px)' }}>
        <div className="flex items-center space-x-2 flex-1 min-w-0">
          <button
            onClick={() => {
              if (fromWorkout) {
                router.push('/training/workout');
              } else {
                router.back();
              }
            }}
            className="text-white hover:text-gray-300 flex-shrink-0"
            aria-label="Назад"
          >
            <ChevronLeft size={24} />
          </button>
          <div className="flex-1 min-w-0">
            {/* В тренировке — маленький оверлайн над названием видео */}
            {fromWorkout && (
              <div
                className="uppercase"
                style={{
                  fontFamily: 'Overpass',
                  fontWeight: 700,
                  fontSize: '11px',
                  lineHeight: '120%',
                  letterSpacing: '0.5px',
                  color: '#A1FF4A',
                }}
              >
                Тренировка
              </div>
            )}
            {/* Реальное название видео вместо статичной надписи «ТРЕНИРОВКА» */}
            <h1
              className="text-white uppercase truncate"
              style={{
                fontFamily: 'Overpass',
                fontWeight: 700,
                fontSize: '12px',
                lineHeight: '120%',
                letterSpacing: '0.5px',
              }}
            >
              {videoData?.title || 'Видео'}
            </h1>
          </div>
        </div>
      </header>

      {isOffline && !isDownloaded && !isLandscape && (
        <div
          className="px-4 py-3 flex items-center justify-center gap-2 text-sm font-semibold"
          style={{
            background: 'rgba(161, 255, 74, 0.10)',
            borderBottom: '1px solid rgba(161, 255, 74, 0.30)',
            color: '#A1FF4A',
          }}
        >
          <WifiOff size={16} className="flex-shrink-0" />
          Нет сети — это видео не скачано для офлайн-просмотра
        </div>
      )}

      {/* Video Player */}
      <div className={isLandscape ? 'fixed inset-0 z-50' : 'relative'}>
        <div
          className={`${isLandscape ? 'w-full h-full bg-black flex items-center justify-center' : 'bg-black'}`}
        >
          <div
            ref={playerContainerRef}
            className={`${isLandscape ? 'w-full h-full' : 'aspect-video'} relative overflow-hidden`}
            // ВАЖНО (Android): авто-показ контролов только для реальной мыши.
            // На тач-устройствах тап генерит синтетический mousemove → раньше
            // он показывал контролы, а tap-toggle через 250мс их прятал →
            // контролы «мигали» на каждое касание. Гейтим по pointerType.
            onPointerMove={(e) => { if (e.pointerType === 'mouse') handleVideoInteraction(); }}
          >
          {isLoading || isKinescopeLoading ? (
            // Пока резолвится URL — показываем превью видео, чтобы пользователь
            // сразу видел кадр, а не чёрный экран. Spinner ненавязчивый,
            // в углу — основное место под poster.
            <div className="w-full h-full relative bg-black">
              {videoData?.thumbnail && (
                <Image
                  src={videoData.thumbnail}
                  alt={videoData.title || ''}
                  fill
                  className="object-cover"
                  priority
                />
              )}
              {/* Лёгкое затемнение, чтобы spinner был виден на светлом превью */}
              <div className="absolute inset-0 bg-gradient-to-b from-transparent via-black/10 to-black/30 pointer-events-none" />
              <div className="absolute bottom-4 right-4">
                <Loader2 size={32} className="animate-spin text-white/80" />
              </div>
            </div>
          ) : (
            // Используем video тег для всех видео (включая Kinescope с прямыми CDN ссылками)
            <>
              <video
                ref={videoRef}
                className={`w-full h-full ${isLandscape ? 'object-contain' : 'object-cover'}`}
                src={kinescopeDirectUrl || videoData?.videoUrl || '/video/trenka.mp4'}
                poster={videoData?.thumbnail}
                autoPlay
                muted={isMuted}
                playsInline
                webkit-playsinline="true"
                x-webkit-airplay="allow"
                controlsList="nodownload"
                preload="auto"
                onPlay={() => setIsPlaying(true)}
                onPause={() => { cancelBufferingSoon(); setIsPlaying(false); setIsBuffering(false); }}
                onError={() => { cancelBufferingSoon(); setIsBuffering(false); }}
                onSeeked={(e) => {
                  setIsBuffering(false);
                  // Перемотка пользователем (не programmatic resume) — помечаем проход
                  // как «с перемоткой», чтобы за него не начислять потенциал.
                  if (resumeAppliedRef.current && !seekingProgrammaticRef.current) {
                    seekedInPlaythroughRef.current = true;
                  }
                  seekingProgrammaticRef.current = false;
                  void e;
                }}
                onTimeUpdate={(e) => {
                  const video = e.currentTarget;
                  setCurrentTime(video.currentTime);

                  // O-3: периодически сохраняем позицию (не чаще раза в 5с, без
                  // setState). Только для свободного просмотра и ТОЛЬКО после того,
                  // как resume применён (resumeAppliedRef) — иначе ранний тик при
                  // t<5 успел бы стереть сохранённую позицию до её восстановления.
                  if (!fromWorkout && video.duration && resumeAppliedRef.current) {
                    const nowTs = Date.now();
                    if (nowTs - lastPosSaveRef.current > 5000) {
                      lastPosSaveRef.current = nowTs;
                      saveVideoPosition(videoId, video.currentTime, video.duration, END_EPSILON_SEC);
                    }
                  }

                  // Видео реально двигается — значит не застряло на буферизации.
                  // Читаем через ref, чтобы не дёргать setState на stale-значении.
                  cancelBufferingSoon();
                  if (isBufferingRef.current) setIsBuffering(false);

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
                  }
                }}
                onCanPlay={(e) => {
                  const video = e.currentTarget;

                  // Восстанавливаем позицию после смены качества. Это имеет
                  // приоритет над resume из localStorage — отмечаем resume как
                  // применённый, чтобы он не перебил позицию смены качества.
                  if (pendingSeekRef.current !== null) {
                    seekingProgrammaticRef.current = true;
                    video.currentTime = pendingSeekRef.current;
                    pendingSeekRef.current = null;
                    resumeAppliedRef.current = true;
                    video.play().catch(() => {});
                    return;
                  }

                  // O-3: один раз на видео восстанавливаем сохранённую позицию
                  // (до автостарта). Флаг ставим ТОЛЬКО когда duration уже известна —
                  // иначе ранний canPlay с duration=0/NaN (Android) «съел» бы
                  // единственный resume; повторные canPlay (ребуфер) отсекаются им же.
                  // Сохранённая позиция всегда НИЖЕ near-end порога (saveVideoPosition
                  // не пишет позицию у самого конца), поэтому мгновенного/повторного
                  // зачёта от resume нет — зачёт начисляется по реальному концу.
                  // Порог восстановления тот же END_EPSILON_SEC, что и у сохранения,
                  // иначе была бы мёртвая зона [d-1, d-eps) «сохранили, но не вернули».
                  if (!resumeAppliedRef.current && !fromWorkout && video.duration && !isNaN(video.duration)) {
                    resumeAppliedRef.current = true;
                    const saved = loadVideoPosition(videoId);
                    if (saved !== null && saved >= 5 && saved < video.duration - END_EPSILON_SEC) {
                      seekingProgrammaticRef.current = true;
                      video.currentTime = saved;
                    }
                  }

                  // В тренировке позицию берём с сервера (watchedDuration). Если
                  // ответ start-POST ещё не пришёл — применит он сам, когда придёт.
                  if (fromWorkout) {
                    applyWorkoutResume();
                  }

                  // Пытаемся начать воспроизведение когда видео готово.
                  // Проверяем живой video.paused, а НЕ React-стейт isPlaying
                  // (на Android canplay после ребуфера срабатывает часто, а
                  // stale isPlaying приводил к лишним play() и дёрганью статуса).
                  if (video.paused) {
                    video.play().then(() => {
                      setIsPlaying(true);
                    }).catch(err => {
                      console.log('Autoplay was prevented:', err);
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
                  // Дебаунс: показываем спиннер, только если ждём дольше 400мс.
                  // Микро-ребуферы (и waiting после seek) больше не мигают кружком.
                  showBufferingSoon();
                }}
                onPlaying={() => {
                  cancelBufferingSoon();
                  setIsBuffering(false);
                }}
                /* onStalled НЕ показывает спиннер: у прогрессивного MP4 stalled
                   срабатывает штатно, когда браузер набрал буфер и приостановил
                   докачку. Именно он давал «кружок каждые ~5 секунд». */
                onCanPlayThrough={() => {
                  cancelBufferingSoon();
                  setIsBuffering(false);
                }}
                onEnded={handleVideoEnded}
              />
              
              {/* Пилюля «поверни телефон» — ненавязчивая подсказка над нижней
                  панелью. Не блокирует контролы и тапы по видео. */}
              {showFullscreenHint && (
                <div className="absolute bottom-20 left-1/2 -translate-x-1/2 z-40 pointer-events-none">
                  <div className="flex items-center gap-2 bg-black/70 backdrop-blur-sm rounded-full px-4 py-2">
                    <Smartphone size={16} className="text-[#A1FF4A] rotate-90 flex-shrink-0" />
                    <span className="text-white text-xs font-semibold whitespace-nowrap">
                      Поверни телефон для полного экрана
                    </span>
                  </div>
                </div>
              )}

              {/* Спиннер буферизации — когда видео подгружается во время
                  воспроизведения (#4). pointer-events:none, чтобы не мешать тапам. */}
              {isBuffering && isPlaying && !isLoading && !isKinescopeLoading && (
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-40">
                  <Loader2 size={48} className="animate-spin text-white" />
                </div>
              )}

              {/* Play/Pause Overlay with Skip Buttons.
                  Единый onClick обрабатывает и одиночный тап (показать/скрыть
                  контролы), и двойной (перемотка) — без onTouchEnd, чтобы на
                  мобилке тач+click не дёргались дважды (#1). touchAction:
                  manipulation убирает 300ms-задержку click на iOS.
                  Скрим убран — единственный градиент остался на нижней панели. */}
              <div
                  style={{ touchAction: 'manipulation' }}
                  className={`absolute inset-0 flex items-center justify-center transition-opacity duration-300 ${
                    showControls ? 'opacity-100' : 'opacity-0'
                  }`}
                  onClick={(e) => {
                    const rect = (e.currentTarget as HTMLDivElement).getBoundingClientRect();
                    const x = e.clientX - rect.left;
                    const isLeft = x < rect.width / 2;

                    if (doubleTapTimerRef.current) {
                      // Второй тап в окне 250мс → перемотка (только если разрешена)
                      clearTimeout(doubleTapTimerRef.current);
                      doubleTapTimerRef.current = null;

                      if (canSeek) {
                        if (isLeft) {
                          skipBackward();
                        } else {
                          skipForward();
                        }

                        setSeekFlash(isLeft ? 'left' : 'right');
                        if (seekFlashTimerRef.current) clearTimeout(seekFlashTimerRef.current);
                        seekFlashTimerRef.current = setTimeout(() => setSeekFlash(null), 600);
                      }

                      showControlsTemporarily();
                    } else {
                      // Первый тап — ждём, не двойной ли. Если нет — show/hide контролов.
                      doubleTapTimerRef.current = setTimeout(() => {
                        doubleTapTimerRef.current = null;
                        if (showControlsRef.current) {
                          if (hideControlsTimeoutRef.current) clearTimeout(hideControlsTimeoutRef.current);
                          setShowControls(false);
                        } else {
                          showControlsTemporarily();
                        }
                      }, 250);
                    }
                  }}
                >
                  {/* Флэш double-tap назад */}
                  {seekFlash === 'left' && (
                    <div className="absolute left-0 top-0 bottom-0 w-1/2 flex items-center justify-center pointer-events-none">
                      <div className="bg-white/20 rounded-full px-4 py-2 flex items-center gap-1 animate-ping-once">
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="white">
                          <path d="M11 18V6l-8.5 6 8.5 6zm.5-6l8.5 6V6l-8.5 6z"/>
                        </svg>
                        <span className="text-white text-sm font-bold">-10</span>
                      </div>
                    </div>
                  )}
                  {/* Флэш double-tap вперед */}
                  {seekFlash === 'right' && (
                    <div className="absolute right-0 top-0 bottom-0 w-1/2 flex items-center justify-center pointer-events-none">
                      <div className="bg-white/20 rounded-full px-4 py-2 flex items-center gap-1 animate-ping-once">
                        <span className="text-white text-sm font-bold">+10</span>
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="white">
                          <path d="M4 18l8.5-6L4 6v12zm9-12v12l8.5-6L13 6z"/>
                        </svg>
                      </div>
                    </div>
                  )}
                  <div className={`flex items-center gap-6 ${showControls ? '' : 'pointer-events-none'}`}>
                    {/* Skip Backward 10s — только в тестовом режиме (перемотка) */}
                    {canSeek && (
                    <button
                      onClick={(e) => { e.stopPropagation(); skipBackward(); }}
                      className="w-12 h-12 bg-white/20 backdrop-blur-sm rounded-full flex items-center justify-center opacity-80 hover:opacity-100 transition-opacity text-white"
                      title="Назад на 10 секунд"
                    >
                      <span className="relative flex items-center justify-center">
                        <RotateCcw size={22} />
                        <span className="absolute text-[7px] font-bold leading-none mt-0.5">10</span>
                      </span>
                    </button>
                    )}

                    {/* Play/Pause Button — крупный хитбокс 64px, чтобы легко попасть (#2).
                        В тренировке — 80px: тапают с расстояния, глядя с пола. */}
                    <button
                      onClick={(e) => { e.stopPropagation(); togglePlay(); }}
                      className={`${fromWorkout ? 'w-20 h-20' : 'w-16 h-16'} bg-white/25 backdrop-blur-sm rounded-full flex items-center justify-center opacity-90 hover:opacity-100 transition-opacity text-white`}
                      title={isPlaying ? 'Пауза' : 'Воспроизвести'}
                    >
                      {isPlaying
                        ? <Pause size={fromWorkout ? 38 : 30} fill="currentColor" />
                        : <Play size={fromWorkout ? 38 : 30} fill="currentColor" className="ml-1" />}
                    </button>

                    {/* Skip Forward 10s — только в тестовом режиме (перемотка) */}
                    {canSeek && (
                    <button
                      onClick={(e) => { e.stopPropagation(); skipForward(); }}
                      className="w-12 h-12 bg-white/20 backdrop-blur-sm rounded-full flex items-center justify-center opacity-80 hover:opacity-100 transition-opacity text-white"
                      title="Вперед на 10 секунд"
                    >
                      <span className="relative flex items-center justify-center">
                        <RotateCw size={22} />
                        <span className="absolute text-[7px] font-bold leading-none mt-0.5">10</span>
                      </span>
                    </button>
                    )}
                  </div>
              </div>

              {/* Video Controls - для всех видео */}
            <div className={`absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent pt-8 ${isLandscape ? 'pb-6 px-5' : 'pb-2 px-3'} transition-opacity duration-300 ${
            showControls ? 'opacity-100' : 'opacity-0 pointer-events-none'
          }`}>
            {/* Scrubber — только когда перемотка разрешена. Когда запрещена
                (тренировочный режим), input НЕ рендерим вовсе (нечего «включать»
                из devtools): в свободном просмотре вместо него — тонкая лаймовая
                полоса прогресса; в тренировке полоса прибита к нижней кромке
                плеера (всегда видима) и здесь не дублируется. */}
            {canSeek ? (
            <div
              className="relative mb-2 select-none"
              onMouseDown={(e) => e.stopPropagation()}
              onTouchStart={(e) => e.stopPropagation()}
            >
              {/* Визуальный трек: тонкий в портрете, чуть толще в landscape */}
              <div
                className={`absolute left-0 right-0 top-1/2 -translate-y-1/2 bg-white/30 rounded-full pointer-events-none ${
                  isLandscape ? 'h-1.5' : 'h-1'
                }`}
              >
                <div
                  className="absolute left-0 top-0 h-full bg-white/40 rounded-full"
                  style={{ width: `${buffered}%` }}
                />
                <div
                  className="absolute left-0 top-0 h-full bg-[#445CFF] rounded-full"
                  style={{ width: `${duration > 0 ? (currentTime / duration) * 100 : 0}%` }}
                />
                {/* Кружок — на том же проценте, что и полоса (#3). Показываем
                    только пока палец/мышь держит скраббер — в покое линия чище. */}
                {isScrubbing && (
                <div
                  className="absolute top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full bg-white border-2 border-[#445CFF] shadow pointer-events-none"
                  style={{
                    left: `${duration > 0 ? (currentTime / duration) * 100 : 0}%`,
                    width: isLandscape ? 16 : 14,
                    height: isLandscape ? 16 : 14,
                  }}
                />
                )}
              </div>
              {/* Реальный input: drag, клавиатура, accessibility */}
              <input
                type="range"
                min={0}
                max={duration || 0}
                step={0.1}
                value={currentTime}
                aria-label="Перемотка видео"
                onPointerDown={() => setIsScrubbing(true)}
                onPointerUp={() => setIsScrubbing(false)}
                onPointerCancel={() => setIsScrubbing(false)}
                onChange={(e) => {
                  if (!canSeek) return; // страховка: без перемотки input не рендерится
                  const t = Number(e.target.value);
                  setCurrentTime(t);
                  if (videoRef.current) {
                    videoRef.current.currentTime = t;
                  }
                  showControlsTemporarily();
                }}
                className="video-scrubber relative w-full"
              />
            </div>
            ) : !fromWorkout ? (
              /* Свободный просмотр в режиме «Тренировка»: честный индикатор
                 прогресса без возможности перемотки */
              <div
                className="relative mb-2 h-[3px] rounded-full bg-white/25 overflow-hidden"
                role="progressbar"
                aria-valuemin={0}
                aria-valuemax={Math.round(duration) || 0}
                aria-valuenow={Math.round(Math.min(currentTime, duration))}
                aria-label="Прогресс видео"
              >
                <div
                  className="h-full bg-[#A1FF4A] rounded-full"
                  style={{ width: `${duration > 0 ? Math.min(100, (currentTime / duration) * 100) : 0}%` }}
                />
              </div>
            ) : null}
            
            {/* Control Buttons: [время (+пилюля режима) — spacer — звук — настройки — fullscreen].
                Дублирующий play/pause убран — есть большая центральная кнопка. */}
            <div className="flex items-center justify-between">
              {/* Time Display + индикатор нестандартного режима */}
              <div className="flex items-center gap-2 min-w-0">
                <span className={`text-white font-medium whitespace-nowrap ${isLandscape ? 'text-sm' : 'text-xs'}`}>
                  {formatTime(currentTime)} / {formatTime(duration)}
                </span>
                {/* Лаймовая пилюля «Просмотр» — чтобы не-дефолтный режим был
                    виден с одного взгляда, без открытия настроек */}
                {!fromWorkout && watchMode === 'view' && (
                  <span
                    className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase whitespace-nowrap"
                    style={{
                      fontFamily: 'Overpass',
                      letterSpacing: '0.5px',
                      backgroundColor: 'rgba(161, 255, 74, 0.2)',
                      color: '#A1FF4A',
                    }}
                  >
                    Просмотр
                  </span>
                )}
              </div>

              <div className={`flex items-center space-x-2 ${isLandscape ? 'space-x-3' : ''}`}>
                {/* Volume Control */}
                <button
                  onClick={toggleMute}
                  className="transition-opacity hover:opacity-80 p-2 text-white"
                  title={isMuted ? 'Включить звук' : 'Выключить звук'}
                >
                  {isMuted
                    ? <VolumeX size={isLandscape ? 24 : 18} />
                    : <Volume2 size={isLandscape ? 24 : 18} />}
                </button>

                {/* Единая кнопка настроек (Режим + Качество). Скрыта, когда обе
                    секции пусты: в тренировке режим не переключается, а качество
                    без выбора. */}
                {(!fromWorkout || hasQualityChoice) && (
                  <div className="relative" onClick={(e) => e.stopPropagation()}>
                    <button
                      onClick={() => {
                        if (showSettings) closeSettings();
                        else setShowSettings(true);
                        showControlsTemporarily();
                      }}
                      className={`transition-opacity hover:opacity-80 p-2 ${showSettings ? 'text-[#A1FF4A]' : 'text-white'}`}
                      title="Настройки плеера"
                      aria-label="Настройки плеера"
                    >
                      <Settings2 size={isLandscape ? 24 : 18} />
                    </button>

                    {/* Ландшафт: компактный поповер над кнопкой */}
                    {showSettings && isLandscape && (
                      <div
                        className={`absolute bottom-full mb-2 right-0 bg-black/90 backdrop-blur-md rounded-xl border border-white/10 overflow-hidden shadow-2xl w-64 max-h-[60vh] overflow-y-auto z-50 origin-bottom-right ${
                          settingsClosing ? 'animate-fadeOut' : 'animate-popIn'
                        }`}
                        onClick={(e) => e.stopPropagation()}
                      >
                        {settingsSections}
                      </div>
                    )}
                  </div>
                )}

                {/* Fullscreen Button */}
                <button
                  onClick={toggleFullscreen}
                  className="transition-opacity hover:opacity-80 p-2 text-white"
                  title={isFullscreen ? 'Выход из полноэкранного режима' : 'Полноэкранный режим'}
                >
                  {isFullscreen
                    ? <Minimize size={isLandscape ? 24 : 18} />
                    : <Maximize size={isLandscape ? 24 : 18} />}
                </button>
              </div>
            </div>
          </div>

              {/* В тренировке прогресс виден ВСЕГДА: тонкая лаймовая линия у
                  нижней кромки плеера, вне автоскрываемой панели контролов —
                  ребёнок видит прогресс с пола даже при спрятанных контролах.
                  В панели контролов линия не дублируется. */}
              {fromWorkout && (
                <div
                  className="absolute bottom-0 left-0 right-0 h-[3px] bg-white/20 z-30 pointer-events-none"
                  role="progressbar"
                  aria-valuemin={0}
                  aria-valuemax={Math.round(duration) || 0}
                  aria-valuenow={Math.round(Math.min(currentTime, duration))}
                  aria-label="Прогресс видео"
                >
                  <div
                    className="h-full bg-[#A1FF4A]"
                    style={{ width: `${duration > 0 ? Math.min(100, (currentTime / duration) * 100) : 0}%` }}
                  />
                </div>
              )}

              {/* Портрет: настройки открываются нижним шитом (в ландшафте —
                  компактный поповер у кнопки). Клик внутри не закрывает шит. */}
              {showSettings && !isLandscape && (
                <div
                  className="fixed inset-x-0 bottom-0 z-[60]"
                  onClick={(e) => e.stopPropagation()}
                >
                  <div
                    className={`bg-[#101530] border-t border-white/10 rounded-t-2xl shadow-2xl ${
                      settingsClosing ? 'animate-slideDown' : 'animate-slideUp'
                    }`}
                    style={{ paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 8px)' }}
                  >
                    {/* Граббер шита */}
                    <div className="w-10 h-1 rounded-full bg-white/20 mx-auto mt-2 mb-1" />
                    {settingsSections}
                  </div>
                </div>
              )}
            </>
          )}

          {/* Рекомендация следующего видео — Overlay (без автоплея) */}
          {showNextVideoPreview && nextVideo && (
            <div className="absolute inset-0 bg-[#0A0E1A] p-4 md:p-8 z-50">
              {/* Header — «РЕКОМЕНДУЕМ» слева, крестик справа */}
              <div className="flex items-center justify-between mb-6 md:mb-8">
                <h2 className="text-white text-xl md:text-4xl font-bold tracking-wider">РЕКОМЕНДУЕМ</h2>

                {/* Close Button */}
                <button
                  onClick={closeRecommendation}
                  className="w-8 h-8 md:w-10 md:h-10 flex items-center justify-center text-white hover:text-gray-300 transition-colors"
                  aria-label="Закрыть"
                >
                  <X size={20} strokeWidth={2.5} className="md:w-7 md:h-7" />
                </button>
              </div>

              {/* Кликабельная карточка: обложка + название. Видео НЕ играет —
                  переход на страницу видео только по тапу. */}
              <button
                type="button"
                onClick={() => router.push(`/video/${nextVideo.id}`)}
                className="flex flex-row items-start gap-4 md:gap-8 text-left w-full"
              >
                {/* Thumbnail с иконкой play */}
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
                    {/* Play icon по центру */}
                    <div className="absolute inset-0 flex items-center justify-center">
                      <div className="w-14 h-14 md:w-20 md:h-20 rounded-full bg-black/50 backdrop-blur-sm flex items-center justify-center border border-white/20">
                        <svg width="22" height="22" viewBox="0 0 24 24" fill="white" className="md:w-8 md:h-8 ml-0.5">
                          <path d="M8 5v14l11-7z" />
                        </svg>
                      </div>
                    </div>
                    {/* Duration Badge */}
                    <div className="absolute bottom-2 right-2 md:bottom-3 md:right-3 bg-black/70 backdrop-blur-sm rounded px-2 py-1 md:px-2.5 md:py-1">
                      <span className="text-white text-[10px] md:text-xs font-medium">
                        {nextVideo.duration && !isNaN(nextVideo.duration) && nextVideo.duration > 0
                          ? `${Math.floor(nextVideo.duration / 60)}:${String(Math.floor(nextVideo.duration % 60)).padStart(2, '0')}`
                          : '0:00'}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Название + инфо справа */}
                <div className="flex-1 flex flex-col justify-start">
                  <h3 className="text-white text-sm md:text-xl font-semibold leading-snug mb-3 md:mb-6">
                    {nextVideo.title}
                  </h3>

                  {/* Info — только на десктопе */}
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
              </button>
            </div>
          )}
        </div>
        </div>
      </div>

  {/* Пилюли действий (скрываем в ландшафтном режиме на мобилках и в тренировке —
      там ряд пуст). «Скачать» и «Камера» убраны по решению владельца 2026-07-31:
      функционал пока не используется (логика скачивания/PoseTracker сохранена —
      вернуть можно, восстановив кнопки). */}
  {!fromWorkout && (
  <div className={`bg-[#101530] ${isLandscape ? 'hidden' : ''}`}>
        <div className="flex flex-wrap items-center gap-2 p-4">
            <>
              {/* Like */}
              <button
                onClick={toggleLike}
                className="bg-[#AEABBB33] rounded-full px-3 py-2 flex items-center gap-1.5 transition-opacity hover:opacity-80"
              >
                <Heart
                  size={18}
                  className={isLiked ? 'text-[#A1FF4A]' : 'text-[#AEABBB]'}
                  fill={isLiked ? 'currentColor' : 'none'}
                />
                <span className="text-[#AEABBB] text-[11px] whitespace-nowrap">
                  {likesCount >= 1000
                    ? `${(likesCount / 1000).toFixed(1)} тыс.`
                    : likesCount}
                </span>
              </button>

              {/* Calendar */}
              <button
                onClick={() => setShowScheduleModal(true)}
                className="bg-[#AEABBB33] rounded-full px-3 py-2 flex items-center gap-1.5 hover:opacity-80 transition-opacity"
              >
                <CalendarPlus size={18} className="text-[#AEABBB]" />
                <span className="text-[#AEABBB] text-[11px] whitespace-nowrap">Календарь</span>
              </button>

              {/* Share — нативный share-шит или копирование ссылки */}
              <button
                onClick={handleShare}
                className="bg-[#AEABBB33] rounded-full px-3 py-2 flex items-center gap-1.5 hover:opacity-80 transition-opacity"
              >
                <Share2 size={18} className="text-[#AEABBB]" />
                <span className="text-[#AEABBB] text-[11px] whitespace-nowrap">Поделиться</span>
              </button>
            </>
        </div>
      </div>
  )}

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
          id: videoData.trainer.id,
          name: videoData.trainer.name,
          lastName: videoData.trainer.lastName,
          avatar: videoData.trainer.avatar
        } : null}
        rpeMin={videoData?.rpeMin}
        rpeMax={videoData?.rpeMax}
        moduleType={videoData?.moduleType}
        loadType={videoData?.loadType}
        muscleGroup={videoData?.muscleGroup}
        gainTag={calculateVideoGain() && (
          <div
            className="px-3 py-1 rounded-full text-xs whitespace-nowrap font-bold flex items-center gap-1 w-fit"
            style={{
              backgroundColor: 'rgba(161, 255, 74, 0.2)',
              color: '#FFFFFF',
            }}
          >
            <Zap size={12} className="text-[#A1FF4A]" fill="currentColor" />
            {calculateVideoGain()}
          </div>
        )}
      />
      {/* Комментарии — только в обычном просмотре: в тренировке отвлекают */}
      {!fromWorkout && <VideoComments videoId={videoId} />}
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
