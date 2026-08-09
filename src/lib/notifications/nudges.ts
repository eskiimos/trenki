// Вовлекающие пуши: онбординг-дрип (зарегистрировался, но ничего не попробовал),
// нудж «серия под угрозой» (стрик обнулится, если не потренироваться сегодня)
// и нудж «гантели запылились» (без подписки и давно не тренировался).
// Чистая логика — решение «кому и что слать» тестируется без БД.

import { TEMPO_MIN_STREAK } from '@/lib/gamification';

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

/** Склонение «день/дня/дней» для текста стрика. */
function daysWord(n: number): string {
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (mod100 >= 11 && mod100 <= 14) return 'дней';
  if (mod10 === 1) return 'день';
  if (mod10 >= 2 && mod10 <= 4) return 'дня';
  return 'дней';
}

/** Нудж «серия под угрозой» — текст зависит от длины стрика. */
export function streakNudgeText(streak: number): NudgeText {
  // При серии ≥ 3 у юзера активен «Ударный темп» — напоминаем, что сгорит и он
  const tempoTail =
    streak >= TEMPO_MIN_STREAK ? ' — иначе сгорит ударный темп (×2 к опыту)' : '';
  return {
    title: '🔥 Серия под угрозой!',
    body: `У тебя ${streak} ${daysWord(streak)} подряд — потренируйся сегодня, чтобы не обнулить серию${tempoTail}.`,
    url: '/training/assessment',
  };
}

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
  /** Текущий стрик (дней тренировок подряд), считается computeStreak. */
  currentStreak: number;
}

export interface NudgeDecision {
  kind: 'onboarding' | 'streak' | 'dusty';
  text: NudgeText;
  /** Новый nudgeStep для записи (для дрипа). */
  nextStep: number;
}

/** Через сколько дней «простоя» напоминаем тем, кто без подписки. */
export const DUSTY_AFTER_DAYS = 4; // из «раз в 3-5 дней» берём середину

/**
 * Что отправить пользователю сейчас (или ничего).
 * Приоритет: онбординг-дрип (ни разу не тренировался — доводим до первой
 * тренировки) → «серия под угрозой» (стрик спасается только сегодня, это
 * срочнее) → «гантели запылились». Конфликта стрика с dusty нет: стрик
 * срабатывает при простое ровно 1 день, dusty — от DUSTY_AFTER_DAYS (4).
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

  // 2) «Серия под угрозой»: стрик ≥ 2, последняя тренировка была вчера —
  // сегодня ещё можно спасти серию. Отдельный интервал-дедуп не нужен:
  // daysSinceLastTraining === 1 истинно максимум один день на каждую
  // потенциальную потерю серии, а lastNudgeOn в кроне и так режет до 1 пуша/день.
  if (c.currentStreak >= 2 && c.daysSinceLastTraining === 1) {
    return { kind: 'streak', text: streakNudgeText(c.currentStreak), nextStep: c.nudgeStep };
  }

  // 3) «Гантели запылились» — только без подписки и с реальным простоем.
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
