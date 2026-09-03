// Единый справочник игровых амплуа (правка владельца «Начало сентября»: в
// шапке профиля — позиция сокращением ЦН/ЛН/ПН/ПЗ/ЛЗ/ВР). Раньше карты
// лежали четырьмя разными копиями (главная ×2, профиль, админка) и расходились
// («ЛК»/«Левый крайний»/«Левый край»). Чистый модуль без Prisma — годится и
// для клиентских экранов.

export type HockeyPositionKey =
  | 'GOALTENDER'
  | 'DEFENSEMAN'
  | 'LEFT_DEFENSEMAN'
  | 'RIGHT_DEFENSEMAN'
  | 'LEFT_WING'
  | 'CENTER'
  | 'RIGHT_WING';

/** Сокращения для шапки/карточек. Общее «защитник» (старые профили) — «З». */
export const POSITION_SHORT: Record<HockeyPositionKey, string> = {
  GOALTENDER: 'ВР',
  DEFENSEMAN: 'З',
  LEFT_DEFENSEMAN: 'ЛЗ',
  RIGHT_DEFENSEMAN: 'ПЗ',
  LEFT_WING: 'ЛН',
  CENTER: 'ЦН',
  RIGHT_WING: 'ПН',
};

export const POSITION_LABEL: Record<HockeyPositionKey, string> = {
  GOALTENDER: 'Вратарь',
  DEFENSEMAN: 'Защитник',
  LEFT_DEFENSEMAN: 'Левый защитник',
  RIGHT_DEFENSEMAN: 'Правый защитник',
  LEFT_WING: 'Левый нападающий',
  CENTER: 'Центральный нападающий',
  RIGHT_WING: 'Правый нападающий',
};

/**
 * Порядок в пикерах: от ворот к нападению. Устаревшее общее DEFENSEMAN не
 * предлагаем — но если у игрока оно уже стоит, экран редактирования должен
 * его показать (см. profile/edit).
 */
export const POSITION_OPTIONS: HockeyPositionKey[] = [
  'GOALTENDER',
  'LEFT_DEFENSEMAN',
  'RIGHT_DEFENSEMAN',
  'LEFT_WING',
  'CENTER',
  'RIGHT_WING',
];

function isPosition(value: unknown): value is HockeyPositionKey {
  return typeof value === 'string' && value in POSITION_SHORT;
}

/** «ЦН» по значению из БД; пусто/неизвестно → null. */
export function positionShort(value?: string | null): string | null {
  return isPosition(value) ? POSITION_SHORT[value] : null;
}

/** «Центральный нападающий» по значению из БД; пусто/неизвестно → null. */
export function positionLabel(value?: string | null): string | null {
  return isPosition(value) ? POSITION_LABEL[value] : null;
}
