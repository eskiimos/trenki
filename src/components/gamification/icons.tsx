// Единый источник lucide-иконок геймификации (статусы, ачивки, аватары лиги).
// Чистые либы (@/lib/gamification, @/lib/achievements, @/lib/league) хранят
// только emoji-поля (нужны push/email-дайджестам — там компонент не отрендерить)
// и СТАБИЛЬНЫЕ строковые КЛЮЧИ; сам UI-рендер эмодзи заменён здесь на иконки.
// Все консьюмеры — клиентские, но модуль без хуков и годится и для server.

import {
  Snowflake, Sparkles, Shield, Trophy, Star, Crown, Award,
  Zap, Target, Flame, Rocket, Swords, Medal,
  Crosshair, Bomb, Axe, Wand2, Drama, HeartPulse, Footprints,
  Cat, Wind, ShieldCheck, Bot,
  Dumbbell, Hand, CalendarCheck, Sunrise, Gem,
  type LucideIcon,
} from 'lucide-react';
import type { SVGProps } from 'react';

// Кастомная иконка «Питбуль с зубами» (ачивка strength_evo1). В lucide нет
// клыкастой собаки, поэтому рисуем сами: оскал с рядом зубов + клыки + злые
// глаза. Монохром, currentColor — тинтуется в лайм/серый как остальные иконки.
// Сигнатура совместима с тем, как AchievementIcon вызывает иконку (size,
// className, aria-hidden), поэтому кладём её в ту же мапу через каст.
function PitbullTeethIcon({ size = 20, ...props }: SVGProps<SVGSVGElement> & { size?: number | string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.7}
      strokeLinecap="round"
      strokeLinejoin="round"
      {...props}
    >
      {/* Купированные уши */}
      <path d="M9 5 L6 2.4 L9.6 4.6" />
      <path d="M15 5 L18 2.4 L14.4 4.6" />
      {/* Голова: лоб между ушами, скулы вниз к пасти (плоская верхняя губа y≈13.8) */}
      <path d="M9 4.8 C6.1 5.6 5 8.2 5.4 10.9 C5.7 12.9 6.8 14.4 8.2 15.4 L8.2 13.8 L15.8 13.8 L15.8 15.4 C17.2 14.4 18.3 12.9 18.6 10.9 C19 8.2 17.9 5.6 15 4.8 Z" />
      {/* Злые глаза (скошенные штрихи) */}
      <path d="M8.5 9.2 L10.6 10.1" />
      <path d="M15.5 9.2 L13.4 10.1" />
      {/* Нос */}
      <path d="M12 10.6 L11 11.9 L13 11.9 Z" fill="currentColor" stroke="none" />
      {/* Оскал: ряд зубов зигзагом по нижней губе */}
      <path d="M8.4 13.8 L9.2 15.7 L10 13.8 L10.8 15.7 L11.6 13.8 L12.4 15.7 L13.2 13.8 L14 15.7 L14.8 13.8 L15.6 15.7" />
    </svg>
  );
}

// ── Статусы-«эволюции» (ключи из STATUSES в @/lib/gamification) ──────────────
// rookie 🏒→Snowflake (первый лёд), prospect ⛸️→Sparkles, junior 🥅→Shield,
// pro 🏆→Trophy, allstar ⭐→Star, legend 👑→Crown.
export const STATUS_ICONS: Record<string, LucideIcon> = {
  rookie: Snowflake,
  prospect: Sparkles,
  junior: Shield,
  pro: Trophy,
  allstar: Star,
  legend: Crown,
};

// ── «Древо навыков»: 14 ключей из ACHIEVEMENT_DEFS (@/lib/achievements) ───────
// По каждой из 7 целей — evo1 и evo2 (эволюция 2 — «сильнее»).
export const ACHIEVEMENT_ICONS: Record<string, LucideIcon> = {
  outrun_evo1: Rocket,      // Ракета на льду
  outrun_evo2: Zap,         // Молния
  shot_evo1: Crosshair,     // Насквозь
  shot_evo2: Bomb,          // Пушка страшная
  strength_evo1: PitbullTeethIcon as unknown as LucideIcon, // Питбуль с зубами (кастомная)
  strength_evo2: Axe,       // Викинг
  hands_evo1: Wand2,        // Финтёр
  hands_evo2: Drama,        // Фокусник
  endurance_evo1: HeartPulse, // Неутомимый
  endurance_evo2: Footprints, // Марафонец
  agility_evo1: Cat,        // Гепард
  agility_evo2: Wind,       // Вихрь
  longevity_evo1: ShieldCheck, // Под защитой
  longevity_evo2: Bot,      // Терминатор

  // Группа «Ачивки» (поведенческие: серии, вехи объёма, время суток).
  // Правило проекта: в UI атлета иконки, не эмодзи.
  workouts_1: Snowflake,    // Первый лёд
  workouts_30: Dumbbell,    // Тридцатка
  workouts_67: Gem,         // «67» — эпическая
  workouts_100: Trophy,     // Сотня
  streak_3: Flame,          // Ударный темп
  streak_5: Hand,           // Пять подряд
  streak_7: CalendarCheck,  // Неделя огня
  streak_14: Rocket,        // Две недели подряд
  early_bird: Sunrise,      // Ранняя пташка
  weekend_warrior: Swords,  // Воин выходных
};

// ── Аватары лиги ─────────────────────────────────────────────────────────────
// Ключи совпадают по индексу с NICK_ICON_KEYS в @/lib/league (детерминированный
// выбор от хэша userId). 'own' — свой ребёнок, всегда Star.
const LEAGUE_AVATAR_ICONS: Record<string, LucideIcon> = {
  flame: Flame,
  rocket: Rocket,
  zap: Zap,
  shield: Shield,
  target: Target,
  snowflake: Snowflake,
  swords: Swords,
  sparkles: Sparkles,
  trophy: Trophy,
  medal: Medal,
  own: Star,
};

/** Иконка аватара строки лиги по ключу; неизвестный ключ → безопасный fallback. */
export function leagueIconKeyToIcon(key: string): LucideIcon {
  return LEAGUE_AVATAR_ICONS[key] ?? Award;
}

interface IconProps {
  size?: number;
  className?: string;
}

/** Иконка статуса по ключу с безопасным fallback (Award), currentColor. */
export function StatusIcon({
  statusKey,
  size = 20,
  className,
}: IconProps & { statusKey: string }) {
  const Icon = STATUS_ICONS[statusKey] ?? Award;
  return <Icon size={size} className={className} aria-hidden />;
}

/** Иконка ачивки по ключу с безопасным fallback (Award), currentColor. */
export function AchievementIcon({
  achievementKey,
  size = 20,
  className,
}: IconProps & { achievementKey: string }) {
  const Icon = ACHIEVEMENT_ICONS[achievementKey] ?? Award;
  return <Icon size={size} className={className} aria-hidden />;
}
