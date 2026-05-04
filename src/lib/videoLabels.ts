// Единые лейблы и порядок для всех мест отображения видео-фильтров и чипов
// Используется на странице /video, в карточках и в модалке фильтров.

export const MODULE_TYPE_LABELS: Record<string, string> = {
  WARMUP: 'Разминка',
  FITNESS: 'ОФП',
  GENERAL_PHYSICAL_PREP: 'ОФП',
  TECHNIQUE: 'Техника',
  COOLDOWN: 'Заминка',
  STRENGTH: 'Силовой',
  CARDIO: 'Кардио',
  STRETCHING: 'Растяжка',
};

export const LOAD_TYPE_LABELS: Record<string, string> = {
  SPEED: 'Скорость',
  POWER: 'Мощность',
  MAX_STRENGTH: 'Макс. сила',
  STRENGTH_ENDURANCE: 'Силовая выносливость',
  ANAEROBIC_ENDURANCE: 'Анаэробная выносливость',
  AEROBIC_ENDURANCE: 'Аэробная выносливость',
  AGILITY: 'Ловкость',
  MOBILITY: 'Мобильность',
  STATIC_STRETCH: 'Стат. растяжка',
  DYNAMIC_STRETCH: 'Дин. растяжка',
  PREHAB: 'Преабилитация',
  TECHNICAL_SKILL: 'Техника',
  HYPERTROPHY: 'Гипертрофия',
  FLEXIBILITY: 'Гибкость',
  RECOVERY: 'Восстановление',
};

export const MUSCLE_GROUP_LABELS: Record<string, string> = {
  LOWER_BODY: 'Низ тела',
  UPPER_PULL: 'Верх — тяга',
  UPPER_PUSH: 'Верх — жим',
  CORE_STABILITY: 'Кор (стабилизация)',
  CORE_DYNAMICS: 'Кор (динамика)',
  PREHAB_SHOULDER: 'Плечи (преаб)',
  PREHAB_KNEE: 'Колени (преаб)',
  PREHAB_BACK: 'Спина (преаб)',
  FULL_BODY: 'Всё тело',
  LEGS: 'Ноги',
  BACK: 'Спина',
  CHEST: 'Грудь',
  SHOULDERS: 'Плечи',
  ARMS: 'Руки',
  CORE: 'Кор',
  GLUTES: 'Ягодицы',
  CARDIO: 'Кардио',
};

export const DIFFICULTY_LABELS: Record<string, string> = {
  BEGINNER: 'Начинающий',
  AMATEUR: 'Любитель',
  INTERMEDIATE: 'Средний',
  ADVANCED: 'Продвинутый',
  PRO: 'Про',
};

// Длительность — корзины для фильтра
export type DurationBucketId = 'short' | 'medium' | 'long' | 'xlong';

export const DURATION_BUCKETS: { id: DurationBucketId; label: string; min: number; max: number }[] = [
  { id: 'short', label: 'До 10 мин', min: 0, max: 10 * 60 },
  { id: 'medium', label: '10–20 мин', min: 10 * 60, max: 20 * 60 },
  { id: 'long', label: '20–40 мин', min: 20 * 60, max: 40 * 60 },
  { id: 'xlong', label: 'Более 40 мин', min: 40 * 60, max: Number.POSITIVE_INFINITY },
];

export function matchesDuration(seconds: number, bucketIds: DurationBucketId[]): boolean {
  if (bucketIds.length === 0) return true;
  return bucketIds.some((id) => {
    const b = DURATION_BUCKETS.find((x) => x.id === id);
    if (!b) return false;
    return seconds >= b.min && seconds < b.max;
  });
}
