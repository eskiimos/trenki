// Редкость наград — чем труднее достать, тем выше вес.
//
// Нужна для витрины в шапке профиля (правка владельца): показываем до 5 значков,
// а когда наград больше — оставляем САМЫЕ СЛОЖНЫЕ, а не первые попавшиеся.
//
// Вес статический, а не «у скольких игроков есть»: динамическая редкость
// потребовала бы считать по всей базе на каждый показ профиля, а на старте
// аудитории она к тому же врёт (у 100 игроков любая награда «редкая»).
// Шкала грубо соответствует времени, которое нужно вложить.
//
// Чистая логика — тестируется без БД (tests/lib/award-rarity.test.ts).

const RARITY: Record<string, number> = {
  // Группа «Ачивки» (серии, вехи, поведение)
  workouts_1: 1, // первая тренировка — стартовая, почти у всех
  streak_3: 10,
  early_bird: 12,
  weekend_warrior: 14,
  streak_5: 20,
  workouts_30: 30,
  workouts_67: 67, // эпическая
  streak_7: 35,
  streak_14: 70,
  workouts_100: 100, // месяцы регулярных тренировок
};

/** Вторая ступень древа (10 тренировок с целью) заметно дороже первой (5). */
const SKILL_EVO1 = 25;
const SKILL_EVO2 = 50;

/**
 * Вес награды по ключу. Древо навыков распознаём по суффиксу — так новые ветки
 * не придётся дописывать в таблицу. Неизвестный ключ → 0 (уйдёт в конец, но не
 * сломает сортировку).
 */
export function awardRarity(key: string): number {
  if (key in RARITY) return RARITY[key]!;
  if (key.endsWith('_evo2')) return SKILL_EVO2;
  if (key.endsWith('_evo1')) return SKILL_EVO1;
  return 0;
}

export interface AwardLike {
  key: string;
  title: string;
  unlocked: boolean;
}

/**
 * До `limit` полученных наград для витрины: самые сложные первыми.
 * Меньше лимита — отдаём сколько есть. Ключ — вторичный критерий сортировки,
 * чтобы порядок не «дышал» между рендерами при равных весах.
 *
 * pinnedKey — награда, закреплённая пользователем: она всегда первая, даже
 * если по сложности не входит в топ (это осознанный выбор витрины, и он
 * важнее автоматики).
 */
export function pickTopAwards<T extends AwardLike>(
  awards: T[],
  limit = 5,
  pinnedKey?: string | null,
): T[] {
  const unlocked = awards.filter((a) => a.unlocked);
  const byRarity = [...unlocked].sort(
    (a, b) => awardRarity(b.key) - awardRarity(a.key) || a.key.localeCompare(b.key),
  );
  const pinned = pinnedKey ? byRarity.find((a) => a.key === pinnedKey) : undefined;
  if (!pinned) return byRarity.slice(0, limit);
  return [pinned, ...byRarity.filter((a) => a.key !== pinned.key)].slice(0, limit);
}
