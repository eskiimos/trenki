'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useTelegram } from '@/hooks/useTelegram';
import CircularSlider from '@/components/CircularSlider2';

type LastTrainingTime = 'TODAY' | 'YESTERDAY' | 'TWO_DAYS_AGO' | 'THREE_PLUS_DAYS' | 'WEEK_PLUS';

export default function TrainingAssessmentPage() {
  const router = useRouter();
  const { user, webApp, isLoading: userLoading } = useTelegram();
  
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  // Состояние формы
  const [formData, setFormData] = useState({
    lastTrainingTime: '' as LastTrainingTime | '',
    energyLevel: 0,
  });

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
    console.log('🎯 Assessment submit - User:', user);
    console.log('🔍 User loading state:', userLoading);
    
    if (!user?.id) {
      console.error('❌ No user ID found');
      alert('Ошибка: пользователь не авторизован. Попробуйте перезагрузить страницу.');
      return;
    }

    if (!formData.lastTrainingTime) {
      alert('Пожалуйста, ответьте на все вопросы');
      return;
    }

    setIsSubmitting(true);

    try {
      const assessmentPayload = {
        userId: user.id.toString(),
        ...formData,
        // Добавляем значения по умолчанию для удаленных полей
        muscleReadiness: 5,
        motivation: 5,
        availableTime: 30,
      };
      
      console.log('📤 Sending assessment:', assessmentPayload);
      
      const response = await fetch('/api/training/assessment', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(assessmentPayload),
      });

      const data = await response.json();
      console.log('📥 Assessment response:', data);

      if (data.success) {
        // Сразу генерируем тренировку
        const generatePayload = {
          userId: user.id.toString(),
          assessmentId: data.assessment.id,
        };
        
        console.log('📤 Generating workout:', generatePayload);
        
        const generateResponse = await fetch('/api/training/generate-v2', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(generatePayload),
        });

        const generateData = await generateResponse.json();
        console.log('📥 Generate response:', generateData);

        if (generateData.success) {
          console.log('✅ Workout generated, redirecting...');
          // Переходим на страницу тренировки
          router.push('/training/workout');
        } else {
          console.error('❌ Generate error:', generateData.error);
          
          // Если профиль не найден, редиректим на стартовый опрос
          if (generateData.redirectTo) {
            alert('Пожалуйста, пройди стартовый опрос для определения твоих характеристик');
            router.push(generateData.redirectTo);
            return;
          }
          
          alert('Ошибка генерации тренировки: ' + generateData.error);
        }
      } else {
        console.error('❌ Assessment error:', data.error);
        alert('Ошибка: ' + data.error);
      }
    } catch (error) {
      console.error('❌ Exception during assessment:', error);
      alert('Произошла ошибка. Попробуйте снова.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const lastTrainingOptions = [
    { value: 'TODAY', label: 'Сегодня' },
    { value: 'YESTERDAY', label: 'Вчера' },
    { value: 'TWO_DAYS_AGO', label: '2 дня назад' },
    { value: 'THREE_PLUS_DAYS', label: '3+ дня назад' },
    { value: 'WEEK_PLUS', label: 'Неделя+ назад' },
  ];

  const [showInfoBlock, setShowInfoBlock] = useState(true);
  const [isClosing, setIsClosing] = useState(false);

  const handleCloseInfo = () => {
    setIsClosing(true);
    setTimeout(() => {
      setShowInfoBlock(false);
      setIsClosing(false);
    }, 300);
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
            color: '#F9F8FE',
            display: 'flex',
            flexDirection: 'column',
            gap: '16px'
          }}>
            <div>
              твой <span style={{color: '#A1FF4A'}}>ии-тренер</span> составит идеальный комплекс для продуктивной тренировки.
            </div>
            <div>
              настрой фильтры и вперед!
            </div>
          </div>
        </div>
      )}

      {/* Прогресс */}
      <div className="mb-6">
        <div className="flex justify-between mb-2 text-sm text-gray-400">
          <span>Оценка состояния</span>
        </div>
      </div>

      {/* Вопросы */}
      <div className="space-y-12">
        <div className="animate-fadeIn space-y-12">
          {/* Вопрос 1: Когда тренировался */}
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
              когда ты в последний раз тренировался
            </h2>
            <div className="flex flex-wrap" style={{ gap: '16px' }}>
              {lastTrainingOptions.map((option) => {
                const isSelected = formData.lastTrainingTime === option.value;
                return (
                  <button
                    key={option.value}
                    onClick={() => {
                      setFormData({ ...formData, lastTrainingTime: option.value as LastTrainingTime });
                    }}
                    className="uppercase transition-all duration-200 hover:scale-105"
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
                    {option.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Вопрос 2: Уровень энергии */}
          <div style={{ minHeight: '350px', marginBottom: '50px' }}>
            <h2 className="mb-6" style={{
              fontFamily: 'Overpass',
              fontWeight: 700,
              fontSize: '12px',
              lineHeight: '120%',
              letterSpacing: '0.5px',
              textTransform: 'uppercase',
              color: '#F9F8FE'
            }}>
              уровень энергии
            </h2>
            <CircularSlider
              value={formData.energyLevel}
              min={0}
              max={10}
              onChange={(value) => setFormData({ ...formData, energyLevel: value })}
            />
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
          onClick={handleSubmit}
          disabled={!formData.lastTrainingTime || isSubmitting || userLoading}
          className="w-full rounded-full font-medium transition-all uppercase flex items-center justify-center"
          style={{
            backgroundColor: '#A1FF4A',
            color: '#060919',
            opacity: (!formData.lastTrainingTime || isSubmitting || userLoading) ? 0.2 : 1,
            fontFamily: 'Overpass, sans-serif',
            fontWeight: 700,
            fontSize: '16px',
            letterSpacing: '0.5px',
            cursor: (!formData.lastTrainingTime || isSubmitting || userLoading) ? 'not-allowed' : 'pointer',
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
