// Единый источник lucide-иконок геймификации (статусы, ачивки, аватары лиги).
// Чистые либы (@/lib/gamification, @/lib/achievements, @/lib/league) хранят
// только emoji-поля (нужны push/email-дайджестам — там компонент не отрендерить)
// и СТАБИЛЬНЫЕ строковые КЛЮЧИ; сам UI-рендер эмодзи заменён здесь на иконки.
// Все консьюмеры — клиентские, но модуль без хуков и годится и для server.

import {
  Snowflake, Sparkles, Shield, Trophy, Star, Crown, Award,
  Zap, Target, Flame, Rocket, Swords, Medal,
  Crosshair, Bomb, Dog, Axe, Wand2, Drama, HeartPulse, Footprints,
  Cat, Wind, ShieldCheck, Bot,
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

// ── «Древо навыков»: 14 ключей из ACHIEVEMENT_DEFS (@/lib/achievements) ───────
// По каждой из 7 целей — evo1 и evo2 (эволюция 2 — «сильнее»).
export const ACHIEVEMENT_ICONS: Record<string, LucideIcon> = {
  outrun_evo1: Rocket,      // Ракета на льду
  outrun_evo2: Zap,         // Молния
  shot_evo1: Crosshair,     // Насквозь
  shot_evo2: Bomb,          // Пушка страшная
  strength_evo1: Dog,       // Питбуль
  strength_evo2: Axe,       // Викинг
  hands_evo1: Wand2,        // Финтёр
  hands_evo2: Drama,        // Фокусник
  endurance_evo1: HeartPulse, // Неутомимый
  endurance_evo2: Footprints, // Марафонец
  agility_evo1: Cat,        // Гепард
  agility_evo2: Wind,       // Вихрь
  longevity_evo1: ShieldCheck, // Под защитой
  longevity_evo2: Bot,      // Терминатор
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
