// Вовлекающие пуши: онбординг-дрип (зарегистрировался, но ничего не попробовал),
// «серия под угрозой» (серия обнулится, если не потренироваться сегодня),
// «пропуск 2 дня» и «гантели запылились» (без подписки и давно не тренировался).
// Чистая логика — решение «кому и что слать» тестируется без БД. Тексты — из
// шаблонов, которые админ редактирует сам (./templates.ts).

import { TEMPO_MIN_STREAK, calendarDayIndex, computeStreak } from '@/lib/gamification';
import { pluralDays } from '@/lib/plural';
import {
  DEFAULT_PUSH_TEMPLATES,
  renderPush,
  type PushTemplateKey,
  type PushTemplates,
} from '@/lib/notifications/templates';

export interface NudgeText {
  title: string;
  body: string;
  url: string;
}

/** Шаги онбординг-дрипа: через сколько дней после регистрации и какой шаблон. */
export const ONBOARDING_DRIP: Array<{ afterDays: number; template: PushTemplateKey; url: string }> = [
  { afterDays: 1, template: 'onboarding1', url: '/training/assessment' },
  { afterDays: 3, template: 'onboarding2', url: '/' },
  { afterDays: 7, template: 'onboarding3', url: '/shorts' },
];

/** Через сколько дней «простоя» напоминаем тем, кто без подписки. */
export const DUSTY_AFTER_DAYS = 4; // из «раз в 3-5 дней» берём середину

/** «Ты не тренировался 2 дня»: вчера и сегодня без тренировки. */
export const MISSED_AFTER_DAYS = 2;

export interface NudgeCandidate {
  createdAt: Date;
  /** Таймзона игрока: «день после регистрации» — календарный, как и простой. */
  tz?: string | null;
  /** Имя для шаблона ({name}). */
  name?: string | null;
  /** Была ли хоть одна тренировка (вообще). */
  everTrained: boolean;
  /**
   * Сколько КАЛЕНДАРНЫХ дней (по таймзоне юзера) прошло с дня последней
   * тренировки: 0 — сегодня, 1 — вчера. null — никогда не тренировался.
   */
  daysSinceLastTraining: number | null;
  /** Активная подписка. */
  hasPremium: boolean;
  /** Шаг дрипа, который уже отправлен (0 — ничего). */
  nudgeStep: number;
  /** Дней с последнего нуджа «гантели запылились». null — ни разу не слали. */
  daysSinceLastDusty: number | null;
  /** Текущая серия (дней тренировок подряд), как на главной. */
  currentStreak: number;
}

export type NudgeKind = 'onboarding' | 'streak' | 'missed' | 'dusty';

export interface NudgeDecision {
  kind: NudgeKind;
  template: PushTemplateKey;
  text: NudgeText;
  /** Новый nudgeStep для записи (для дрипа). */
  nextStep: number;
}

/**
 * Простой и серия из дат тренировок — в календарных днях по таймзоне юзера,
 * как серия на главной (Б1/Б3: раньше считали 24-часовыми отрезками по часам
 * сервера, и «тренировался вчера вечером» в 15:00 выглядело как «сегодня»).
 */
export function trainingRecency(
  completedAts: Date[],
  now: Date,
  tz?: string | null,
): { everTrained: boolean; daysSinceLastTraining: number | null; currentStreak: number } {
  if (completedAts.length === 0) return { everTrained: false, daysSinceLastTraining: null, currentStreak: 0 };
  const last = Math.max(...completedAts.map((d) => calendarDayIndex(d, tz)));
  return {
    everTrained: true,
    daysSinceLastTraining: Math.max(0, calendarDayIndex(now, tz) - last),
    currentStreak: computeStreak(completedAts, now, tz),
  };
}

function decision(
  kind: NudgeKind,
  template: PushTemplateKey,
  url: string,
  nextStep: number,
  templates: PushTemplates,
  vars: Record<string, string | null | undefined>,
): NudgeDecision {
  return { kind, template, nextStep, text: { ...renderPush(templates, template, vars), url } };
}

/**
 * Что отправить пользователю сейчас (или ничего).
 * Приоритет: онбординг-дрип (ни разу не тренировался — доводим до первой
 * тренировки) → «серия под угрозой» (спасается только сегодня) → «пропуск
 * 2 дня» → «гантели запылились». Друг с другом не пересекаются: серия — при
 * простое 1 день, пропуск — ровно 2, «запылились» — от 4.
 */
export function decideNudge(
  c: NudgeCandidate,
  now: Date,
  templates: PushTemplates = DEFAULT_PUSH_TEMPLATES,
): NudgeDecision | null {
  // Календарные дни: зарегистрировался вечером — первый пуш назавтра вечером,
  // а не через 48 часов (как было при счёте 24-часовыми отрезками).
  const ageDays = calendarDayIndex(now, c.tz) - calendarDayIndex(c.createdAt, c.tz);
  const vars = { name: c.name };

  // 1) Онбординг-дрип: ни одной тренировки за всё время.
  if (!c.everTrained) {
    // Берём самый поздний шаг, который уже «созрел» и ещё не отправлен.
    for (let i = ONBOARDING_DRIP.length - 1; i >= 0; i -= 1) {
      const step = i + 1;
      const s = ONBOARDING_DRIP[i]!;
      if (step > c.nudgeStep && ageDays >= s.afterDays) {
        return decision('onboarding', s.template, s.url, step, templates, vars);
      }
    }
    return null; // все шаги отправлены либо ещё рано
  }

  // 2) «Серия под угрозой»: серия ≥ 2, последняя тренировка вчера — сегодня
  // ещё можно спасти. Условие «вчера» истинно один день на каждую серию.
  if (c.currentStreak >= 2 && c.daysSinceLastTraining === 1) {
    const template = c.currentStreak >= TEMPO_MIN_STREAK ? 'streakTempo' : 'streak';
    return decision('streak', template, '/training/assessment', c.nudgeStep, templates, {
      ...vars,
      streak: pluralDays(c.currentStreak),
    });
  }

  // 3) «Пропуск 2 дня»: ровно на второй день без тренировок — срабатывает
  // один раз на каждый перерыв, отдельный дедуп не нужен. И с подпиской, и без.
  if (c.daysSinceLastTraining === MISSED_AFTER_DAYS) {
    return decision('missed', 'missed', '/training/assessment', c.nudgeStep, templates, vars);
  }

  // 4) «Гантели запылились» — только без подписки и с реальным простоем.
  // Повторяем не чаще, чем раз в DUSTY_AFTER_DAYS: без этого условие «простой ≥ N»
  // истинно каждый следующий день и пуш уходил бы ежедневно и бесконечно.
  if (!c.hasPremium && c.daysSinceLastTraining !== null && c.daysSinceLastTraining >= DUSTY_AFTER_DAYS) {
    const cooledDown = c.daysSinceLastDusty === null || c.daysSinceLastDusty >= DUSTY_AFTER_DAYS;
    if (cooledDown) {
      return decision('dusty', 'dusty', '/training/assessment', c.nudgeStep, templates, vars);
    }
  }

  return null;
}

/**
 * Можно ли слать нудж в день, когда уже ушло утреннее напоминание по циклу (Б4).
 * Раньше такой день глушил всё — и у атлетов с циклом «серия под угрозой» по
 * будням не доходила никогда. Серия срочная (спасается только сегодня) и про
 * другое, поэтому её пропускаем; остальное — нет, одного пуша о тренировке хватит.
 */
export function allowedOnReminderDay(kind: NudgeKind): boolean {
  return kind === 'streak';
}

/** Сколько после начала окна ещё можно слать вечерние пуши. */
export const NUDGE_WINDOW_MINUTES = 3 * 60;
/** И в любом случае не позже 22:00 по местному времени: дети. */
export const NUDGE_LATEST_MINUTE = 22 * 60;

/**
 * Попадает ли местная минута в окно вечерних пушей. Без верхней границы
 * деплой после 21:00 или сбой крона вокруг 18:00 отправили бы пуши детям
 * ночью; пропущенное окно просто переносится на завтра.
 */
export function inNudgeWindow(localMinute: number, targetMinute: number): boolean {
  const end = Math.min(targetMinute + NUDGE_WINDOW_MINUTES, NUDGE_LATEST_MINUTE);
  return localMinute >= targetMinute && localMinute < end;
}
