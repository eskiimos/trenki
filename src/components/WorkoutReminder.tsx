'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { getTelegramId } from '@/lib/auth';

interface WorkoutData {
  id: string;
  status: string;
  currentVideoIndex: number;
  totalVideos: number;
  targetDuration: number;
  targetRPE: number;
  startedAt: string | null;
  createdAt: string;
  modules: Array<{
    id: string;
    title: string;
    completed: boolean;
  }>;
}

export default function WorkoutReminder() {
  const router = useRouter();
  const [workout, setWorkout] = useState<WorkoutData | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchCurrentWorkout = async () => {
      try {
        const telegramId = getTelegramId();
        if (!telegramId) {
          setIsLoading(false);
          return;
        }

        const response = await fetch(`/api/training/current?userId=${telegramId}`);
        const data = await response.json();
        
        if (data.workout) {
          setWorkout(data.workout);
        }
      } catch (error) {
        console.error('Ошибка загрузки тренировки:', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchCurrentWorkout();
  }, []);

  if (isLoading || !workout) return null;

  const completedVideos = workout.modules.filter((v) => v.completed).length;
  const totalVideos = workout.totalVideos;
  const progress = Math.round((completedVideos / totalVideos) * 100);
  const isStarted = workout.status === 'IN_PROGRESS';

  return (
    <div className="bg-gradient-to-r from-orange-500 to-orange-600 p-4 rounded-lg shadow-lg mb-6 animate-pulse-slow">
      <div className="flex items-center justify-between">
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-2xl">🔥</span>
            <h3 className="text-white font-bold text-lg">
              {isStarted ? 'Продолжи тренировку!' : 'У тебя есть тренировка!'}
            </h3>
          </div>
          
          <div className="space-y-1">
            <p className="text-white/90 text-sm">
              Прогресс: {completedVideos}/{totalVideos} видео
            </p>
            
            {/* Прогресс-бар */}
            <div className="w-full bg-white/30 rounded-full h-2 overflow-hidden">
              <div 
                className="bg-white h-full rounded-full transition-all duration-300"
                style={{ width: `${progress}%` }}
              />
            </div>
            
            <p className="text-white/80 text-xs">
              {progress}% завершено
            </p>
          </div>
        </div>
        
        <button
          onClick={() => router.push(`/training/workout?id=${workout.id}`)}
          className="ml-4 bg-white text-orange-600 px-6 py-3 rounded-lg font-semibold hover:bg-orange-50 transition-colors shadow-md flex items-center gap-2"
        >
          {isStarted ? (
            <>
              <span>Продолжить</span>
              <span>▶️</span>
            </>
          ) : (
            <>
              <span>Начать</span>
              <span>🚀</span>
            </>
          )}
        </button>
      </div>
    </div>
  );
}
