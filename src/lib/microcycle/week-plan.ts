// Движок недельного плана микроцикла — реализует методичку тренеров
// (Логика физиологии микроцикла).
//
// Стартовая неделя:
//   Пн — полноценная, «в тонусе»
//   Вт — только разминка (зарядка)
//   Ср — полноценная, «заряжен» (пик)
//   Чт — разминка + растяжка
//   Пт — полноценная, пониженная нагрузка («устал») — перед выходными играми
//
// Адаптация по опросу после цикла:
//   ИЗИ   → поднять состояние самого «низкого» полного дня на ступень
//            (Устал→В тонусе→Заряжен). Когда все полные дни на пике —
//            добавить ещё один полный день (превратить лёгкий в полный).
//   НОРМ  → состояния те же, меняются только цели (ротация, без повторов).
//   ТЯЖКО → снизить состояние самого «высокого» полного дня на ступень.
//            Когда все на минимуме — структурно не меняем (нужно разбираться).
//
// Данные: per-day состояние кодируется полем MicrocycleDay.intent
//   IN_TONE/CHARGED/TIRED = полный день с этим состоянием,
//   WARMUP = только разминка, STRETCH = разминка+растяжка.
// Поэтому отдельная миграция не нужна — прошлый цикл читается из intent.

import { MicrocycleIntent, TrainingGoal, EnergyState, MicrocycleFeedback } from '@/generated/prisma';

export type DayKind = 'FULL' | 'WARMUP' | 'WARMUP_STRETCH';

/** Состояние недельного дня без цели — то, что переносится между циклами. */
export interface DayState {
  dayOfWeek: number; // 1=Пн … 5=Пт
  kind: DayKind;
  /** для FULL — нагрузка; для лёгких — режим разминки */
  energyState: EnergyState;
}

/** Полный план дня (состояние + цель + производные intent/label для хранения и UI). */
export interface DayPlan extends DayState {
  goal: TrainingGoal;
  intent: MicrocycleIntent;
  label: string;
}

// Шкала состояний по возрастанию нагрузки.
const STATE_LADDER: EnergyState[] = [
  EnergyState.TIRED,
  EnergyState.IN_TONE,
  EnergyState.FULLY_CHARGED,
];

const stateIdx = (s: EnergyState) => STATE_LADDER.indexOf(s);

// Пул целей для ротации недель (вариативность, чтобы не повторялось).
const GOAL_POOL: TrainingGoal[] = [
  TrainingGoal.POWERFUL_SHOT,
  TrainingGoal.OUTRUN_OPPONENT,
  TrainingGoal.STRENGTH_STABILITY,
  TrainingGoal.SOFT_HANDS,
  TrainingGoal.FULL_GAME_ENDURANCE,
  TrainingGoal.AGILITY,
];

// Стартовая структура недели (состояния; цели назначаются ротацией).
const BASE_WEEK: DayState[] = [
  { dayOfWeek: 1, kind: 'FULL', energyState: EnergyState.IN_TONE },
  { dayOfWeek: 2, kind: 'WARMUP', energyState: EnergyState.TIRED },
  { dayOfWeek: 3, kind: 'FULL', energyState: EnergyState.FULLY_CHARGED },
  { dayOfWeek: 4, kind: 'WARMUP_STRETCH', energyState: EnergyState.IN_TONE },
  { dayOfWeek: 5, kind: 'FULL', energyState: EnergyState.TIRED },
];

// intent (для хранения/UI) выводится из (kind, energyState).
export function intentFor(kind: DayKind, energyState: EnergyState): MicrocycleIntent {
  if (kind === 'WARMUP') return MicrocycleIntent.WARMUP;
  if (kind === 'WARMUP_STRETCH') return MicrocycleIntent.STRETCH;
  if (energyState === EnergyState.FULLY_CHARGED) return MicrocycleIntent.CHARGED;
  if (energyState === EnergyState.IN_TONE) return MicrocycleIntent.IN_TONE;
  return MicrocycleIntent.TIRED;
}

export function labelFor(kind: DayKind, energyState: EnergyState): string {
  if (kind === 'WARMUP') return 'Разминка';
  if (kind === 'WARMUP_STRETCH') return 'Растяжка';
  if (energyState === EnergyState.FULLY_CHARGED) return 'Заряжен';
  if (energyState === EnergyState.IN_TONE) return 'В тонусе';
  return 'Устал';
}

// Прошлый день (из БД) → состояние для адаптации.
export function parsePrevDay(dayOfWeek: number, intent: MicrocycleIntent): DayState {
  switch (intent) {
    case MicrocycleIntent.WARMUP:
      return { dayOfWeek, kind: 'WARMUP', energyState: EnergyState.TIRED };
    case MicrocycleIntent.STRETCH:
      return { dayOfWeek, kind: 'WARMUP_STRETCH', energyState: EnergyState.IN_TONE };
    case MicrocycleIntent.CHARGED:
      return { dayOfWeek, kind: 'FULL', energyState: EnergyState.FULLY_CHARGED };
    case MicrocycleIntent.IN_TONE:
      return { dayOfWeek, kind: 'FULL', energyState: EnergyState.IN_TONE };
    case MicrocycleIntent.TIRED:
    default:
      return { dayOfWeek, kind: 'FULL', energyState: EnergyState.TIRED };
  }
}

const clone = (w: DayState[]): DayState[] => w.map((d) => ({ ...d }));
const isFull = (d: DayState) => d.kind === 'FULL';

/** ИЗИ-шаг: поднять самый «низкий» полный день. true — подняли, false — все на пике. */
function raiseLowestFull(week: DayState[]): boolean {
  const fulls = week.filter(isFull).filter((d) => stateIdx(d.energyState) < STATE_LADDER.length - 1);
  if (fulls.length === 0) return false;
  // самый низкий по состоянию, при равенстве — более ранний день
  fulls.sort((a, b) => stateIdx(a.energyState) - stateIdx(b.energyState) || a.dayOfWeek - b.dayOfWeek);
  const target = fulls[0];
  target.energyState = STATE_LADDER[stateIdx(target.energyState) + 1];
  return true;
}

/** ТЯЖКО-шаг: снизить самый «высокий» полный день. true — снизили, false — все на минимуме. */
function lowerHighestFull(week: DayState[]): boolean {
  const fulls = week.filter(isFull).filter((d) => stateIdx(d.energyState) > 0);
  if (fulls.length === 0) return false;
  // самый высокий по состоянию, при равенстве — более ранний день
  fulls.sort((a, b) => stateIdx(b.energyState) - stateIdx(a.energyState) || a.dayOfWeek - b.dayOfWeek);
  const target = fulls[0];
  target.energyState = STATE_LADDER[stateIdx(target.energyState) - 1];
  return true;
}

/** Превратить лёгкий день в полный (Вт раньше Чт). true — добавили полный день. */
function upgradeLightDay(week: DayState[]): boolean {
  const light = week
    .filter((d) => d.kind !== 'FULL')
    .sort((a, b) => a.dayOfWeek - b.dayOfWeek)[0];
  if (!light) return false;
  light.kind = 'FULL';
  light.energyState = EnergyState.IN_TONE; // новый полный день стартует «в тонусе»
  return true;
}

/**
 * Считает структуру недели для нового цикла из прошлого + фидбэка.
 * Возвращает только состояния (без целей).
 */
export function adaptWeek(prev: DayState[] | null, feedback: MicrocycleFeedback | null): DayState[] {
  if (!prev || prev.length === 0) return clone(BASE_WEEK);
  const week = clone(prev);

  switch (feedback) {
    case MicrocycleFeedback.EASY:
      // поднимаем низший полный; если все на пике — добавляем полный день
      if (!raiseLowestFull(week)) upgradeLightDay(week);
      break;
    case MicrocycleFeedback.HARD:
      lowerHighestFull(week); // если все на минимуме — структурно не меняем
      break;
    case MicrocycleFeedback.NORMAL:
    default:
      // состояния те же — меняются только цели (ротацией ниже)
      break;
  }
  return week;
}

/**
 * Назначает цели по принципу ротации: каждую неделю сдвиг по пулу, внутри
 * недели полные дни получают разные цели (не повторяются, тем более подряд).
 * Лёгкие дни: Вт — динамика (AGILITY), Чт — мобилити/растяжка (SPORT_LONGEVITY).
 */
// Шаг ротации между неделями = базовое число полных дней (3). Сдвигаем пул
// на GOAL_STEP за цикл, чтобы наборы целей соседних недель не пересекались
// (методичка НОРМ: «без повторов, тем более подряд»). Пул из 6 целей →
// период повтора 2 недели, соседние недели не делят цели.
const GOAL_STEP = 3;

function assignGoals(week: DayState[], cycleNumber: number): DayPlan[] {
  let fullIdx = 0;
  const offset = (cycleNumber - 1) * GOAL_STEP;
  return week
    .slice()
    .sort((a, b) => a.dayOfWeek - b.dayOfWeek)
    .map((d) => {
      let goal: TrainingGoal;
      if (d.kind === 'WARMUP') {
        goal = TrainingGoal.AGILITY;
      } else if (d.kind === 'WARMUP_STRETCH') {
        goal = TrainingGoal.SPORT_LONGEVITY;
      } else {
        goal = GOAL_POOL[(offset + fullIdx) % GOAL_POOL.length];
        fullIdx += 1;
      }
      return {
        ...d,
        goal,
        intent: intentFor(d.kind, d.energyState),
        label: labelFor(d.kind, d.energyState),
      };
    });
}

/**
 * Главная функция: план недели для цикла cycleNumber.
 * @param prev состояния прошлого цикла (из parsePrevDay) или null для первого
 * @param feedback ответ из опроса прошлого цикла
 */
export function planWeek(
  prev: DayState[] | null,
  feedback: MicrocycleFeedback | null,
  cycleNumber: number,
): DayPlan[] {
  const adapted = adaptWeek(prev, feedback);
  return assignGoals(adapted, cycleNumber);
}
