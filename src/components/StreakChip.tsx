'use client';

// Плашка стрика на главной: плоский surface-фон (без градиента), ОДНА строка
// без переносов — иконка + короткий текст (обрезается при нехватке места) +
// бейдж темпа справа целиком. Сам грузит сводку; при стрике < 1, ошибке или
// пока грузится — не рендерит ничего.

import { useEffect, useState } from 'react';
import { Flame } from 'lucide-react';
import { TEMPO_MIN_STREAK } from '@/lib/gamification';
import { plural } from '@/lib/plural';
import TempoBadgeButton from '@/components/TempoBadgeButton';

const StreakChip = () => {
  const [streak, setStreak] = useState(0);

  useEffect(() => {
    let cancelled = false;
    fetch('/api/gamification/summary')
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (!cancelled && typeof d?.streak === 'number') setStreak(d.streak);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  if (streak < 1) return null;

  const active = streak >= TEMPO_MIN_STREAK;

  return (
    <section className="px-4" style={{ paddingTop: 12 }}>
      <div
        className="flex items-center gap-3 rounded-2xl px-4 py-3"
        style={{ background: '#101530', border: '1px solid rgba(255,255,255,0.06)' }}
      >
        <Flame size={20} className="text-[#FF8C4A] shrink-0" fill="currentColor" aria-hidden />
        <span className="text-white text-sm font-medium font-overpass flex-1 min-w-0 truncate">
          Серия: {streak} {plural(streak, ['день', 'дня', 'дней'])}
        </span>
        <TempoBadgeButton streak={streak} tempoActive={active} />
      </div>
    </section>
  );
};

export default StreakChip;
