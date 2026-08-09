'use client';

// Страница ачивок (вместо модалки — решение босса): сетка 2 в ряд,
// lucide-иконки вместо эмодзи. Полученные — яркие с lime-рамкой, будущие —
// приглушённые с условием и мини-прогрессом. Данные — /api/gamification/
// achievements (считаются ретроактивно из истории).

import { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  ChevronLeft, Snowflake, Medal, BicepsFlexed, Gem, TrainFront, Zap, Target,
  Dumbbell, Flame, CalendarDays, Rocket, Trophy, Sunrise, Swords,
  type LucideIcon,
} from 'lucide-react';
import BottomNavigation from '@/components/BottomNavigation';

interface AchievementItem {
  key: string;
  title: string;
  description: string;
  emoji: string; // fallback, если для ключа нет иконки
  unlocked: boolean;
  progress: { current: number; target: number };
}

// Иконки по ключам ачивок (UI-слой; чистая либа хранит только emoji-fallback)
const ICONS: Record<string, LucideIcon> = {
  workouts_1: Snowflake,
  workouts_10: Medal,
  workouts_50: BicepsFlexed,
  workouts_100: Gem,
  workouts_250: TrainFront,
  modules_25: Zap,
  modules_100: Target,
  modules_500: Dumbbell,
  streak_3: Flame,
  streak_7: CalendarDays,
  streak_14: Rocket,
  streak_30: Trophy,
  early_bird: Sunrise,
  weekend_warrior: Swords,
};

const AchievementsPage = () => {
  const [items, setItems] = useState<AchievementItem[] | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetch('/api/gamification/achievements')
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((d) => {
        if (!cancelled) setItems(d.achievements || []);
      })
      .catch(() => {
        if (!cancelled) setError(true);
      });
    return () => { cancelled = true; };
  }, []);

  const unlockedCount = items?.filter((a) => a.unlocked).length ?? 0;

  return (
    <div
      className="min-h-screen bg-[#101530] text-white"
      // Тапбар фиксированный: отступ снизу = safe-area + 96px (правило проекта)
      style={{ paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 96px)' }}
    >
      {/* Шапка */}
      <div
        className="flex items-center gap-4 p-4 max-w-3xl md:mx-auto md:px-8"
        style={{ paddingTop: 'calc(env(safe-area-inset-top, 0px) + 16px)' }}
      >
        <Link href="/profile" aria-label="Назад в профиль">
          <ChevronLeft size={28} className="text-white" />
        </Link>
        <h1 className="text-white text-xs font-bold font-overpass uppercase tracking-[0.5px]">
          Ачивки{items ? ` (${unlockedCount}/${items.length})` : ''}
        </h1>
      </div>

      <div className="px-4 max-w-3xl md:mx-auto md:px-8">
        {error && (
          <div className="text-muted text-sm text-center py-10">
            Не удалось загрузить ачивки — попробуй обновить страницу
          </div>
        )}
        {!items && !error && (
          <div className="w-8 h-8 border-2 border-white/30 border-t-white rounded-full animate-spin mx-auto my-12" />
        )}

        {items && (
          <div className="grid grid-cols-2 gap-3">
            {items.map((a) => {
              const Icon = ICONS[a.key];
              const pct = Math.min(100, Math.round((a.progress.current / Math.max(1, a.progress.target)) * 100));
              return (
                <div
                  key={a.key}
                  className={`rounded-2xl p-4 flex flex-col items-center text-center border ${
                    a.unlocked
                      ? 'bg-brand/10 border-brand/40'
                      : 'bg-white/[0.04] border-white/10 opacity-70'
                  }`}
                >
                  <div
                    className={`w-14 h-14 rounded-full flex items-center justify-center mb-3 ${
                      a.unlocked ? 'bg-brand/20 text-brand' : 'bg-white/10 text-muted'
                    }`}
                  >
                    {Icon ? (
                      <Icon size={28} aria-hidden />
                    ) : (
                      <span className="text-2xl" aria-hidden>{a.emoji}</span>
                    )}
                  </div>
                  <div className={`text-sm font-bold ${a.unlocked ? 'text-brand' : 'text-white'}`}>
                    {a.title}
                  </div>
                  <div className="text-muted text-[11px] mt-1 leading-snug">{a.description}</div>
                  {/* Прогресс — только у незакрытых счётчиковых ачивок */}
                  {!a.unlocked && a.progress.target > 1 && (
                    <div className="w-full mt-3">
                      <div className="h-1.5 bg-white/10 rounded-full overflow-hidden">
                        <div className="h-full bg-[#FF8C4A]" style={{ width: `${pct}%` }} />
                      </div>
                      <div className="text-muted text-[10px] mt-1">
                        {a.progress.current}/{a.progress.target}
                      </div>
                    </div>
                  )}
                  {a.unlocked && (
                    <div className="text-brand text-[10px] font-bold font-overpass uppercase mt-2">
                      Получено
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      <BottomNavigation activeTab="profile" />
    </div>
  );
};

export default AchievementsPage;
