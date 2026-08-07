'use client';

// Переиспользуемое «кольцо потенциала»: 5 характеристик + общий потенциал
// (визуал — PotentialSection, pure CSS/SVG). Добавляет поверх него
// paywall-поведение из /profile: при grayed блок серый/размытый и цифры
// скрыты («Для FREE/paywalled потенциал серый и цифры скрыты»).
// Используется в /profile (grayed = paywalled) и в родительском кабинете
// /parent (grayed = false — родитель видит всё).

import PotentialSection from '@/components/PotentialSection';

export interface PotentialRingRatings {
  power?: number | null;
  speed?: number | null;
  endurance?: number | null;
  technique?: number | null;
  flexibility?: number | null;
}

export interface PotentialRingProps {
  ratings: PotentialRingRatings;
  potential?: number | null;
  /** Серый/размытый режим для FREE/paywalled (как в /profile) */
  grayed?: boolean;
  /** Недавний прирост характеристик — зелёные «+0.4» над цифрами */
  gains?: {
    endurance?: number;
    technique?: number;
    power?: number;
    speed?: number;
    flexibility?: number;
  };
}

export default function PotentialRing({
  ratings,
  potential,
  grayed = false,
  gains,
}: PotentialRingProps) {
  return (
    <div
      style={
        grayed
          ? { filter: 'grayscale(1) blur(6px)', opacity: 0.5, pointerEvents: 'none', userSelect: 'none' }
          : undefined
      }
      aria-hidden={grayed}
    >
      <PotentialSection
        ratingEndurance={ratings.endurance ?? undefined}
        ratingTechnique={ratings.technique ?? undefined}
        ratingPower={ratings.power ?? undefined}
        ratingSpeed={ratings.speed ?? undefined}
        ratingFlexibility={ratings.flexibility ?? undefined}
        potential={potential ?? undefined}
        gains={gains}
      />
    </div>
  );
}
