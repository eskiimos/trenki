'use client';

import { useEffect, useState } from 'react';
import { Dumbbell, Gauge, HeartPulse, Target, PersonStanding, Zap, Star, PartyPopper, type LucideIcon } from 'lucide-react';
import { Button } from '@/components/ui';

interface CharacteristicsGainModalProps {
  gains: {
    ratingPower?: number;
    ratingSpeed?: number;
    ratingEndurance?: number;
    ratingTechnique?: number;
    ratingFlexibility?: number;
  };
  newCharacteristics: {
    ratingPower: number;
    ratingSpeed: number;
    ratingEndurance: number;
    ratingTechnique: number;
    ratingFlexibility: number;
    potential: number;
  };
  /** Заработанный за это действие XP (0 → строка XP не показывается) */
  xpEarned?: number;
  /** Множитель темпа, применённый к XP (2 при активном «Ударном темпе») */
  tempoMultiplier?: number;
  onClose: () => void;
}

type CharacteristicKey = 'ratingPower' | 'ratingSpeed' | 'ratingEndurance' | 'ratingTechnique' | 'ratingFlexibility';

interface CharacteristicItem {
  key: CharacteristicKey;
  Icon: LucideIcon;
  label: string;
  color: string; // акцент характеристики (иконка + прогресс)
}

// Эмодзи заменены на lucide-иконки (решение босса). Цвет — акцент характеристики.
const characteristics: CharacteristicItem[] = [
  { key: 'ratingPower', Icon: Dumbbell, label: 'Сила', color: '#FF6B6B' },
  { key: 'ratingSpeed', Icon: Gauge, label: 'Скорость', color: '#FFCC4A' },
  { key: 'ratingEndurance', Icon: HeartPulse, label: 'Выносливость', color: '#A1FF4A' },
  { key: 'ratingTechnique', Icon: Target, label: 'Техника', color: '#4ECDC4' },
  { key: 'ratingFlexibility', Icon: PersonStanding, label: 'Гибкость', color: '#B98BFF' },
];

export default function CharacteristicsGainModal({
  gains,
  newCharacteristics,
  xpEarned = 0,
  tempoMultiplier = 1,
  onClose,
}: CharacteristicsGainModalProps) {
  const [animateIn, setAnimateIn] = useState(false);
  const [showGains, setShowGains] = useState(false);

  useEffect(() => {
    const t1 = setTimeout(() => setAnimateIn(true), 50);
    const t2 = setTimeout(() => setShowGains(true), 400);
    return () => { clearTimeout(t1); clearTimeout(t2); };
  }, []);

  // Только выросшие характеристики
  const gainedCharacteristics = characteristics.filter(
    (char) => gains[char.key] && gains[char.key]! > 0,
  );

  if (gainedCharacteristics.length === 0) {
    return null;
  }

  return (
    <div
      className={`fixed inset-0 z-50 flex items-center justify-center p-4 transition-all duration-300 ${
        animateIn ? 'bg-black/80 backdrop-blur-sm' : 'bg-black/0'
      }`}
      onClick={onClose}
      role="dialog"
      aria-modal="true"
    >
      <div
        className={`w-full max-w-md rounded-3xl p-6 shadow-2xl transition-all duration-500 ${
          animateIn ? 'scale-100 opacity-100' : 'scale-90 opacity-0'
        }`}
        style={{ background: '#101530', border: '1px solid rgba(255,255,255,0.08)' }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Заголовок */}
        <div className="text-center mb-6">
          <div className="w-16 h-16 mx-auto mb-3 rounded-full flex items-center justify-center bg-brand/15">
            <PartyPopper size={30} className="text-brand" />
          </div>
          <h2 className="text-white text-xl font-bold font-overpass mb-1">Отличная работа!</h2>
          <p className="text-muted text-sm font-overpass">Ты прокачал свои характеристики</p>
        </div>

        {/* Список приростов */}
        <div className="flex flex-col gap-2.5 mb-4">
          {gainedCharacteristics.map((char) => {
            const gain = gains[char.key]!;
            const newValue = newCharacteristics[char.key];
            const oldValue = newValue - gain;
            const { Icon } = char;

            return (
              <div
                key={char.key}
                className="rounded-2xl p-3.5 transition-all duration-500"
                style={{
                  background: 'rgba(255,255,255,0.04)',
                  border: '1px solid rgba(255,255,255,0.06)',
                  transform: showGains ? 'translateX(0)' : 'translateX(-16px)',
                  opacity: showGains ? 1 : 0,
                }}
              >
                <div className="flex items-center justify-between mb-2.5">
                  <div className="flex items-center gap-2.5">
                    <div
                      className="w-9 h-9 rounded-full flex items-center justify-center shrink-0"
                      style={{ background: `${char.color}22` }}
                    >
                      <Icon size={18} style={{ color: char.color }} />
                    </div>
                    <span className="text-white text-sm font-semibold font-overpass">{char.label}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-muted text-sm font-overpass tabular-nums">{oldValue.toFixed(1)}</span>
                    <span className="text-brand text-sm font-bold font-overpass tabular-nums">+{gain.toFixed(1)}</span>
                    <span className="text-white text-base font-bold font-overpass tabular-nums">{newValue.toFixed(1)}</span>
                  </div>
                </div>

                {/* Прогресс-бар: акцент характеристики */}
                <div className="h-2 bg-black/30 rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all duration-1000 ease-out"
                    style={{
                      width: showGains ? `${Math.min(100, newValue)}%` : `${Math.min(100, oldValue)}%`,
                      backgroundColor: char.color,
                    }}
                  />
                </div>
              </div>
            );
          })}
        </div>

        {/* Заработанный XP — показываем только если реально начислен */}
        {xpEarned > 0 && (
          <div
            className="rounded-2xl p-4 mb-3 flex items-center justify-between"
            style={{ background: 'rgba(161,255,74,0.12)', border: '1px solid rgba(161,255,74,0.4)' }}
          >
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-full flex items-center justify-center bg-brand/20 shrink-0">
                <Star size={18} className="text-brand" fill="currentColor" />
              </div>
              <span className="text-white text-base font-semibold font-overpass">Опыт</span>
            </div>
            <div className="flex items-center gap-2">
              {tempoMultiplier > 1 && (
                <span className="text-[#FF8C4A] text-[11px] font-bold font-overpass rounded-full px-2 py-0.5 border border-[#FF8C4A]/40">
                  ×{tempoMultiplier}
                </span>
              )}
              <span className="text-brand text-2xl font-black font-overpass tabular-nums">
                +{xpEarned}
              </span>
              <span className="text-brand text-sm font-bold font-overpass">XP</span>
            </div>
          </div>
        )}

        {/* Новый потенциал */}
        <div
          className="rounded-2xl p-4 mb-6 flex items-center justify-between"
          style={{
            background: 'linear-gradient(135deg, rgba(68,92,255,0.28) 0%, rgba(123,97,255,0.28) 100%)',
            border: '1px solid rgba(68,92,255,0.5)',
          }}
        >
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-full flex items-center justify-center bg-white/10 shrink-0">
              <Zap size={18} className="text-white" fill="currentColor" />
            </div>
            <span className="text-white text-base font-semibold font-overpass">Потенциал</span>
          </div>
          <span className="text-white text-2xl font-black font-overpass tabular-nums">
            {newCharacteristics.potential.toFixed(1)}
          </span>
        </div>

        <Button variant="primary" fullWidth onClick={onClose}>
          Продолжить
        </Button>
      </div>
    </div>
  );
}
