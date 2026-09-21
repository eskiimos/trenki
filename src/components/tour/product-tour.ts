import { TourStep } from './types';

// Сценарий продуктового тура атлета (переписан 2026-09 под текущий интерфейс:
// главная точка входа — карточка «ИИ-тренер · собрать неделю» на главной, а не
// кнопка в календаре; экран быстрой тренировки больше не проходим целиком).
//
// Маршрут: главная (шапка → нижнее меню → быстрая тренировка → тап «собрать
// неделю») → календарь (готовая неделя) → профиль (потенциал → уровень и XP).
//
// Реально сохраняется только микроцикл (тап по карточке на главной выполняет
// обычную сборку). Без подписки шаги про неделю пропускаются (requiresAccess).
//
// data-tour якоря:
//   src/app/page.tsx                    (header, ai-trainer-card, microcycle-card)
//   src/components/BottomNavigation.tsx (bottom-nav)
//   src/app/calendar/page.tsx           (microcycle-banner)
//   src/app/profile/page.tsx            (potential-ring, level-card)

export const PRODUCT_TOUR: TourStep[] = [
  {
    id: 'home-header',
    route: '/',
    anchor: 'header',
    advanceOn: 'next',
    title: 'Твой профиль',
    body: 'Здесь твоё имя, игровой номер и позиция. А приложение помогает тебе расти как игроку.',
  },
  {
    id: 'home-nav',
    route: '/',
    anchor: 'bottom-nav',
    advanceOn: 'next',
    title: 'Навигация',
    body: 'Внизу — главная, треньки (короткие упражнения), все тренировки, календарь и твой профиль.',
  },
  {
    id: 'home-quick',
    route: '/',
    anchor: 'ai-trainer-card',
    advanceOn: 'next',
    title: 'Быстрая тренировка',
    body: 'Нужна одна тренировка прямо сейчас? Выбери цель и самочувствие — ИИ соберёт её за секунды.',
  },
  {
    id: 'home-week',
    route: '/',
    anchor: 'microcycle-card',
    advanceOn: 'tap',
    requiresAccess: true,
    title: 'ИИ-тренер на неделю',
    body: 'Главное — план на неделю: 5 тренировок под твой уровень. Нажми на кнопку — ИИ-тренер соберёт его.',
  },
  {
    id: 'cal-week',
    route: '/calendar',
    anchor: 'microcycle-banner',
    advanceOn: 'next',
    navigate: 'wait',
    optional: true,
    requiresAccess: true,
    title: 'Твоя неделя готова',
    body: 'Вот твой план на 5 дней. Каждый день — своя тренировка: открывай по очереди и расти.',
  },
  {
    id: 'profile-potential',
    route: '/profile',
    anchor: 'potential-ring',
    advanceOn: 'next',
    title: 'Твой потенциал',
    body: 'Кольцо потенциала и пять характеристик растут с каждой тренировкой.',
  },
  {
    id: 'profile-level',
    route: '/profile',
    anchor: 'level-card',
    advanceOn: 'next',
    isLast: true,
    title: 'Уровень и опыт',
    body: 'За тренировки и ежедневный чек-ин копишь опыт — растут уровень и звание. Тренируйся 3 дня подряд, и включится ударный темп: весь опыт дня удваивается. Дальше — ты сам!',
  },
];

/** Шаги, доступные пользователю (без платных — при paywall). */
export function availableTourSteps(paywalled: boolean): TourStep[] {
  return PRODUCT_TOUR.filter((s) => !(s.requiresAccess && paywalled));
}
