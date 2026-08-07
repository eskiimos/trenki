'use client';

// Компактная плашка стрика на главной: «🔥 Серия: N дн. подряд».
// Сам грузит сводку геймификации; при стрике < 2, ошибке или пока грузится —
// не рендерит ничего (плашка мотивирует беречь серию, а серия из 1 дня — ещё
// не серия). При серии ≥ 3 активен «Темп ×2» — говорим об этом вместо
// абстрактного «не потеряй».

import { useEffect, useState } from 'react';
import { TEMPO_MIN_STREAK } from '@/lib/gamification';

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

  // Показываем уже с 1 дня — как тизер множителя: «ещё N дн. — и опыт ×2»
  if (streak < 1) return null;

  return (
    <section className="px-4" style={{ paddingTop: 12 }}>
      <div className="bg-surface rounded-2xl px-4 py-3 flex items-center gap-3">
        <span className="text-xl" aria-hidden>🔥</span>
        <span className="text-white text-sm font-medium">
          {streak >= TEMPO_MIN_STREAK
            ? `Серия: ${streak} дн. подряд — опыт ×2!`
            : `Серия: ${streak} дн. Ещё ${TEMPO_MIN_STREAK - streak} — и опыт ×2!`}
        </span>
      </div>
    </section>
  );
};

export default StreakChip;
