/**
 * Маппинг типов нагрузки (LoadType) на прирост характеристик
 * Согласно документу "Потенциал и характеристики-метрики"
 */

export type CharacteristicType = 
  | 'ratingPower' 
  | 'ratingSpeed' 
  | 'ratingEndurance' 
  | 'ratingTechnique' 
  | 'ratingFlexibility';

export interface CharacteristicGain {
  characteristic: CharacteristicType;
  multiplier: number; // 1 = полный прирост, 0.5 = половинный
}

/**
 * Маппинг LoadType → Характеристики
 */
export const LOAD_TYPE_TO_CHARACTERISTICS: Record<string, CharacteristicGain[]> = {
  // Скорость: +скорость, +выносливость
  SPEED: [
    { characteristic: 'ratingSpeed', multiplier: 1 },
    { characteristic: 'ratingEndurance', multiplier: 1 },
  ],
  
  // Мощность: +сила, +0.5 скорость
  POWER: [
    { characteristic: 'ratingPower', multiplier: 1 },
    { characteristic: 'ratingSpeed', multiplier: 0.5 },
  ],
  
  // Максимальная сила: +сила
  MAX_STRENGTH: [
    { characteristic: 'ratingPower', multiplier: 1 },
  ],
  
  // Силовая выносливость: +выносливость
  STRENGTH_ENDURANCE: [
    { characteristic: 'ratingEndurance', multiplier: 1 },
  ],
  
  // Анаэробная выносливость: +выносливость
  ANAEROBIC_ENDURANCE: [
    { characteristic: 'ratingEndurance', multiplier: 1 },
  ],
  
  // Аэробная выносливость: +выносливость
  AEROBIC_ENDURANCE: [
    { characteristic: 'ratingEndurance', multiplier: 1 },
  ],
  
  // Ловкость: +техника
  AGILITY: [
    { characteristic: 'ratingTechnique', multiplier: 1 },
  ],
  
  // Мобильность: +гибкость, +0.5 техника
  MOBILITY: [
    { characteristic: 'ratingFlexibility', multiplier: 1 },
    { characteristic: 'ratingTechnique', multiplier: 0.5 },
  ],
  
  // Статическая растяжка: +гибкость, +0.5 техника
  STATIC_STRETCH: [
    { characteristic: 'ratingFlexibility', multiplier: 1 },
    { characteristic: 'ratingTechnique', multiplier: 0.5 },
  ],
  
  // Динамическая растяжка: +гибкость, +0.5 техника
  DYNAMIC_STRETCH: [
    { characteristic: 'ratingFlexibility', multiplier: 1 },
    { characteristic: 'ratingTechnique', multiplier: 0.5 },
  ],
  
  // ЛФК (преабилитация): +гибкость, +0.5 сила
  PREHAB: [
    { characteristic: 'ratingFlexibility', multiplier: 1 },
    { characteristic: 'ratingPower', multiplier: 0.5 },
  ],
  
  // Техническое мастерство: +техника (и +0.5 к паре, если есть второй тег)
  TECHNICAL_SKILL: [
    { characteristic: 'ratingTechnique', multiplier: 1 },
  ],
};

/**
 * Специальная обработка для разминки
 * Разминка дает +1 к гибкости и +0.5 к любому другому типу нагрузки
 */
export function getWarmupGains(otherLoadType?: string): CharacteristicGain[] {
  const gains: CharacteristicGain[] = [
    { characteristic: 'ratingFlexibility', multiplier: 1 },
  ];
  
  // Если есть второй тег нагрузки, добавляем его с множителем 0.5
  if (otherLoadType && LOAD_TYPE_TO_CHARACTERISTICS[otherLoadType]) {
    const otherGains = LOAD_TYPE_TO_CHARACTERISTICS[otherLoadType];
    gains.push({
      characteristic: otherGains[0].characteristic,
      multiplier: 0.5,
    });
  }
  
  return gains;
}

/**
 * Базовый прирост за один модуль
 */
export const BASE_GAIN = 0.5;

/**
 * Расчет прироста характеристики
 * Формула: прирост = base_gain * ((100 - current_value) / 100)
 * 
 * @param currentValue - текущее значение характеристики (0-100)
 * @param baseGain - базовый прирост (по умолчанию 0.5)
 * @param multiplier - множитель (1 или 0.5)
 * @returns прирост характеристики
 */
export function calculateGain(
  currentValue: number,
  baseGain: number = BASE_GAIN,
  multiplier: number = 1
): number {
  const gain = baseGain * ((100 - currentValue) / 100) * multiplier;
  return parseFloat(gain.toFixed(4));
}

/**
 * Подсчет итогового прироста характеристик за тренировку
 * 
 * @param moduleTags - массив тегов LoadType из всех модулей тренировки
 * @param currentCharacteristics - текущие значения характеристик
 * @param isWarmupOrCooldown - является ли модуль разминкой или заминкой (x0.5 поинтов)
 * @returns объект с приростами для каждой характеристики
 */
export function calculateWorkoutGains(
  moduleTags: string[][],
  currentCharacteristics: Record<CharacteristicType, number>,
  isWarmupOrCooldown: boolean[] = []
): Record<CharacteristicType, number> {
  const characteristicGains: Record<CharacteristicType, number> = {
    ratingPower: 0,
    ratingSpeed: 0,
    ratingEndurance: 0,
    ratingTechnique: 0,
    ratingFlexibility: 0,
  };

  // Обрабатываем каждый модуль отдельно, чтобы учитывать moduleMultiplier
  moduleTags.forEach((tags, moduleIndex) => {
    // Разминка и заминка дают половину поинтов
    const moduleMultiplier = isWarmupOrCooldown[moduleIndex] ? 0.5 : 1;

    // Считаем вхождения тегов внутри модуля
    const tagCounts: Record<string, number> = {};
    tags.forEach(tag => {
      tagCounts[tag] = (tagCounts[tag] || 0) + 1;
    });

    Object.entries(tagCounts).forEach(([loadType, count]) => {
      const gains = LOAD_TYPE_TO_CHARACTERISTICS[loadType];
      if (gains) {
        gains.forEach(({ characteristic, multiplier }) => {
          const currentValue = currentCharacteristics[characteristic];
          const singleGain = calculateGain(currentValue, BASE_GAIN * moduleMultiplier, multiplier);
          characteristicGains[characteristic] += singleGain * count;
        });
      }
    });
  });

  // Округляем до 4 знаков после запятой
  Object.keys(characteristicGains).forEach(key => {
    const charKey = key as CharacteristicType;
    characteristicGains[charKey] = parseFloat(characteristicGains[charKey].toFixed(4));
  });

  return characteristicGains;
}

/**
 * Пересчет potential (среднее арифметическое всех характеристик)
 */
export function calculatePotential(
  characteristics: Record<CharacteristicType, number>
): number {
  const sum = Object.values(characteristics).reduce((acc, val) => acc + val, 0);
  const avg = sum / 5;
  return parseFloat(avg.toFixed(1));
}
