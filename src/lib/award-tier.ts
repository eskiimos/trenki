// Тиры наград — цвет значка (правка владельца «Начало сентября»: «сделать их
// крутыми, чтоб хотелось выставить в шапку»):
//   · ачивки (серии, вехи, поведение) — серые;
//   · достижения древа, эволюция 1 — серебро;
//   · достижения древа, эволюция 2 — золото;
//   · «67» (67 тренировок) — фиолетовая «эпическая».
// Тир выводится из ключа, как и редкость (award-rarity), — новые ветки древа
// подхватываются по суффиксу без правок здесь. Чистая логика, без React.

export type AwardTier = 'common' | 'silver' | 'gold' | 'epic';

/** Сколько наград помещается в шапке профиля. */
export const SHOWCASE_SLOTS = 5;

const EPIC_KEYS: ReadonlySet<string> = new Set(['workouts_67']);

export function awardTier(key: string): AwardTier {
  if (EPIC_KEYS.has(key)) return 'epic';
  if (key.endsWith('_evo2')) return 'gold';
  if (key.endsWith('_evo1')) return 'silver';
  return 'common';
}

export const TIER_LABEL: Record<AwardTier, string> = {
  common: 'Ачивка',
  silver: 'Серебро',
  gold: 'Золото',
  epic: 'Эпическая',
};

export interface TierStyle {
  /** Фон значка — «металл» градиентом */
  background: string;
  border: string;
  /** Цвет иконки поверх фона */
  color: string;
  /** Лёгкое свечение — у золота и эпической */
  shadow: string;
}

export const TIER_STYLE: Record<AwardTier, TierStyle> = {
  common: {
    background: 'linear-gradient(135deg, #9A9AAE 0%, #6B6B7E 55%, #4E4E60 100%)',
    border: '#B4B4C6',
    color: '#F9F8FE',
    shadow: 'none',
  },
  silver: {
    background: 'linear-gradient(135deg, #F6F6FA 0%, #C3C5D2 45%, #8F92A4 100%)',
    border: '#E4E5EE',
    color: '#2A2D3E',
    shadow: '0 0 0 1px rgba(255,255,255,0.08)',
  },
  gold: {
    background: 'linear-gradient(135deg, #FFF0A8 0%, #F2B62B 50%, #B8790A 100%)',
    border: '#FFD966',
    color: '#3A2600',
    shadow: '0 0 10px rgba(242,182,43,0.35)',
  },
  epic: {
    background: 'linear-gradient(135deg, #E0C3FF 0%, #A855F7 50%, #6D28D9 100%)',
    border: '#C084FC',
    color: '#FFFFFF',
    shadow: '0 0 12px rgba(168,85,247,0.45)',
  },
};
