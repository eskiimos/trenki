'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useTelegram } from '@/hooks/useTelegram';
import { TrainingGoal } from '@/generated/prisma';
import { GOAL_LABELS, ENERGY_STATE_LABELS } from '@/lib/training-algorithm-v3';
import { pickCycleDayToOffer, todayCycleDayIndex } from '@/lib/microcycle/offer';
import { openSubscriptionModal } from '@/lib/subscription-modal';
import { useTour } from '@/components/tour/TourProvider';
import AppLoader from '@/components/AppLoader';

const trainingGoals = Object.values(TrainingGoal) as TrainingGoal[];

// C-4: подписи дней цикла по intent (крутые названия нагрузок, как в календаре).
const INTENT_LABELS: Record<string, string> = {
  IN_TONE: 'Стандарт',
  WARMUP: 'Зарядка',
  CHARGED: 'Овертайм',
  STRETCH: 'Раскисление',
  TIRED: 'Лёгкая нагрузка',
};

const GOAL_ICONS: Record<string, string> = {
  POWERFUL_SHOT: 'A_powerful_throw.svg',
  OUTRUN_OPPONENT: 'Running_away_from_the_opponent.svg',
  STRENGTH_STABILITY: 'Power_struggle_and_resilience.svg',
  SOFT_HANDS: 'Soft_handles.svg',
  FULL_GAME_ENDURANCE: 'Endurance_for_the_whole_game.svg',
  AGILITY: 'maneuverability.svg',
  SPORT_LONGEVITY: 'athletic_longevity.svg',
};

type EnergyStateValue = 'FULLY_CHARGED' | 'IN_TONE' | 'TIRED';

const energyStates: EnergyStateValue[] = ['TIRED', 'IN_TONE', 'FULLY_CHARGED'];

export default function TrainingAssessmentPage() {
  const router = useRouter();
  const { webApp, isLoading: userLoading } = useTelegram();
  // Во время обучающего тура попап «У тебя активен цикл» не показываем —
  // он полноэкранный (fixed inset-0) и перехватывает тап по подсвеченным
  // турами кнопкам (баг с циклом при обучалке).
  const { isActive: tourActive } = useTour();

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [step, setStep] = useState(1);

  // Состояние формы. По умолчанию ничего не выбрано — атлет сам
  // указывает энергию и цель перед генерацией.
  const [formData, setFormData] = useState({
    goal: null as TrainingGoal | null,
    energyState: null as EnergyStateValue | null,
  });

  // Пришли из задания родителя («Тренироваться») — цель уже выбрана за атлета:
  // /training/assessment?goal=POWERFUL_SHOT. Читаем из location, а не через
  // useSearchParams, чтобы не заворачивать страницу в Suspense.
  useEffect(() => {
    try {
      const goal = new URLSearchParams(window.location.search).get('goal');
      if (goal && GOAL_LABELS[goal]) {
        setFormData((prev) => (prev.goal ? prev : { ...prev, goal: goal as TrainingGoal }));
      }
    } catch { }
  }, []);

  // C-4: предложение сделать тренировку из активного цикла вместо быстрой.
  // Если отказался от цикла — день закроем, только когда быстрая реально создана
  // (в handleSubmit), а не на сам отказ, иначе уход без тренировки закрыл бы день.
  const declinedCycleSessionRef = useRef<string | null>(null);
  const formStartedRef = useRef(false);

  // Стейты
  const [cycleOffer, setCycleOffer] = useState<{ sessionId: string; label: string; } | null>(null);
  const [isCycleModalVisible, setIsCycleModalVisible] = useState(false);
  const [triggerStep1Anim, setTriggerStep1Anim] = useState(false);
  const [cycleCheckPending, setCycleCheckPending] = useState(true);

  // Боевой запрос к API
  useEffect(() => {
    let skipCycleOffer = tourActive;
    try {
      skipCycleOffer ||= new URLSearchParams(window.location.search).has('goal');
    } catch { }
    // Тур и назначенная родителем цель сразу открывают обычную форму.
    // Раньше ранний return оставлял карточки энергии прозрачными навсегда.
    if (skipCycleOffer) {
      setCycleOffer(null);
      setIsCycleModalVisible(false);
      setTriggerStep1Anim(true);
      setCycleCheckPending(false);
      return;
    }

    let cancelled = false;
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), 10_000);
    let revealTimer: ReturnType<typeof setTimeout> | undefined;

    (async () => {
      try {
        const res = await fetch('/api/microcycle/current', { cache: 'no-store', signal: controller.signal });
        if (!res.ok) {
          if (!cancelled) setTriggerStep1Anim(true);
          return;
        }

        const data = await res.json();
        const mc = data.microcycle;

        if (cancelled || !mc || mc.effectiveStatus !== 'ACTIVE') {
          if (!cancelled) setTriggerStep1Anim(true);
          return;
        }

        const todayIdx = todayCycleDayIndex(mc.weekStartDate, new Date());
        const day = pickCycleDayToOffer(mc.days || [], todayIdx);

        if (!cancelled && !formStartedRef.current && day && day.workoutSession) {
          setCycleOffer({
            sessionId: day.workoutSession.id,
            label: INTENT_LABELS[day.intent] || 'тренировка',
          });
          // Даем React отрендерить элемент с translate-y-full, затем запускаем выезд наверх
          revealTimer = setTimeout(() => {
            if (!cancelled) setIsCycleModalVisible(true);
          }, 50);
        } else {
          // Если на сегодня плана нет — сразу анимируем появление карточек энергии
          if (!cancelled) setTriggerStep1Anim(true);
        }
      } catch {
        if (!cancelled) setTriggerStep1Anim(true);
      } finally {
        clearTimeout(timeout);
        if (!cancelled) setCycleCheckPending(false);
      }
    })();

    return () => {
      cancelled = true;
      controller.abort();
      clearTimeout(timeout);
      clearTimeout(revealTimer);
    };
  }, [tourActive]);

  useEffect(() => {
    const handlePopState = () => {
      // Оставляем только возврат с шага 2 на шаг 1
      if (step === 2) {
        setStep(1);
      }
    };

    window.addEventListener('popstate', handlePopState);

    const handleTgBack = () => {
      if (step === 2) {
        window.history.back(); // Вызовет popstate и вернет на шаг 1
      } else {
        router.back(); // Если мы на шаге 1 — просто уходим со страницы
      }
    };

    if (webApp) {
      webApp.BackButton.show();
      webApp.BackButton.onClick(handleTgBack);
    }

    return () => {
      window.removeEventListener('popstate', handlePopState);
      if (webApp) {
        webApp.BackButton.offClick(handleTgBack);
        webApp.BackButton.hide();
      }
    };
  }, [step, webApp, router]);

  const declineCycleOffer = () => {
    // Даем 150мс на то, чтобы кнопка успела визуально "прожаться"
    setTimeout(() => {
      if (!cycleOffer) return;
      formStartedRef.current = true;
      declinedCycleSessionRef.current = cycleOffer.sessionId;
      setIsCycleModalVisible(false);

      // Ждем пока модалка уедет вниз, затем анимируем карточки
      setTimeout(() => {
        setCycleOffer(null);
        setTriggerStep1Anim(true);
      }, 350);
    }, 150);
  };

  const acceptCycleOffer = () => {
    setTimeout(() => {
      if (!cycleOffer) return;
      router.push(`/training/session/${cycleOffer.sessionId}`);
    }, 150);
  };

  // Функция для перехода на второй шаг (вместо обычного setStep)
  const goToStep2 = () => {
    window.history.pushState({ screen: 'step2' }, ''); // Пушим стейт для свайпа назад
    setStep(2);
  };


  const handleSubmit = async () => {
    if (!formData.energyState) {
      alert('Пожалуйста, выберите своё состояние');
      return;
    }
    if (!formData.goal) {
      alert('Пожалуйста, выберите цель тренировки');
      return;
    }

    setIsSubmitting(true);

    try {
      const generateResponse = await fetch('/api/training/generate-v3', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          goal: formData.goal,
          energyState: formData.energyState,
          // C-4: быстрая вместо циклового дня. Сервер запомнит связь и закроет
          // день цикла при ЗАВЕРШЕНИИ быстрой — не авансом при создании.
          replacesCycleSessionId: declinedCycleSessionRef.current ?? undefined,
        }),
      });

      if (generateResponse.status === 401) {
        alert('Сессия истекла. Войдите заново.');
        router.push('/login');
        return;
      }

      // 402: бесплатная недельная квота исчерпана → предлагаем подписку.
      if (generateResponse.status === 402) {
        openSubscriptionModal('ai-workout');
        setIsSubmitting(false);
        return;
      }

      const generateData = await generateResponse.json();

      if (generateData.success) {
        // День цикла больше НЕ закрываем здесь: связь ушла в generate-v3, и
        // сервер закроет день при завершении быстрой (не авансом).
        declinedCycleSessionRef.current = null;
        router.push(`/training/workout?id=${generateData.workoutId}`);
        return;
      }

      if (generateData.redirectTo) {
        alert('Пожалуйста, пройди стартовый опрос для определения твоих характеристик');
        router.push(generateData.redirectTo);
        return;
      }

      if (generateData.missingModules && generateData.missingModules.length > 0) {
        alert(`Не хватает модулей для тренировки: ${generateData.missingModules.join(', ')}`);
        router.push('/training/workout');
        return;
      }

      alert('Ошибка генерации тренировки: ' + generateData.error);
    } catch (error) {
      console.error('❌ Exception during assessment:', error);
      alert('Произошла ошибка. Попробуйте снова.');
    } finally {
      setIsSubmitting(false);
    }

  };

  const isReady = !isSubmitting && !userLoading && !!formData.goal;
  const isRageMode = isReady && formData.energyState === 'FULLY_CHARGED';

  const initialLoading = cycleCheckPending || userLoading;

  return (
    <>
    <AppLoader ready={!initialLoading} />
    <div className="w-full overflow-hidden relative" style={{ visibility: initialLoading ? 'hidden' : 'visible' }} inert={initialLoading}>

      {/* C-4: предложение сделать тренировку из активного цикла вместо быстрой.
          В обучающем туре не показываем — перекрывает подсвеченные кнопки. */}
      {/* Полноэкранный экран "У тебя активен цикл" */}
      {cycleOffer && !tourActive && (
        <div
          className={`fixed inset-0 z-100 bg-night flex flex-col px-4 pt-12 transition-transform duration-500 ease-[cubic-bezier(0.32,0.72,0,1)] ${isCycleModalVisible ? 'translate-y-0' : 'translate-y-full'
            }`}
          style={{ paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 24px)' }}
        >
          {/* Иконка и заголовки (плавно проявляются с задержкой) */}
          <div className={`flex-1 flex flex-col justify-center items-center text-center transition-all duration-700 delay-150 ${isCycleModalVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'
            }`}>
            <div className="w-20 h-20 mb-6 rounded-full bg-brand/10 flex items-center justify-center">
              <img src="/icons/icon-cards.svg" alt="План" className="w-10 h-10" />
            </div>

            <h2 className="font-overpass font-bold text-3xl text-ink tracking-tight mb-4">
              А как же наш план?
            </h2>

            <p className="font-overpass text-[16px] text-muted leading-relaxed px-4">
              У нас уже запланирована тренировка: <br />
              <span className="text-brand font-bold text-[18px] block mt-2">{cycleOffer.label}</span>
            </p>
          </div>

          {/* Кнопки действий (выплывают чуть позже) */}
          <div className={`flex flex-col gap-3 mt-auto transition-all duration-700 delay-300 ${isCycleModalVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-10'
            }`}>
            <button
              type="button"
              onClick={acceptCycleOffer}
              className="w-full h-14 rounded-pill bg-brand text-night font-overpass font-bold text-[16px] tracking-[0.5px] uppercase transition-all active:scale-95"
            >
              Пашем по плану
            </button>

            <button
              type="button"
              onClick={declineCycleOffer}
              className="w-full h-14 rounded-pill bg-surface border border-[var(--border-hairline)] text-ink font-overpass font-bold text-[16px] tracking-[0.5px] uppercase transition-all active:scale-95 hover:bg-elevated"
            >
              Погнали быструю
            </button>
          </div>
        </div>
      )}

      {/* Заголовок с кнопкой назад */}
      <div className="mb-6 flex items-center justify-center p-4 relative">
        <button
          onClick={() => {
            setTimeout(() => {
              if (step === 2) {
                window.history.back();
              } else {
                router.back();
              }
            }, 150);
          }}
          className="shrink-0 absolute left-4 opacity-25 active:scale-85 active:opacity-40 transition-all duration-200"
        >
          <img src="/icons/icon-action-back.svg" alt="Назад" width={24} height={24} />
        </button>

        <h1 className="font-overpass font-bold text-xs leading-6">
          БЫСТРАЯ ТРЕНИРОВКА
        </h1>
      </div>
      <div
        className="flex transition-transform duration-500 ease-[cubic-bezier(0.32,0.72,0,1)]"
        style={{ transform: `translateX(-${(step - 1) * 100}%)` }}
      >
        {/* Шаг 1: Состояние */}
        <div className="w-full shrink-0 p-4 flex flex-col min-h-[calc(100vh-80px)]">

          {/* Заголовок и индикатор шага */}
          <div className="mb-6">
            <div className="font-overpass font-bold text-[11px] text-muted tracking-widest uppercase mb-2">
              Шаг 1 из 2
            </div>
            <h2 className="font-overpass font-bold text-2xl text-ink tracking-tight">
              Как самочувствие?
            </h2>
          </div>

          {/* Горизонтальные карточки на всю ширину */}
          <div className={`flex flex-col gap-3 transition-opacity duration-300 ${triggerStep1Anim ? 'opacity-100 anim-stagger' : 'opacity-0'
            }`}>
            {energyStates.map((state) => {
              const info = ENERGY_STATE_LABELS[state];
              if (!info) return null;

              const isSelected = formData.energyState === state;

              // Настройки визуализации для каждого состояния
              let activeBars = 1;
              let indicatorColor = 'bg-brand';
              let description = '';

              if (state === 'FULLY_CHARGED') {
                activeBars = 3;
                indicatorColor = 'bg-brand';
                description = 'Максимальная интенсивность. Упор на развитие навыков и физики.';
              } else if (state === 'IN_TONE') {
                activeBars = 2;
                indicatorColor = 'bg-ink'; // Белый
                description = 'Сбалансированная нагрузка. Стандартный рабочий режим.';
              } else if (state === 'TIRED') {
                activeBars = 1;
                indicatorColor = 'bg-[var(--color-danger)]'; // Оранжевый/красный из твоих токенов
                description = 'Легкие упражнения, фокус на восстановление и раскисление.';
              }

              return (
                <button
                  key={state}
                  onClick={() => {
                    formStartedRef.current = true;
                    setFormData({ ...formData, energyState: state });
                    setTimeout(goToStep2, 250);
                  }}
                  className={`
            relative flex items-center justify-between p-4 w-full rounded-(--radius-lg)
            transition-all duration-200 active:scale-95 border text-left
            ${isSelected
                      ? 'bg-brand/10 border-(--border-lime)'
                      : 'bg-surface border-transparent hover:bg-elevated'
                    }
          `}
                >
                  {/* Левая часть: Текст */}
                  <div className="flex flex-col gap-1.5 pr-4 flex-1">
                    <span className={`font-overpass font-bold text-[17px] leading-none ${isSelected ? 'text-brand' : 'text-ink'}`}>
                      {info.label}
                    </span>
                    <span className="font-overpass text-[13px] text-muted leading-snug">
                      {description}
                    </span>
                  </div>

                  {/* Правая часть: Индикатор энергии */}
                  <div className="flex gap-1 shrink-0">
                    {[1, 2, 3].map((barIndex) => (
                      <div
                        key={barIndex}
                        className={`h-2 w-3.5 rounded-full transition-colors ${barIndex <= activeBars
                          ? indicatorColor
                          : 'bg-muted/20'
                          }`}
                      />
                    ))}
                  </div>
                </button>
              );
            })}
          </div>

          {/* Инфоблок-заглушка внизу (прижимается к низу через mt-auto) */}
          <div className="mt-auto pt-8"
            style={{
              paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 16px)'
            }}
          >
            <div className="p-4 rounded-md bg-surface/50 border border-(--border-hairline) flex gap-3 items-start">
              {/* Если нет этой иконки, можешь подставить любую другую или эмодзи 🤖 */}
              <img src="/icons/icon-cards.svg" alt="AI" className="w-5 h-5 shrink-0 mt-0.5 opacity-60 grayscale" />
              <p className="font-overpass text-[13px] text-muted leading-relaxed">
                ИИ-тренер подстроит объем и интенсивность упражнений под твой текущий уровень энергии, чтобы избежать перетренированности.
              </p>
            </div>
          </div>

        </div>

        {/* Шаг 2: Цель */}
        <div className="w-full shrink-0 p-4 flex flex-col min-h-[calc(100vh-120px)]">
          <div className="mb-6">
            <div className="font-overpass font-bold text-[11px] text-muted tracking-widest uppercase mb-2">
              Шаг 2 из 2
            </div>
            <h2 className="font-overpass font-bold text-2xl text-ink tracking-tight">
              Что будешь тренировать?
            </h2>
          </div>
          <div className="flex flex-col gap-3">
            <div>
              <div className="flex flex-col gap-3 anim-stagger">
                {trainingGoals.map((goal) => {
                  const info = GOAL_LABELS[goal];
                  if (!info) return null;

                  const isSelected = formData.goal === goal;
                  const iconFile = GOAL_ICONS[goal];
                  let animationClass = '';
                  if (isSelected) {
                    if (formData.energyState === 'FULLY_CHARGED') animationClass = 'anim-energy-burst';
                    else if (formData.energyState === 'IN_TONE') animationClass = 'anim-pop-normal';
                    else if (formData.energyState === 'TIRED') animationClass = 'anim-sluggish';
                  }
                  return (
                    <button
                      key={goal}
                      onClick={() => setFormData({ ...formData, goal })}
                      className={`
                        w-full flex items-center gap-3 p-3 rounded-lg 
                        font-overpass font-bold text-[16px] leading-[1.2] tracking-[0.5px] 
                        transition-all duration-200 active:scale-95 text-left border
                          ${isSelected
                          ? 'bg-brand/10 border-(--border-lime)'
                          : 'bg-surface border-transparent hover:bg-elevated'
                        }
                      `}
                    >
                      {iconFile && (
                        <img
                          src={`/images/AI_t/${iconFile}`}
                          alt=""
                          className={`h-11 w-auto shrink-0 transition-opacity ${isSelected ? 'opacity-100' : 'opacity-50 grayscale-60'
                            } ${animationClass}`}
                        />
                      )}
                      <span>{info.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
          {/*  кнопка сабмит */}
          <div
            className="z-50 mt-auto pointer-events-none"
            style={{
              background: 'linear-gradient(to top, var(--color-night) 60%, transparent)',
              paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 16px)'
            }}
          >
            <button
              type="button"
              onClick={handleSubmit}
              disabled={!isReady}
              className={`
      pointer-events-auto w-full h-14 rounded-pill flex items-center justify-center
      font-overpass font-bold text-[16px] tracking-[0.5px] uppercase transition-all
      ${!isReady
                  ? 'bg-brand/20 text-brand/50 cursor-not-allowed'
                  : 'bg-brand text-night active:scale-95 cursor-pointer'
                }
      ${isRageMode ? 'anim-button-rage' : (isReady ? 'anim-glow-pulse' : '')}
    `}
            >
              {isSubmitting ? (
                <img
                  src="/icons/loading.svg"
                  alt="Загрузка"
                  className="w-6 h-6 animate-spin"
                />
              ) : userLoading ? (
                'Загрузка...'
              ) : formData.energyState === 'FULLY_CHARGED' ? (
                'Погнали!'
              ) : formData.energyState === 'IN_TONE' ? (
                'Вперед'
              ) : formData.energyState === 'TIRED' ? (
                'Ну, попробуем'
              ) : (
                'Вперед'
              )}
            </button>
          </div>
        </div>



      </div>
    </div >
    </>
  );
}
