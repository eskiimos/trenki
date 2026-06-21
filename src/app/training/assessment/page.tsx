'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useTelegram } from '@/hooks/useTelegram';
import { TrainingGoal } from '@/generated/prisma';
import { GOAL_LABELS, ENERGY_STATE_LABELS } from '@/lib/training-algorithm-v3';
import { pickCycleDayToOffer, todayCycleDayIndex } from '@/lib/microcycle/offer';
import { useTour } from '@/components/tour/TourProvider';

const trainingGoals = Object.values(TrainingGoal) as TrainingGoal[];

// C-4: подписи дней цикла по intent (крутые названия нагрузок, как в календаре).
const INTENT_LABELS: Record<string, string> = {
  IN_TONE: 'База/стандарт',
  WARMUP: 'Зарядка',
  CHARGED: 'Овертайм',
  STRETCH: 'Раскисление',
  TIRED: 'Лёгкая нагрузка',
};

const GOAL_ICONS: Record<string, string> = {
  POWERFUL_SHOT:       'A_powerful_throw.svg',
  OUTRUN_OPPONENT:     'Running_away_from_the_opponent.svg',
  STRENGTH_STABILITY:  'Power_struggle_and_resilience.svg',
  SOFT_HANDS:          'Soft_handles.svg',
  FULL_GAME_ENDURANCE: 'Endurance_for_the_whole_game.svg',
  AGILITY:             'maneuverability.svg',
  SPORT_LONGEVITY:     'athletic_longevity.svg',
};

type EnergyStateValue = 'FULLY_CHARGED' | 'IN_TONE' | 'TIRED';

const energyStates: EnergyStateValue[] = ['FULLY_CHARGED', 'IN_TONE', 'TIRED'];

export default function TrainingAssessmentPage() {
  const router = useRouter();
  const { user, webApp, isLoading: userLoading } = useTelegram();
  // Во время обучающего тура попап «У тебя активен цикл» не показываем —
  // он полноэкранный (fixed inset-0) и перехватывает тап по подсвеченным
  // турами кнопкам (баг с циклом при обучалке).
  const { isActive: tourActive } = useTour();

  const [isSubmitting, setIsSubmitting] = useState(false);
  
  // Состояние формы. По умолчанию ничего не выбрано — атлет сам
  // указывает энергию и цель перед генерацией.
  const [formData, setFormData] = useState({
    goal: null as TrainingGoal | null,
    energyState: null as EnergyStateValue | null,
  });

  // C-4: предложение сделать тренировку из активного цикла вместо быстрой.
  const [cycleOffer, setCycleOffer] = useState<{ sessionId: string; label: string } | null>(null);
  // Если отказался от цикла — день закроем, только когда быстрая реально создана
  // (в handleSubmit), а не на сам отказ, иначе уход без тренировки закрыл бы день.
  const declinedCycleSessionRef = useRef<string | null>(null);

  useEffect(() => {
    if (tourActive) return; // в туре не предлагаем цикл (см. tourActive выше)
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch('/api/microcycle/current');
        if (!res.ok) return;
        const data = await res.json();
        const mc = data.microcycle;
        if (cancelled || !mc || mc.effectiveStatus !== 'ACTIVE') return;
        const todayIdx = todayCycleDayIndex(mc.weekStartDate, new Date());
        const day = pickCycleDayToOffer(mc.days || [], todayIdx);
        if (!cancelled && day && day.workoutSession) {
          setCycleOffer({
            sessionId: day.workoutSession.id,
            label: INTENT_LABELS[day.intent] || 'тренировка',
          });
        }
      } catch {
        // нет сети/цикла — просто не предлагаем
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [tourActive]);

  const acceptCycleOffer = () => {
    if (!cycleOffer) return;
    router.push(`/training/workout?id=${cycleOffer.sessionId}`);
  };

  const declineCycleOffer = () => {
    if (!cycleOffer) return;
    // Запоминаем день — закроем его в handleSubmit, когда быстрая создастся.
    declinedCycleSessionRef.current = cycleOffer.sessionId;
    setCycleOffer(null);
  };

  // Логирование состояния пользователя
  useEffect(() => {
    console.log('👤 User state changed:', { user, userLoading });
  }, [user, userLoading]);

  useEffect(() => {
    if (webApp) {
      webApp.BackButton.show();
      webApp.BackButton.onClick(() => router.back());
      
      return () => {
        webApp.BackButton.hide();
      };
    }
  }, [webApp, router]);

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
        }),
      });

      if (generateResponse.status === 401) {
        alert('Сессия истекла. Войдите заново.');
        router.push('/login');
        return;
      }

      const generateData = await generateResponse.json();

      if (generateData.success) {
        // C-4: спортсмен отказался от цикла в пользу быстрой — теперь, когда
        // быстрая реально создана, закрываем предложенный день цикла.
        if (declinedCycleSessionRef.current) {
          try {
            await fetch('/api/microcycle/close-day', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ sessionId: declinedCycleSessionRef.current }),
            });
          } catch {
            // не критично — просто не закрыли день цикла
          }
          declinedCycleSessionRef.current = null;
        }
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

  const [showInfoBlock, setShowInfoBlock] = useState(false);
  const [isClosing, setIsClosing] = useState(false);

  // Читаем из localStorage после монтирования
  useEffect(() => {
    const dismissed = localStorage.getItem('assessment_info_dismissed');
    if (!dismissed) setShowInfoBlock(true);
  }, []);

  const handleCloseInfo = () => {
    setIsClosing(true);
    setTimeout(() => {
      setShowInfoBlock(false);
      setIsClosing(false);
      localStorage.setItem('assessment_info_dismissed', '1');
    }, 300);
  };

  const handleOpenInfo = () => {
    setShowInfoBlock(true);
  };

  return (
    <div className="min-h-screen bg-[#101530] text-white p-4" style={{ paddingBottom: '100px' }}>
      {/* C-4: предложение сделать тренировку из активного цикла вместо быстрой.
          В обучающем туре не показываем — перекрывает подсвеченные кнопки. */}
      {cycleOffer && !tourActive && (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
          <div className="absolute inset-0 bg-black/60" />
          <div className="relative w-full max-w-sm rounded-xl bg-[#0B0F2A] p-5 text-left shadow-lg border border-[rgba(68,92,255,0.35)]">
            <div className="text-white text-base font-semibold">У тебя активен цикл</div>
            <div className="mt-2 text-white/80 text-sm">
              По плану цикла есть невыполненная тренировка —{' '}
              <span className="text-[#A1FF4A] font-semibold">{cycleOffer.label}</span>. Сделать её вместо быстрой?
            </div>
            <div className="mt-4 flex flex-col gap-2">
              <button
                type="button"
                onClick={acceptCycleOffer}
                className="w-full rounded-lg bg-[#A1FF4A] px-3 py-2.5 text-sm font-semibold text-[#0B0F2A]"
              >
                Да, из цикла
              </button>
              <button
                type="button"
                onClick={declineCycleOffer}
                className="w-full rounded-lg border border-white/20 px-3 py-2.5 text-sm font-semibold text-white"
              >
                Нет, быструю
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Заголовок с кнопкой назад */}
      <div className="mb-6 flex items-center gap-3">
        <button onClick={() => router.back()} className="flex-shrink-0">
          <img src="/icons/icon-action-back.svg" alt="Назад" width={24} height={24} />
        </button>
        <h1 style={{
          fontFamily: 'Overpass',
          fontWeight: 700,
          fontSize: '12px',
          lineHeight: '120%',
          letterSpacing: '0.5px',
          textTransform: 'uppercase',
          color: '#F9F8FE',
          flex: 1
        }}>
          БЫСТРАЯ ТРЕНИРОВКА
        </h1>
        {/* Кнопка "i" — показывается когда блок скрыт */}
        {!showInfoBlock && (
          <button
            onClick={handleOpenInfo}
            style={{
              width: '24px',
              height: '24px',
              borderRadius: '50%',
              border: '1.5px solid rgba(255,255,255,0.4)',
              background: 'transparent',
              color: '#F9F8FE',
              fontFamily: 'Overpass',
              fontWeight: 700,
              fontSize: '13px',
              lineHeight: 1,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
            }}
            aria-label="Показать подсказку"
          >
            i
          </button>
        )}
      </div>

      {/* Информационный блок */}
      {showInfoBlock && (
        <div 
          className={`mb-6 transition-all duration-300 ${isClosing ? 'opacity-0 transform scale-95' : 'opacity-100 transform scale-100'}`}
          style={{
            width: '100%',
            minHeight: '125px',
            padding: '8px 8px 8px 16px',
            gap: '8px',
            borderRadius: '8px',
            background: 'linear-gradient(180deg, rgba(87, 108, 255, 0) 0%, rgba(87, 108, 255, 0.5) 100%)',
            display: 'flex',
            flexDirection: 'column',
            position: 'relative'
          }}
        >
          {/* Верхняя часть с иконками */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
            <img src="/icons/icon-cards.svg" alt="ИИ" width={16} height={16} />
            <button 
              onClick={handleCloseInfo}
              style={{ 
                background: 'transparent', 
                border: 'none', 
                cursor: 'pointer',
                padding: '0',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}
            >
              <img src="/icons/action-close.svg" alt="Закрыть" width={16} height={16} />
            </button>
          </div>
          
          {/* Текст */}
          <div style={{
            fontFamily: 'Overpass',
            fontWeight: 700,
            fontSize: '14px',
            lineHeight: '120%',
            letterSpacing: '0.5px',
            textTransform: 'uppercase',
            color: '#F9F8FE',
            display: 'flex',
            flexDirection: 'column',
            gap: '16px'
          }}>
            <div>
              составим идеальный комплекс для твоей <span style={{color: '#A1FF4A'}}>быстрой тренировки</span>.
            </div>
            <div>
              настрой фильтры и вперед!
            </div>
          </div>
        </div>
      )}

      {/* Вопросы */}
      <div className="space-y-12">
        <div className="animate-fadeIn space-y-12">
          {/* Вопрос 1: Цель тренировки */}
          <div>
            <h2 className="mb-6" style={{
              fontFamily: 'Overpass',
              fontWeight: 700,
              fontSize: '12px',
              lineHeight: '120%',
              letterSpacing: '0.5px',
              textTransform: 'uppercase',
              color: '#F9F8FE'
            }}>
              цель тренировки
            </h2>
            <div className="flex flex-wrap" data-tour="goal-section" style={{ gap: '12px' }}>
              {trainingGoals.map((goal) => {
                const info = GOAL_LABELS[goal];
                if (!info) return null;
                const isSelected = formData.goal === goal;
                const iconFile = GOAL_ICONS[goal];
                return (
                  <div key={goal} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    {iconFile && (
                      <img
                        src={`/images/AI_t/${iconFile}`}
                        alt=""
                        style={{ height: '44px', width: 'auto', display: 'block' }}
                      />
                    )}
                    <button
                      onClick={() => setFormData({ ...formData, goal })}
                      className="transition-all duration-200 hover:scale-105"
                      style={{
                        height: '44px',
                        paddingTop: '12px',
                        paddingRight: '16px',
                        paddingBottom: '12px',
                        paddingLeft: '16px',
                        borderRadius: '32px',
                        backgroundColor: isSelected ? '#A1FF4A' : '#AEABBB33',
                        color: isSelected ? '#060919' : '#F9F8FE',
                        fontFamily: 'Overpass',
                        fontWeight: 700,
                        fontSize: '14px',
                        lineHeight: '120%',
                        letterSpacing: '0.5px',
                        textAlign: 'center',
                        opacity: 1,
                        whiteSpace: 'nowrap',
                        border: 'none',
                        cursor: 'pointer'
                      }}
                    >
                      {info.label}
                    </button>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Вопрос 2: Состояние */}
          <div>
            <h2 className="mb-6" style={{
              fontFamily: 'Overpass',
              fontWeight: 700,
              fontSize: '12px',
              lineHeight: '120%',
              letterSpacing: '0.5px',
              textTransform: 'uppercase',
              color: '#F9F8FE'
            }}>
              твое состояние
            </h2>
            <div data-tour="energy-state" style={{ display: 'flex', gap: '12px' }}>
              {energyStates.map((state) => {
                const info = ENERGY_STATE_LABELS[state];
                if (!info) return null;
                const isSelected = formData.energyState === state;
                return (
                  <button
                    key={state}
                    onClick={() => setFormData({ ...formData, energyState: state })}
                    className="transition-all duration-200 hover:scale-105"
                    style={{
                      flex: 1,
                      height: '44px',
                      padding: '12px 16px',
                      borderRadius: '32px',
                      backgroundColor: isSelected ? '#A1FF4A' : '#AEABBB33',
                      color: isSelected ? '#060919' : '#F9F8FE',
                      fontFamily: 'Overpass',
                      fontWeight: 700,
                      fontSize: '14px',
                      lineHeight: '120%',
                      letterSpacing: '0.5px',
                      textAlign: 'center',
                      border: 'none',
                      cursor: 'pointer',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {info.label}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {/* Фиксированная кнопка "Вперед" */}
      <div 
        className="fixed bottom-0 left-0 right-0 p-4"
        style={{
          backgroundColor: '#101530',
          borderTop: '1px solid rgba(255, 255, 255, 0.1)',
          zIndex: 50
        }}
      >
        <button
          type="button"
          data-tour="submit-button"
          onClick={handleSubmit}
          disabled={!formData.goal || isSubmitting || userLoading}
          className="w-full rounded-full font-medium transition-all uppercase flex items-center justify-center"
          style={{
            backgroundColor: '#A1FF4A',
            color: '#060919',
            opacity: (!formData.goal || isSubmitting || userLoading) ? 0.2 : 1,
            fontFamily: 'Overpass, sans-serif',
            fontWeight: 700,
            fontSize: '16px',
            letterSpacing: '0.5px',
            cursor: (!formData.goal || isSubmitting || userLoading) ? 'not-allowed' : 'pointer',
            height: '56px',
            padding: '0 16px',
          }}
        >
          {isSubmitting ? (
            <img 
              src="/icons/loading.svg" 
              alt="Загрузка" 
              width={24} 
              height={24}
              style={{
                animation: 'spin 1s linear infinite'
              }}
            />
          ) : userLoading ? (
            'Загрузка...'
          ) : (
            'Вперед'
          )}
        </button>
        <style jsx>{`
          @keyframes spin {
            from {
              transform: rotate(0deg);
            }
            to {
              transform: rotate(360deg);
            }
          }
        `}</style>
      </div>
    </div>
  );
}
