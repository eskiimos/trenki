'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useTelegram } from '@/hooks/useTelegram';

interface WorkoutModule {
  id: string;
  moduleId: string;
  name: string;
  description: string | null;
  type: string;
  duration: number;
  rpeRange: string;
  video: any;
  order: number;
  completed: boolean;
  actualRPE: number | null;
}

interface Workout {
  id: string;
  status: string;
  targetDuration: number;
  targetRPE: number;
  loadDirection: string;
  progress: number;
  createdAt: string;
  modules: WorkoutModule[];
  equipment?: string[];
}

export default function WorkoutPage() {
  const router = useRouter();
  const { user, webApp } = useTelegram();
  
  const [workout, setWorkout] = useState<Workout | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [showInfoBlock, setShowInfoBlock] = useState(true);
  const [isClosing, setIsClosing] = useState(false);

  useEffect(() => {
    if (webApp) {
      webApp.BackButton.show();
      webApp.BackButton.onClick(() => router.back());
      
      return () => {
        webApp.BackButton.hide();
      };
    }
  }, [webApp, router]);

  useEffect(() => {
    if (user?.id) {
      loadWorkout();
    }
  }, [user]);

  const loadWorkout = async () => {
    try {
      const response = await fetch(`/api/training/current?userId=${user?.id}`);
      const data = await response.json();

      if (data.success) {
        setWorkout(data.workout);
      } else {
        // Нет активной тренировки, перенаправляем на оценку
        router.push('/training/assessment');
      }
    } catch (error) {
      console.error('Ошибка загрузки тренировки:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleCloseInfo = () => {
    setIsClosing(true);
    setTimeout(() => {
      setShowInfoBlock(false);
      setIsClosing(false);
    }, 300);
  };

  const startWorkout = () => {
    // Переход к первому модулю
    if (workout && workout.modules.length > 0) {
      router.push(`/training/module/${workout.modules[0].id}`);
    }
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

  if (!workout) {
    return null;
  }

  const moduleTypeInfo = {
    WARMUP: { label: 'РАЗМИНКА', number: 1 },
    FITNESS: { label: 'ФИЗИЧЕСКАЯ ПОДГОТОВКА', number: 2 },
    TECHNIQUE: { label: 'ТЕХНИКА', number: 3 },
    COOLDOWN: { label: 'ЗАМИНКА', number: 4 },
  };

  return (
    <div className="min-h-screen bg-[#101530] text-white p-4" style={{ paddingTop: '60px', paddingBottom: '100px' }}>
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
          color: '#F9F8FE'
        }}>
          ПЕРСОНАЛЬНАЯ ТРЕНИРОВКА
        </h1>
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

      {/* Модули тренировки */}
      <div className="grid grid-cols-2 gap-4 mb-6">
        {workout.modules.map((module, index) => {
          const info = moduleTypeInfo[module.type as keyof typeof moduleTypeInfo];
          const isActive = index === 0; // Первый модуль активный
          
          return (
            <div
              key={module.id}
              style={{
                width: '100%',
                height: '254px',
                padding: '16px',
                borderRadius: '16px',
                background: isActive 
                  ? 'linear-gradient(180deg, rgba(68, 92, 255, 0.5) 0%, rgba(68, 92, 255, 0) 100%)'
                  : 'rgba(39, 42, 60, 0.5)',
                backdropFilter: 'blur(10px)',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
                position: 'relative',
                opacity: isActive ? 1 : 0.6
              }}
            >
              {/* Номер */}
              <div style={{
                fontFamily: 'Overpass',
                fontWeight: 700,
                fontSize: '80px',
                lineHeight: '100%',
                color: '#F9F8FE',
                opacity: 0.1,
                position: 'absolute',
                top: '16px',
                right: '16px'
              }}>
                {info?.number || index + 1}
              </div>

              {/* Название модуля */}
              <div style={{
                fontFamily: 'Overpass',
                fontWeight: 700,
                fontSize: '14px',
                lineHeight: '120%',
                letterSpacing: '0.5px',
                textTransform: 'uppercase',
                color: '#F9F8FE',
                marginTop: 'auto'
              }}>
                {info?.label || module.type}
              </div>
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
          {workout.equipment && workout.equipment.length > 0 ? (
            workout.equipment.map((item, index) => (
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
          )}
        </div>
      </div>

      {/* Фиксированная кнопка "Начать тренировку" */}
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
          onClick={startWorkout}
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
          Начать тренировку
        </button>
      </div>
    </div>
  );
}

export default function WorkoutPage() {
  const router = useRouter();
  const { user, webApp } = useTelegram();
  
  const [workout, setWorkout] = useState<Workout | null>(null);
  const [currentModuleIndex, setCurrentModuleIndex] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [isCompleting, setIsCompleting] = useState(false);
  const [showRPEModal, setShowRPEModal] = useState(false);
  const [selectedRPE, setSelectedRPE] = useState(5);
  const [startTime, setStartTime] = useState<number | null>(null);

  useEffect(() => {
    if (webApp) {
      webApp.BackButton.show();
      webApp.BackButton.onClick(() => router.back());
      
      return () => {
        webApp.BackButton.hide();
      };
    }
  }, [webApp, router]);

  useEffect(() => {
    if (user?.id) {
      loadWorkout();
    }
  }, [user]);

  const loadWorkout = async () => {
    try {
      const response = await fetch(`/api/training/current?userId=${user?.id}`);
      const data = await response.json();

      if (data.success) {
        setWorkout(data.workout);
        
        // Находим первый незавершенный модуль
        const firstIncomplete = data.workout.modules.findIndex((m: WorkoutModule) => !m.completed);
        if (firstIncomplete !== -1) {
          setCurrentModuleIndex(firstIncomplete);
        }

        // Если тренировка еще не начата, начинаем её
        if (data.workout.status === 'PENDING') {
          await startWorkout(data.workout.id);
        }
      } else {
        // Нет активной тренировки, перенаправляем на оценку
        router.push('/training/assessment');
      }
    } catch (error) {
      console.error('Ошибка загрузки тренировки:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const startWorkout = async (workoutId: string) => {
    try {
      await fetch('/api/training/current', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          workoutId,
          action: 'start',
        }),
      });
      
      setStartTime(Date.now());
    } catch (error) {
      console.error('Ошибка начала тренировки:', error);
    }
  };

  const completeModule = async () => {
    if (!workout) return;

    setShowRPEModal(true);
  };

  const submitModuleCompletion = async () => {
    if (!workout) return;

    const currentModule = workout.modules[currentModuleIndex];
    setIsCompleting(true);

    try {
      await fetch('/api/training/current', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          workoutId: workout.id,
          action: 'completeModule',
          moduleId: currentModule.id,
          actualRPE: selectedRPE,
        }),
      });

      // Обновляем локальное состояние
      const updatedModules = [...workout.modules];
      updatedModules[currentModuleIndex].completed = true;
      updatedModules[currentModuleIndex].actualRPE = selectedRPE;
      
      setWorkout({
        ...workout,
        modules: updatedModules,
      });

      setShowRPEModal(false);

      // Переходим к следующему модулю или завершаем
      if (currentModuleIndex < workout.modules.length - 1) {
        setCurrentModuleIndex(currentModuleIndex + 1);
      } else {
        // Все модули завершены
        await completeWorkout();
      }
    } catch (error) {
      console.error('Ошибка завершения модуля:', error);
    } finally {
      setIsCompleting(false);
    }
  };

  const completeWorkout = async () => {
    if (!workout || !startTime) return;

    const actualDuration = Math.round((Date.now() - startTime) / 60000); // в минутах

    try {
      await fetch('/api/training/current', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          workoutId: workout.id,
          action: 'complete',
          actualDuration,
        }),
      });

      // Показываем поздравление
      if (webApp) {
        webApp.showAlert('Тренировка завершена! Отличная работа! 💪', () => {
          router.push('/training/history');
        });
      } else {
        alert('Тренировка завершена! Отличная работа! 💪');
        router.push('/training/history');
      }
    } catch (error) {
      console.error('Ошибка завершения тренировки:', error);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#101530] flex items-center justify-center">
        <div className="text-white text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white mx-auto mb-4"></div>
          <p>Загрузка тренировки...</p>
        </div>
      </div>
    );
  }

  if (!workout) {
    return null;
  }

  const currentModule = workout.modules[currentModuleIndex];
  const progress = ((currentModuleIndex + (currentModule.completed ? 1 : 0)) / workout.modules.length) * 100;

  const loadDirectionLabels = {
    LIGHT: { text: 'Легкая', color: 'text-green-400', bg: 'bg-green-900/30' },
    MEDIUM: { text: 'Средняя', color: 'text-yellow-400', bg: 'bg-yellow-900/30' },
    HIGH: { text: 'Интенсивная', color: 'text-red-400', bg: 'bg-red-900/30' },
  };

  const loadLabel = loadDirectionLabels[workout.loadDirection as keyof typeof loadDirectionLabels] || loadDirectionLabels.MEDIUM;

  const moduleTypeLabels = {
    WARMUP: { icon: '🔥', text: 'Разминка', color: 'bg-orange-600' },
    MAIN: { icon: '💪', text: 'Основная часть', color: 'bg-blue-600' },
    COOLDOWN: { icon: '🧘', text: 'Заминка', color: 'bg-purple-600' },
    RECOVERY: { icon: '✨', text: 'Восстановление', color: 'bg-green-600' },
  };

  const moduleLabel = moduleTypeLabels[currentModule.type as keyof typeof moduleTypeLabels] || moduleTypeLabels.MAIN;

  return (
    <div className="min-h-screen bg-[#101530] text-white pb-24">
      {/* Шапка с прогрессом */}
      <div className="bg-gray-900 p-4">
        <div className="flex justify-between items-center mb-3">
          <div>
            <h1 className="text-xl font-bold">Ваша тренировка</h1>
            <p className={`text-sm ${loadLabel.color}`}>{loadLabel.text} • RPE {workout.targetRPE}/10</p>
          </div>
          <div className="text-right">
            <p className="text-2xl font-bold">{Math.round(progress)}%</p>
            <p className="text-xs text-gray-400">{currentModuleIndex + 1}/{workout.modules.length}</p>
          </div>
        </div>
        <div className="h-2 bg-gray-700 rounded-full overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-blue-600 to-blue-400 transition-all duration-500"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>

      {/* Текущий модуль */}
      <div className="p-4">
        <div className={`inline-flex items-center gap-2 px-3 py-1 rounded-full ${moduleLabel.color} text-sm font-medium mb-4`}>
          <span>{moduleLabel.icon}</span>
          <span>{moduleLabel.text}</span>
        </div>

        <h2 className="text-3xl font-bold mb-2">{currentModule.name}</h2>
        {currentModule.description && (
          <p className="text-gray-400 mb-4">{currentModule.description}</p>
        )}

        <div className="grid grid-cols-2 gap-3 mb-6">
          <div className="bg-gray-800 p-4 rounded-xl">
            <p className="text-gray-400 text-sm">Длительность</p>
            <p className="text-2xl font-bold">{Math.round(currentModule.duration / 60)} мин</p>
          </div>
          <div className="bg-gray-800 p-4 rounded-xl">
            <p className="text-gray-400 text-sm">Целевой RPE</p>
            <p className="text-2xl font-bold">{currentModule.rpeRange}</p>
          </div>
        </div>

        {/* Видео */}
        {currentModule.video && (
          <div className="bg-gray-800 rounded-xl overflow-hidden mb-6">
            <div className="aspect-video bg-gray-700 flex items-center justify-center">
              <svg className="w-20 h-20 text-gray-600" fill="currentColor" viewBox="0 0 20 20">
                <path d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832l3-2a1 1 0 000-1.664l-3-2z" />
              </svg>
            </div>
            <div className="p-4">
              <h3 className="font-semibold">{currentModule.video.title}</h3>
              <p className="text-sm text-gray-400">{currentModule.video.description}</p>
            </div>
          </div>
        )}

        {/* Кнопка завершения */}
        {!currentModule.completed && (
          <button
            onClick={completeModule}
            disabled={isCompleting}
            className="w-full bg-green-600 hover:bg-green-700 text-white py-4 rounded-xl font-semibold transition-colors disabled:opacity-50"
          >
            ✅ Завершить упражнение
          </button>
        )}

        {/* Список всех модулей */}
        <div className="mt-8">
          <h3 className="text-lg font-semibold mb-4">План тренировки</h3>
          <div className="space-y-2">
            {workout.modules.map((module, index) => (
              <div
                key={module.id}
                className={`flex items-center gap-3 p-3 rounded-xl transition-all ${
                  index === currentModuleIndex
                    ? 'bg-blue-600'
                    : module.completed
                    ? 'bg-green-900/30'
                    : 'bg-gray-800'
                }`}
              >
                <div className="flex-shrink-0 w-8 h-8 rounded-full bg-gray-700 flex items-center justify-center font-semibold">
                  {module.completed ? '✓' : index + 1}
                </div>
                <div className="flex-1">
                  <p className="font-medium">{module.name}</p>
                  <p className="text-sm text-gray-400">{Math.round(module.duration / 60)} мин • RPE {module.rpeRange}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Модальное окно оценки RPE */}
      {showRPEModal && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center p-4 z-50">
          <div className="bg-gray-900 rounded-2xl p-6 max-w-md w-full">
            <h3 className="text-2xl font-bold mb-2">Как прошло упражнение?</h3>
            <p className="text-gray-400 mb-6">Оцените уровень нагрузки (RPE 1-10)</p>
            
            <div className="space-y-4 mb-6">
              <input
                type="range"
                min="1"
                max="10"
                value={selectedRPE}
                onChange={(e) => setSelectedRPE(parseInt(e.target.value))}
                className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-blue-500"
              />
              <div className="flex justify-between text-sm text-gray-400">
                <span>Очень легко</span>
                <span className="text-3xl font-bold text-white">{selectedRPE}/10</span>
                <span>Максимум</span>
              </div>
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => setShowRPEModal(false)}
                className="flex-1 bg-gray-700 hover:bg-gray-600 text-white py-3 rounded-xl font-semibold transition-colors"
              >
                Отмена
              </button>
              <button
                onClick={submitModuleCompletion}
                disabled={isCompleting}
                className="flex-1 bg-blue-600 hover:bg-blue-700 text-white py-3 rounded-xl font-semibold transition-colors disabled:opacity-50"
              >
                {isCompleting ? '⏳ Сохраняем...' : 'Подтвердить'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
