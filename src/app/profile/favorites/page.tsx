'use client';

// «Избранное» — ОТДЕЛЬНАЯ страница (правка владельца: история и избранное не
// должны жить на одном экране). Три подвкладки:
//  · «Треньки» — лайкнутые шортсы (лайк = избранное), чистые превью без
//    названий, тап открывает шортс;
//  · «Занятия» — лайкнутые занятия каталога (лайк = избранное, как у шортсов);
//  · «ИИ-тренер» — сохранённые звёздочкой тренировки целиком
//    (FavoriteWorkout), звёздочка ставится в истории (/profile/watch-history).
// Подвкладка пишется в URL (?fav=), возврат «Назад» из шортса её не сбрасывает.

import React, { Suspense, useEffect, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useSearchParams } from 'next/navigation';
import { Clapperboard, Dumbbell, Sparkles, Star } from 'lucide-react';
import BottomNavigation from '@/components/BottomNavigation';
import { Skeleton } from '@/components/Skeleton';

const plural = (n: number, one: string, few: string, many: string) => {
  const m10 = n % 10;
  const m100 = n % 100;
  if (m10 === 1 && m100 !== 11) return one;
  if (m10 >= 2 && m10 <= 4 && (m100 < 12 || m100 > 14)) return few;
  return many;
};

interface FavWorkout {
  id: string;
  title: string;
  createdAt: string;
  modules: { id: string; title: string; thumbnail?: string | null }[];
  missingCount: number;
  totalDuration: number;
}

interface LikedVideo {
  id: string;
  title: string;
  thumbnail: string | null;
  duration: number;
  trainer: string;
}

interface LikedShort {
  id: string;
  title: string;
  thumbnail: string | null;
}

type FavTab = 'shorts' | 'videos' | 'workouts';

const FavoritesPage = () => {
  const searchParams = useSearchParams();
  const favParam = searchParams.get('fav');
  const [favTab, setFavTab] = useState<FavTab>(
    favParam === 'workouts' || favParam === 'videos' ? favParam : 'shorts',
  );
  // Явный выбор (URL или тап) — автопереключение больше не трогает подвкладку
  const [favTabChosen, setFavTabChosen] = useState(favParam !== null);

  const [isLoading, setIsLoading] = useState(true);
  const [favorites, setFavorites] = useState<FavWorkout[]>([]);
  const [likedShorts, setLikedShorts] = useState<LikedShort[]>([]);
  const [likedVideos, setLikedVideos] = useState<LikedVideo[]>([]);

  const switchFavTab = (key: FavTab) => {
    setFavTab(key);
    setFavTabChosen(true);
    try {
      window.history.replaceState(null, '', `?fav=${key}`);
    } catch {}
  };

  useEffect(() => {
    let cancelled = false;
    Promise.allSettled([
      fetch('/api/favorites/workouts')
        .then((r) => (r.ok ? r.json() : null))
        .then((d) => {
          const list: FavWorkout[] = d?.workouts ?? [];
          if (!cancelled) setFavorites(list);
          return list;
        }),
      fetch('/api/shorts/liked')
        .then((r) => (r.ok ? r.json() : null))
        .then((d) => {
          const list: LikedShort[] = d?.shorts ?? [];
          if (!cancelled) setLikedShorts(list);
          return list;
        }),
      fetch('/api/videos/liked')
        .then((r) => (r.ok ? r.json() : null))
        .then((d) => {
          const list: LikedVideo[] = d?.videos ?? [];
          if (!cancelled) setLikedVideos(list);
          return list;
        }),
    ]).then(([favRes, shortsRes, videosRes]) => {
      if (cancelled) return;
      setIsLoading(false);
      // Автовыбор подвкладки — только пока юзер не выбирал сам: пустые
      // «Треньки» при непустых тренировках встречали бы пустым экраном.
      const favList = favRes.status === 'fulfilled' ? favRes.value : [];
      const shortsList = shortsRes.status === 'fulfilled' ? shortsRes.value : [];
      const videoList = videosRes.status === 'fulfilled' ? videosRes.value : [];
      setFavTabChosen((chosen) => {
        // Открываем первую НЕпустую вкладку, чтобы не встречать пустым экраном
        if (!chosen && shortsList.length === 0) {
          if (videoList.length > 0) setFavTab('videos');
          else if (favList.length > 0) setFavTab('workouts');
        }
        return chosen;
      });
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const removeFavorite = async (id: string) => {
    setFavorites((prev) => prev.filter((f) => f.id !== id)); // оптимистично
    try {
      await fetch(`/api/favorites/workouts?id=${encodeURIComponent(id)}`, { method: 'DELETE' });
    } catch {}
  };

  return (
    <div className="min-h-screen bg-surface pb-nav">
      {/* Шапка */}
      <header className="flex items-center gap-4 p-4 safe-top">
        <Link href="/profile" aria-label="Назад в профиль" className="inline-flex">
          <Image src="/icons/icon-action-back.svg" alt="Назад" width={24} height={24} />
        </Link>
        <h1 className="text-white text-xs font-bold font-overpass uppercase tracking-[0.5px]">
          Избранное
        </h1>
      </header>

      {/* Подвкладки: короткий формат, занятия каталога и тренировки ИИ.
          grid auto-fit — на узком экране третья переносится, а не сжимается
          до нечитаемого. */}
      <div
        className="px-4 pb-3"
        style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(104px, 1fr))', gap: 8 }}
      >
        {(
          [
            ['shorts', <Clapperboard key="i" size={16} aria-hidden />, `Треньки${likedShorts.length ? ` (${likedShorts.length})` : ''}`],
            ['videos', <Dumbbell key="i" size={16} aria-hidden />, `Занятия${likedVideos.length ? ` (${likedVideos.length})` : ''}`],
            ['workouts', <Sparkles key="i" size={16} aria-hidden />, `ИИ-тренер${favorites.length ? ` (${favorites.length})` : ''}`],
          ] as const
        ).map(([key, icon, label]) => (
          <button
            key={key}
            type="button"
            onClick={() => switchFavTab(key)}
            className="font-overpass uppercase rounded-full font-extrabold text-[11px] tracking-[0.5px] py-2 px-3 inline-flex items-center justify-center gap-1.5 transition-colors"
            style={{
              border: `1px solid ${favTab === key ? 'var(--color-brand)' : '#2a2f4a'}`,
              background: favTab === key ? 'var(--lime-medium)' : 'transparent',
              color: favTab === key ? 'var(--color-brand)' : 'var(--color-muted)',
            }}
          >
            {icon}
            {label}
          </button>
        ))}
      </div>

      <div className="px-4">
        {isLoading ? (
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
        ) : (
          <>
            {favTab === 'shorts' &&
              (likedShorts.length === 0 ? (
                <div className="text-center py-12">
                  <p className="text-gray-400 text-lg">Пока пусто</p>
                  <p className="text-gray-500 text-sm mt-2">
                    Лайкай треньки в ленте — они появятся здесь
                  </p>
                </div>
              ) : (
                /* Плитки без названий/описаний (правка владельца) — чистые
                   превью, как в ленте шортсов; имя ролика остаётся в aria. */
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
              ))}

            {favTab === 'videos' &&
              (likedVideos.length === 0 ? (
                <div className="text-center py-12">
                  <p className="text-gray-400 text-lg">Пока пусто</p>
                  <p className="text-gray-500 text-sm mt-2">
                    Ставь лайк занятию в каталоге — оно появится здесь
                  </p>
                </div>
              ) : (
                <div className="flex flex-col gap-3">
                  {likedVideos.map((v) => (
                    <Link
                      key={v.id}
                      href={`/video/${v.id}`}
                      className="flex gap-3 rounded-2xl overflow-hidden bg-night border border-[#2a2f4a] p-3"
                    >
                      <span
                        className="relative rounded-xl overflow-hidden bg-surface shrink-0"
                        style={{ width: 104, aspectRatio: '16 / 9' }}
                      >
                        {v.thumbnail ? (
                          <Image src={v.thumbnail} alt="" fill className="object-cover" />
                        ) : (
                          <span
                            className="absolute inset-0 flex items-center justify-center text-muted"
                            aria-hidden
                          >
                            <Dumbbell size={20} />
                          </span>
                        )}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block text-ink font-overpass font-bold text-sm leading-tight line-clamp-2">
                          {v.title}
                        </span>
                        <span className="block text-muted text-xs mt-1">
                          {v.trainer}
                          {v.duration > 0 && ` · ${Math.round(v.duration / 60)} мин`}
                        </span>
                      </span>
                    </Link>
                  ))}
                </div>
              ))}

            {favTab === 'workouts' &&
              (favorites.length === 0 ? (
                <div className="text-center py-12">
                  <p className="text-gray-400 text-lg">Пока пусто</p>
                  <p className="text-gray-500 text-sm mt-2">
                    Сохраняй тренировки звёздочкой в{' '}
                    <Link href="/profile/watch-history" className="text-brand underline">
                      истории
                    </Link>{' '}
                    — они появятся здесь
                  </p>
                </div>
              ) : (
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
              ))}
          </>
        )}
      </div>

      <BottomNavigation activeTab="profile" />
    </div>
  );
};

// useSearchParams в клиентской странице требует Suspense-границу
export default function FavoritesPageWrapper() {
  return (
    <Suspense fallback={null}>
      <FavoritesPage />
    </Suspense>
  );
}
