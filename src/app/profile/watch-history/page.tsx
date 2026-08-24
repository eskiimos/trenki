'use client';

// «История и избранное» (профиль → Мои тренировки).
//
// Две вкладки с РАЗНЫМ содержимым (правка владельца «история и избранное
// показывают одно и то же»):
//  · «История» — единая лента активности: завершённые тренировки ИИ-тренера
//    (быстрые и цикловые, /api/profile/history) вперемешку с одиночными
//    просмотрами видео каталога, по дате. Тренировку можно звёздочкой
//    сохранить в избранное прямо из истории.
//  · «Избранное» — сохранённые тренировки целиком (FavoriteWorkout) +
//    лайкнутые треньки-шортсы (лайк = избранное, решение владельца).
//
// URL: ?tab=favorites (алиас workouts — старые ссылки) открывает «Избранное».

import React, { Suspense, useEffect, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useSearchParams } from 'next/navigation';
import { Clapperboard, Sparkles, Star } from 'lucide-react';
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

// ── Типы ответов API ─────────────────────────────────────────────────────────

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

interface FavWorkout {
  id: string;
  title: string;
  createdAt: string;
  modules: { id: string; title: string; thumbnail?: string | null }[];
  missingCount: number;
  totalDuration: number;
}

interface LikedShort {
  id: string;
  title: string;
  thumbnail: string | null;
}

// ── Страница ─────────────────────────────────────────────────────────────────

const WatchHistoryPage = () => {
  const searchParams = useSearchParams();
  const tabParam = searchParams.get('tab');
  const [tab, setTab] = useState<'history' | 'favorites'>(
    tabParam === 'favorites' || tabParam === 'workouts' ? 'favorites' : 'history',
  );

  const [items, setItems] = useState<HistoryItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  // Отдельный флаг для «Избранного»: без него deep-link ?tab=favorites на весь
  // срок фетча показывал финальное «Пока пусто» вместо скелетонов.
  const [favLoading, setFavLoading] = useState(true);
  const [favorites, setFavorites] = useState<FavWorkout[]>([]);
  const [likedShorts, setLikedShorts] = useState<LikedShort[]>([]);
  // Сессии, по которым звёздочка уже в полёте — дабл-тап не шлёт второй POST
  const [busyIds, setBusyIds] = useState<Set<string>>(new Set());

  /** Переключение вкладки + запись в URL: возврат «Назад» из шортса/видео
   *  ремоунтит страницу, и без параметра вкладка сбрасывалась бы на «Историю». */
  const switchTab = (key: 'history' | 'favorites') => {
    setTab(key);
    try {
      window.history.replaceState(null, '', key === 'favorites' ? '?tab=favorites' : location.pathname);
    } catch {}
  };

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

    Promise.allSettled([
      fetch('/api/favorites/workouts')
        .then((r) => (r.ok ? r.json() : null))
        .then((d) => {
          if (!cancelled) setFavorites(d?.workouts ?? []);
        }),
      fetch('/api/shorts/liked')
        .then((r) => (r.ok ? r.json() : null))
        .then((d) => {
          if (!cancelled) setLikedShorts(d?.shorts ?? []);
        }),
    ]).then(() => {
      if (!cancelled) setFavLoading(false);
    });

    return () => {
      cancelled = true;
    };
  }, []);

  /** Звёздочка на карточке истории: сохранить/убрать тренировку из избранного.
   *  busyIds гасит дабл-тап: add-ветка не оптимистична (id даёт сервер), и без
   *  защиты второй тап слал бы второй POST. */
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
      // оптимистично
      setItems((prev) =>
        prev.map((i) => (i.type === 'workout' && i.id === w.id ? { ...i, favoriteId: null } : i)),
      );
      setFavorites((prev) => prev.filter((f) => f.id !== favId));
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
      // Полный объект избранного соберёт следующая загрузка; для мгновенного
      // отображения хватает заголовка и модулей из карточки истории.
      setFavorites((prev) => [
        {
          id: favId,
          title: w.title,
          createdAt: new Date().toISOString(),
          modules: w.modules,
          missingCount: 0,
          totalDuration: w.totalDuration,
        },
        ...prev.filter((f) => f.id !== favId),
      ]);
    } catch {}
  };

  const removeFavorite = async (id: string) => {
    setFavorites((prev) => prev.filter((f) => f.id !== id)); // оптимистично
    setItems((prev) =>
      prev.map((i) => (i.type === 'workout' && i.favoriteId === id ? { ...i, favoriteId: null } : i)),
    );
    try {
      await fetch(`/api/favorites/workouts?id=${encodeURIComponent(id)}`, { method: 'DELETE' });
    } catch {}
  };

  const favCount = favorites.length + likedShorts.length;

  return (
    <div className="min-h-screen bg-surface pb-nav">
      {/* Шапка */}
      <header className="flex items-center gap-4 p-4 safe-top">
        <Link href="/profile" aria-label="Назад в профиль" className="inline-flex">
          <Image src="/icons/icon-action-back.svg" alt="Назад" width={24} height={24} />
        </Link>
        <h1 className="text-white text-xs font-bold font-overpass uppercase tracking-[0.5px]">
          История и избранное
        </h1>
      </header>

      {/* Вкладки */}
      <div className="flex gap-2 px-4 pb-3">
        {(
          [
            ['history', 'История'],
            ['favorites', `Избранное${favCount ? ` (${favCount})` : ''}`],
          ] as const
        ).map(([key, label]) => (
          <button
            key={key}
            type="button"
            onClick={() => switchTab(key)}
            className="font-overpass uppercase flex-1 rounded-full font-extrabold text-xs tracking-[0.5px] py-2.5 px-3 transition-colors"
            style={{
              border: `1px solid ${tab === key ? 'var(--color-brand)' : '#2a2f4a'}`,
              background: tab === key ? 'var(--lime-medium)' : 'transparent',
              color: tab === key ? 'var(--color-brand)' : 'var(--color-muted)',
            }}
          >
            {label}
          </button>
        ))}
      </div>

      {/* ─── История ─── */}
      {tab === 'history' && (
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
      )}

      {/* ─── Избранное ─── */}
      {tab === 'favorites' && (
        <div className="px-4">
          {favLoading ? (
            <div className="flex flex-col gap-3">
              {[1, 2, 3].map((i) => (
                <div key={i} className="rounded-2xl p-4 bg-night">
                  <Skeleton width="w-3/4" height="h-4" />
                  <div className="mt-3">
                    <Skeleton width="w-1/2" height="h-3" />
                  </div>
                </div>
              ))}
            </div>
          ) : favorites.length === 0 && likedShorts.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-gray-400 text-lg">Пока пусто</p>
              <p className="text-gray-500 text-sm mt-2">
                Сохраняй тренировки звёздочкой, а треньки — лайком: всё появится здесь
              </p>
            </div>
          ) : (
            <>
              {favorites.length > 0 && (
                <section className="mb-6">
                  {/* Разграничение с короткими треньками (правка владельца):
                      у каждой секции своя иконка и полное название */}
                  <h2 className="flex items-center gap-1.5 text-muted text-xs font-medium font-overpass uppercase tracking-wide mb-2 px-1">
                    <Sparkles size={16} aria-hidden />
                    Тренировки от ИИ-тренера
                  </h2>
                  <div className="flex flex-col gap-3">
                    {favorites.map((w) => (
                      <div key={w.id} className="rounded-2xl p-4 bg-night border border-[#2a2f4a]">
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <div className="text-ink font-overpass font-extrabold text-[15px]">
                              {w.title}
                            </div>
                            <div className="text-muted text-xs mt-1">
                              {w.modules.length}{' '}
                              {plural(w.modules.length, 'модуль', 'модуля', 'модулей')}
                              {w.totalDuration > 0 && ` · ${Math.round(w.totalDuration / 60)} мин`}
                              {w.missingCount > 0 && ` · ${w.missingCount} недоступно`}
                            </div>
                          </div>
                          <button
                            type="button"
                            onClick={() => removeFavorite(w.id)}
                            aria-label="Убрать из избранного"
                            className="inline-flex text-brand shrink-0"
                          >
                            <Star size={20} fill="currentColor" aria-hidden />
                          </button>
                        </div>
                        <div className="flex flex-col gap-1.5 mt-3">
                          {w.modules.map((m, i) => (
                            <Link
                              key={`${w.id}-${m.id}`}
                              href={`/video/${m.id}`}
                              className="flex items-center gap-2"
                            >
                              <span className="text-brand-blue text-[11px] font-extrabold w-4">
                                {i + 1}
                              </span>
                              <span className="text-muted text-[13px] truncate">{m.title}</span>
                            </Link>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </section>
              )}

              {likedShorts.length > 0 && (
                <section className="mb-6">
                  <h2 className="flex items-center gap-1.5 text-muted text-xs font-medium font-overpass uppercase tracking-wide mb-2 px-1">
                    <Clapperboard size={16} aria-hidden />
                    Треньки · короткий формат
                  </h2>
                  {/* Плитки без названий/описаний (правка владельца) — чистые
                      превью, как в ленте шортсов; имя ролика остаётся в aria. */}
                  <div className="grid grid-cols-3 gap-2">
                    {likedShorts.map((s) => (
                      <Link
                        key={s.id}
                        href={`/shorts/${s.id}`}
                        aria-label={`Открыть треньку «${s.title}»`}
                        className="relative rounded-xl overflow-hidden bg-night"
                        style={{ aspectRatio: '9 / 16' }}
                      >
                        {s.thumbnail ? (
                          <Image src={s.thumbnail} alt="" fill className="object-cover" />
                        ) : (
                          <span
                            className="absolute inset-0 flex items-center justify-center text-muted"
                            aria-hidden
                          >
                            <Clapperboard size={24} />
                          </span>
                        )}
                      </Link>
                    ))}
                  </div>
                </section>
              )}
            </>
          )}
        </div>
      )}

      <BottomNavigation activeTab="profile" />
    </div>
  );
};

// ── Карточки ленты истории ───────────────────────────────────────────────────

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
      {/* Сохранить тренировку целиком — потом можно повторить из «Избранного» */}
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
  <Link href={`/video/${v.id}`} className="rounded-2xl overflow-hidden bg-night">
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
