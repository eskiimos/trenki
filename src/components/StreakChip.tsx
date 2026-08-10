'use client';

// Плашка стрика на главной. Использует общий <Banner> (grad-accent + лаймовая
// рамка, иконка/заголовок/подзаголовок/action) — как GuideBanner и прочие блоки
// главной, чтобы не выбиваться из стиля. Сам грузит сводку; при стрике < 1,
// ошибке или пока грузится — не рендерит ничего.

import { useEffect, useState } from 'react';
import { Flame } from 'lucide-react';
import { TEMPO_MIN_STREAK } from '@/lib/gamification';
import { Banner } from '@/components/ui';
import TempoBadge from '@/components/TempoBadge';

/** «1 день / 2 дня / 5 дней» */
function pluralDays(n: number): string {
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (mod10 === 1 && mod100 !== 11) return 'день';
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return 'дня';
  return 'дней';
}

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

  // Показываем уже с 1 дня — как тизер множителя
  if (streak < 1) return null;

  const active = streak >= TEMPO_MIN_STREAK;
  const left = TEMPO_MIN_STREAK - streak;

  return (
    <section className="px-4" style={{ paddingTop: 12 }}>
      <Banner
        icon={<Flame size={22} className="text-[#FF8C4A]" fill="currentColor" aria-hidden />}
        title={`Серия: ${streak} ${pluralDays(streak)} подряд`}
        subtitle={active ? 'Опыт за тренировки идёт ×2' : `Ещё ${left} ${pluralDays(left)} — и опыт ×2`}
        action={<TempoBadge streak={streak} tempoActive={active} />}
      />
    </section>
  );
};

export default StreakChip;
