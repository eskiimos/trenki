'use client';

// «История тренировок» (профиль → Мои тренировки). ТОЛЬКО история — избранное
// живёт на отдельной странице /profile/favorites (правка владельца: странно,
// что история и избранное хранятся в одном месте).
//
// Лента: завершённые тренировки ИИ-тренера (быстрые и цикловые,
// /api/profile/history) вперемешку с одиночными просмотрами видео каталога,
// по дате. Тренировку можно звёздочкой сохранить в избранное прямо отсюда.
//
// Старые ссылки ?tab=workouts|favorites (кэшированные PWA) редиректят на
// /profile/favorites.

import React, { Suspense, useEffect, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useRouter, useSearchParams } from 'next/navigation';
import { Sparkles, Star } from 'lucide-react';
import BottomNavigation from '@/components/BottomNavigation';
import { Skeleton } from '@/components/Skeleton';

// Длительность видео в формате YouTube (MM:SS или H:MM:SS)
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

const formatDate = (iso: string): string => {
  const d = new Date(iso);
  const now = new Date();
  const sameYear = d.getFullYear() === now.getFullYear();
  return d.toLocaleDateString('ru-RU', {
    day: 'numeric',
    month: 'long',
    ...(sameYear ? {} : { year: 'numeric' }),
  });
};

const plural = (n: number, one: string, few: string, many: string) => {
  const m10 = n % 10;
  const m100 = n % 100;
  if (m10 === 1 && m100 !== 11) return one;
  if (m10 >= 2 && m10 <= 4 && (m100 < 12 || m100 > 14)) return few;
  return many;
};

// ── Типы ответа /api/profile/history ─────────────────────────────────────────

interface WorkoutItem {
  type: 'workout';
  id: string;
  title: string;
  cycleLabel: string | null;
  status: 'COMPLETED' | 'PARTIAL';
  date: string;
  completedModules: number;
  totalModules: number;
  totalDuration: number;
  modules: { id: string; title: string }[];
  favoriteId: string | null;
}

interface VideoItem {
  type: 'video';
  id: string;
  title: string;
  date: string;
  duration: number;
  thumbnail: string | null;
  tags: string[];
  equipment: string[];
  likesCount: number;
  trainer: { id: string; name: string; lastName: string; avatar: string };
}

type HistoryItem = WorkoutItem | VideoItem;

// ── Страница ─────────────────────────────────────────────────────────────────

const WatchHistoryPage = () => {
  const router = useRouter();
  const searchParams = useSearchParams();
  const tabParam = searchParams.get('tab');

  const [items, setItems] = useState<HistoryItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  // Сессии, по которым звёздочка уже в полёте — дабл-тап не шлёт второй POST
  const [busyIds, setBusyIds] = useState<Set<string>>(new Set());

  // Легаси-редирект: избранное переехало на свою страницу
  useEffect(() => {
    if (tabParam === 'workouts' || tabParam === 'favorites') {
      router.replace('/profile/favorites');
    }
  }, [tabParam, router]);

  useEffect(() => {
    let cancelled = false;
    fetch('/api/profile/history?limit=50')
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (!cancelled) setItems(d?.items ?? []);
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  /** Звёздочка: сохранить/убрать тренировку из избранного. busyIds гасит
   *  дабл-тап: add-ветка не оптимистична (id даёт сервер). */
  const toggleFavorite = async (w: WorkoutItem) => {
    if (busyIds.has(w.id)) return;
    setBusyIds((prev) => new Set(prev).add(w.id));
    try {
      await doToggleFavorite(w);
    } finally {
      setBusyIds((prev) => {
        const next = new Set(prev);
        next.delete(w.id);
        return next;
      });
    }
  };

  const doToggleFavorite = async (w: WorkoutItem) => {
    if (w.favoriteId) {
      const favId = w.favoriteId;
      setItems((prev) =>
        prev.map((i) => (i.type === 'workout' && i.id === w.id ? { ...i, favoriteId: null } : i)),
      );
      try {
        await fetch(`/api/favorites/workouts?id=${encodeURIComponent(favId)}`, {
          method: 'DELETE',
        });
      } catch {}
      return;
    }
    try {
      const res = await fetch('/api/favorites/workouts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId: w.id }),
      });
      if (!res.ok) return;
      const d = await res.json();
      const favId = d?.workout?.id;
      if (!favId) return;
      setItems((prev) =>
        prev.map((i) => (i.type === 'workout' && i.id === w.id ? { ...i, favoriteId: favId } : i)),
      );
    } catch {}
  };

  return (
    <div className="min-h-screen bg-surface pb-nav">
      {/* Шапка: слева назад + заголовок, справа — вход в избранное */}
      <header className="flex items-center justify-between gap-4 p-4 safe-top">
        <div className="flex items-center gap-4 min-w-0">
          <Link href="/profile" aria-label="Назад в профиль" className="inline-flex">
            <Image src="/icons/icon-action-back.svg" alt="Назад" width={24} height={24} />
          </Link>
          <h1 className="text-white text-xs font-bold font-overpass uppercase tracking-[0.5px] truncate">
            История тренировок
          </h1>
        </div>
        <Link
          href="/profile/favorites"
          aria-label="Избранное"
          className="inline-flex text-white hover:opacity-80 transition-opacity shrink-0"
        >
          <Star size={24} aria-hidden />
        </Link>
      </header>

      <div className="px-4">
        {isLoading ? (
          <div className="flex flex-col gap-3">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="rounded-2xl p-4 bg-night">
                <Skeleton width="w-3/4" height="h-4" />
                <div className="mt-3">
                  <Skeleton width="w-1/2" height="h-3" />
                </div>
              </div>
            ))}
          </div>
        ) : items.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-gray-400 text-lg">История пуста</p>
            <p className="text-gray-500 text-sm mt-2">
              Здесь будут тренировки от ИИ-тренера и видео, которые ты смотрел
            </p>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {items.map((item) =>
              item.type === 'workout' ? (
                <WorkoutCard
                  key={`w-${item.id}`}
                  w={item}
                  onToggleFavorite={() => toggleFavorite(item)}
                />
              ) : (
                <VideoCard key={`v-${item.id}-${item.date}`} v={item} />
              ),
            )}
          </div>
        )}
      </div>

      <BottomNavigation activeTab="profile" />
    </div>
  );
};

// ── Карточки ленты ───────────────────────────────────────────────────────────

const WorkoutCard = ({
  w,
  onToggleFavorite,
}: {
  w: WorkoutItem;
  onToggleFavorite: () => void;
}) => (
  <div className="rounded-2xl p-4 bg-night border border-[#2a2f4a]">
    <div className="flex items-start justify-between gap-3">
      <div className="flex items-start gap-3 min-w-0">
        <span
          className="flex items-center justify-center bg-brand/15 text-brand shrink-0 rounded-full"
          style={{ width: 40, height: 40 }}
          aria-hidden
        >
          <Sparkles size={20} />
        </span>
        <div className="min-w-0">
          <div className="text-ink font-overpass font-extrabold text-[15px]">{w.title}</div>
          <div className="text-muted text-xs mt-1">
            {formatDate(w.date)}
            {w.cycleLabel && ` · ${w.cycleLabel}`}
          </div>
          <div className="text-muted text-xs mt-0.5">
            {w.completedModules} из {w.totalModules}{' '}
            {plural(w.totalModules, 'модуля', 'модулей', 'модулей')}
            {w.totalDuration > 0 && ` · ${Math.round(w.totalDuration / 60)} мин`}
            {w.status === 'PARTIAL' && ' · досрочный финиш'}
          </div>
        </div>
      </div>
      {/* Сохранить тренировку целиком — повторить можно из «Избранного» */}
      <button
        type="button"
        onClick={onToggleFavorite}
        aria-label={w.favoriteId ? 'Убрать из избранного' : 'В избранное'}
        aria-pressed={!!w.favoriteId}
        className={`inline-flex shrink-0 ${w.favoriteId ? 'text-brand' : 'text-muted'}`}
      >
        <Star size={20} fill={w.favoriteId ? 'currentColor' : 'none'} aria-hidden />
      </button>
    </div>
  </div>
);

const VideoCard = ({ v }: { v: VideoItem }) => (
  <Link href={`/video/${v.id}`} className="rounded-2xl overflow-hidden bg-night block">
    <div className="relative w-full aspect-video">
      <Image
        src={v.thumbnail && v.thumbnail.trim() !== '' ? v.thumbnail : '/images/video_prew_2.png'}
        alt={v.title}
        fill
        className="object-cover"
      />
      <div className="absolute bottom-3 right-3 bg-black/70 backdrop-blur-sm text-white text-sm font-medium px-2.5 py-1 rounded-lg">
        {formatDuration(v.duration)}
      </div>
    </div>
    <div className="p-4">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-full overflow-hidden shrink-0 bg-gray-700">
          {v.trainer.avatar ? (
            <Image
              src={v.trainer.avatar}
              alt={`${v.trainer.name} ${v.trainer.lastName}`}
              width={40}
              height={40}
              className="object-cover w-full h-full"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-white font-bold">
              {v.trainer.name.charAt(0)}
            </div>
          )}
        </div>
        <h3 className="text-white text-base font-semibold line-clamp-2 leading-tight flex-1">
          {v.title.toUpperCase()}
        </h3>
      </div>
      <div className="text-white/60 text-xs mt-2">
        {formatDate(v.date)} · {v.trainer.name} {v.trainer.lastName}
        {v.equipment.length > 0 && ` · ${v.equipment.join(' / ')}`}
      </div>
    </div>
  </Link>
);

// useSearchParams в клиентской странице требует Suspense-границу (App Router:
// без неё пререндер страницы падает с ошибкой сборки).
export default function WatchHistoryPageWrapper() {
  return (
    <Suspense fallback={null}>
      <WatchHistoryPage />
    </Suspense>
  );
}
