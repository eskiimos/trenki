'use client';

// Компактная плашка стрика на главной: «🔥 Серия: N дн. подряд».
// Сам грузит сводку геймификации; при стрике < 1, ошибке или пока грузится —
// не рендерит ничего. При серии ≥ 3 активен «Ударный темп ×2» — говорим об
// этом прямо, вместо абстрактного «не потеряй».

import { useEffect, useState } from 'react';
import { Flame } from 'lucide-react';
import { TEMPO_MIN_STREAK } from '@/lib/gamification';
import TempoBadge from '@/components/TempoBadge';

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

  // Показываем уже с 1 дня — как тизер множителя: «ещё N дн. — и ударный темп ×2»
  if (streak < 1) return null;

  return (
    <section className="px-4" style={{ paddingTop: 12 }}>
      <div className="bg-surface rounded-2xl px-4 py-3 flex items-center gap-3">
        <Flame size={20} className="text-[#FF8C4A] shrink-0" fill="currentColor" aria-hidden />
        <span className="text-white text-sm font-medium flex-1 min-w-0">
          {streak >= TEMPO_MIN_STREAK
            ? `Ударный темп! Серия ${streak} дн.`
            : `Серия: ${streak} дн. подряд`}
        </span>
        {/* Бейдж темпа: активный ×2 или отсчёт — правило всегда на виду */}
        <TempoBadge streak={streak} tempoActive={streak >= TEMPO_MIN_STREAK} />
      </div>
    </section>
  );
};

export default StreakChip;
