// Фундамент монетизации: проверка премиум-доступа.
//
// Источник истины — поля User.accessTier / premiumUntil (миграция add_access_tier).
// Пока тариф выдаётся вручную из админки; когда подключим T-Bank, биллинг будет
// выставлять premiumUntil (или продлевать по крону). Гейтить премиум-фичи/лимиты
// нужно через hasPremium(), а не сверяя поля напрямую.

export interface AccessInput {
  accessTier: string; // 'FREE' | 'PREMIUM' (AccessTier)
  premiumUntil: Date | string | null;
}

/**
 * Есть ли у пользователя активный премиум-доступ.
 * PREMIUM И (без срока — бессрочно, ИЛИ срок ещё не истёк).
 * @param now передаётся для тестируемости (по умолчанию — текущий момент).
 */
export function hasPremium(user: AccessInput | null | undefined, now: Date = new Date()): boolean {
  if (!user || user.accessTier !== 'PREMIUM') return false;
  if (user.premiumUntil == null) return true; // бессрочный премиум
  const until = user.premiumUntil instanceof Date ? user.premiumUntil : new Date(user.premiumUntil);
  if (isNaN(until.getTime())) return false;
  return until.getTime() > now.getTime();
}
