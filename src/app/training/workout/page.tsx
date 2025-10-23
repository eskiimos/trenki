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
