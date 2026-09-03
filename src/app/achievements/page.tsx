'use client';

// «Награды» — две категории (правка владельца «Самый конец августа»):
//  · «Ачивки» — поведенческие: серии дней подряд, ранняя пташка, воин
//    выходных, вехи объёма (в т.ч. эпическая «67»);
//  · «Достижения» — древо навыков: по каждой из 7 целей две ступени-«эволюции»
//    (5 и 10 завершённых тренировок с этой целью).
// Данные — /api/gamification/achievements (обе группы считаются ретроактивно
// из истории завершений).
//
// Витрина в шапке профиля (правка «Начало сентября»): игрок сам собирает до
// SHOWCASE_SLOTS наград тапом по полученной; пустые слоты в профиле — серые
// «+». Тиры (цвет значка): ачивки серые, эволюция 1 — серебро, эволюция 2 —
// золото, «67» — фиолетовая эпическая (src/lib/award-tier.ts).

import { useEffect, useState, Suspense } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Pin, Sparkles } from 'lucide-react';
import BottomNavigation from '@/components/BottomNavigation';
import { AchievementIcon } from '@/components/gamification/icons';
import { SKILL_TREE } from '@/lib/achievements';
import { awardTier, SHOWCASE_SLOTS, TIER_LABEL, TIER_STYLE } from '@/lib/award-tier';
import { pickTopAwards } from '@/lib/award-rarity';

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

/** Награда из группы «Ачивки» (серии/вехи) — плоский список, без эволюций. */
interface StreakItem {
  key: string;
  title: string;
  description: string;
  unlocked: boolean;
  progress: { current: number; target: number };
}

/** Кружок-значок в цвете тира; закрытая награда — приглушённая. */
function AwardPuck({ awardKey, unlocked, size }: { awardKey: string; unlocked: boolean; size: 56 | 48 }) {
  const st = TIER_STYLE[awardTier(awardKey)];
  const cls = size === 56 ? 'w-14 h-14' : 'w-12 h-12';
  return (
    <span
      className={`${cls} rounded-full flex items-center justify-center shrink-0`}
      style={
        unlocked
          ? { background: st.background, border: `1px solid ${st.border}`, color: st.color, boxShadow: st.shadow }
          : { background: 'rgba(255,255,255,0.08)', color: 'var(--color-muted)', opacity: 0.6 }
      }
      aria-hidden
    >
      <AchievementIcon achievementKey={awardKey} size={size === 56 ? 28 : 24} />
    </span>
  );
}

/** Подпись «в шапке» под выбранной наградой. */
function PinnedMark() {
  return (
    <span className="text-brand text-[10px] font-bold uppercase mt-2 inline-flex items-center gap-1">
      <Pin size={12} aria-hidden />
      в шапке
    </span>
  );
}

/** Рамка карточки: выбранная — лаймовая, полученная — в цвете тира, закрытая — без. */
function cardBorder(unlocked: boolean, pinned: boolean, key: string): string {
  if (pinned) return '1px solid var(--color-brand)';
  if (unlocked) return `1px solid ${TIER_STYLE[awardTier(key)].border}66`;
  return '1px solid transparent';
}

/** Карточка одной эволюции древа. tierLabel — «Эволюция 1» / «Эволюция 2». */
function EvolutionCard({
  item,
  tierLabel,
  pinned,
  onToggle,
}: {
  item: AchievementItem;
  tierLabel: string;
  pinned: boolean;
  onToggle: () => void;
}) {
  const pct = Math.min(
    100,
    Math.round((item.progress.current / Math.max(1, item.progress.target)) * 100),
  );
  const tier = awardTier(item.key);
  return (
    <button
      type="button"
      disabled={!item.unlocked}
      onClick={onToggle}
      aria-pressed={pinned}
      title={item.unlocked ? (pinned ? 'Убрать из шапки' : 'Поставить в шапку профиля') : undefined}
      className="rounded-2xl p-4 flex flex-col items-center text-center transition-transform active:scale-95 disabled:active:scale-100"
      style={{
        background: item.unlocked ? 'rgba(255,255,255,0.05)' : 'rgba(174,171,187,0.06)',
        border: cardBorder(item.unlocked, pinned, item.key),
        opacity: item.unlocked ? 1 : 0.8,
      }}
    >
      <span
        className="text-[9px] font-bold font-overpass uppercase tracking-[0.5px] mb-2"
        style={{ color: item.unlocked ? TIER_STYLE[tier].border : 'var(--color-muted)' }}
      >
        {tierLabel} · {TIER_LABEL[tier]}
      </span>
      <span className="mb-3">
        <AwardPuck awardKey={item.key} unlocked={item.unlocked} size={56} />
      </span>
      <span className={`text-sm font-bold ${item.unlocked ? 'text-ink' : 'text-white'}`}>
        {item.title}
      </span>
      {!item.unlocked ? (
        <span className="w-full mt-3">
          <span className="block h-1.5 bg-white/10 rounded-full overflow-hidden">
            <span className="block h-full bg-[#FF8C4A]" style={{ width: `${pct}%` }} />
          </span>
          <span className="block text-muted text-[10px] mt-1">
            {item.progress.current}/{item.progress.target}
          </span>
        </span>
      ) : pinned ? (
        <PinnedMark />
      ) : (
        <span className="text-muted text-[10px] font-bold font-overpass uppercase mt-2">Получено</span>
      )}
    </button>
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

const AchievementsPage = () => {
  const [items, setItems] = useState<AchievementItem[] | null>(null);
  const [streaks, setStreaks] = useState<StreakItem[] | null>(null);
  const [error, setError] = useState(false);
  // Витрина в шапке профиля: до SHOWCASE_SLOTS ключей в порядке показа
  const [pinned, setPinned] = useState<string[]>([]);
  const [pinBusy, setPinBusy] = useState(false);
  // Короткое сообщение (лимит слотов / ошибка сервера), само гаснет
  const [notice, setNotice] = useState<string | null>(null);
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
    fetch('/api/profile')
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (cancelled) return;
        const list = d?.user?.pinnedAchievements;
        setPinned(Array.isArray(list) ? list.filter((k: unknown) => typeof k === 'string') : []);
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    if (!notice) return;
    const t = setTimeout(() => setNotice(null), 2500);
    return () => clearTimeout(t);
  }, [notice]);

  /** Сохранить витрину целиком; при ошибке — откат и текст причины. */
  const savePinned = async (next: string[]) => {
    const prev = pinned;
    setPinBusy(true);
    setPinned(next); // оптимистично
    try {
      const res = await fetch('/api/gamification/pinned', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ keys: next }),
      });
      if (!res.ok) {
        setPinned(prev);
        const d = await res.json().catch(() => ({}));
        setNotice(d?.error || 'Не удалось сохранить');
      }
    } catch {
      setPinned(prev);
      setNotice('Нет связи — попробуй ещё раз');
    } finally {
      setPinBusy(false);
    }
  };

  /** Тап по полученной награде — поставить в шапку / убрать. Сервер проверяет,
   *  что она реально получена: иначе в витрине висела бы чужая ачивка. */
  const togglePin = (key: string) => {
    if (pinBusy) return;
    if (pinned.includes(key)) {
      void savePinned(pinned.filter((k) => k !== key));
      return;
    }
    if (pinned.length >= SHOWCASE_SLOTS) {
      setNotice(`В шапке уже ${SHOWCASE_SLOTS} наград — сначала убери одну`);
      return;
    }
    void savePinned([...pinned, key]);
  };

  /** Добить свободные слоты самыми сложными из полученных (award-rarity). */
  const fillBest = () => {
    if (pinBusy) return;
    const all = [...(streaks ?? []), ...(items ?? [])];
    const rest = pickTopAwards(
      all.filter((a) => !pinned.includes(a.key)),
      SHOWCASE_SLOTS - pinned.length,
    );
    if (rest.length > 0) void savePinned([...pinned, ...rest.map((a) => a.key)]);
  };

  const byKey = new Map((items ?? []).map((a) => [a.key, a]));
  const unlockedCount = items?.filter((a) => a.unlocked).length ?? 0;
  const total = items?.length ?? SKILL_TREE.length * 2;
  const streakUnlocked = streaks?.filter((a) => a.unlocked).length ?? 0;
  const streakTotal = streaks?.length ?? 10;
  const unlockedNotPinned =
    [...(streaks ?? []), ...(items ?? [])].filter((a) => a.unlocked && !pinned.includes(a.key)).length;
  const loaded = !!items && !!streaks;

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

        {/* Состояние витрины + подсказка */}
        {loaded && (
          <div
            className="rounded-2xl px-4 py-3 mb-4 flex items-center gap-3"
            style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)' }}
          >
            <div className="min-w-0 flex-1">
              <div className="text-ink text-sm font-bold font-overpass">
                В шапке профиля: {pinned.length} из {SHOWCASE_SLOTS}
              </div>
              <div className="text-muted text-[11px] leading-snug mt-0.5">
                Тапни по полученной награде, чтобы поставить её в шапку или убрать.
              </div>
            </div>
            {pinned.length < SHOWCASE_SLOTS && unlockedNotPinned > 0 && (
              <button
                type="button"
                onClick={fillBest}
                disabled={pinBusy}
                className="shrink-0 inline-flex items-center gap-1.5 rounded-full px-3 py-2 text-[11px] font-extrabold font-overpass uppercase transition-transform active:scale-95"
                style={{
                  background: 'var(--lime-medium)',
                  border: '1px solid var(--color-brand)',
                  color: 'var(--color-brand)',
                }}
              >
                <Sparkles size={14} aria-hidden />
                Лучшие
              </button>
            )}
          </div>
        )}
        {notice && (
          <div
            role="status"
            className="rounded-xl px-4 py-2.5 mb-4 text-[13px] font-bold font-overpass"
            style={{ background: 'rgba(255,140,74,0.12)', color: '#FF8C4A' }}
          >
            {notice}
          </div>
        )}

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
            {streaks.map((a) => {
              const isPinned = pinned.includes(a.key);
              const tier = awardTier(a.key);
              return (
                <button
                  key={a.key}
                  type="button"
                  disabled={!a.unlocked}
                  onClick={() => togglePin(a.key)}
                  aria-pressed={isPinned}
                  title={a.unlocked ? (isPinned ? 'Убрать из шапки' : 'Поставить в шапку профиля') : undefined}
                  className="rounded-2xl p-4 flex flex-col items-center text-center transition-transform active:scale-95 disabled:active:scale-100"
                  style={{
                    background: a.unlocked ? 'rgba(255,255,255,0.05)' : 'rgba(174,171,187,0.06)',
                    border: cardBorder(a.unlocked, isPinned, a.key),
                  }}
                >
                  {/* Подпись тира — только у эпической: остальные ачивки все серые */}
                  {tier === 'epic' && (
                    <span
                      className="text-[9px] font-bold font-overpass uppercase tracking-[0.5px] mb-2"
                      style={{ color: TIER_STYLE.epic.border }}
                    >
                      {TIER_LABEL.epic}
                    </span>
                  )}
                  <AwardPuck awardKey={a.key} unlocked={a.unlocked} size={48} />
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
                  {isPinned && <PinnedMark />}
                </button>
              );
            })}
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
                    <EvolutionCard
                      item={evo1}
                      tierLabel="Эволюция 1"
                      pinned={pinned.includes(evo1.key)}
                      onToggle={() => togglePin(evo1.key)}
                    />
                    <EvolutionCard
                      item={evo2}
                      tierLabel="Эволюция 2"
                      pinned={pinned.includes(evo2.key)}
                      onToggle={() => togglePin(evo2.key)}
                    />
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
