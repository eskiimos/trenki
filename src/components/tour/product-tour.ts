import { TourStep } from './types';

// Сценарий продуктового тура атлета.
//
// Маршрут: главная → (тап карточки ИИ-тренер) → ассессмент (тап цели,
// тап состояния, «Вперёд» только поясняем) → (тап «Собрать неделю» в
// календаре, РЕАЛЬНАЯ генерация микроцикла) → 5 дней → профиль.
//
// ВАЖНО: в туре одиночная тренировка ИИ-тренера НЕ генерируется и НЕ
// сохраняется — шаг «Вперёд» только подсвечивается и поясняется (advanceOn
// 'next'), реального сабмита нет. Сохраняется только микроцикл (5 дней) —
// он и есть носитель вовлечения. Вне тура одиночная работает как прежде.
//
// 3 шага продвигаются реальным тапом пользователя (2, 3, 4) + ключевой
// тап «Собрать неделю» (6). data-tour якоря:
//   src/app/page.tsx                      (header, ai-trainer-card)
//   src/app/training/assessment/page.tsx  (goal-section, energy-state, submit-button)
//   src/app/calendar/page.tsx             (microcycle-button, microcycle-banner)
//   src/app/profile/page.tsx              (potential-ring)

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
    id: 'home-ai',
    route: '/',
    anchor: 'ai-trainer-card',
    advanceOn: 'tap',
    title: 'Персональный ИИ-тренер',
    body: 'Нажми на карточку — покажу, как ИИ подбирает тренировку под тебя.',
  },
  {
    id: 'assess-goal',
    route: '/training/assessment',
    anchor: 'goal-section',
    advanceOn: 'tap',
    title: 'Выбери цель',
    body: 'Над чем работаем? Нажми на одну из целей.',
  },
  {
    id: 'assess-energy',
    route: '/training/assessment',
    anchor: 'energy-state',
    advanceOn: 'tap',
    title: 'Твоё состояние',
    body: 'Отметь, как себя чувствуешь — ИИ подстроит нагрузку. Нажми на один из вариантов.',
  },
  {
    id: 'assess-submit',
    route: '/training/assessment',
    anchor: 'submit-button',
    advanceOn: 'next',
    title: 'Разовая тренировка',
    body: 'Кнопка «Вперёд» соберёт одну тренировку под этот запрос. А сейчас покажу кое-что мощнее — целую неделю.',
  },
  {
    id: 'cal-generate',
    route: '/calendar',
    anchor: 'microcycle-button',
    advanceOn: 'tap',
    title: 'Собери неделю',
    body: 'ИИ-тренер составит сразу 5 тренировок на неделю — под твой уровень. Нажми!',
  },
  {
    id: 'cal-week',
    route: '/calendar',
    anchor: 'microcycle-banner',
    advanceOn: 'next',
    title: 'Твоя неделя готова',
    body: 'Вот твой план на 5 дней. Каждый день — своя тренировка. Открывай по очереди и расти.',
  },
  {
    id: 'profile-potential',
    route: '/profile',
    anchor: 'potential-ring',
    advanceOn: 'next',
    isLast: true,
    title: 'Твой потенциал',
    body: 'Кольцо потенциала и пять характеристик растут с каждой тренировкой. Это всё — дальше ты сам!',
  },
];
