'use client';

import React from 'react';
import { TEMPO_MIN_STREAK, TEMPO_MULTIPLIER } from '@/lib/gamification';

// Бейдж «Темп ×2» — всегда виден (решение босса: правило множителя должно
// бросаться в глаза). Два состояния:
//  - активен (серия ≥ 3): лаймовый «🔥 Темп ×2»;
//  - тизер: янтарный «🔥 До ×2: N дн.» — живой отсчёт до множителя.
const TempoBadge = ({ streak, tempoActive }: { streak: number; tempoActive: boolean }) => {
  if (tempoActive) {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-brand/15 border border-brand/40 text-brand text-[11px] font-bold font-overpass px-2 py-0.5 whitespace-nowrap">
        <span aria-hidden>🔥</span>
        Темп ×{TEMPO_MULTIPLIER}
      </span>
    );
  }
  const daysLeft = Math.max(1, TEMPO_MIN_STREAK - Math.max(0, streak));
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-[#FF8C4A]/15 border border-[#FF8C4A]/40 text-[#FF8C4A] text-[11px] font-bold font-overpass px-2 py-0.5 whitespace-nowrap">
      <span aria-hidden>🔥</span>
      До ×{TEMPO_MULTIPLIER}: {daysLeft} дн.
    </span>
  );
};

export default TempoBadge;
