import { TourStep } from './types';

// Сценарий продуктового тура атлета. Маршрут построен под РЕАЛЬНУЮ
// навигацию приложения:
//   главная → (тап карточки ИИ-тренер) → ассессмент → (тап «Вперёд»,
//   реальная генерация) → /training/workout → профиль (потенциал).
//
// 4 шага продвигаются реальным тапом пользователя (2, 3, 4, 5) — он сам жмёт
// живые элементы и обучается моторно, как и просил владелец. Шаги 3-4 (цель
// и состояние) ещё и обязательны: без них генерация на шаге 5 вернёт 400.
//
// data-tour атрибуты проставлены в:
//   src/app/page.tsx                      (header, ai-trainer-card)
//   src/app/training/assessment/page.tsx  (goal-section, energy-state, submit-button)
//   src/app/training/workout/page.tsx     (workout-modules)
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
    body: 'Самое главное. Нажми на эту карточку — соберём тренировку под тебя.',
  },
  {
    id: 'assess-goal',
    route: '/training/assessment',
    anchor: 'goal-section',
    advanceOn: 'tap',
    title: 'Выбери цель',
    body: 'Над чем работаем сегодня? Нажми на одну из целей.',
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
    advanceOn: 'tap',
    title: 'Поехали',
    body: 'Жми «Вперёд» — ИИ соберёт тебе персональную тренировку из модулей.',
  },
  {
    id: 'workout-modules',
    route: '/training/workout',
    anchor: 'workout-modules',
    advanceOn: 'next',
    title: 'Твоя тренировка',
    body: 'Готово! Тренировка собрана из модулей — разминка, основная часть, заминка. Проходишь по очереди.',
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
