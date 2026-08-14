'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { Star } from 'lucide-react';
import BottomNavigation from '@/components/BottomNavigation';
import { Skeleton } from '@/components/Skeleton';

// Функция для форматирования длительности видео в YouTube формате (MM:SS или H:MM:SS)
const formatDuration = (seconds: number): string => {
  if (!seconds || seconds <= 0) return '0:00';
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;
  
  if (hours > 0) {
    return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }
  return `${minutes}:${secs.toString().padStart(2, '0')}`;
};

interface Video {
  id: string;
  title: string;
  description?: string;
  duration: number;
  videoUrl: string;
  thumbnail?: string;
  category: string;
  difficulty: string;
  tags: string[];
  loadTypes: string[];
  equipment: string[];
  level?: string;
  viewsCount: number;
  likesCount: number;
  trainer: {
    id: string;
    name: string;
    lastName: string;
    avatar?: string;
    speciality: string;
  };
  createdAt: string;
  watchedAt: string;
  isPublished: boolean;
  rpeMin?: number;
  rpeMax?: number;
}

// Избранная тренировка целиком (составленная ИИ).
interface FavWorkout {
  id: string;
  title: string;
  createdAt: string;
  modules: { id: string; title: string; thumbnail?: string | null }[];
  missingCount: number;
  totalDuration: number;
}

const WatchHistoryPage = () => {
  const [videos, setVideos] = useState<Video[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  // Две вкладки: составленные тренировки и отдельные видео (решение владельца —
  // одиночные просмотры не теряем).
  // Стартуем с «Видео»: у большинства избранных тренировок ещё нет, и вкладка
  // по умолчанию встречала бы пустым экраном. Переключаемся на «Тренировки»
  // автоматически, если они есть.
  const [tab, setTab] = useState<'workouts' | 'videos'>('videos');
  const [workouts, setWorkouts] = useState<FavWorkout[]>([]);

  useEffect(() => {
    fetch('/api/favorites/workouts')
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        const list = d?.workouts ?? [];
        setWorkouts(list);
        if (list.length > 0) setTab('workouts');
      })
      .catch(() => {});
  }, []);

  const removeWorkout = async (id: string) => {
    setWorkouts((prev) => prev.filter((w) => w.id !== id)); // оптимистично
    try {
      await fetch(`/api/favorites/workouts?id=${encodeURIComponent(id)}`, { method: 'DELETE' });
    } catch {
      /* при сбое список восстановится на следующей загрузке */
    }
  };

  useEffect(() => {
    const fetchWatchHistory = async () => {
      try {
        setIsLoading(true);

        // Сервер берёт userId из сессии
        const historyResponse = await fetch('/api/profile/watch-history?limit=50');

        if (historyResponse.status === 401) {
          setIsLoading(false);
          return;
        }
        if (!historyResponse.ok) {
          throw new Error('Failed to fetch watch history');
        }

        const historyData = await historyResponse.json();
        setVideos(historyData.videos || []);
      } catch (error) {
        console.error('Error fetching watch history:', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchWatchHistory();
  }, []);

  // Skeleton компонент для видео карточки
  const VideoCardSkeleton = () => (
    <div className="mb-6">
      {/* Превью видео */}
      <div className="relative w-full aspect-video mb-3">
        <Skeleton width="w-full" height="h-full" />
      </div>
      
      {/* Контент */}
      <div className="px-4 py-3">
        {/* Аватар + Заголовок */}
        <div className="flex items-center gap-3 mb-2">
          <Skeleton width="w-10" height="h-10" rounded />
          <div className="flex-1 space-y-2">
            <Skeleton width="w-3/4" height="h-4" />
            <Skeleton width="w-1/2" height="h-4" />
          </div>
        </div>
        
        {/* Теги */}
        <div className="flex gap-2 mb-2">
          <Skeleton width="w-20" height="h-6" className="rounded-full" />
          <Skeleton width="w-24" height="h-6" className="rounded-full" />
          <Skeleton width="w-16" height="h-6" className="rounded-full" />
        </div>
        
        {/* Информация о тренере */}
        <Skeleton width="w-full" height="h-3" />
      </div>
    </div>
  );

  if (isLoading) {
    return (
      <div className="min-h-screen bg-surface pb-nav">
        {/* Header */}
        <header className="flex items-center justify-between p-4 bg-[#101530]" style={{ paddingTop: 'calc(env(safe-area-inset-top, 0px) + 16px)' }}>
          <div className="flex items-center space-x-2">
            <Link href="/profile" className="text-white hover:text-gray-300">
              <Image src="/icons/icon-action-back.svg" alt="Назад" width={24} height={24} />
            </Link>
            <Skeleton width="w-48" height="h-5" />
          </div>
        </header>

        {/* Video Cards Skeleton */}
        <div className="mt-4">
          {[1, 2, 3, 4].map((i) => (
            <VideoCardSkeleton key={i} />
          ))}
        </div>

        <BottomNavigation activeTab="profile" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-surface pb-nav">
      {/* Header */}
      <header className="flex items-center justify-between p-4 bg-[#101530]" style={{ paddingTop: 'calc(env(safe-area-inset-top, 0px) + 16px)' }}>
        <div className="flex items-center space-x-2">
          <Link href="/profile" className="text-white hover:text-gray-300">
            <Image src="/icons/icon-action-back.svg" alt="Назад" width={24} height={24} />
          </Link>
          <h1 
            className="text-white uppercase"
            style={{
              fontFamily: 'Overpass',
              fontWeight: 700,
              fontSize: '12px',
              lineHeight: '120%',
              letterSpacing: '0.5px',
              verticalAlign: 'middle',
              textTransform: 'uppercase'
            }}
          >
            История и избранное
          </h1>
        </div>
      </header>

      {/* Вкладки: составленные тренировки / отдельные видео */}
      <div className="flex gap-2 px-4 pb-3">
        {([
          ['workouts', `Тренировки${workouts.length ? ` (${workouts.length})` : ''}`],
          ['videos', 'Видео'],
        ] as const).map(([key, label]) => (
          <button
            key={key}
            type="button"
            onClick={() => setTab(key)}
            className="font-overpass uppercase"
            style={{
              flex: 1,
              padding: '10px 12px',
              borderRadius: 999,
              fontWeight: 800,
              fontSize: 12,
              letterSpacing: '0.5px',
              border: `1px solid ${tab === key ? '#A1FF4A' : '#2a2f4a'}`,
              background: tab === key ? 'rgba(161,255,74,0.12)' : 'transparent',
              color: tab === key ? '#A1FF4A' : '#AEABBB',
              cursor: 'pointer',
            }}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Вкладка «Тренировки» — сохранённые целиком занятия от ИИ */}
      {tab === 'workouts' && (
        <div className="px-4">
          {workouts.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-gray-400 text-lg">Пока пусто</p>
              <p className="text-gray-500 text-sm mt-2">
                Заверши тренировку от ИИ-тренера и добавь её в избранное — она появится здесь
              </p>
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              {workouts.map((w) => (
                <div
                  key={w.id}
                  className="rounded-2xl p-4"
                  style={{ background: '#060919', border: '1px solid #2a2f4a' }}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="font-overpass" style={{ color: '#F9F8FE', fontWeight: 800, fontSize: 15 }}>
                        {w.title}
                      </div>
                      <div style={{ color: '#AEABBB', fontSize: 12, marginTop: 4 }}>
                        {w.modules.length} модул{w.modules.length === 1 ? 'ь' : w.modules.length < 5 ? 'я' : 'ей'}
                        {w.totalDuration > 0 && ` · ${Math.round(w.totalDuration / 60)} мин`}
                        {w.missingCount > 0 && ` · ${w.missingCount} недоступно`}
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => removeWorkout(w.id)}
                      aria-label="Убрать из избранного"
                      style={{ color: '#A1FF4A', background: 'none', border: 'none', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}
                    >
                      <Star size={20} fill="#A1FF4A" aria-hidden />
                    </button>
                  </div>

                  <div className="flex flex-col gap-1.5 mt-3">
                    {w.modules.map((m, i) => (
                      <Link key={`${w.id}-${m.id}`} href={`/video/${m.id}`} className="flex items-center gap-2">
                        <span style={{ color: '#445CFF', fontSize: 11, fontWeight: 800, width: 16 }}>{i + 1}</span>
                        <span style={{ color: '#AEABBB', fontSize: 13 }} className="truncate">{m.title}</span>
                      </Link>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Вкладка «Видео» — история отдельных просмотров */}
      <div style={{ display: tab === 'videos' ? 'block' : 'none' }}>
        {videos.length === 0 ? (
          <div className="text-center py-12 px-4">
            <p className="text-gray-400 text-lg">История пуста</p>
            <p className="text-gray-500 text-sm mt-2">Здесь будут появляться видео, которые вы смотрели</p>
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            {videos.map((video) => (
              <Link key={video.id} href={`/video/${video.id}`}>
                <div>
                  {/* Video Thumbnail - 100% ширины экрана */}
                  <div className="relative w-full aspect-video">
                    <Image
                      src={(video.thumbnail && video.thumbnail.trim() !== '') ? video.thumbnail : '/images/video_prew_2.png'}
                      alt={video.title}
                      fill
                      className="object-cover"
                    />
                    {/* Duration badge */}
                    <div className="absolute bottom-3 right-3 bg-black/70 backdrop-blur-sm text-white text-sm font-medium px-2.5 py-1 rounded-lg">
                      {formatDuration(video.duration)}
                    </div>
                  </div>
                  
                  {/* Video Info */}
                  <div className="px-4 py-3">
                    {/* Trainer Avatar + Title на одной строке */}
                    <div className="flex items-center gap-3 mb-2">
                      <div className="w-10 h-10 rounded-full overflow-hidden flex-shrink-0 bg-gray-700">
                        {video.trainer.avatar ? (
                          <Image
                            src={video.trainer.avatar}
                            alt={`${video.trainer.name} ${video.trainer.lastName}`}
                            width={40}
                            height={40}
                            className="object-cover w-full h-full"
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-white font-bold">
                            {video.trainer.name.charAt(0)}
                          </div>
                        )}
                      </div>
                      <h3 className="text-white text-base font-semibold line-clamp-2 leading-tight flex-1">
                        {video.title.toUpperCase()}
                      </h3>
                    </div>
                    
                    {/* Tags - горизонтальный скролл */}
                    <div
                      className="overflow-x-auto -mx-4 px-4 mb-2"
                      style={{
                        scrollbarWidth: 'none',
                        msOverflowStyle: 'none',
                      }}
                    >
                      <div className="flex gap-2 w-max">
                        {video.tags.map((tag) => (
                          <span
                            key={tag}
                            className="px-3 py-1 rounded-full text-xs whitespace-nowrap"
                            style={{
                              backgroundColor: '#AEABBB33',
                              color: '#AEABBB',
                            }}
                          >
                            {tag}
                          </span>
                        ))}
                      </div>
                    </div>

                    {/* Trainer info - последняя строка */}
                    <div
                      style={{ fontSize: '12px' }}
                      className="text-white/60 mt-2"
                    >
                      <span>
                        {video.trainer.name} {video.trainer.lastName}
                      </span>
                      <span className="text-white/40"> | </span>
                      <span>
                        {video.likesCount >= 1000 
                          ? `${(video.likesCount / 1000).toFixed(1)} тыс.` 
                          : video.likesCount} лайков
                      </span>
                      <span className="text-white/40"> | </span>
                      <span>оборудование ({video.equipment.join(' / ')})</span>
                    </div>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>

      <BottomNavigation activeTab="profile" />
    </div>
  );
};

export default WatchHistoryPage;
