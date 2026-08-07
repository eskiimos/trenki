'use client';

// Компактная плашка стрика на главной: «🔥 Серия: N дн. подряд».
// Сам грузит сводку геймификации; при стрике < 2, ошибке или пока грузится —
// не рендерит ничего (плашка мотивирует беречь серию, а серия из 1 дня — ещё
// не серия).

import { useEffect, useState } from 'react';

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

  if (streak < 2) return null;

  return (
    <section className="px-4" style={{ paddingTop: 12 }}>
      <div className="bg-surface rounded-2xl px-4 py-3 flex items-center gap-3">
        <span className="text-xl" aria-hidden>🔥</span>
        <span className="text-white text-sm font-medium">
          Серия: {streak} дн. подряд — не потеряй!
        </span>
      </div>
    </section>
  );
};

export default StreakChip;
