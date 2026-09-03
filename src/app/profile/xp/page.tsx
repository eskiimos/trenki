'use client';

// «История XP» — откуда взялся опыт (правка владельца «Начало сентября»:
// «сколько-то с тренировок, за чек-ин, с бустерами»). Данные —
// /api/gamification/xp-history: разбивка итога по источникам + по дням.
// Единственный бустер в игре — «Ударный темп ×2», его вклад отдельной строкой.

import { useEffect, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { Blocks, CalendarCheck, Dumbbell, Flame, type LucideIcon } from 'lucide-react';
import BottomNavigation from '@/components/BottomNavigation';
import { plural } from '@/lib/plural';
import { TEMPO_MULTIPLIER } from '@/lib/gamification';

interface XpDay {
  day: number;
  date: string;
  workouts: number;
  modules: number;
  checkin: number;
  tempo: boolean;
  tempoBonus: number;
  total: number;
}

interface XpHistory {
  totals: { workouts: number; modules: number; checkins: number; tempoBonus: number; total: number };
  days: XpDay[];
  legacy: { modules: number; amount: number };
}

const fmt = new Intl.NumberFormat('ru-RU');

/** «3 сентября, ср» — дата дня как есть, без сдвига таймзоны (день уже в tz игрока). */
function dayLabel(iso: string): string {
  return new Date(`${iso}T00:00:00Z`).toLocaleDateString('ru-RU', {
    day: 'numeric',
    month: 'long',
    weekday: 'short',
    timeZone: 'UTC',
  });
}

function dayDetails(d: XpDay): string {
  const parts: string[] = [];
  if (d.workouts > 0) parts.push(`${d.workouts} ${plural(d.workouts, ['тренировка', 'тренировки', 'тренировок'])}`);
  if (d.modules > 0) parts.push(`${d.modules} ${plural(d.modules, ['модуль', 'модуля', 'модулей'])}`);
  if (d.checkin > 0) parts.push(`чек-ин +${d.checkin}`);
  return parts.join(' · ');
}

export default function XpHistoryPage() {
  const [data, setData] = useState<XpHistory | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetch('/api/gamification/xp-history')
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((d) => {
        if (!cancelled) setData(d);
      })
      .catch(() => {
        if (!cancelled) setError(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const sources: { Icon: LucideIcon; label: string; value: number; accent?: boolean }[] = data
    ? [
        { Icon: Dumbbell, label: 'Тренировки', value: data.totals.workouts },
        { Icon: Blocks, label: 'Модули', value: data.totals.modules },
        { Icon: CalendarCheck, label: 'Чек-ины', value: data.totals.checkins },
        { Icon: Flame, label: `Ударный темп ×${TEMPO_MULTIPLIER}`, value: data.totals.tempoBonus, accent: true },
      ]
    : [];

  return (
    <div className="min-h-screen bg-surface text-white pb-nav">
      {/* Шапка */}
      <div className="flex items-center gap-4 p-4 safe-top max-w-3xl md:mx-auto md:px-8">
        <Link href="/profile" aria-label="Назад в профиль" className="inline-flex">
          <Image src="/icons/icon-action-back.svg" alt="Назад" width={24} height={24} />
        </Link>
        <h1 className="text-white text-xs font-bold font-overpass uppercase tracking-[0.5px]">
          История XP
        </h1>
      </div>

      <div className="px-4 max-w-3xl md:mx-auto md:px-8">
        {error && (
          <div className="text-muted text-sm text-center py-10">
            Не удалось загрузить историю — попробуй обновить страницу
          </div>
        )}
        {!data && !error && (
          <div className="w-8 h-8 border-2 border-white/30 border-t-white rounded-full animate-spin mx-auto my-12" />
        )}

        {data && (
          <>
            {/* Итого и разбивка по источникам */}
            <div className="bg-night rounded-lg p-4 mb-4">
              <div className="text-muted text-[11px] font-bold font-overpass uppercase tracking-[0.5px]">
                Всего опыта
              </div>
              <div className="text-ink font-overpass font-black text-3xl tabular-nums mt-1">
                {fmt.format(data.totals.total)} XP
              </div>
              <div className="flex flex-col gap-2 mt-4">
                {sources.map(({ Icon, label, value, accent }) => (
                  <div key={label} className="flex items-center gap-3">
                    <span
                      className="w-8 h-8 rounded-full flex items-center justify-center shrink-0"
                      style={{
                        background: accent ? 'rgba(255,140,74,0.14)' : 'var(--lime-subtle)',
                        color: accent ? '#FF8C4A' : 'var(--color-brand)',
                      }}
                    >
                      <Icon size={16} aria-hidden />
                    </span>
                    <span className="text-ink text-sm font-medium font-overpass flex-1 min-w-0">{label}</span>
                    <span className="text-ink text-sm font-bold font-overpass tabular-nums">
                      {accent ? '+' : ''}
                      {fmt.format(value)}
                    </span>
                  </div>
                ))}
              </div>
              <div className="text-muted text-[11px] leading-snug mt-3">
                Тренировка — {100} XP, модуль — {20} XP, чек-ин — 10–50 XP по дню недели. Ударный темп
                удваивает тренировки и модули с третьего дня подряд.
              </div>
            </div>

            {/* По дням */}
            {data.days.length === 0 && data.legacy.modules === 0 ? (
              <div className="text-muted text-sm text-center py-10">
                Пока пусто — заверши первую тренировку или отметься чек-ином.
              </div>
            ) : (
              <div className="flex flex-col gap-2">
                {data.days.map((d) => (
                  <div
                    key={d.day}
                    className="flex items-center gap-3 rounded-2xl px-4 py-3"
                    style={{ background: '#060919', border: '1px solid rgba(255,255,255,0.06)' }}
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-ink text-sm font-bold font-overpass capitalize">
                          {dayLabel(d.date)}
                        </span>
                        {d.tempo && (
                          <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold font-overpass bg-brand/15 border border-brand/40 text-brand">
                            <Flame size={11} fill="currentColor" aria-hidden />
                            ×{TEMPO_MULTIPLIER}
                          </span>
                        )}
                      </div>
                      <div className="text-muted text-xs mt-0.5">{dayDetails(d)}</div>
                    </div>
                    <span className="text-brand font-overpass font-black text-base tabular-nums shrink-0">
                      +{fmt.format(d.total)}
                    </span>
                  </div>
                ))}
                {data.legacy.modules > 0 && (
                  <div
                    className="flex items-center gap-3 rounded-2xl px-4 py-3"
                    style={{ background: '#060919', border: '1px solid rgba(255,255,255,0.06)' }}
                  >
                    <div className="min-w-0 flex-1">
                      <div className="text-ink text-sm font-bold font-overpass">Ранее</div>
                      <div className="text-muted text-xs mt-0.5">
                        {data.legacy.modules}{' '}
                        {plural(data.legacy.modules, ['модуль', 'модуля', 'модулей'])} без даты
                      </div>
                    </div>
                    <span className="text-brand font-overpass font-black text-base tabular-nums shrink-0">
                      +{fmt.format(data.legacy.amount)}
                    </span>
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </div>

      <BottomNavigation activeTab="profile" />
    </div>
  );
}
