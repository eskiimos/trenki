'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useTelegram } from '@/hooks/useTelegram';
import CharacteristicsGainModal from '@/components/CharacteristicsGainModal';
import Toast from '@/components/Toast';
import ModuleSelectionModal from '@/components/ModuleSelectionModal';
import { Check, Play, Lightbulb, PartyPopper, RefreshCw, Search, SkipForward, Star, Zap } from 'lucide-react';
import { CharacteristicIcon } from '@/components/training/icons';

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
  /** Осознанно пропущен («Пропустить модуль»): не блокирует финиш, но XP и
   *  прироста не даёт; сессия со скипами завершается как PARTIAL. */
  skipped?: boolean;
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
  
  // Состояние для модалки прироста характеристик
  const [showGainsModal, setShowGainsModal] = useState(false);
  const [characteristicsGains, setCharacteristicsGains] = useState<any>(null);
  const [newCharacteristics, setNewCharacteristics] = useState<any>(null);
  const [gainXp, setGainXp] = useState<{ xp: number; mult: number }>({ xp: 0, mult: 1 });

  // Пропуск модуля: индекс-цель + предпросмотр «что теряешь» (skip-preview).
  const [skipIndex, setSkipIndex] = useState<number | null>(null);
  const [skipPreview, setSkipPreview] = useState<{
    xp: number;
    /** Бонус ×100 за полную тренировку — сгорает на ПЕРВОМ скипе сессии */
    bonusForfeited?: number;
    gains: Record<string, number>;
    potentialGain: number;
  } | null>(null);
  const [skipping, setSkipping] = useState(false);

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
  // Выбранное направление растяжки для заминки (подсветка в панели действий:
  // раньше активного состояния не было вовсе — не понять, что уже выбрано)
  const [stretchDir, setStretchDir] = useState<'FULL' | 'UPPER' | 'LOWER' | null>(null);

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

  // «Можно завершать»: каждый модуль либо пройден, либо осознанно пропущен,
  // и есть хотя бы один пройденный (скип ВСЕХ закрывает сессию на сервере).
  const allCompleted =
    !!workout &&
    workout.modules.length > 0 &&
    workout.modules.every(m => m.completed || m.skipped) &&
    workout.modules.some(m => m.completed);

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
        message: data?.alreadyExists ? 'Уже в избранном' : 'Тренировка сохранена в избранное',
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
        // Подсветка направления растяжки относится к КОНКРЕТНОЙ тренировке —
        // при загрузке другой сбрасываем, иначе покажет чужой выбор.
        setStretchDir(null);
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

  /** Открыть предупреждение о пропуске: тянем честный расчёт «что теряешь». */
  const openSkipModal = (index: number) => {
    if (!workout) return;
    setSkipIndex(index);
    setSkipPreview(null);
    const m = workout.modules[index];
    fetch(`/api/training/skip-preview?sessionId=${workout.id}&videoId=${m.id}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (d && typeof d.xp === 'number') setSkipPreview(d);
      })
      .catch(() => {});
  };

  const confirmSkip = async () => {
    if (!workout || skipIndex === null || skipping) return;
    const m = workout.modules[skipIndex];
    setSkipping(true);
    try {
      const res = await fetch('/api/training/update', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId: workout.id, videoId: m.id, action: 'skip' }),
      });
      if (!res.ok) return;
      const d = await res.json();
      if (d.allSkipped) {
        // Все модули пропущены — сервер закрыл сессию как SKIPPED
        router.push('/');
        return;
      }
      setWorkout((prev) =>
        prev
          ? {
              ...prev,
              modules: prev.modules.map((mod, i) =>
                i === skipIndex ? { ...mod, skipped: true } : mod,
              ),
            }
          : prev,
      );
      setSkipIndex(null);
      setSkipPreview(null);
    } catch {
    } finally {
      setSkipping(false);
    }
  };

  const startOrContinueWorkout = () => {
    if (!workout || workout.modules.length === 0) return;

    if (allCompleted) {
      completeWorkout();
      return;
    }

    const firstIncompleteIndex = workout.modules.findIndex(m => !m.completed && !m.skipped);
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
          message: `Модуль заменен на "${data.newModule.title}"`,
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
            message: data.error || 'Достигнут дневной лимит тренировок. Приходи завтра!',
            type: 'warning'
          });
          setTimeout(() => router.push('/'), 3000);
        } else {
          setToast({ message: 'Тренировка завершена!', type: 'success' });
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
            message: errorData.error || 'Достигнут дневной лимит тренировок. Приходи завтра!',
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
              <span className="text-brand font-semibold inline-flex items-center gap-2">
                <Lightbulb size={16} aria-hidden />
                Что можно сделать:
              </span>
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
    // Клиренс снизу: в фикс-баре теперь до трёх кнопок (завершить + избранное
    // + досрочный финиш) — 100px не хватало, последний блок уезжал под бар.
    <div
      className="min-h-screen bg-surface text-white p-4"
      style={{
        paddingBottom: 'calc(var(--safe-bottom) + 220px)',
        paddingTop: 'calc(env(safe-area-inset-top, 0px) + 16px)',
      }}
    >
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
          const isSkipped = !!module.skipped && !isCompleted;

          // Находим первый незавершенный модуль (пропущенные не в счёт)
          const firstIncompleteIndex = workout.modules.findIndex(m => !m.completed && !m.skipped);

          // Модуль активен, если:
          // 1. Он не завершен и не пропущен
          // 2. Это первый незавершенный модуль (в случае рассинхронизации с currentVideoIndex)
          const isActive = !isCompleted && !isSkipped && index === firstIncompleteIndex;
          const isLocked = (!isCompleted && !isActive) || isSkipped;

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
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                }}>
                  <Check size={16} aria-hidden />
                  Завершено
                </div>
              )}

              {/* Индикатор пропущенного модуля */}
              {isSkipped && (
                <div style={{
                  position: 'absolute',
                  top: '12px',
                  left: '12px',
                  zIndex: 3,
                  padding: '4px 8px',
                  borderRadius: '12px',
                  background: 'rgba(174, 171, 187, 0.75)',
                  fontFamily: 'Overpass',
                  fontWeight: 600,
                  fontSize: '10px',
                  color: '#101530',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                }}>
                  <SkipForward size={14} aria-hidden />
                  Пропущен
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
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                }}>
                  <Play size={16} fill="currentColor" aria-hidden />
                  Текущий
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
            // Текущий активный модуль — тот же, что подсвечен в сетке:
            // пропущенные не в счёт (раньше find(!completed) брал скипнутый
            // модуль, и оборудование расходилось с карточкой «Текущий»).
            const currentModule = workout?.modules?.find(m => !m.completed && !m.skipped);
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

      {/* Панель действий над ТЕКУЩИМ модулем (правка владельца: «использовать
          свободное место между инвентарём и кнопкой продолжить»).
          Раньше все эти контролы висели абсолютом поверх карточки модуля, и на
          заминке ряд «Всё тело/Верх/Низ» ложился прямо на кнопки замены —
          пилюли перехватывали клики, и заменить/пропустить было невозможно.
          Все они и так относились только к активному модулю, поэтому вынос
          сюда ничего не ломает и заодно даёт нормальные тач-таргеты. */}
      {(() => {
        const activeIndex = workout.modules.findIndex((m) => !m.completed && !m.skipped);
        if (activeIndex === -1) return null;
        const activeModule = workout.modules[activeIndex];
        const busy = replacingModuleIndex === activeIndex && isReplacingModule;
        const canReplace = !!activeModule.equipment && activeModule.equipment.length > 0;
        const actionStyle: React.CSSProperties = {
          flex: 1,
          minHeight: 44,
          borderRadius: 12,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 6,
          fontFamily: 'Overpass',
          fontWeight: 700,
          fontSize: 12,
          letterSpacing: '0.3px',
          cursor: busy ? 'wait' : 'pointer',
        };
        return (
          <div
            style={{
              width: '100%',
              marginTop: 16,
              padding: 16,
              borderRadius: 16,
              background: 'rgba(39, 42, 60, 0.5)',
              backdropFilter: 'blur(10px)',
            }}
          >
            <div
              style={{
                fontFamily: 'Overpass',
                fontWeight: 700,
                fontSize: 11,
                letterSpacing: '0.5px',
                textTransform: 'uppercase',
                color: '#AEABBB',
                marginBottom: 4,
              }}
            >
              Сейчас
            </div>
            {/* Название текущего модуля — на карточке его нет вообще */}
            <div
              style={{
                fontFamily: 'Overpass',
                fontWeight: 700,
                fontSize: 14,
                lineHeight: '120%',
                color: '#F9F8FE',
                marginBottom: 12,
              }}
            >
              {activeModule.title}
            </div>

            {/* auto-fit, а не flex: на 320px три подписи с иконками в один ряд
                не помещаются — лишняя кнопка переносится на вторую строку */}
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(100px, 1fr))',
                gap: 8,
              }}
            >
              {canReplace && (
                <button
                  type="button"
                  onClick={() => handleReplaceModule(activeIndex)}
                  disabled={busy}
                  style={{
                    ...actionStyle,
                    backgroundColor: 'rgba(161, 255, 74, 0.18)',
                    border: '1px solid rgba(161, 255, 74, 0.4)',
                    color: '#A1FF4A',
                  }}
                >
                  <RefreshCw size={16} aria-hidden className={busy ? 'animate-spin' : ''} />
                  Заменить
                </button>
              )}
              <button
                type="button"
                onClick={() => setPickerIndex(activeIndex)}
                style={{
                  ...actionStyle,
                  backgroundColor: 'rgba(68, 92, 255, 0.22)',
                  border: '1px solid rgba(68, 92, 255, 0.45)',
                  color: '#A9B6FF',
                }}
              >
                <Search size={16} aria-hidden />
                Выбрать
              </button>
              <button
                type="button"
                onClick={() => openSkipModal(activeIndex)}
                style={{
                  ...actionStyle,
                  backgroundColor: 'rgba(174, 171, 187, 0.14)',
                  border: '1px solid rgba(174, 171, 187, 0.35)',
                  color: '#AEABBB',
                }}
              >
                <SkipForward size={16} aria-hidden />
                Пропустить
              </button>
            </div>

            {/* Направление растяжки — только для заминки. Теперь на всю ширину
                панели, а не в 155px карточки: подписи наконец помещаются. */}
            {activeModule.moduleType === 'COOLDOWN' && (
              <div style={{ marginTop: 12 }}>
                <div
                  style={{
                    fontFamily: 'Overpass',
                    fontWeight: 700,
                    fontSize: 11,
                    letterSpacing: '0.5px',
                    textTransform: 'uppercase',
                    color: '#AEABBB',
                    marginBottom: 8,
                  }}
                >
                  Растяжка на
                </div>
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fit, minmax(84px, 1fr))',
                    gap: 8,
                  }}
                >
                  {([
                    { dir: 'FULL', label: 'Всё тело' },
                    { dir: 'UPPER', label: 'Верх' },
                    { dir: 'LOWER', label: 'Низ' },
                  ] as const).map(({ dir, label }) => {
                    const selected = stretchDir === dir;
                    return (
                      <button
                        key={dir}
                        type="button"
                        onClick={() => {
                          setStretchDir(dir);
                          handleReplaceModule(activeIndex, dir);
                        }}
                        disabled={busy}
                        style={{
                          ...actionStyle,
                          backgroundColor: selected
                            ? 'rgba(161, 255, 74, 0.28)'
                            : 'rgba(161, 255, 74, 0.12)',
                          border: `1px solid rgba(161, 255, 74, ${selected ? 0.7 : 0.3})`,
                          color: '#A1FF4A',
                        }}
                      >
                        {label}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        );
      })()}

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

        {/* «В избранное» — правка владельца: «между модулями и завершить
            тренировку можно добавить ⭐ добавить тренировку в избранное».
            Кнопка существовала, но жила внутри модалки showCompletionModal,
            вызов которой удалили ещё 29.01 (ce403e4) — на экране её не было
            вовсе, отсюда «я не понял как лайкнуть тренировку». Теперь она в
            живом баре и видна, как только пройден хотя бы один модуль. */}
        {workout && workout.modules.some((m) => m.completed) && (
          <button
            type="button"
            onClick={saveWorkoutToFavorites}
            disabled={favSaving || favSaved}
            className="w-full mt-2 rounded-full transition-transform active:scale-95"
            style={{
              backgroundColor: favSaved ? 'rgba(161, 255, 74, 0.16)' : 'transparent',
              border: `1px solid ${favSaved ? 'rgba(161,255,74,0.5)' : 'rgba(174,171,187,0.35)'}`,
              color: favSaved ? '#A1FF4A' : '#F9F8FE',
              fontFamily: 'Overpass, sans-serif',
              fontWeight: 700,
              fontSize: '14px',
              cursor: favSaving || favSaved ? 'default' : 'pointer',
              height: '44px',
              padding: '0 16px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 8,
            }}
          >
            <Star size={18} fill={favSaved ? 'currentColor' : 'none'} aria-hidden />
            {favSaved ? 'В избранном' : favSaving ? 'Сохраняем…' : 'Добавить в избранное'}
          </button>
        )}

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

      {/* Пропуск модуля — красивое предупреждение «что теряешь» (решение
          владельца): прирост по характеристикам с иконками, XP, потенциал.
          Оверлей скроллится сам — урок Galaxy Fold. */}
      {skipIndex !== null && workout && (() => {
        const m = workout.modules[skipIndex];
        const CHAR_LABELS: Record<string, string> = {
          ratingPower: 'Сила',
          ratingSpeed: 'Скорость',
          ratingEndurance: 'Выносливость',
          ratingTechnique: 'Техника',
          ratingFlexibility: 'Гибкость',
        };
        const gainRows = skipPreview
          ? Object.entries(skipPreview.gains).filter(([, v]) => v > 0.0005)
          : [];
        const xpLoss = skipPreview ? skipPreview.xp * tempoMult : null;
        return (
          <div
            className="fixed inset-0 z-50 overflow-y-auto overscroll-contain bg-black/80 backdrop-blur-sm"
            onClick={() => { setSkipIndex(null); setSkipPreview(null); }}
            role="dialog"
            aria-modal="true"
          >
            <div
              className="min-h-full flex items-center justify-center p-4"
              style={{
                paddingTop: 'calc(var(--safe-top) + var(--space-4))',
                paddingBottom: 'calc(var(--safe-bottom) + var(--space-4))',
              }}
            >
              <div
                className="w-full max-w-md rounded-3xl p-4 sm:p-6"
                style={{ background: '#101530', border: '1px solid rgba(255,255,255,0.08)' }}
                onClick={(e) => e.stopPropagation()}
              >
                <div className="text-center mb-4">
                  <div className="w-14 h-14 mx-auto mb-3 rounded-full flex items-center justify-center bg-white/10">
                    <SkipForward size={26} className="text-muted" aria-hidden />
                  </div>
                  <h2 className="text-white text-lg font-bold font-overpass">
                    Пропустить модуль?
                  </h2>
                  <p className="text-muted text-sm font-overpass mt-1">
                    {m.title}
                  </p>
                </div>

                <p className="text-muted text-xs font-overpass mb-2">
                  Пропуская, ты не получишь:
                </p>
                <div className="flex flex-col gap-2 mb-4">
                  {gainRows.map(([key, value]) => (
                    <div
                      key={key}
                      className="rounded-xl px-3 py-2.5 flex items-center justify-between gap-2"
                      style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)' }}
                    >
                      <span className="flex items-center gap-2 min-w-0">
                        <CharacteristicIcon characteristic={key} size={18} className="text-brand shrink-0" />
                        <span className="text-white text-sm font-overpass truncate">{CHAR_LABELS[key] ?? key}</span>
                      </span>
                      <span className="text-brand text-sm font-bold font-overpass tabular-nums shrink-0">
                        +{value.toFixed(2)}
                      </span>
                    </div>
                  ))}
                  {skipPreview && skipPreview.potentialGain > 0 && (
                    <div
                      className="rounded-xl px-3 py-2.5 flex items-center justify-between gap-2"
                      style={{ background: 'rgba(68,92,255,0.15)', border: '1px solid rgba(68,92,255,0.35)' }}
                    >
                      <span className="flex items-center gap-2">
                        <Zap size={18} className="text-white shrink-0" fill="currentColor" aria-hidden />
                        <span className="text-white text-sm font-overpass">Потенциал</span>
                      </span>
                      <span className="text-white text-sm font-bold font-overpass tabular-nums shrink-0">
                        +{skipPreview.potentialGain.toFixed(2)}
                      </span>
                    </div>
                  )}
                  {xpLoss !== null && (
                    <div
                      className="rounded-xl px-3 py-2.5 flex items-center justify-between gap-2"
                      style={{ background: 'rgba(161,255,74,0.10)', border: '1px solid rgba(161,255,74,0.35)' }}
                    >
                      <span className="flex items-center gap-2">
                        <Star size={18} className="text-brand shrink-0" fill="currentColor" aria-hidden />
                        <span className="text-white text-sm font-overpass">Опыт за модуль</span>
                        {tempoMult > 1 && (
                          <span className="text-danger text-[10px] font-bold font-overpass rounded-full px-1.5 py-0.5 border border-danger/40">
                            ×{tempoMult}
                          </span>
                        )}
                      </span>
                      <span className="text-brand text-sm font-bold font-overpass tabular-nums shrink-0">
                        +{xpLoss} XP
                      </span>
                    </div>
                  )}
                  {/* Первый скип сжигает и бонус за ПОЛНУЮ тренировку — без
                      этой строки цена пропуска занижалась в разы, и скип
                      выглядел «дешевле» досрочного финиша */}
                  {skipPreview && (skipPreview.bonusForfeited ?? 0) > 0 && (
                    <div
                      className="rounded-xl px-3 py-2.5 flex items-center justify-between gap-2"
                      style={{ background: 'rgba(255,140,74,0.10)', border: '1px solid rgba(255,140,74,0.35)' }}
                    >
                      <span className="flex items-center gap-2 min-w-0">
                        <PartyPopper size={18} className="text-danger shrink-0" aria-hidden />
                        <span className="text-white text-sm font-overpass leading-tight">
                          Бонус за полную тренировку
                        </span>
                        {tempoMult > 1 && (
                          <span className="text-danger text-[10px] font-bold font-overpass rounded-full px-1.5 py-0.5 border border-danger/40 shrink-0">
                            ×{tempoMult}
                          </span>
                        )}
                      </span>
                      <span className="text-danger text-sm font-bold font-overpass tabular-nums shrink-0">
                        +{(skipPreview.bonusForfeited ?? 0) * tempoMult} XP
                      </span>
                    </div>
                  )}
                  {!skipPreview && (
                    <div className="text-muted text-xs text-center py-2">Считаем…</div>
                  )}
                </div>

                <div className="flex flex-col gap-2">
                  <button
                    type="button"
                    onClick={() => { setSkipIndex(null); setSkipPreview(null); }}
                    className="w-full rounded-full font-overpass font-extrabold uppercase text-sm py-3.5 transition-transform active:scale-95"
                    style={{ background: '#A1FF4A', color: '#060919', border: 'none' }}
                  >
                    Продолжить тренировку
                  </button>
                  <button
                    type="button"
                    onClick={confirmSkip}
                    disabled={skipping}
                    className="w-full rounded-full font-overpass font-semibold text-sm py-3 disabled:opacity-50"
                    style={{ background: 'transparent', color: '#AEABBB', border: '1px solid rgba(174,171,187,0.35)' }}
                  >
                    {skipping ? 'Пропускаем…' : 'Всё равно пропустить'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        );
      })()}

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
            <div className="text-white text-base font-semibold flex items-center gap-2">
              <PartyPopper size={20} className="text-brand" aria-hidden />
              Отличная работа!
            </div>
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
          onPicked={() => { loadWorkout(); setToast({ message: 'Модуль обновлён', type: 'success' }); }}
        />
      )}
    </div>
  );
}
