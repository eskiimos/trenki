'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useTelegram } from '@/hooks/useTelegram';

interface WorkoutHistoryItem {
  id: string;
  status: string;
  targetDuration: number;
  actualDuration: number | null;
  targetRPE: number;
  actualRPE: number | null;
  loadDirection: string;
  modulesCount: number;
  createdAt: string;
  completedAt: string | null;
}

interface Stats {
  totalWorkouts: number;
  totalDuration: number;
  avgRPE: number;
  lastWorkoutDate: string | null;
  currentStreak: number;
}

export default function TrainingHistoryPage() {
  const router = useRouter();
  const { user, webApp } = useTelegram();
  
  const [workouts, setWorkouts] = useState<WorkoutHistoryItem[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [isLoading, setIsLoading] = useState(true);

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
      loadHistory();
    }
  }, [user]);

  const loadHistory = async () => {
    try {
      const response = await fetch(`/api/training/history?userId=${user?.id}&limit=20`);
      const data = await response.json();

      if (data.success) {
        setWorkouts(data.workouts);
        setStats(data.stats);
      }
    } catch (error) {
      console.error('Ошибка загрузки истории:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffDays === 0) return 'Сегодня';
    if (diffDays === 1) return 'Вчера';
    if (diffDays < 7) return `${diffDays} дней назад`;
    
    return date.toLocaleDateString('ru-RU', {
      day: 'numeric',
      month: 'long',
      year: date.getFullYear() !== now.getFullYear() ? 'numeric' : undefined,
    });
  };

  const loadDirectionLabels = {
    LIGHT: { text: 'Легкая', color: 'text-green-400', bg: 'bg-green-900/30' },
    MEDIUM: { text: 'Средняя', color: 'text-yellow-400', bg: 'bg-yellow-900/30' },
    HIGH: { text: 'Интенсивная', color: 'text-red-400', bg: 'bg-red-900/30' },
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#101530] flex items-center justify-center">
        <div className="text-white text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white mx-auto mb-4"></div>
          <p>Загрузка истории...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#101530] text-white p-4 pb-24">
      <h1 className="text-3xl font-bold mb-6">История тренировок</h1>

      {/* Статистика */}
      {stats && (
        <div className="grid grid-cols-2 gap-3 mb-6">
          <div className="bg-gradient-to-br from-blue-600 to-blue-800 p-4 rounded-xl">
            <p className="text-sm text-blue-200">Всего тренировок</p>
            <p className="text-3xl font-bold">{stats.totalWorkouts}</p>
          </div>
          <div className="bg-gradient-to-br from-purple-600 to-purple-800 p-4 rounded-xl">
            <p className="text-sm text-purple-200">Серия дней</p>
            <p className="text-3xl font-bold">{stats.currentStreak} 🔥</p>
          </div>
          <div className="bg-gradient-to-br from-green-600 to-green-800 p-4 rounded-xl">
            <p className="text-sm text-green-200">Общее время</p>
            <p className="text-3xl font-bold">{stats.totalDuration}</p>
            <p className="text-xs text-green-200">минут</p>
          </div>
          <div className="bg-gradient-to-br from-orange-600 to-orange-800 p-4 rounded-xl">
            <p className="text-sm text-orange-200">Средний RPE</p>
            <p className="text-3xl font-bold">{stats.avgRPE}</p>
            <p className="text-xs text-orange-200">из 10</p>
          </div>
        </div>
      )}

      {/* Кнопка новой тренировки */}
      <button
        onClick={() => router.push('/training/assessment')}
        className="w-full bg-blue-600 hover:bg-blue-700 text-white py-4 rounded-xl font-semibold transition-colors mb-6"
      >
        ➕ Начать новую тренировку
      </button>

      {/* Список тренировок */}
      {workouts.length === 0 ? (
        <div className="text-center py-12">
          <div className="text-6xl mb-4">🏋️</div>
          <h3 className="text-xl font-semibold mb-2">Пока нет тренировок</h3>
          <p className="text-gray-400 mb-6">
            Начните первую тренировку, чтобы увидеть статистику
          </p>
          <button
            onClick={() => router.push('/training/assessment')}
            className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-xl font-semibold transition-colors"
          >
            Начать
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {workouts.map((workout) => {
            const loadLabel = loadDirectionLabels[workout.loadDirection as keyof typeof loadDirectionLabels] || loadDirectionLabels.MEDIUM;
            const isCompleted = workout.status === 'COMPLETED';
            
            return (
              <div
                key={workout.id}
                className={`p-4 rounded-xl ${
                  isCompleted ? 'bg-gray-800' : 'bg-gray-800/50 border-2 border-gray-700'
                }`}
              >
                <div className="flex justify-between items-start mb-3">
                  <div>
                    <p className="text-sm text-gray-400">{formatDate(workout.completedAt || workout.createdAt)}</p>
                    <h3 className={`text-lg font-semibold ${loadLabel.color}`}>
                      {loadLabel.text} тренировка
                    </h3>
                  </div>
                  <div className={`px-3 py-1 rounded-full text-sm font-medium ${
                    isCompleted ? 'bg-green-900/30 text-green-400' : 'bg-yellow-900/30 text-yellow-400'
                  }`}>
                    {isCompleted ? '✓ Завершена' : '⏸ Пропущена'}
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <p className="text-xs text-gray-400">Длительность</p>
                    <p className="font-semibold">
                      {workout.actualDuration || workout.targetDuration} мин
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-400">RPE</p>
                    <p className="font-semibold">
                      {workout.actualRPE || workout.targetRPE}/10
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-400">Упражнений</p>
                    <p className="font-semibold">{workout.modulesCount}</p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Мотивационное сообщение */}
      {stats && stats.currentStreak > 0 && (
        <div className="mt-6 p-4 bg-gradient-to-r from-orange-600/30 to-red-600/30 border border-orange-500 rounded-xl">
          <p className="text-center">
            <span className="text-2xl">🔥</span>
            <br />
            <span className="font-semibold">
              Ты на волне! {stats.currentStreak} {stats.currentStreak === 1 ? 'день' : 'дней'} подряд!
            </span>
            <br />
            <span className="text-sm text-gray-300">
              Продолжай в том же духе!
            </span>
          </p>
        </div>
      )}
    </div>
  );
}
