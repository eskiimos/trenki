'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { registerBanner, BANNER_PRIORITY } from '@/lib/bottom-banner-registry';

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

// O-2: «скрыть на сегодня». Раньше плашка не имела понятия «закрыто» — после
// закрытия и обновления она появлялась снова (в цикле несколько PENDING-дней,
// /api/training/current всегда отдаёт один). Теперь ✕ прячет напоминание на
// текущий день (localStorage), а назавтра оно показывается снова.
const DISMISS_KEY = 'workoutReminderDismissedDate';
const todayKey = () => {
  const d = new Date();
  return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
};

export default function WorkoutReminder() {
  const router = useRouter();
  const [workout, setWorkout] = useState<WorkoutData | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Уже скрыли сегодня — ничего не показываем (и не дёргаем API).
    try {
      if (localStorage.getItem(DISMISS_KEY) === todayKey()) {
        setIsLoading(false);
        return;
      }
    } catch {
      // localStorage недоступен — просто покажем напоминание как обычно.
    }

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

  // Пока напоминание видимо — регистрируем его как активный нижний баннер,
  // чтобы менее важные (install) не налезали снизу.
  const visible = !isLoading && !!workout;
  useEffect(() => {
    if (!visible) return;
    return registerBanner('workout-reminder', BANNER_PRIORITY.workoutReminder);
  }, [visible]);

  if (isLoading || !workout) return null;

  const isStarted = workout.status === 'IN_PROGRESS';

  const dismissForToday = () => {
    try {
      localStorage.setItem(DISMISS_KEY, todayKey());
    } catch {
      // не критично — просто скроем на эту сессию страницы
    }
    setWorkout(null);
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
        className="w-full p-2 rounded-lg inline-flex flex-col justify-center items-start gap-2 overflow-hidden text-left"
        style={{
          background: '#060919',
          border: '1px solid rgba(68, 92, 255, 0.35)',
        }}
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
              dismissForToday();
            }}
            className="w-8 h-8 -m-1 inline-flex items-center justify-center text-[#A1FF4A] text-lg font-bold leading-none"
            aria-label="Скрыть напоминание на сегодня"
          >
            ✕
          </button>
        </div>
        <div className="self-stretch justify-start">
          <span className="text-slate-50 text-sm font-bold font-['Overpass'] uppercase leading-4 tracking-wide">
            {isStarted ? 'продолжить' : 'начать'}
          </span>
          <span className="text-lime-400 text-sm font-bold font-['Overpass'] uppercase leading-4 tracking-wide">
            {' '}{isStarted ? 'прерванную тренировку' : 'тренировку'}
          </span>
        </div>
      </div>
    </div>
  );
}
