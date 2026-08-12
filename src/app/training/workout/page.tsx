'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useTelegram } from '@/hooks/useTelegram';
import CharacteristicsGainModal from '@/components/CharacteristicsGainModal';
import Toast from '@/components/Toast';
import ModuleSelectionModal from '@/components/ModuleSelectionModal';

interface WorkoutModule {
  id: string;
  sessionVideoId?: string;
  title: string;
  description: string | null;
  типМодуля: string | null;
  типНагрузки: string | null;
  moduleType?: string | null;
  loadType?: string | null;
  duration: number;
  rpeRange: string;
  videoUrl: string;
  thumbnail: string | null;
  equipment: string[];
  trainer: {
    id: string;
    name: string;
    lastName: string;
  };
  order: number;
  completed: boolean;
  startedAt?: string | null;
  completedAt?: string | null;
  watchedDuration?: number | null;
}

interface Workout {
  id: string;
  status: string;
  targetDuration: number;
  targetRPE: number;
  loadDirection: string;
  progress?: number;
  currentVideoIndex?: number;
  totalVideos?: number;
  startedAt?: string | null;
  createdAt: string;
  modules: WorkoutModule[];
  equipment?: string[];
  trainingGoal?: string | null;
  dayLabel?: string | null;
}

const GOAL_LABELS: Record<string, string> = {
  POWERFUL_SHOT: 'Мощный бросок',
  OUTRUN_OPPONENT: 'Убегаем от соперника',
  STRENGTH_STABILITY: 'Силовая борьба и устойчивость',
  SOFT_HANDS: 'Мягкие ручки',
  FULL_GAME_ENDURANCE: 'Выносливость на всю игру',
  AGILITY: 'Маневренность',
  SPORT_LONGEVITY: 'Спортивное долголетие',
};

/** Русское склонение: plural(2, ['модуль','модуля','модулей']) → 'модуля'. */
function plural(n: number, forms: [string, string, string]): string {
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (mod10 === 1 && mod100 !== 11) return forms[0];
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return forms[1];
  return forms[2];
}

export default function WorkoutPage() {
  const router = useRouter();
  const { user, webApp } = useTelegram();
  
  const [workout, setWorkout] = useState<Workout | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [showInfoBlock, setShowInfoBlock] = useState(false);
  const [isClosing, setIsClosing] = useState(false);

  // Читаем из localStorage после монтирования
  useEffect(() => {
    const dismissed = localStorage.getItem('workout_info_dismissed');
    if (!dismissed) setShowInfoBlock(true);
  }, []);
  const [showCompletionModal, setShowCompletionModal] = useState(false);
  
  // Состояние для модалки прироста характеристик
  const [showGainsModal, setShowGainsModal] = useState(false);
  const [characteristicsGains, setCharacteristicsGains] = useState<any>(null);
  const [newCharacteristics, setNewCharacteristics] = useState<any>(null);
  const [gainXp, setGainXp] = useState<{ xp: number; mult: number }>({ xp: 0, mult: 1 });

  // Досрочный финиш: модалка-предупреждение + текущий множитель «Темпа ×2»
  // (нужен, чтобы показать честное «недозаработаешь X баллов»).
  const [showEarlyFinishModal, setShowEarlyFinishModal] = useState(false);
  const [earlyFinishing, setEarlyFinishing] = useState(false);
  const [tempoMult, setTempoMult] = useState(1);
  useEffect(() => {
    let cancelled = false;
    fetch('/api/gamification/summary')
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (!cancelled && typeof d?.tempoMultiplier === 'number') setTempoMult(d.tempoMultiplier);
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, []);

  // Состояние для Toast уведомлений
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'warning' | 'info' } | null>(null);
  
  // Состояние для отображения заглушки при отсутствии видео
  const [noVideosAvailable, setNoVideosAvailable] = useState(false);
  const [missingModules, setMissingModules] = useState<string[]>([]);
  
  // Состояние для замены модуля
  const [replacingModuleIndex, setReplacingModuleIndex] = useState<number | null>(null);
  const [isReplacingModule, setIsReplacingModule] = useState(false);
  // Ручной подбор модуля (поиск/фильтр) — индекс открытого слота
  const [pickerIndex, setPickerIndex] = useState<number | null>(null);

  useEffect(() => {
    if (webApp) {
      webApp.BackButton.show();
      webApp.BackButton.onClick(() => router.back());
      
      return () => {
        webApp.BackButton.hide();
      };
    }
  }, [webApp, router]);

  // Загружаем тренировку сразу при монтировании — auth идёт через httpOnly
  // cookie на сервере (requireAuthUser). Раньше гейт `if (user?.id)` зависел
  // от localStorage; на Samsung Fold в PWA-стандалоне localStorage мог быть
  // пустым → user никогда не выставлялся → loadWorkout не вызывался →
  // бесконечная загрузка. На iOS Safari проблема не воспроизводилась.
  useEffect(() => {
    loadWorkout();
  }, []);

  // Перезагружаем данные при возврате на страницу (например, после просмотра видео)
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        console.log('🔄 Page became visible, reloading workout data...');
        loadWorkout();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, []);

  const allCompleted = !!workout && workout.modules.length > 0 && workout.modules.every(m => m.completed);

  // «Понравилась вся тренировка?» — сохранение составленного занятия целиком.
  const [favSaving, setFavSaving] = useState(false);
  const [favSaved, setFavSaved] = useState(false);

  const saveWorkoutToFavorites = async () => {
    if (!workout || favSaving || favSaved) return;
    setFavSaving(true);
    try {
      const res = await fetch('/api/favorites/workouts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId: workout.id }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setToast({ message: data?.error || 'Не удалось сохранить', type: 'error' });
        return;
      }
      setFavSaved(true);
      setToast({
        message: data?.alreadyExists ? 'Уже в избранном' : '★ Тренировка сохранена в избранное',
        type: 'success',
      });
    } catch {
      setToast({ message: 'Сетевая ошибка', type: 'error' });
    } finally {
      setFavSaving(false);
    }
  };

  const loadWorkout = async () => {
    try {
      // Проверяем, есть ли ID тренировки в URL (при переходе из напоминания)
      const urlParams = new URLSearchParams(window.location.search);
      const workoutId = urlParams.get('id');

      const response = workoutId
        ? await fetch(`/api/training/current?workoutId=${workoutId}`)
        : await fetch('/api/training/current');

      const data = await response.json();

      if (data.workout) {
        console.log('📊 Loaded workout data:', {
          id: data.workout.id,
          currentVideoIndex: data.workout.currentVideoIndex,
          totalVideos: data.workout.totalVideos,
          modules: data.workout.modules.map((m: any, i: number) => ({
            index: i,
            title: m.title?.substring(0, 20),
            типМодуля: m.типМодуля,
            completed: m.completed,
            order: m.order,
            equipment: m.equipment || [],
          })),
        });
        setWorkout(data.workout);
        setNoVideosAvailable(false);
      } else {
        // Нет активной тренировки
        console.log('No active workout found');
        setNoVideosAvailable(true);
        // Можно попробовать получить информацию об ошибке из предыдущего запроса
      }
    } catch (error: any) {
      console.error('Ошибка загрузки тренировки:', error);
      setNoVideosAvailable(true);
      // Если в ошибке есть информация о недостающих модулях
      if (error?.missingModules) {
        setMissingModules(error.missingModules);
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleCloseInfo = () => {
    setIsClosing(true);
    setTimeout(() => {
      setShowInfoBlock(false);
      setIsClosing(false);
      localStorage.setItem('workout_info_dismissed', '1');
    }, 300);
  };

  const handleOpenInfo = () => {
    setShowInfoBlock(true);
  };

  const startOrContinueWorkout = () => {
    if (!workout || workout.modules.length === 0) return;

    if (allCompleted) {
      completeWorkout();
      return;
    }

    const firstIncompleteIndex = workout.modules.findIndex(m => !m.completed);
    const targetIndex = firstIncompleteIndex === -1 ? 0 : firstIncompleteIndex;
    const targetModule = workout.modules[targetIndex];

    router.push(`/video/${targetModule.id}?fromWorkout=true&sessionId=${workout.id}`);
  };

  // Функция замены модуля на другой подходящий
  const handleReplaceModule = async (
    moduleIndex: number,
    stretchDirection?: 'FULL' | 'UPPER' | 'LOWER',
  ) => {
    if (!workout) return;

    setReplacingModuleIndex(moduleIndex);
    setIsReplacingModule(true);

    try {
      const response = await fetch('/api/training/replace-module', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          workoutSessionId: workout.id,
          moduleIndex,
          stretchDirection, // C-8: направление растяжки (только для заминки)
        }),
      });

      console.log(`📡 API Response status: ${response.status}`);

      if (response.ok) {
        const data = await response.json();
        console.log('✅ Module replaced successfully:', data.newModule.title);
        
        // Обновляем тренировку с новым модулем
        await loadWorkout();
        
        setToast({
          message: `✅ Модуль заменен на "${data.newModule.title}"`,
          type: 'success',
        });
      } else {
        const error = await response.json();
        console.error('❌ API Error:', error);
        setToast({
          message: error.error || 'Не удалось заменить модуль',
          type: 'error',
        });
      }
    } catch (err) {
      console.error('❌ Exception during module replacement:', err);
      setToast({
        message: 'Ошибка при замене модуля',
        type: 'error',
      });
    } finally {
      setReplacingModuleIndex(null);
      setIsReplacingModule(false);
    }
  };

  const completeWorkout = async (earlyFinish = false) => {
    try {
      const response = await fetch('/api/training/complete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId: workout?.id,
          earlyFinish,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        console.log('✅ Workout completed successfully', data);
        
        // Проверяем, есть ли прирост характеристик
        if (data.success && data.gains && data.newCharacteristics) {
          // Показываем модалку прироста
          setCharacteristicsGains(data.gains);
          setNewCharacteristics(data.newCharacteristics);
          setGainXp({ xp: data.xpEarned ?? 0, mult: data.tempoMultiplier ?? 1 });
          setShowGainsModal(true);
        } else if (data.limitReached) {
          // Показываем Toast о лимите
          setToast({
            message: data.error || 'Достигнут дневной лимит тренировок. Приходи завтра! 💪',
            type: 'warning'
          });
          setTimeout(() => router.push('/'), 3000);
        } else {
          setToast({ message: '✨ Тренировка завершена!', type: 'success' });
          // Сначала — предложение собрать цикл (если уместно), редирект только
          // без него
          const shown = await maybeOfferCycle();
          if (!shown) setTimeout(() => router.push('/'), 2000);
        }
      } else {
        const errorData = await response.json();
        console.error('❌ Error response:', errorData);
        
        if (errorData.limitReached) {
          setToast({
            message: errorData.error || 'Достигнут дневной лимит тренировок. Приходи завтра! 💪',
            type: 'warning'
          });
        } else {
          setToast({ message: 'Ошибка при завершении тренировки', type: 'error' });
        }
      }
    } catch (error) {
      console.error('❌ Error completing workout:', error);
      setToast({ message: 'Ошибка при завершении тренировки', type: 'error' });
    }
  };
  
  // Закрытие модалки прироста и переход на главную
  // После первой быстрой тренировки предлагаем собрать микроцикл (август-
  // правки). Раз на устройство (localStorage) и только если активного цикла
  // нет — обладателю цикла напоминание не нужно.
  const [showCycleOffer, setShowCycleOffer] = useState(false);
  const maybeOfferCycle = async (): Promise<boolean> => {
    try {
      const KEY = 'trenki_cycle_offer_shown';
      if (localStorage.getItem(KEY)) return false;
      const res = await fetch('/api/microcycle/current');
      const d = await res.json().catch(() => null);
      if (d?.microcycle) return false; // цикл уже есть — не предлагаем
      localStorage.setItem(KEY, '1');
      setShowCycleOffer(true);
      return true;
    } catch {
      return false;
    }
  };

  const handleGainsModalClose = () => {
    setShowGainsModal(false);
    maybeOfferCycle().then((shown) => {
      if (!shown) router.push('/');
    });
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#101530] flex items-center justify-center">
        <img 
          src="/icons/loading.svg" 
          alt="Загрузка" 
          width={48} 
          height={48}
          style={{
            animation: 'spin 1s linear infinite'
          }}
        />
        <style jsx>{`
          @keyframes spin {
            from { transform: rotate(0deg); }
            to { transform: rotate(360deg); }
          }
        `}</style>
      </div>
    );
  }

  // Заглушка при отсутствии видео для тренировки
  if (noVideosAvailable || !workout) {
    return (
      <div className="min-h-screen bg-[#101530] text-white p-4 flex flex-col items-center justify-center">
        <div className="max-w-md w-full text-center space-y-6">
          {/* Иконка */}
          <div className="flex justify-center mb-4">
            <div className="w-24 h-24 rounded-full bg-gradient-to-br from-purple-500 to-blue-600 flex items-center justify-center">
              <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2">
                <path d="M12 2L2 7l10 5 10-5-10-5z"/>
                <path d="M2 17l10 5 10-5"/>
                <path d="M2 12l10 5 10-5"/>
              </svg>
            </div>
          </div>

          {/* Заголовок */}
          <h1 className="text-2xl font-bold">
            Недостаточно видео
          </h1>

          {/* Описание */}
          <p className="text-gray-400 text-base leading-relaxed">
            К сожалению, в данный момент в базе недостаточно видео для генерации персональной тренировки. 
            Наша команда уже работает над добавлением нового контента!
          </p>

          {/* Советы */}
          <div className="bg-[#1a1f3a] rounded-lg p-4 space-y-3 text-left">
            <p className="text-sm text-gray-300">
              <span className="text-[#A1FF4A] font-semibold">💡 Что можно сделать:</span>
            </p>
            <ul className="space-y-2 text-sm text-gray-400">
              <li className="flex items-start gap-2">
                <span className="text-[#A1FF4A] mt-0.5">•</span>
                <span>Попробуйте выбрать другие параметры при оценке состояния</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-[#A1FF4A] mt-0.5">•</span>
                <span>Посмотрите отдельные видео в каталоге</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-[#A1FF4A] mt-0.5">•</span>
                <span>Вернитесь позже - мы регулярно добавляем новый контент</span>
              </li>
            </ul>
          </div>

          {/* Информация для админов о недостающих модулях */}
          {missingModules.length > 0 && (
            <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-4 space-y-2 text-left">
              <p className="text-sm font-semibold text-red-400 flex items-center gap-2">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
                  <line x1="12" y1="9" x2="12" y2="13"/>
                  <line x1="12" y1="17" x2="12.01" y2="17"/>
                </svg>
                Для админов: Недостающие модули
              </p>
              <div className="space-y-1 text-sm text-red-300">
                {missingModules.map((module, index) => (
                  <div key={index} className="flex items-center gap-2">
                    <span className="w-1.5 h-1.5 bg-red-400 rounded-full"></span>
                    <span className="font-mono">{module}</span>
                  </div>
                ))}
              </div>
              <p className="text-xs text-red-300/70 mt-2 pt-2 border-t border-red-500/20">
                Необходимо добавить видео указанных типов в базу данных для корректной генерации тренировок
              </p>
            </div>
          )}

          {/* Кнопки действий */}
          <div className="space-y-3 pt-4">
            <button
              onClick={() => router.push('/training/assessment')}
              className="w-full py-3 px-6 bg-gradient-to-r from-blue-600 to-purple-600 rounded-lg font-semibold hover:opacity-90 transition-opacity"
            >
              Пройти оценку заново
            </button>
            
            <button
              onClick={() => router.push('/videos')}
              className="w-full py-3 px-6 bg-[#1a1f3a] rounded-lg font-semibold hover:bg-[#2d3448] transition-colors"
            >
              Перейти к каталогу видео
            </button>
            
            <button
              onClick={() => router.push('/')}
              className="w-full py-3 px-6 text-gray-400 hover:text-white transition-colors"
            >
              Вернуться на главную
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Маппинг русских названий на типы для UI
  const moduleTypeMap: Record<string, string> = {
    'Разминка': 'WARMUP',
    'ОФП': 'FITNESS',
    'Техника': 'TECHNIQUE',
    'Заминка': 'COOLDOWN',
    WARMUP: 'WARMUP',
    FITNESS: 'FITNESS',
    TECHNIQUE: 'TECHNIQUE',
    COOLDOWN: 'COOLDOWN',
  };

  const moduleTypeInfo = {
    WARMUP: { label: 'РАЗМИНКА', number: 1 },
    FITNESS: { label: 'ФИЗИЧЕСКАЯ ПОДГОТОВКА', number: 2 },
    TECHNIQUE: { label: 'ТЕХНИКА', number: 3 },
    COOLDOWN: { label: 'ЗАМИНКА', number: 4 },
  };

  // Функция для получения типа модуля
  const getModuleType = (module: WorkoutModule): string => {
    const raw = module.moduleType || module.типМодуля || '';
    return moduleTypeMap[raw] || 'WARMUP';
  };

  return (
    <div className="min-h-screen bg-[#101530] text-white p-4" style={{ paddingBottom: '100px', paddingTop: 'calc(env(safe-area-inset-top, 0px) + 16px)' }}>
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
          ПЕРСОНАЛЬНАЯ ТРЕНИРОВКА
        </h1>
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
            color: '#F9F8FE'
          }}>
            <span style={{color: '#A1FF4A'}}>ии-тренер</span> рекомендует пройти все модули по очереди, а потом хорошенько отдохнуть
          </div>
        </div>
      )}

      {/* Название дня цикла (нагрузка/характер дня) — для цикловых тренировок */}
      {workout.dayLabel && (
        <div className="mb-2" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{
            fontFamily: 'Overpass',
            fontWeight: 400,
            fontSize: '12px',
            lineHeight: '120%',
            letterSpacing: '0.5px',
            color: '#9B99AA',
          }}>ДЕНЬ ЦИКЛА:</span>
          <span style={{
            fontFamily: 'Overpass',
            fontWeight: 700,
            fontSize: '12px',
            lineHeight: '120%',
            letterSpacing: '0.5px',
            textTransform: 'uppercase',
            color: '#A1FF4A',
          }}>{workout.dayLabel}</span>
        </div>
      )}

      {/* Выбранная цель тренировки */}
      {workout.trainingGoal && GOAL_LABELS[workout.trainingGoal] && (
        <div className="mb-4" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{
            fontFamily: 'Overpass',
            fontWeight: 400,
            fontSize: '12px',
            lineHeight: '120%',
            letterSpacing: '0.5px',
            color: '#9B99AA',
          }}>ЦЕЛЬ:</span>
          <span style={{
            fontFamily: 'Overpass',
            fontWeight: 700,
            fontSize: '12px',
            lineHeight: '120%',
            letterSpacing: '0.5px',
            textTransform: 'uppercase',
            color: '#A1FF4A',
          }}>{GOAL_LABELS[workout.trainingGoal]}</span>
        </div>
      )}

      {/* Модули тренировки */}
      <div className="grid grid-cols-2 gap-4 mb-6" data-tour="workout-modules">
        {workout.modules.map((module, index) => {
          const moduleType = getModuleType(module);
          const info = moduleTypeInfo[moduleType as keyof typeof moduleTypeInfo];
          const isCompleted = module.completed;
          
          // Находим первый незавершенный модуль
          const firstIncompleteIndex = workout.modules.findIndex(m => !m.completed);
          
          // Модуль активен, если:
          // 1. Он не завершен
          // 2. Это первый незавершенный модуль (в случае рассинхронизации с currentVideoIndex)
          const isActive = !isCompleted && index === firstIncompleteIndex;
          const isLocked = !isCompleted && !isActive;

          // Незавершённый модуль, который уже начинали — покажем, с какого места
          // продолжим (сервер помнит watchedDuration, плеер туда и перемотает).
          const resumeAt = !isCompleted && module.watchedDuration && module.watchedDuration >= 5
            ? module.watchedDuration
            : 0;


          // Определяем фоновое изображение
          const backgroundImages: Record<string, string> = {
            'WARMUP': '/images/AI_t/1_warm_up.webp',
            'TECHNIQUE': '/images/AI_t/3_technic.webp',
            'FITNESS': '/images/AI_t/2_physical_training.webp',
            'COOLDOWN': '/images/AI_t/4_the_hitch.webp',
          };
          
          const bgImage = backgroundImages[moduleType] || '/images/warm-up-1.png';
          
          // Определяем overlay цвет
          let overlayColor = 'rgba(174, 171, 187, 0.2)'; // Базовое перекрытие
          if (isCompleted) {
            overlayColor = 'rgba(68, 92, 255, 0.2)'; // Выполненная (синий оттенок)
          } else if (isActive) {
            overlayColor = 'rgba(161, 255, 74, 0.15)'; // Текущая (зеленый оттенок)
          } else if (isLocked) {
            overlayColor = 'rgba(16, 21, 48, 0.7)'; // Заблокированная (темнее)
          }
          
          // Определяем иконку нумерации
          const checkIcons = [
            '/icons/check-1.svg',
            '/icons/check-2.svg',
            '/icons/check-3.svg',
            '/icons/check-4.svg',
          ];
          const checkIcon = isCompleted ? '/icons/check-done.svg' : checkIcons[index] || checkIcons[0];
          
          const handleModuleClick = () => {
            if (isLocked) {
              // Показываем уведомление о блокировке
              alert('Сначала завершите предыдущие модули');
              return;
            }
            // Переходим к видео
            router.push(`/video/${module.id}?fromWorkout=true&sessionId=${workout.id}`);
          };
          
          return (
            <div
              key={module.id}
              onClick={handleModuleClick}
              style={{
                width: '100%',
                aspectRatio: '1 / 1', // Квадратная карточка
                borderRadius: '16px',
                position: 'relative',
                overflow: 'hidden',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                backgroundImage: `url(${bgImage})`,
                backgroundSize: 'cover',
                backgroundPosition: 'center',
                backgroundRepeat: 'no-repeat',
                gap: '12px',
                cursor: isLocked ? 'not-allowed' : 'pointer',
                opacity: isLocked ? 0.6 : 1,
                transition: 'transform 0.2s ease',
                border: isActive ? '2px solid #A1FF4A' : 'none',
              }}
              onMouseDown={(e) => {
                if (!isLocked) {
                  e.currentTarget.style.transform = 'scale(0.98)';
                }
              }}
              onMouseUp={(e) => {
                e.currentTarget.style.transform = 'scale(1)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = 'scale(1)';
              }}
            >
              {/* Overlay */}
              <div style={{
                position: 'absolute',
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                backgroundColor: overlayColor,
                zIndex: 1,
              }} />

              {/* Иконка блокировки для недоступных модулей */}
              {isLocked && (
                <div style={{
                  position: 'absolute',
                  top: '12px',
                  right: '12px',
                  zIndex: 3,
                  width: '24px',
                  height: '24px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}>
                  <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                    <path d="M15.8333 9.16667H4.16667C3.24619 9.16667 2.5 9.91286 2.5 10.8333V16.6667C2.5 17.5871 3.24619 18.3333 4.16667 18.3333H15.8333C16.7538 18.3333 17.5 17.5871 17.5 16.6667V10.8333C17.5 9.91286 16.7538 9.16667 15.8333 9.16667Z" stroke="#F9F8FE" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                    <path d="M5.83333 9.16667V5.83333C5.83333 4.72826 6.27232 3.66846 7.05372 2.88706C7.83512 2.10565 8.89493 1.66667 10 1.66667C11.1051 1.66667 12.1649 2.10565 12.9463 2.88706C13.7277 3.66846 14.1667 4.72826 14.1667 5.83333V9.16667" stroke="#F9F8FE" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                </div>
              )}

              {/* Индикатор завершения */}
              {isCompleted && (
                <div style={{
                  position: 'absolute',
                  top: '12px',
                  left: '12px',
                  zIndex: 3,
                  padding: '4px 8px',
                  borderRadius: '12px',
                  background: 'rgba(68, 92, 255, 0.8)',
                  fontFamily: 'Overpass',
                  fontWeight: 600,
                  fontSize: '10px',
                  color: '#F9F8FE',
                }}>
                  ✓ Завершено
                </div>
              )}

              {/* Индикатор текущего модуля */}
              {isActive && !isCompleted && (
                <div style={{
                  position: 'absolute',
                  top: '12px',
                  left: '12px',
                  zIndex: 3,
                  padding: '4px 8px',
                  borderRadius: '12px',
                  background: 'rgba(161, 255, 74, 0.8)',
                  fontFamily: 'Overpass',
                  fontWeight: 600,
                  fontSize: '10px',
                  color: '#101530',
                }}>
                  ▶ Текущий
                </div>
              )}

              {/* Иконка нумерации */}
              <img 
                src={checkIcon}
                alt={`Шаг ${index + 1}`}
                width={24}
                height={24}
                style={{
                  position: 'relative',
                  zIndex: 2,
                }}
              />

              {/* Название модуля по центру */}
              <div style={{
                position: 'relative',
                zIndex: 2,
                fontFamily: 'Overpass',
                fontWeight: 700,
                fontSize: '14px',
                lineHeight: '120%',
                letterSpacing: '0.5px',
                textTransform: 'uppercase',
                color: '#F9F8FE',
                textAlign: 'center',
                padding: '0 16px',
              }}>
                {info?.label || module.типМодуля || module.moduleType || 'МОДУЛЬ'}
              </div>

              {/* Начатый модуль — продолжим с сохранённого места */}
              {resumeAt > 0 && isActive && (
                <div style={{
                  position: 'relative',
                  zIndex: 2,
                  marginTop: 4,
                  fontFamily: 'Overpass',
                  fontWeight: 700,
                  fontSize: '11px',
                  letterSpacing: '0.3px',
                  color: '#A1FF4A',
                  textAlign: 'center',
                }}>
                  Продолжить с {Math.floor(resumeAt / 60)}:{String(Math.floor(resumeAt % 60)).padStart(2, '0')}
                </div>
              )}

              {/* Кнопка замены модуля (нижний правый угол) */}
              {(() => {
                const canReplace = !isCompleted && !isLocked && module.equipment && module.equipment.length > 0;
                return canReplace && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleReplaceModule(index);
                    }}
                    disabled={replacingModuleIndex === index && isReplacingModule}
                    style={{
                      position: 'absolute',
                      bottom: '12px',
                      right: '12px',
                      zIndex: 3,
                      width: '32px',
                      height: '32px',
                      borderRadius: '8px',
                      backgroundColor: 'rgba(161, 255, 74, 0.2)',
                      border: '1px solid rgba(161, 255, 74, 0.4)',
                      color: '#A1FF4A',
                      cursor: replacingModuleIndex === index && isReplacingModule ? 'wait' : 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      transition: 'all 0.2s ease',
                      padding: 0,
                      fontSize: '16px',
                      fontWeight: 'bold',
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.backgroundColor = 'rgba(161, 255, 74, 0.3)';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.backgroundColor = 'rgba(161, 255, 74, 0.2)';
                    }}
                    title="Заменить видео"
                  >
                    {replacingModuleIndex === index && isReplacingModule ? (
                      <span style={{ display: 'inline-block', animation: 'spin 1s linear infinite' }}>⟳</span>
                    ) : (
                      '⟳'
                    )}
                  </button>
                );
              })()}

              {/* Ручной подбор модуля: поиск/фильтр видео (лупа рядом с авто-заменой) */}
              {!isCompleted && !isLocked && (
                <button
                  onClick={(e) => { e.stopPropagation(); setPickerIndex(index); }}
                  title="Выбрать вручную (поиск и фильтр)"
                  style={{
                    position: 'absolute', bottom: '12px', right: '50px', zIndex: 3,
                    width: '32px', height: '32px', borderRadius: '8px',
                    backgroundColor: 'rgba(68, 92, 255, 0.22)', border: '1px solid rgba(68, 92, 255, 0.45)',
                    color: '#A9B6FF', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 0, cursor: 'pointer',
                  }}
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="11" cy="11" r="7" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
                  </svg>
                </button>
              )}

              {/* C-8: выбор направления растяжки для заминки (дня растяжки).
                  Подменяет стретч-видео через replace-module. «Рандом» —
                  это просто уже подобранное видео (по умолчанию). */}
              {module.moduleType === 'COOLDOWN' && !isCompleted && !isLocked && (
                <div
                  onClick={(e) => e.stopPropagation()}
                  style={{
                    position: 'absolute',
                    left: '8px',
                    right: '8px',
                    bottom: '8px',
                    zIndex: 3,
                    display: 'flex',
                    gap: '4px',
                    justifyContent: 'center',
                  }}
                >
                  {([
                    { dir: 'FULL', label: 'Всё тело' },
                    { dir: 'UPPER', label: 'Верх' },
                    { dir: 'LOWER', label: 'Низ' },
                  ] as const).map(({ dir, label }) => (
                    <button
                      key={dir}
                      onClick={(e) => {
                        e.stopPropagation();
                        handleReplaceModule(index, dir);
                      }}
                      disabled={replacingModuleIndex === index && isReplacingModule}
                      style={{
                        flex: 1,
                        padding: '6px 2px',
                        borderRadius: '8px',
                        backgroundColor: 'rgba(161, 255, 74, 0.18)',
                        border: '1px solid rgba(161, 255, 74, 0.4)',
                        color: '#A1FF4A',
                        fontFamily: 'Overpass',
                        fontSize: '11px',
                        fontWeight: 700,
                        whiteSpace: 'nowrap',
                        cursor: replacingModuleIndex === index && isReplacingModule ? 'wait' : 'pointer',
                      }}
                      title={`Растяжка: ${label}`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Оборудование */}
      <div style={{
        width: '100%',
        padding: '16px',
        borderRadius: '16px',
        background: 'rgba(39, 42, 60, 0.5)',
        backdropFilter: 'blur(10px)'
      }}>
        <h3 style={{
          fontFamily: 'Overpass',
          fontWeight: 700,
          fontSize: '14px',
          lineHeight: '120%',
          letterSpacing: '0.5px',
          textTransform: 'uppercase',
          color: '#F9F8FE',
          marginBottom: '16px'
        }}>
          ОБОРУДОВАНИЕ:
        </h3>
        <div className="space-y-3">
          {(() => {
            // Получаем текущий активный модуль (первый незавершенный)
            const currentModule = workout?.modules?.find(m => !m.completed);
            const equipment = currentModule?.equipment || [];
            
            return equipment.length > 0 ? (
              equipment.map((item, index) => (
                <div key={index} style={{
                  fontFamily: 'Overpass',
                  fontWeight: 400,
                  fontSize: '14px',
                  lineHeight: '120%',
                  color: '#F9F8FE',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px'
                }}>
                  <span>{index + 1}.</span>
                  <span>{item}</span>
                </div>
              ))
            ) : (
              <div style={{
                fontFamily: 'Overpass',
                fontWeight: 400,
                fontSize: '14px',
                lineHeight: '120%',
                color: '#F9F8FE'
              }}>
                - (без специального оборудования)
              </div>
            );
          })()}
        </div>
      </div>

      {/* Фиксированная кнопка управления тренировкой */}
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
          onClick={startOrContinueWorkout}
          className="w-full rounded-full font-medium transition-all uppercase"
          style={{
            backgroundColor: '#A1FF4A',
            color: '#060919',
            fontFamily: 'Overpass, sans-serif',
            fontWeight: 700,
            fontSize: '16px',
            letterSpacing: '0.5px',
            cursor: 'pointer',
            height: '56px',
            padding: '0 16px',
          }}
        >
          {allCompleted
            ? 'Завершить тренировку'
            : workout && workout.modules.some(m => m.completed)
              ? 'Продолжить тренировку'
              : 'Начать тренировку'}
        </button>

        {/* Досрочный финиш: доступен, когда пройден хотя бы один модуль, но не
            все. Засчитываем пройденные модули, но без бонуса за полную тренировку
            (правки август-середина). */}
        {workout && !allCompleted && workout.modules.some(m => m.completed) && (
          <button
            type="button"
            onClick={() => setShowEarlyFinishModal(true)}
            className="w-full mt-2 rounded-full font-medium transition-all"
            style={{
              backgroundColor: 'transparent',
              color: '#AEABBB',
              fontFamily: 'Overpass, sans-serif',
              fontWeight: 600,
              fontSize: '14px',
              cursor: 'pointer',
              height: '44px',
              padding: '0 16px',
            }}
          >
            Завершить досрочно
          </button>
        )}
      </div>

      {/* Досрочный финиш — предупреждение «недозаработаешь X баллов».
          Пройденные модули засчитываются, но бонус за полную тренировку теряется. */}
      {showEarlyFinishModal && workout && (() => {
        const passed = workout.modules.filter(m => m.completed).length;
        const remaining = workout.modules.length - passed;
        const kept = passed * 20 * tempoMult;                 // засчитается сейчас
        const forfeited = (100 + remaining * 20) * tempoMult; // бонус + оставшиеся модули
        return (
          <div
            style={{
              position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.8)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              zIndex: 60, padding: 24,
            }}
            onClick={() => !earlyFinishing && setShowEarlyFinishModal(false)}
          >
            <div
              onClick={(e) => e.stopPropagation()}
              style={{
                backgroundColor: '#101530', border: '1px solid rgba(255,255,255,0.1)',
                borderRadius: 20, padding: 24, maxWidth: 360, width: '100%',
                fontFamily: 'Overpass, sans-serif',
              }}
            >
              <div style={{ color: '#F9F8FE', fontWeight: 700, fontSize: 20, marginBottom: 12 }}>
                Завершить досрочно?
              </div>
              <p style={{ color: '#AEABBB', fontSize: 14, lineHeight: '150%', marginBottom: 8 }}>
                Ты прошёл <b style={{ color: '#A1FF4A' }}>{passed}</b> {plural(passed, ['модуль', 'модуля', 'модулей'])} — они засчитаются
                (<b style={{ color: '#A1FF4A' }}>+{kept} XP</b>) вместе с приростом характеристик.
              </p>
              <p style={{ color: '#AEABBB', fontSize: 14, lineHeight: '150%', marginBottom: 20 }}>
                Не доделаешь {remaining} {plural(remaining, ['модуль', 'модуля', 'модулей'])} — недозаработаешь{' '}
                <b style={{ color: '#FF8C4A' }}>{forfeited} {plural(forfeited, ['балл', 'балла', 'баллов'])}</b>{' '}
                (бонус за полную тренировку + оставшиеся модули).
              </p>
              <button
                type="button"
                disabled={earlyFinishing}
                onClick={() => setShowEarlyFinishModal(false)}
                style={{
                  width: '100%', height: 52, borderRadius: 999, backgroundColor: '#A1FF4A',
                  color: '#060919', fontWeight: 700, fontSize: 16, cursor: 'pointer', marginBottom: 10,
                }}
              >
                Продолжить тренировку
              </button>
              <button
                type="button"
                disabled={earlyFinishing}
                onClick={async () => {
                  setEarlyFinishing(true);
                  setShowEarlyFinishModal(false);
                  await completeWorkout(true);
                  setEarlyFinishing(false);
                }}
                style={{
                  width: '100%', height: 48, borderRadius: 999, backgroundColor: 'transparent',
                  color: '#AEABBB', fontWeight: 600, fontSize: 14, cursor: 'pointer',
                }}
              >
                {earlyFinishing ? 'Сохраняем…' : 'Всё равно закончить'}
              </button>
            </div>
          </div>
        );
      })()}

      {/* Модальное окно завершения тренировки */}
      {showCompletionModal && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.8)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 9999,
            padding: '20px',
          }}
        >
          <div
            style={{
              backgroundColor: '#1A1F3A',
              borderRadius: '24px',
              padding: '32px 24px',
              maxWidth: '400px',
              width: '100%',
              textAlign: 'center',
              border: '1px solid rgba(161, 255, 74, 0.2)',
            }}
          >
            {/* Иконка успеха */}
            <div
              style={{
                width: '80px',
                height: '80px',
                borderRadius: '50%',
                backgroundColor: 'rgba(161, 255, 74, 0.1)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                margin: '0 auto 24px',
              }}
            >
              <span style={{ fontSize: '48px' }}>🎉</span>
            </div>

            {/* Заголовок */}
            <h2
              style={{
                fontFamily: 'Overpass, sans-serif',
                fontWeight: 700,
                fontSize: '24px',
                lineHeight: '120%',
                color: '#F9F8FE',
                marginBottom: '12px',
              }}
            >
              Тренировка завершена!
            </h2>

            {/* Текст поздравления */}
            <p
              style={{
                fontFamily: 'Overpass, sans-serif',
                fontWeight: 400,
                fontSize: '16px',
                lineHeight: '150%',
                color: 'rgba(249, 248, 254, 0.7)',
                marginBottom: '32px',
              }}
            >
              Отличная работа! Ты молодец, все модули пройдены успешно 💪
            </p>

            {/* Понравилась вся тренировка? — сохраняем составленное занятие целиком */}
            {workout && (
              <div
                style={{
                  background: 'rgba(174, 171, 187, 0.08)',
                  border: '1px solid rgba(174, 171, 187, 0.2)',
                  borderRadius: '16px',
                  padding: '16px',
                  marginBottom: '20px',
                  textAlign: 'left',
                }}
              >
                <div
                  style={{
                    fontFamily: 'Overpass, sans-serif',
                    fontWeight: 700,
                    fontSize: '14px',
                    color: '#F9F8FE',
                    marginBottom: 4,
                  }}
                >
                  Понравилась вся тренировка?
                </div>
                <div style={{ fontFamily: 'Overpass, sans-serif', fontSize: '12px', color: '#AEABBB', marginBottom: 12 }}>
                  Сохрани её целиком — сможешь повторить в любой момент из избранного.
                </div>
                <button
                  type="button"
                  disabled={favSaving || favSaved}
                  onClick={saveWorkoutToFavorites}
                  style={{
                    width: '100%',
                    height: '44px',
                    borderRadius: '22px',
                    background: favSaved ? 'rgba(161,255,74,0.15)' : 'transparent',
                    border: `1.5px solid ${favSaved ? '#A1FF4A' : 'rgba(161,255,74,0.5)'}`,
                    color: '#A1FF4A',
                    fontFamily: 'Overpass, sans-serif',
                    fontWeight: 800,
                    fontSize: '13px',
                    letterSpacing: '0.5px',
                    textTransform: 'uppercase',
                    cursor: favSaving || favSaved ? 'default' : 'pointer',
                    opacity: favSaving ? 0.6 : 1,
                  }}
                >
                  {favSaved ? '★ В избранном' : favSaving ? 'Сохраняю…' : '☆ Добавить в избранное'}
                </button>
              </div>
            )}

            {/* Кнопка завершения */}
            <button
              type="button"
              onClick={() => completeWorkout()}
              style={{
                width: '100%',
                height: '56px',
                borderRadius: '28px',
                backgroundColor: '#A1FF4A',
                color: '#060919',
                fontFamily: 'Overpass, sans-serif',
                fontWeight: 700,
                fontSize: '16px',
                letterSpacing: '0.5px',
                cursor: 'pointer',
                border: 'none',
                textTransform: 'uppercase',
              }}
            >
              Завершить тренировку
            </button>
          </div>
        </div>
      )}
      
      {/* Модалка прироста характеристик */}
      {showGainsModal && characteristicsGains && newCharacteristics && (
        <CharacteristicsGainModal
          gains={characteristicsGains}
          newCharacteristics={newCharacteristics}
          xpEarned={gainXp.xp}
          tempoMultiplier={gainXp.mult}
          onClose={handleGainsModalClose}
        />
      )}
      
      {/* Предложение собрать микроцикл после первой быстрой тренировки */}
      {showCycleOffer && (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
          <div className="absolute inset-0 bg-black/60" />
          <div className="relative w-full max-w-sm rounded-xl bg-[#0B0F2A] p-5 text-left shadow-lg border border-[rgba(68,92,255,0.35)]">
            <div className="text-white text-base font-semibold">Отличная работа! 💪</div>
            <div className="mt-2 text-white/80 text-sm">
              Ты всегда можешь собрать себе цикл на неделю во вкладке{' '}
              <span className="text-[#A1FF4A] font-semibold">«Календарь»</span> — ИИ-тренер
              распланирует 5 тренировок под тебя.
            </div>
            <div className="mt-4 flex flex-col gap-2">
              <button
                type="button"
                onClick={() => router.push('/calendar')}
                className="w-full rounded-lg bg-[#A1FF4A] px-3 py-2.5 text-sm font-semibold text-[#0B0F2A]"
              >
                Собрать неделю
              </button>
              <button
                type="button"
                onClick={() => { setShowCycleOffer(false); router.push('/'); }}
                className="w-full rounded-lg border border-white/20 px-3 py-2.5 text-sm font-semibold text-white"
              >
                Окей
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Toast уведомления */}
      {toast && (
        <Toast
          message={toast.message}
          type={toast.type}
          onClose={() => setToast(null)}
        />
      )}

      {/* Ручной подбор модуля: поиск + фильтр */}
      {pickerIndex !== null && workout && (
        <ModuleSelectionModal
          sessionId={workout.id}
          moduleIndex={pickerIndex}
          onClose={() => setPickerIndex(null)}
          onPicked={() => { loadWorkout(); setToast({ message: '✅ Модуль обновлён', type: 'success' }); }}
        />
      )}
    </div>
  );
}
