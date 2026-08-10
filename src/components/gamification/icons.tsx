// Единый источник lucide-иконок геймификации (статусы, ачивки, аватары лиги).
// Чистые либы (@/lib/gamification, @/lib/achievements, @/lib/league) хранят
// только emoji-поля (нужны push/email-дайджестам — там компонент не отрендерить)
// и СТАБИЛЬНЫЕ строковые КЛЮЧИ; сам UI-рендер эмодзи заменён здесь на иконки.
// Все консьюмеры — клиентские, но модуль без хуков и годится и для server.

import {
  Snowflake, Sparkles, Shield, Trophy, Star, Crown, Award,
  Hand, Music, BicepsFlexed, Gem, Zap, Target, Puzzle, Dumbbell,
  Flame, Grab, CalendarDays, Rocket, Sunrise, Swords, Medal,
  type LucideIcon,
} from 'lucide-react';

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

// ── Ачивки (все 16 ключей из ACHIEVEMENT_DEFS в @/lib/achievements) ──────────
export const ACHIEVEMENT_ICONS: Record<string, LucideIcon> = {
  workouts_1: Snowflake,
  workouts_5: Hand,
  workouts_15: Music,
  workouts_30: BicepsFlexed,
  workouts_60: Shield,
  workouts_100: Gem,
  modules_10: Zap,
  modules_50: Target,
  modules_150: Puzzle,
  modules_300: Dumbbell,
  streak_3: Flame,
  streak_5: Grab,
  streak_7: CalendarDays,
  streak_14: Rocket,
  early_bird: Sunrise,
  weekend_warrior: Swords,
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
