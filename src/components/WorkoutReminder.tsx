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
  const [isCancelling, setIsCancelling] = useState(false);

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

  const requestCancelConfirmation = () => {
    return new Promise<boolean>((resolve) => {
      const tg = window.Telegram?.WebApp;
      const message = 'Вы уверены, что хотите отменить тренировку?';

      if (tg?.showConfirm) {
        tg.showConfirm(message, (confirmed) => resolve(!!confirmed));
        return;
      }

      resolve(window.confirm(message));
    });
  };

  const handleCancelWorkout = async () => {
    if (isCancelling || !workout) return;

    const confirmed = await requestCancelConfirmation();
    if (!confirmed) return;

    const telegramId = getTelegramId();
    if (!telegramId) return;

    try {
      setIsCancelling(true);
      const response = await fetch('/api/training/cancel', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId: workout.id, userId: telegramId }),
      });

      if (!response.ok) {
        const data = await response.json().catch(() => null);
        throw new Error(data?.error || 'Не удалось отменить тренировку');
      }

      setWorkout(null);
    } catch (error) {
      console.error('Ошибка отмены тренировки:', error);
      const tg = window.Telegram?.WebApp;
      const message = error instanceof Error ? error.message : 'Ошибка отмены тренировки';

      if (tg?.showAlert) {
        tg.showAlert(message);
      } else {
        alert(message);
      }
    } finally {
      setIsCancelling(false);
    }
  };

  return (
    <div className="fixed left-0 right-0 bottom-20 z-40 px-4">
      <button
        onClick={() => router.push(`/training/workout?id=${workout.id}`)}
        className="w-full p-2 bg-[#445CFF] rounded-lg inline-flex flex-col justify-center items-start gap-2 overflow-hidden text-left"
      >
        <div className="self-stretch inline-flex justify-between items-start gap-2">
          <img
            src="/icons/icon-cards.svg"
            alt=""
            className="w-4 h-4"
          />
          <button
            type="button"
            onClick={handleCancelWorkout}
            className="text-[#A1FF4A] text-sm font-bold leading-4"
            aria-label="Закрыть напоминание"
          >
            ✕
          </button>
        </div>
        <div className="self-stretch justify-start">
          <span className="text-slate-50 text-sm font-bold font-['Overpass'] uppercase leading-4 tracking-wide">
            {isStarted ? 'продолжить' : 'начать'}
          </span>
          <span className="text-lime-400 text-sm font-bold font-['Overpass'] uppercase leading-4 tracking-wide">
            {' '}тренировку с персональным тренером
          </span>
        </div>
      </button>
    </div>
  );
}
