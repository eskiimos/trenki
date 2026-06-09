// Маппинг намерения дня микроцикла → параметры генератора тренировок.
// Каждый день недели имеет своё intent (Пн=в тонусе, Вт=разминка, …, Пт=устал),
// и мы хотим, чтобы AI-движок отдавал под него разные по нагрузке тренировки.
//
// На входе у generate-v3 — { goal: TrainingGoal, energyState: EnergyState }.
// Здесь мы решаем какой именно goal+energyState скармливать движку для каждого
// intent'а.
//
// !!! TODO !!! Эти 5 строк нужно валидировать с методистом / тренерами.
// Сейчас стоят разумные дефолты, чтобы Sprint 1 ехал; в Sprint 2-3 заменим
// на согласованные параметры. См. план в обсуждении.

import { MicrocycleIntent, TrainingGoal, EnergyState, MicrocycleFeedback } from '@/generated/prisma';

export interface IntentParams {
  /** День недели (1=Пн, 5=Пт) — для удобства и валидации */
  dayOfWeek: number;
  /** Cмысл дня — человекочитаемая подпись для UI/логов */
  label: string;
  /** Цель тренировки, передаётся в generate-v3 */
  goal: TrainingGoal;
  /** Состояние энергии, передаётся в generate-v3 */
  energyState: EnergyState;
}

/**
 * Канонический порядок дней в микроцикле. Используется при генерации, чтобы
 * пройти Пн→Пт детерминированно.
 */
export const MICROCYCLE_DAYS_ORDER: MicrocycleIntent[] = [
  MicrocycleIntent.IN_TONE,
  MicrocycleIntent.WARMUP,
  MicrocycleIntent.CHARGED,
  MicrocycleIntent.STRETCH,
  MicrocycleIntent.TIRED,
];

/**
 * Маппинг intent → параметры. Числовые значения подобраны как разумные
 * дефолты на старте — должны быть согласованы с тренерами до прод-релиза.
 */
export const INTENT_PARAMS: Record<MicrocycleIntent, IntentParams> = {
  // Пн — «в тонусе»: бодрый старт недели, средняя нагрузка на ведущую цель.
  // TODO: уточнить с тренерами выбор goal — сейчас взяли OUTRUN_OPPONENT
  // как "общая динамика", но возможно стоит брать цель из профиля атлета.
  [MicrocycleIntent.IN_TONE]: {
    dayOfWeek: 1,
    label: 'В тонусе',
    goal: TrainingGoal.OUTRUN_OPPONENT,
    energyState: EnergyState.IN_TONE,
  },

  // Вт — «разминка/зарядка»: лёгкая активация после Пн.
  // TODO: уточнить — может быть отдельная цель типа AGILITY уместнее.
  [MicrocycleIntent.WARMUP]: {
    dayOfWeek: 2,
    label: 'Разминка',
    goal: TrainingGoal.AGILITY,
    energyState: EnergyState.TIRED, // TIRED → структура с меньшим RPE
  },

  // Ср — «заряжен»: пик недели, максимальная нагрузка на силовую работу.
  [MicrocycleIntent.CHARGED]: {
    dayOfWeek: 3,
    label: 'Заряжен',
    goal: TrainingGoal.POWERFUL_SHOT,
    energyState: EnergyState.FULLY_CHARGED,
  },

  // Чт — «растяжка»: мобилити-фокус.
  // TODO: SPORT_LONGEVITY ≈ восстановление/гибкость по описанию — проверить
  // с тренерами, какая цель действительно ведёт к подбору растяжек.
  [MicrocycleIntent.STRETCH]: {
    dayOfWeek: 4,
    label: 'Растяжка',
    goal: TrainingGoal.SPORT_LONGEVITY,
    energyState: EnergyState.IN_TONE,
  },

  // Пт — «устал»: лёгкая закрывающая тренировка перед выходными.
  // TODO: уточнить goal — SOFT_HANDS («мягкие ручки») как технико-моторная
  // работа без больших усилий, должно подходить, но требует подтверждения.
  [MicrocycleIntent.TIRED]: {
    dayOfWeek: 5,
    label: 'Устал',
    goal: TrainingGoal.SOFT_HANDS,
    energyState: EnergyState.TIRED,
  },
};

/**
 * Преобразует ответ из опроса в числовой adjustmentFactor:
 *   EASY   → +1 (следующий цикл усложняется)
 *   NORMAL → 0  (повторяем те же параметры)
 *   HARD   → -1 (упрощаем)
 *   null   → 0  (нет фидбэка — первый цикл или пропустили опрос)
 *
 * Числа сейчас целые, потому что adjustEnergyState шагает дискретно. Если в
 * будущем подключим тонкие RPE-сдвиги, можно будет ±0.5 и т.п.
 */
export function feedbackToFactor(feedback: MicrocycleFeedback | null): number {
  switch (feedback) {
    case MicrocycleFeedback.EASY: return 1;
    case MicrocycleFeedback.HARD: return -1;
    case MicrocycleFeedback.NORMAL:
    default: return 0;
  }
}

/**
 * Сдвигает energyState по шкале TIRED → IN_TONE → FULLY_CHARGED.
 * Это коренной (но простой) рычаг адаптации: getRPERange и
 * getWorkoutStructure внутри v3 алгоритма реагируют на energyState
 * автоматически — RPE и состав модулей подстраиваются.
 */
function adjustEnergyState(base: EnergyState, factor: number): EnergyState {
  const ladder: EnergyState[] = [
    EnergyState.TIRED,
    EnergyState.IN_TONE,
    EnergyState.FULLY_CHARGED,
  ];
  const idx = ladder.indexOf(base);
  if (idx === -1) return base; // защита от неизвестного значения
  const next = Math.max(0, Math.min(ladder.length - 1, idx + Math.round(factor)));
  return ladder[next];
}

/**
 * Применяет коэффициент адаптации к параметрам intent'а. Goal не трогаем —
 * методически это другое решение, а вот energyState шагаем по шкале.
 */
export function applyAdjustment(
  params: IntentParams,
  adjustmentFactor: number | null,
): IntentParams {
  if (adjustmentFactor == null || adjustmentFactor === 0) return params;
  return {
    ...params,
    energyState: adjustEnergyState(params.energyState, adjustmentFactor),
  };
}
