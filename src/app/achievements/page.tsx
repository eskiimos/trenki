'use client';

// «Награды» — две категории (правка владельца «Самый конец августа»):
//  · «Ачивки» — поведенческие: серии дней подряд, ранняя пташка, воин
//    выходных, вехи объёма (восстановленный набор, удалённый при переходе на
//    древо, — 9 из прежних 16);
//  · «Достижения» — древо навыков: по каждой из 7 целей две ступени-«эволюции»
//    (5 и 10 завершённых тренировок с этой целью).
// Данные — /api/gamification/achievements (обе группы считаются ретроактивно
// из истории завершений). Полученные — яркие с lime-рамкой, будущие —
// приглушённые с прогрессом.

import { useEffect, useState, Suspense } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import BottomNavigation from '@/components/BottomNavigation';
import { AchievementIcon } from '@/components/gamification/icons';
import { SKILL_TREE } from '@/lib/achievements';

interface AchievementItem {
  key: string;
  title: string;
  description: string;
  emoji: string; // хранится в API-ответе (нужен email-дайджесту), в UI не рендерится
  goal: string;
  tier: 1 | 2;
  target: number;
  unlocked: boolean;
  progress: { current: number; target: number };
}

/** Карточка одной эволюции. tierLabel — «Эволюция 1» / «Эволюция 2». */
function EvolutionCard({ item, tierLabel }: { item: AchievementItem; tierLabel: string }) {
  const pct = Math.min(
    100,
    Math.round((item.progress.current / Math.max(1, item.progress.target)) * 100),
  );
  return (
    <div
      className={`rounded-2xl p-4 flex flex-col items-center text-center border ${
        item.unlocked ? 'bg-brand/10 border-brand/40' : 'bg-white/[0.04] border-white/10 opacity-70'
      }`}
    >
      <div
        className={`text-[9px] font-bold font-overpass uppercase tracking-[0.5px] mb-2 ${
          item.tier === 2 ? 'text-[#FF8C4A]' : 'text-muted'
        }`}
      >
        {tierLabel}
      </div>
      <div
        className={`w-14 h-14 rounded-full flex items-center justify-center mb-3 ${
          item.unlocked ? 'bg-brand/20 text-brand' : 'bg-white/10 text-muted'
        }`}
      >
        <AchievementIcon achievementKey={item.key} size={28} />
      </div>
      <div className={`text-sm font-bold ${item.unlocked ? 'text-brand' : 'text-white'}`}>
        {item.title}
      </div>
      {!item.unlocked ? (
        <div className="w-full mt-3">
          <div className="h-1.5 bg-white/10 rounded-full overflow-hidden">
            <div className="h-full bg-[#FF8C4A]" style={{ width: `${pct}%` }} />
          </div>
          <div className="text-muted text-[10px] mt-1">
            {item.progress.current}/{item.progress.target}
          </div>
        </div>
      ) : (
        <div className="text-brand text-[10px] font-bold font-overpass uppercase mt-2">Получено</div>
      )}
    </div>
  );
}

/** Плейсхолдер, если ключа из SKILL_TREE вдруг нет в ответе API. */
function emptyItem(key: string, tier: 1 | 2, title: string): AchievementItem {
  const target = tier === 1 ? 5 : 10;
  return {
    key, title, description: '', emoji: '', goal: '', tier, target,
    unlocked: false, progress: { current: 0, target },
  };
}

/** Награда из группы «Ачивки» (серии/вехи) — плоский список, без эволюций. */
interface StreakItem {
  key: string;
  title: string;
  description: string;
  unlocked: boolean;
  progress: { current: number; target: number };
}

const AchievementsPage = () => {
  const [items, setItems] = useState<AchievementItem[] | null>(null);
  const [streaks, setStreaks] = useState<StreakItem[] | null>(null);
  const [error, setError] = useState(false);
  // Две категории (правка владельца): «Ачивки» = серии и вехи,
  // «Достижения» = древо навыков.
  // Вкладка из URL: с профиля ведут две отдельные карточки-категории
  const searchParams = useSearchParams();
  const [tab, setTab] = useState<'streaks' | 'skills'>(
    searchParams.get('tab') === 'skills' ? 'skills' : 'streaks',
  );

  useEffect(() => {
    let cancelled = false;
    fetch('/api/gamification/achievements')
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((d) => {
        if (cancelled) return;
        setItems(d.achievements || []);
        setStreaks(d.streakAchievements || []);
      })
      .catch(() => {
        if (!cancelled) setError(true);
      });
    return () => { cancelled = true; };
  }, []);

  const byKey = new Map((items ?? []).map((a) => [a.key, a]));
  const unlockedCount = items?.filter((a) => a.unlocked).length ?? 0;
  const total = items?.length ?? SKILL_TREE.length * 2;
  const streakUnlocked = streaks?.filter((a) => a.unlocked).length ?? 0;
  const streakTotal = streaks?.length ?? 9;

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
          <Image src="/icons/icon-action-back.svg" alt="Назад" width={24} height={24} />
        </Link>
        <h1 className="text-white text-xs font-bold font-overpass uppercase tracking-[0.5px]">
          Награды
        </h1>
      </div>

      <div className="px-4 max-w-3xl md:mx-auto md:px-8">
        {/* Две категории наград */}
        <div className="flex gap-2 pb-4">
          {(
            [
              ['streaks', `Ачивки${streaks ? ` ${streakUnlocked}/${streakTotal}` : ''}`],
              ['skills', `Достижения${items ? ` ${unlockedCount}/${total}` : ''}`],
            ] as const
          ).map(([key, label]) => (
            <button
              key={key}
              type="button"
              onClick={() => setTab(key)}
              className="font-overpass uppercase flex-1 rounded-full font-extrabold text-[11px] tracking-[0.5px] py-2.5 px-3 transition-colors"
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

        {error && (
          <div className="text-muted text-sm text-center py-10">
            Не удалось загрузить награды — попробуй обновить страницу
          </div>
        )}
        {!items && !error && (
          <div className="w-8 h-8 border-2 border-white/30 border-t-white rounded-full animate-spin mx-auto my-12" />
        )}

        {/* «Ачивки»: серии, вехи, поведение */}
        {tab === 'streaks' && streaks && (
          <div className="grid grid-cols-2 gap-3">
            {streaks.map((a) => (
              <div
                key={a.key}
                className="rounded-2xl p-4 flex flex-col items-center text-center"
                style={{
                  background: a.unlocked ? 'var(--lime-subtle)' : 'rgba(174,171,187,0.06)',
                  border: `1px solid ${a.unlocked ? 'var(--border-lime)' : 'transparent'}`,
                }}
              >
                <span className={a.unlocked ? 'text-brand' : 'text-muted opacity-50'} aria-hidden>
                  <AchievementIcon achievementKey={a.key} size={28} />
                </span>
                <span
                  className={`font-overpass font-bold text-sm mt-2 ${a.unlocked ? 'text-ink' : 'text-muted'}`}
                >
                  {a.title}
                </span>
                <span className="text-muted text-[11px] leading-snug mt-1">{a.description}</span>
                {/* Прогресс — только у счётчиков (у boolean-наград target=1) */}
                {!a.unlocked && a.progress.target > 1 && (
                  <span className="w-full mt-2">
                    <span className="block h-1.5 rounded-full bg-white/10 overflow-hidden">
                      <span
                        className="block h-full rounded-full bg-brand/60"
                        style={{
                          width: `${Math.round((a.progress.current / a.progress.target) * 100)}%`,
                        }}
                      />
                    </span>
                    <span className="block text-muted text-[10px] mt-1 tabular-nums">
                      {a.progress.current}/{a.progress.target}
                    </span>
                  </span>
                )}
              </div>
            ))}
          </div>
        )}

        {tab === 'skills' && items && (
          <div className="flex flex-col gap-6">
            {SKILL_TREE.map((branch) => {
              const evo1 = byKey.get(branch.evo1.key) ?? emptyItem(branch.evo1.key, 1, branch.evo1.title);
              const evo2 = byKey.get(branch.evo2.key) ?? emptyItem(branch.evo2.key, 2, branch.evo2.title);
              return (
                <div key={branch.goal}>
                  <h2 className="text-muted text-[11px] font-bold font-overpass uppercase tracking-[0.5px] mb-3">
                    {branch.goalTitle}
                  </h2>
                  <div className="grid grid-cols-2 gap-3">
                    <EvolutionCard item={evo1} tierLabel="Эволюция 1" />
                    <EvolutionCard item={evo2} tierLabel="Эволюция 2" />
                  </div>
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

// useSearchParams в клиентской странице требует Suspense-границу (App Router:
// без неё пререндер падает с ошибкой сборки).
export default function AchievementsPageWrapper() {
  return (
    <Suspense fallback={null}>
      <AchievementsPage />
    </Suspense>
  );
}
