'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { getTelegramId } from '@/lib/auth';

interface FormData {
  // Самооценка (1-10)
  rawPower: number;
  rawSpeed: number;
  rawEndurance: number;
  rawTechnique: number;
  rawFlexibility: number;
  
  // Вопросы для k_mastery
  yearsInHockey: string;
  trainingFrequency: string;
  matchFrequency: string;
  gameDifficulty: string;
}

export default function CharacteristicsOnboardingPage() {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  const [formData, setFormData] = useState<FormData>({
    rawPower: 5,
    rawSpeed: 5,
    rawEndurance: 5,
    rawTechnique: 5,
    rawFlexibility: 5,
    yearsInHockey: '',
    trainingFrequency: '',
    matchFrequency: '',
    gameDifficulty: '',
  });

  const handleSliderChange = (field: keyof FormData, value: number) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleSelectChange = (field: keyof FormData, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async () => {
    setIsSubmitting(true);
    
    try {
      const userId = getTelegramId();
      
      if (!userId) {
        alert('Ошибка: не удалось определить пользователя');
        return;
      }

      const response = await fetch('/api/profile/characteristics', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId,
          ...formData,
        }),
      });

      const data = await response.json();

      if (response.ok) {
        // Переходим в профиль или на главную
        router.push('/profile');
      } else {
        alert(data.error || 'Ошибка при сохранении данных');
      }
    } catch (error) {
      console.error('Error submitting characteristics:', error);
      alert('Ошибка при отправке данных');
    } finally {
      setIsSubmitting(false);
    }
  };

  const nextStep = () => {
    if (step < 3) setStep(step + 1);
  };

  const prevStep = () => {
    if (step > 1) setStep(step - 1);
  };

  return (
    <div className="min-h-screen bg-[#060919] text-white pb-20">
      {/* Шапка */}
      <div className="px-4 pt-8 pb-4">
        <div className="flex items-center justify-between mb-6">
          {step > 1 && (
            <button onClick={prevStep} className="w-10 h-10 flex items-center justify-center">
              <Image 
                src="/icons/icon-action-back.svg" 
                alt="Назад" 
                width={32} 
                height={32}
              />
            </button>
          )}
          <div className="flex-1 text-center">
            <span className="text-[#A1FF4A] text-sm font-bold">ШАГ {step} ИЗ 3</span>
          </div>
          <div className="w-10" /> {/* Для симметрии */}
        </div>

        <h1 className="text-2xl font-bold text-center mb-2">
          {step === 1 && 'Раскрой свой потенциал!'}
          {step === 2 && 'Твой опыт в хоккее'}
          {step === 3 && 'Последний шаг!'}
        </h1>
        <p className="text-center text-gray-400 text-sm">
          {step === 1 && 'Оцени свои текущие способности по шкале от 1 до 10'}
          {step === 2 && 'Расскажи о своей хоккейной практике'}
          {step === 3 && 'Еще пара вопросов и готово!'}
        </p>
      </div>

      <div className="px-4">
        {/* ШАГ 1: Самооценка */}
        {step === 1 && (
          <div className="space-y-6">
            {/* Сила */}
            <div>
              <div className="flex justify-between mb-2">
                <span className="text-sm font-bold uppercase">💪 Сила</span>
                <span className="text-[#A1FF4A] text-lg font-bold">{formData.rawPower}</span>
              </div>
              <input
                type="range"
                min="1"
                max="10"
                value={formData.rawPower}
                onChange={(e) => handleSliderChange('rawPower', parseInt(e.target.value))}
                className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-[#A1FF4A]"
              />
              <div className="flex justify-between text-xs text-gray-500 mt-1">
                <span>Слабая</span>
                <span>Средняя</span>
                <span>Отличная</span>
              </div>
            </div>

            {/* Скорость */}
            <div>
              <div className="flex justify-between mb-2">
                <span className="text-sm font-bold uppercase">⚡ Скорость</span>
                <span className="text-[#A1FF4A] text-lg font-bold">{formData.rawSpeed}</span>
              </div>
              <input
                type="range"
                min="1"
                max="10"
                value={formData.rawSpeed}
                onChange={(e) => handleSliderChange('rawSpeed', parseInt(e.target.value))}
                className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-[#A1FF4A]"
              />
              <div className="flex justify-between text-xs text-gray-500 mt-1">
                <span>Медленная</span>
                <span>Средняя</span>
                <span>Быстрая</span>
              </div>
            </div>

            {/* Выносливость */}
            <div>
              <div className="flex justify-between mb-2">
                <span className="text-sm font-bold uppercase">🫀 Выносливость</span>
                <span className="text-[#A1FF4A] text-lg font-bold">{formData.rawEndurance}</span>
              </div>
              <input
                type="range"
                min="1"
                max="10"
                value={formData.rawEndurance}
                onChange={(e) => handleSliderChange('rawEndurance', parseInt(e.target.value))}
                className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-[#A1FF4A]"
              />
              <div className="flex justify-between text-xs text-gray-500 mt-1">
                <span>Низкая</span>
                <span>Средняя</span>
                <span>Высокая</span>
              </div>
            </div>

            {/* Техника */}
            <div>
              <div className="flex justify-between mb-2">
                <span className="text-sm font-bold uppercase">🎯 Техника</span>
                <span className="text-[#A1FF4A] text-lg font-bold">{formData.rawTechnique}</span>
              </div>
              <input
                type="range"
                min="1"
                max="10"
                value={formData.rawTechnique}
                onChange={(e) => handleSliderChange('rawTechnique', parseInt(e.target.value))}
                className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-[#A1FF4A]"
              />
              <div className="flex justify-between text-xs text-gray-500 mt-1">
                <span>Базовая</span>
                <span>Средняя</span>
                <span>Мастерская</span>
              </div>
            </div>

            {/* Гибкость */}
            <div>
              <div className="flex justify-between mb-2">
                <span className="text-sm font-bold uppercase">🤸 Гибкость</span>
                <span className="text-[#A1FF4A] text-lg font-bold">{formData.rawFlexibility}</span>
              </div>
              <input
                type="range"
                min="1"
                max="10"
                value={formData.rawFlexibility}
                onChange={(e) => handleSliderChange('rawFlexibility', parseInt(e.target.value))}
                className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-[#A1FF4A]"
              />
              <div className="flex justify-between text-xs text-gray-500 mt-1">
                <span>Жесткая</span>
                <span>Средняя</span>
                <span>Отличная</span>
              </div>
            </div>

            <button
              onClick={nextStep}
              className="w-full bg-[#A1FF4A] text-black py-4 rounded-lg font-bold text-lg mt-8 hover:bg-[#8fea35] transition"
            >
              Далее
            </button>
          </div>
        )}

        {/* ШАГ 2: Опыт */}
        {step === 2 && (
          <div className="space-y-6">
            {/* Сколько лет в хоккее */}
            <div>
              <label className="block text-sm font-bold uppercase mb-3">
                Сколько лет вы занимаетесь хоккеем?
              </label>
              <div className="space-y-2">
                {[
                  { value: 'LESS_THAN_1', label: 'Меньше 1 года', coef: 1.53 },
                  { value: '1_TO_3', label: '1-3 года', coef: 1.65 },
                  { value: '3_TO_5', label: '3-5 лет', coef: 1.7 },
                  { value: 'MORE_THAN_5', label: 'Больше 5 лет', coef: 1.75 },
                ].map((option) => (
                  <button
                    key={option.value}
                    onClick={() => handleSelectChange('yearsInHockey', option.value)}
                    className={`w-full p-4 rounded-lg border-2 transition ${
                      formData.yearsInHockey === option.value
                        ? 'border-[#A1FF4A] bg-[#A1FF4A]/10'
                        : 'border-gray-700 bg-[#111631]'
                    }`}
                  >
                    <div className="text-left font-semibold">{option.label}</div>
                  </button>
                ))}
              </div>
            </div>

            {/* Частота тренировок */}
            <div>
              <label className="block text-sm font-bold uppercase mb-3">
                Как часто вы тренируетесь?
              </label>
              <div className="space-y-2">
                {[
                  { value: 'ONCE_A_WEEK', label: 'Раз в неделю или реже', coef: 1.53 },
                  { value: '2_TO_4_TIMES', label: '2-4 раза в неделю', coef: 1.65 },
                  { value: 'ALMOST_DAILY', label: 'Почти каждый день', coef: 1.7 },
                  { value: 'SEVERAL_TIMES_DAILY', label: 'Несколько раз в день', coef: 1.75 },
                ].map((option) => (
                  <button
                    key={option.value}
                    onClick={() => handleSelectChange('trainingFrequency', option.value)}
                    className={`w-full p-4 rounded-lg border-2 transition ${
                      formData.trainingFrequency === option.value
                        ? 'border-[#A1FF4A] bg-[#A1FF4A]/10'
                        : 'border-gray-700 bg-[#111631]'
                    }`}
                  >
                    <div className="text-left font-semibold">{option.label}</div>
                  </button>
                ))}
              </div>
            </div>

            <button
              onClick={nextStep}
              disabled={!formData.yearsInHockey || !formData.trainingFrequency}
              className="w-full bg-[#A1FF4A] text-black py-4 rounded-lg font-bold text-lg mt-8 hover:bg-[#8fea35] transition disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Далее
            </button>
          </div>
        )}

        {/* ШАГ 3: Игровая практика */}
        {step === 3 && (
          <div className="space-y-6">
            {/* Частота матчей */}
            <div>
              <label className="block text-sm font-bold uppercase mb-3">
                Как часто вы играете матчи?
              </label>
              <div className="space-y-2">
                {[
                  { value: 'NO_MATCHES', label: 'Не играю, только тренируюсь', coef: 1.53 },
                  { value: 'FEW_PER_MONTH', label: 'Несколько раз в месяц', coef: 1.65 },
                  { value: 'ONCE_A_WEEK', label: 'Раз в неделю', coef: 1.7 },
                  { value: 'SEVERAL_PER_WEEK', label: 'Несколько раз в неделю', coef: 1.75 },
                ].map((option) => (
                  <button
                    key={option.value}
                    onClick={() => handleSelectChange('matchFrequency', option.value)}
                    className={`w-full p-4 rounded-lg border-2 transition ${
                      formData.matchFrequency === option.value
                        ? 'border-[#A1FF4A] bg-[#A1FF4A]/10'
                        : 'border-gray-700 bg-[#111631]'
                    }`}
                  >
                    <div className="text-left font-semibold">{option.label}</div>
                  </button>
                ))}
              </div>
            </div>

            {/* Сложность игровых ситуаций */}
            <div>
              <label className="block text-sm font-bold uppercase mb-3">
                Насколько сложно вам в игровых ситуациях против равных соперников?
              </label>
              <div className="space-y-2">
                {[
                  { value: 'VERY_HARD', label: 'Очень сложно, часто проигрываю', coef: 1.53 },
                  { value: 'HARD', label: 'Есть сложности, но могу конкурировать', coef: 1.64 },
                  { value: 'ADVANTAGE', label: 'В большинстве случаев чувствую преимущество', coef: 1.75 },
                ].map((option) => (
                  <button
                    key={option.value}
                    onClick={() => handleSelectChange('gameDifficulty', option.value)}
                    className={`w-full p-4 rounded-lg border-2 transition ${
                      formData.gameDifficulty === option.value
                        ? 'border-[#A1FF4A] bg-[#A1FF4A]/10'
                        : 'border-gray-700 bg-[#111631]'
                    }`}
                  >
                    <div className="text-left font-semibold">{option.label}</div>
                  </button>
                ))}
              </div>
            </div>

            <button
              onClick={handleSubmit}
              disabled={!formData.matchFrequency || !formData.gameDifficulty || isSubmitting}
              className="w-full bg-[#A1FF4A] text-black py-4 rounded-lg font-bold text-lg mt-8 hover:bg-[#8fea35] transition disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSubmitting ? 'Сохранение...' : 'Завершить'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
