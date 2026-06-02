'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

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
  const [showCancelConfirm, setShowCancelConfirm] = useState(false);

  useEffect(() => {
    const fetchCurrentWorkout = async () => {
      try {
        const response = await fetch('/api/training/current');
        if (response.status === 401) {
          setIsLoading(false);
          return;
        }
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

  const handleCancelWorkout = async () => {
    if (isCancelling || !workout) return;

    try {
      setIsCancelling(true);
      const response = await fetch('/api/training/cancel', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId: workout.id }),
      });

      if (!response.ok) {
        const data = await response.json().catch(() => null);
        throw new Error(data?.error || 'Не удалось отменить тренировку');
      }

      setWorkout(null);
      setShowCancelConfirm(false);
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
    <div className="fixed left-0 right-0 z-50 px-4" style={{ bottom: 'calc(6rem + 30px)' }}>
      <div
        role="button"
        tabIndex={0}
        onClick={() => router.push(`/training/workout?id=${workout.id}`)}
        onKeyDown={(event) => {
          if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault();
            router.push(`/training/workout?id=${workout.id}`);
          }
        }}
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
            onClick={(event) => {
              event.stopPropagation();
              setShowCancelConfirm(true);
            }}
            className="w-8 h-8 -m-1 inline-flex items-center justify-center text-[#A1FF4A] text-lg font-bold leading-none"
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
      </div>
      {showCancelConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
          <div
            className="absolute inset-0 bg-black/50"
            onClick={() => setShowCancelConfirm(false)}
            role="button"
            tabIndex={-1}
            aria-label="Закрыть подтверждение"
          />
          <div className="relative w-full max-w-sm rounded-xl bg-[#0B0F2A] p-4 text-left shadow-lg">
            <div className="text-white text-base font-semibold">Вы уверены?</div>
            <div className="mt-2 text-white/80 text-sm">
              Тренировка будет отменена.
            </div>
            <div className="mt-4 flex gap-2">
              <button
                type="button"
                onClick={() => setShowCancelConfirm(false)}
                className="flex-1 rounded-lg border border-white/20 px-3 py-2 text-sm font-semibold text-white"
              >
                Нет
              </button>
              <button
                type="button"
                onClick={handleCancelWorkout}
                className="flex-1 rounded-lg bg-[#A1FF4A] px-3 py-2 text-sm font-semibold text-[#0B0F2A]"
              >
                Да, отменить
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
