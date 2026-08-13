'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { TrainingGoal, EnergyState } from '@/generated/prisma';
import { GOAL_LABELS, ENERGY_STATE_LABELS } from '@/lib/training-algorithm-v3';
import { openSubscriptionModal } from '@/lib/subscription-modal';
import { GoalIcon, EnergyIcon } from '@/components/training/icons';
import { Target, Dumbbell, Check, Flame, Lightbulb } from 'lucide-react';

// Преобразуем const объекты в массивы значений
const trainingGoals = Object.values(TrainingGoal) as TrainingGoal[];
const energyStates = Object.values(EnergyState) as EnergyState[];

export default function SelectGoalPage() {
  const router = useRouter();
  const [selectedGoal, setSelectedGoal] = useState<TrainingGoal | null>(null);
  const [selectedEnergy, setSelectedEnergy] = useState<EnergyState | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);

  const handleGenerate = async () => {
    if (!selectedGoal || !selectedEnergy) {
      alert('Пожалуйста, выберите цель и состояние');
      return;
    }

    setIsGenerating(true);

    try {
      const response = await fetch('/api/training/generate-v3', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          goal: selectedGoal,
          energyState: selectedEnergy,
        }),
      });

      if (response.status === 401) {
        alert('Сессия истекла. Войдите заново.');
        router.push('/login');
        return;
      }

      // 402: недельная квота бесплатных ИИ-тренировок исчерпана → подписка.
      if (response.status === 402) {
        openSubscriptionModal('ai-workout');
        return;
      }

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Ошибка генерации тренировки');
      }

      router.push(`/training/workout?id=${data.workoutId}`);
    } catch (error: any) {
      console.error('Ошибка:', error);
      alert(error.message || 'Не удалось сгенерировать тренировку');
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#101530] text-white p-6" style={{ paddingTop: 'calc(env(safe-area-inset-top, 0px) + 24px)' }}>
      <div className="max-w-2xl mx-auto">
        {/* Заголовок */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-2">Создание тренировки</h1>
          <p className="text-gray-400">Выберите цель и оцените своё состояние</p>
        </div>

        {/* ШАГ 1: ВЫБОР ЦЕЛИ */}
        <section className="mb-8">
          <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
            <Target size={24} className="text-brand" aria-hidden />
            Шаг 1: Выберите цель
          </h2>
          <div className="grid grid-cols-1 gap-3">
            {trainingGoals.map((goal) => {
              const info = GOAL_LABELS[goal];
              
              // Проверка на существование
              if (!info) {
                console.error('Missing label for goal:', goal);
                return null;
              }
              
              const isSelected = selectedGoal === goal;

              return (
                <button
                  key={goal}
                  onClick={() => setSelectedGoal(goal)}
                  className={`
                    p-4 rounded-xl text-left transition-all
                    ${
                      isSelected
                        ? 'bg-gradient-to-r from-orange-500 to-red-500 shadow-lg scale-105'
                        : 'bg-[#1a1f3a] hover:bg-[#242b4a]'
                    }
                  `}
                >
                  <div className="flex items-center gap-3">
                    <GoalIcon goal={goal} size={24} className={isSelected ? 'text-white' : 'text-brand'} />
                    <div className="flex-1">
                      <div className="font-bold text-lg">{info.label}</div>
                      <div className="text-sm text-gray-400">{info.description}</div>
                    </div>
                    {isSelected && (
                      <Check size={24} className="text-white" aria-hidden />
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        </section>

        {/* ШАГ 2: ОЦЕНКА СОСТОЯНИЯ */}
        <section className="mb-8">
          <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
            <Dumbbell size={24} className="text-brand" aria-hidden />
            Шаг 2: Оцените своё состояние
          </h2>
          <p className="text-sm text-gray-400 mb-4">
            Это опционально, но помогает подобрать оптимальную нагрузку
          </p>
          <div className="grid grid-cols-1 gap-3">
            {energyStates.map((state) => {
              const info = ENERGY_STATE_LABELS[state];
              
              // Проверка на существование
              if (!info) {
                console.error('Missing label for energy state:', state);
                return null;
              }
              
              const isSelected = selectedEnergy === state;

              return (
                <button
                  key={state}
                  onClick={() => setSelectedEnergy(state)}
                  className={`
                    p-4 rounded-xl text-left transition-all
                    ${
                      isSelected
                        ? 'bg-gradient-to-r from-blue-500 to-purple-500 shadow-lg scale-105'
                        : 'bg-[#1a1f3a] hover:bg-[#242b4a]'
                    }
                  `}
                >
                  <div className="flex items-center gap-3">
                    <EnergyIcon state={state} size={24} className={isSelected ? 'text-white' : 'text-brand'} />
                    <div className="flex-1">
                      <div className="font-bold text-lg">{info.label}</div>
                    </div>
                    {isSelected && (
                      <Check size={24} className="text-white" aria-hidden />
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        </section>

        {/* Кнопка генерации */}
        <button
          onClick={handleGenerate}
          disabled={!selectedGoal || !selectedEnergy || isGenerating}
          className={`
            w-full py-4 rounded-xl font-bold text-lg transition-all
            flex items-center justify-center gap-2
            ${
              selectedGoal && selectedEnergy && !isGenerating
                ? 'bg-gradient-to-r from-orange-500 to-red-500 hover:scale-105 shadow-xl'
                : 'bg-gray-600 cursor-not-allowed'
            }
          `}
        >
          {isGenerating ? (
            'Генерируем тренировку...'
          ) : (
            <>
              Сгенерировать тренировку
              <Flame size={20} aria-hidden />
            </>
          )}
        </button>

        {/* Подсказка */}
        {!selectedEnergy && selectedGoal && (
          <p className="flex items-center justify-center gap-2 text-center text-sm text-gray-400 mt-4">
            <Lightbulb size={16} className="shrink-0" aria-hidden />
            Если не оценишь состояние, используем стандартную нагрузку
          </p>
        )}
      </div>
    </div>
  );
}
