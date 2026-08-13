// Единый источник lucide-иконок тренировочной части: цели, состояния энергии,
// дни микроцикла и характеристики. Аналог src/components/gamification/icons.tsx.
//
// ПОЧЕМУ ОТДЕЛЬНЫЙ МОДУЛЬ. Раньше эмодзи жили прямо в данных: `GOAL_LABELS`
// и `ENERGY_STATE_LABELS` (@/lib/training-algorithm-v3) несут поле `emoji`, и
// каждый экран рендерил его строкой. Эмодзи по-разному выглядят на iOS/Android,
// не тинтуются и выпадают из иконочной системы. Поля `emoji` в либах ОСТАЮТСЯ —
// они нужны пушам и письмам, где компонент не отрендерить; UI берёт иконку
// отсюда по стабильному КЛЮЧУ.
//
// Размеры — по стандарту (см. /admin/ui-kit): 16 inline в тексте, 20 в строках
// и карточках, 24 — заголовки/крупные плитки.

import React from 'react';
import {
  Crosshair, Footprints, Dumbbell, Hand, HeartPulse, Wind, ShieldCheck,
  BatteryFull, Zap, Moon, PersonStanding, Target, Move, Award,
  type LucideIcon,
} from 'lucide-react';

/* ─── Цели тренировки (ключи из TrainingGoal / GOAL_LABELS) ──────────────── */
export const GOAL_ICONS: Record<string, LucideIcon> = {
  POWERFUL_SHOT: Crosshair,          // 🎯 Мощный бросок
  OUTRUN_OPPONENT: Footprints,       // 🦵 Убегаем от соперника
  STRENGTH_STABILITY: Dumbbell,      // 💪 Силовая борьба и устойчивость
  SOFT_HANDS: Hand,                  // 🏒 Мягкие ручки
  FULL_GAME_ENDURANCE: HeartPulse,   // 🫁 Выносливость на всю игру
  AGILITY: Wind,                     // ⚡ Маневренность
  SPORT_LONGEVITY: ShieldCheck,      // 🏥 Спортивное долголетие
};

/* ─── Состояние энергии (EnergyState) и дни микроцикла (MicrocycleIntent) ── */
export const ENERGY_ICONS: Record<string, LucideIcon> = {
  FULLY_CHARGED: BatteryFull,        // 🔋 Заряжен
  CHARGED: BatteryFull,              // 🔋 день микроцикла «заряжен»
  IN_TONE: Zap,                      // ⚡ В тонусе
  TIRED: Moon,                       // 😴 Устал
  WARMUP: Footprints,                // 🏃 Разминка/зарядка
  STRETCH: PersonStanding,           // 🧘 Растяжка
};

/* ─── Характеристики профиля ─────────────────────────────────────────────── */
export const CHARACTERISTIC_ICONS: Record<string, LucideIcon> = {
  ratingPower: Dumbbell,             // 💪 Сила
  ratingSpeed: Zap,                  // ⚡ Скорость
  ratingEndurance: HeartPulse,       // 🫀 Выносливость
  ratingTechnique: Target,           // 🎯 Техника
  ratingFlexibility: Move,           // 🤸 Гибкость
};

interface IconProps {
  size?: number;
  className?: string;
  color?: string;
}

/** Иконка цели тренировки по ключу; неизвестный ключ → безопасный fallback. */
export function GoalIcon({ goal, size = 20, className, color }: IconProps & { goal: string }) {
  const Icon = GOAL_ICONS[goal] ?? Award;
  return <Icon size={size} className={className} color={color} aria-hidden />;
}

/** Иконка состояния энергии / дня микроцикла. */
export function EnergyIcon({ state, size = 20, className, color }: IconProps & { state: string }) {
  const Icon = ENERGY_ICONS[state] ?? Zap;
  return <Icon size={size} className={className} color={color} aria-hidden />;
}

/** Иконка характеристики (ratingPower, ratingSpeed, …). */
export function CharacteristicIcon({
  characteristic,
  size = 16,
  className,
  color,
}: IconProps & { characteristic: string }) {
  const Icon = CHARACTERISTIC_ICONS[characteristic] ?? Target;
  return <Icon size={size} className={className} color={color} aria-hidden />;
}
