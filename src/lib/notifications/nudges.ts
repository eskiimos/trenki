// Вовлекающие пуши: онбординг-дрип (зарегистрировался, но ничего не попробовал)
// и нудж «гантели запылились» (без подписки и давно не тренировался).
// Чистая логика — решение «кому и что слать» тестируется без БД.

export interface NudgeText {
  title: string;
  body: string;
  url: string;
}

/** Шаги онбординг-дрипа: через сколько дней после регистрации и что писать. */
export const ONBOARDING_DRIP: Array<{ afterDays: number; text: NudgeText }> = [
  {
    afterDays: 1,
    text: {
      title: 'Начнём? Это займёт 15 минут ⚡️',
      body: 'ИИ-тренер уже собрал первую тренировку под тебя. Попробуй — просто нажми «начать».',
      url: '/training/assessment',
    },
  },
  {
    afterDays: 3,
    text: {
      title: 'Твой потенциал ждёт 📈',
      body: 'Пройди первую тренировку — и увидишь, как растут твои характеристики.',
      url: '/',
    },
  },
  {
    afterDays: 7,
    text: {
      title: 'Загляни на минутку 🏒',
      body: 'Короткие видео от тренеров-профи — бесплатно. Начни с них, если на тренировку пока нет времени.',
      url: '/shorts',
    },
  },
];

/** Нудж для тех, кто без подписки и давно не тренировался. */
export const DUSTY_NUDGE: NudgeText = {
  title: 'Гантели уже запылились! 🏋️',
  body: 'Пора как следует потренироваться. ИИ-тренер соберёт занятие под твоё состояние.',
  url: '/training/assessment',
};

export interface NudgeCandidate {
  createdAt: Date;
  /** Была ли хоть одна тренировка (вообще). */
  everTrained: boolean;
  /** Дней с последней активности/тренировки. null — никогда не тренировался. */
  daysSinceLastTraining: number | null;
  /** Активная подписка. */
  hasPremium: boolean;
  /** Шаг дрипа, который уже отправлен (0 — ничего). */
  nudgeStep: number;
  /** Дней с последнего нуджа «гантели запылились». null — ни разу не слали. */
  daysSinceLastDusty: number | null;
}

export interface NudgeDecision {
  kind: 'onboarding' | 'dusty';
  text: NudgeText;
  /** Новый nudgeStep для записи (для дрипа). */
  nextStep: number;
}

/** Через сколько дней «простоя» напоминаем тем, кто без подписки. */
export const DUSTY_AFTER_DAYS = 4; // из «раз в 3-5 дней» берём середину

/**
 * Что отправить пользователю сейчас (или ничего).
 * Приоритет у онбординг-дрипа: человек ещё ни разу не тренировался — его надо
 * довести до первой тренировки, а не корить «запылившимися гантелями».
 */
export function decideNudge(c: NudgeCandidate, now: Date): NudgeDecision | null {
  const ageDays = Math.floor((now.getTime() - c.createdAt.getTime()) / 86_400_000);

  // 1) Онбординг-дрип: ни одной тренировки за всё время.
  if (!c.everTrained) {
    // Берём самый поздний шаг, который уже «созрел» и ещё не отправлен.
    for (let i = ONBOARDING_DRIP.length - 1; i >= 0; i -= 1) {
      const step = i + 1;
      if (step > c.nudgeStep && ageDays >= ONBOARDING_DRIP[i]!.afterDays) {
        return { kind: 'onboarding', text: ONBOARDING_DRIP[i]!.text, nextStep: step };
      }
    }
    return null; // все шаги отправлены либо ещё рано
  }

  // 2) «Гантели запылились» — только без подписки и с реальным простоем.
  // Повторяем не чаще, чем раз в DUSTY_AFTER_DAYS: без этого условие «простой ≥ N»
  // истинно каждый следующий день и пуш уходил бы ежедневно и бесконечно.
  if (!c.hasPremium && c.daysSinceLastTraining !== null && c.daysSinceLastTraining >= DUSTY_AFTER_DAYS) {
    const cooledDown = c.daysSinceLastDusty === null || c.daysSinceLastDusty >= DUSTY_AFTER_DAYS;
    if (cooledDown) {
      return { kind: 'dusty', text: DUSTY_NUDGE, nextStep: c.nudgeStep };
    }
  }

  return null;
}
