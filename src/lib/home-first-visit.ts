// Первый заход на главную (правки «Середина сентября», п.3).
//
// Новичок после онбординга видел разом плашку гида, чек-ин с неделей из 7
// ячеек, баннер пушей и пилюлю «На экран Домой» — очерёдности не было. Теперь
// «второстепенные» блоки главной (чек-ин, пуши, «На экран Домой») ждут, пока
// человек разберётся с гидом.
//
// Показываем их, когда тур СЕЙЧАС не идёт И выполнено хоть одно:
//   - тур пройден или пропущен (флаг TourProvider);
//   - плашка гида закрыта крестиком;
//   - тур запускали с плашки (брошенный посреди тур не должен прятать чек-ин навсегда);
//   - сервер говорит «не новичок»: аккаунту больше суток, уже был чек-ин
//     или есть завершённая тренировка.
// Без серверной части новичок, который плашку не трогает, не увидел бы чек-ин
// никогда, а действующие пользователи (плашку многие не закрывали) потеряли бы
// его после обновления.
//
// Флаги гида живут в localStorage — на устройстве, не на пользователе. Второй
// аккаунт на том же телефоне унаследует «тур пройден»: для этих блоков безвредно.

/** Окно «новичка»: первые сутки после регистрации. */
export const NEWCOMER_WINDOW_MS = 24 * 60 * 60 * 1000;

// Ключи localStorage. Первые два исторические: completed пишет TourProvider
// (завершение и «Пропустить»), dismissed — крестик плашки на главной.
export const TOUR_COMPLETED_KEY = 'trenki_tour_completed';
export const GUIDE_DISMISSED_KEY = 'trenki_guide_banner_dismissed';
export const TOUR_STARTED_KEY = 'trenki_guide_tour_started';

/** Аккаунт моложе суток. Дата из будущего (рассинхрон часов) — тоже «свежий». */
export function isFreshAccount(createdAt: Date, now: Date = new Date()): boolean {
  return now.getTime() - createdAt.getTime() < NEWCOMER_WINDOW_MS;
}

export interface NewcomerFacts {
  createdAt: Date;
  hasAnyCheckin: boolean;
  hasAnyWorkout: boolean;
}

/**
 * Серверная часть: пользователь ещё «новичок» — аккаунту меньше суток, ни
 * одного чек-ина и ни одной завершённой тренировки.
 */
export function isNewcomer(facts: NewcomerFacts, now: Date = new Date()): boolean {
  return isFreshAccount(facts.createdAt, now) && !facts.hasAnyCheckin && !facts.hasAnyWorkout;
}

export interface GuideFlags {
  tourCompleted: boolean;
  guideDismissed: boolean;
  tourStarted: boolean;
}

/**
 * Флаги гида из хранилища. Хранилище может отсутствовать или бросать
 * (приватный режим, заблокированные данные сайта) — тогда считаем, что
 * флагов нет, и решает серверная часть.
 */
export function readGuideFlags(storage: Pick<Storage, 'getItem'> | null | undefined): GuideFlags {
  const has = (key: string) => {
    try {
      return !!storage?.getItem(key);
    } catch {
      return false;
    }
  };
  return {
    tourCompleted: has(TOUR_COMPLETED_KEY),
    guideDismissed: has(GUIDE_DISMISSED_KEY),
    tourStarted: has(TOUR_STARTED_KEY),
  };
}

export interface HomeExtrasInput {
  /** Тур идёт прямо сейчас (useTour().isActive). */
  tourActive: boolean;
  /** Флаги гида; null — ещё не прочитаны (до монтирования). */
  flags: GuideFlags | null;
  /** Ответ сервера; null — ещё грузится. Ошибку запроса клиент сводит к false. */
  newcomer: boolean | null;
}

/** Можно ли показывать чек-ин, баннер пушей и «На экран Домой». */
export function canShowHomeExtras({ tourActive, flags, newcomer }: HomeExtrasInput): boolean {
  // Во время тура не отвлекаем и не двигаем вёрстку под подсветкой шага
  if (tourActive) return false;
  if (flags && (flags.tourCompleted || flags.guideDismissed || flags.tourStarted)) return true;
  return newcomer === false;
}
