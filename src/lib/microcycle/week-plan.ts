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

// Пул целей ПОЛНЫХ дней (вариативность). Включает AGILITY ОСОЗНАННО: «полно-
// дневных» целей всего 5 (AGILITY занята днём-зарядкой, SPORT_LONGEVITY — днём-
// раскисления), а чтобы наборы целей СОСЕДНИХ недель не пересекались при 3
// полных днях, пул должен быть ≥6. Поэтому AGILITY переиспользуется в пуле —
// ценой того, что на части недель ловкость встречается и в зарядке, и в полном
// дне (компромисс, не баг: нужны новые TrainingGoal, чтобы убрать совсем).
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

// «Крутые» названия нагрузок (по таблице методиста):
//   Заряжен→Овертайм, В тонусе→Стандарт, Устал→Лёгкая нагрузка,
//   Разминка→Зарядка, Растяжка→Раскисление.
export function labelFor(kind: DayKind, energyState: EnergyState): string {
  if (kind === 'WARMUP') return 'Зарядка';
  if (kind === 'WARMUP_STRETCH') return 'Раскисление';
  if (energyState === EnergyState.FULLY_CHARGED) return 'Овертайм';
  if (energyState === EnergyState.IN_TONE) return 'Стандарт';
  return 'Лёгкая нагрузка';
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
// Шаг ротации между неделями = фактическое число полных дней этой недели.
// Сдвигаем пул на nFull за цикл, чтобы наборы целей соседних недель максимально
// не пересекались (методичка НОРМ: «без повторов, тем более подряд»). Завязка
// на nFull (а не на захардкоженную 3) корректна и когда ИЗИ-апгрейд добавил
// 4-й полный день. Пул из 5 целей ≥ числу полных дней → внутри недели цели не
// повторяются.
function assignGoals(week: DayState[], cycleNumber: number): DayPlan[] {
  let fullIdx = 0;
  const nFull = week.filter((d) => d.kind === 'FULL').length;
  const offset = (cycleNumber - 1) * nFull;
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

// ─── Старт цикла с разных дней (методичка «По циклу с разных дней начало») ───
// Если цикл собирают не с понедельника, первая (вводная) неделя короче и
// «доезжает» до выходных лёгкими днями; со следующей недели — стандартная
// Пн-Пт (это решает generate.ts). dayOfWeek в результате — относительный
// порядковый день 1..N от даты старта (как и у BASE_WEEK).
type DayKindState = { kind: DayKind; energyState: EnergyState };
const D_IN_TONE: DayKindState = { kind: 'FULL', energyState: EnergyState.IN_TONE };          // в тонусе
const D_CHARGED: DayKindState = { kind: 'FULL', energyState: EnergyState.FULLY_CHARGED };    // заряжен
const D_TIRED: DayKindState = { kind: 'FULL', energyState: EnergyState.TIRED };              // устал
const D_WARMUP: DayKindState = { kind: 'WARMUP', energyState: EnergyState.TIRED };           // зарядка
const D_STRETCH: DayKindState = { kind: 'WARMUP_STRETCH', energyState: EnergyState.IN_TONE };// раскисление

// Ключ — JS getUTCDay(): 0=Вс, 1=Пн … 6=Сб.
const FIRST_WEEK_BY_DOW: Record<number, DayKindState[]> = {
  1: [D_IN_TONE, D_WARMUP, D_CHARGED, D_STRETCH, D_TIRED], // Пн — полный стандарт
  2: [D_IN_TONE, D_CHARGED, D_STRETCH, D_TIRED],           // Вт — без зарядки
  3: [D_IN_TONE, D_STRETCH, D_TIRED, D_WARMUP],            // Ср → …Сб зарядка
  4: [D_IN_TONE, D_TIRED, D_WARMUP],                       // Чт → …Сб зарядка
  5: [D_IN_TONE, D_WARMUP, D_STRETCH],                     // Пт → Сб зарядка, Вс раскисление
  6: [D_IN_TONE, D_WARMUP],                                // Сб → Вс зарядка
  0: [D_WARMUP],                                           // Вс — только зарядка, далее Пн полный
};

/** Структура вводной недели по дню старта (getUTCDay). Пн = полный BASE_WEEK. */
export function firstWeekStructure(startDow: number): DayState[] {
  const seq = FIRST_WEEK_BY_DOW[startDow] ?? FIRST_WEEK_BY_DOW[1];
  return seq.map((d, i) => ({ dayOfWeek: i + 1, kind: d.kind, energyState: d.energyState }));
}

/** План вводной недели (структура по дню старта + цели). */
export function planFirstWeek(startDow: number, cycleNumber: number): DayPlan[] {
  return assignGoals(firstWeekStructure(startDow), cycleNumber);
}

/** Стандартная неделя Пн-Пт (база для адаптации после вводной недели). */
export function standardWeekStates(): DayState[] {
  return clone(BASE_WEEK);
}

/**
 * Восстанавливает план дней (с целями и подписями) из сохранённых intent и
 * номера цикла — та же ротация целей, что при генерации. assignGoals чист и
 * зависит только от структуры недели + cycleNumber, а структура (FULL/лёгкий)
 * однозначно выводится из intent через parsePrevDay. Позволяет показать цель
 * дня цикла без отдельного хранения её в БД (миграция не нужна).
 */
export function goalsFromStoredDays(
  days: { dayOfWeek: number; intent: MicrocycleIntent }[],
  cycleNumber: number,
): DayPlan[] {
  const states = days.map((d) => parsePrevDay(d.dayOfWeek, d.intent));
  return assignGoals(states, cycleNumber);
}
