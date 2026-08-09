'use client';

import React from 'react';
import { Flame } from 'lucide-react';
import { TEMPO_MIN_STREAK, TEMPO_MULTIPLIER } from '@/lib/gamification';

// Бейдж «Ударный темп» — всегда виден (решение босса: правило множителя должно
// бросаться в глаза). Два состояния:
//  - активен (серия ≥ 3): лаймовый «Ударный темп ×2»;
//  - тизер: янтарный «До ударного темпа: N дн.» — живой отсчёт до множителя.
// Иконка lucide Flame вместо эмодзи: эмодзи ломали выравнивание строки
// (свой line-height) и бейдж выглядел скомканным.
const TempoBadge = ({ streak, tempoActive }: { streak: number; tempoActive: boolean }) => {
  const base =
    'inline-flex items-center gap-1.5 rounded-full text-[11px] font-bold font-overpass leading-none px-2.5 py-1.5 whitespace-nowrap';
  if (tempoActive) {
    return (
      <span className={`${base} bg-brand/15 border border-brand/40 text-brand`}>
        <Flame size={12} fill="currentColor" aria-hidden />
        <span>Ударный темп ×{TEMPO_MULTIPLIER}</span>
      </span>
    );
  }
  const daysLeft = Math.max(1, TEMPO_MIN_STREAK - Math.max(0, streak));
  return (
    <span className={`${base} bg-[#FF8C4A]/15 border border-[#FF8C4A]/40 text-[#FF8C4A]`}>
      <Flame size={12} aria-hidden />
      <span>До ударного темпа: {daysLeft} дн.</span>
    </span>
  );
};

export default TempoBadge;
