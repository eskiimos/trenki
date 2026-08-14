'use client';

import React, { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import {
  ChevronLeft, ChevronRight, Plus, RefreshCw, AlertTriangle, CalendarDays,
  Zap, BatteryFull, Target, PersonStanding, Dumbbell,
} from 'lucide-react';
import BottomNavigation from '@/components/BottomNavigation';
import SwipeableWorkoutItem from '@/components/SwipeableWorkoutItem';
import MicrocyclePreparingOverlay from '@/components/MicrocyclePreparingOverlay';
import { EnergyIcon, GoalIcon } from '@/components/training/icons';

interface ScheduledWorkout {
  id: string;
  date: string;
  completed: boolean;
  video: {
    id: string;
    title: string;
    thumbnail: string | null;
    duration: number;
    level: string | null;
    equipment: string[];
    category: string;
    trainer: {
      name: string;
      lastName: string;
      avatar: string | null;
    };
  };
}

interface CoachAssignment {
  id: string;
  status: 'PENDING' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED';
  dueDate: string;
  videoId: string | null;
  workoutSessionId: string | null;
  coach: { id: string; firstName: string | null; lastName: string | null };
  video: { id: string; title: string; thumbnail: string | null; duration: number | null } | null;
}

type MicrocycleIntent = 'IN_TONE' | 'WARMUP' | 'CHARGED' | 'STRETCH' | 'TIRED';

interface MicrocycleDay {
  dayOfWeek: number; // порядковый день цикла 1..N от weekStartDate (НЕ календарный)
  intent: MicrocycleIntent;
  goal: string | null; // направленность/цель дня (подпись)
  goalKey?: string | null; // ключ цели (POWERFUL_SHOT, AGILITY, …) — для иконки
  modules: {
    id: string;
    title: string;
    thumbnail: string | null;
    duration: number;
  }[]; // модули тренировки дня с превью (как в /video)
  workoutSession: {
    id: string;
    status: string;
    targetDuration: number;
    totalVideos: number;
    currentVideoIndex: number;
  } | null;
}

interface ActiveMicrocycle {
  id: string;
  weekStartDate: string; // ISO date (YYYY-MM-DD)
  cycleNumber: number;
  status: string;
  days: MicrocycleDay[];
}

// «Крутые» названия нагрузок (таблица методиста).
const MICROCYCLE_INTENT_LABEL: Record<MicrocycleIntent, string> = {
  IN_TONE: 'База/стандарт',
  WARMUP: 'Зарядка',
  CHARGED: 'Овертайм',
  STRETCH: 'Раскисление',
  TIRED: 'Лёгкая нагрузка',
};

// Иконки интентов живут в @/components/training/icons (<EnergyIcon state={…} />) —
// локальной карты эмодзи здесь больше нет.

export default function CalendarPage() {
  const router = useRouter();
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [scheduledWorkouts, setScheduledWorkouts] = useState<ScheduledWorkout[]>([]);
  const [coachAssignments, setCoachAssignments] = useState<CoachAssignment[]>([]);
  const [microcycle, setMicrocycle] = useState<ActiveMicrocycle | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  /** Сбой загрузки — раньше любая ошибка выглядела как «у тебя ничего не запланировано». */
  const [loadError, setLoadError] = useState<string | null>(null);
  /**
   * Успел ли ответить /api/microcycle/current. Отдельно от `microcycle === null`,
   * потому что null означает и «цикла нет», и «запрос упал», а кнопка «Собрать
   * неделю» на бэке ПЕРЕСОБИРАЕТ существующий план — показывать её по ошибке нельзя.
   */
  const [cycleLoaded, setCycleLoaded] = useState(false);
  /** Защита от гонки: ответ устаревшего месяца не должен перезаписывать актуальный. */
  const reqIdRef = useRef(0);
  const [generatingCycle, setGeneratingCycle] = useState(false);
  const [cycleError, setCycleError] = useState<string | null>(null);
  // Пересборка дня «раскисление» под выбранную часть тела (низ/верх/всё).
  const [stretchRebuilding, setStretchRebuilding] = useState(false);
  const [stretchError, setStretchError] = useState<string | null>(null);

  const handleStretchBodyPart = async (
    sessionId: string,
    bodyPart: 'lower' | 'upper' | 'full',
  ) => {
    if (stretchRebuilding) return;
    setStretchError(null);
    setStretchRebuilding(true);
    try {
      const res = await fetch('/api/microcycle/stretch-day', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId, bodyPart }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setStretchError(data?.error || 'Не удалось пересобрать');
        setStretchRebuilding(false);
        return;
      }
      setStretchRebuilding(false);
      router.push(`/training/workout?id=${sessionId}`);
    } catch {
      setStretchError('Ошибка сети');
      setStretchRebuilding(false);
    }
  };

  useEffect(() => {
    fetchCalendar();
  }, [currentDate.getMonth(), currentDate.getFullYear()]);

  // Ручная генерация микроцикла (кнопка «Собрать неделю»). Идемпотентна —
  // если на эту неделю цикл уже есть, бэкенд вернёт существующий (мгновенно).
  // Поэтому держим экран сборки минимум ~5с, чтобы анимация успела проиграться
  // и создавалось ощущение, что ИИ реально собирает неделю.
  const MIN_OVERLAY_MS = 5000;
  const handleGenerateMicrocycle = async () => {
    if (generatingCycle) return;
    // Пересборка существующего цикла — предупреждаем (план заменится, старт с сегодня).
    if (
      microcycle &&
      !confirm('У тебя уже есть активный цикл на эту неделю. Пересобрать его заново?\n\nТекущий план заменится и стартует с сегодня.')
    ) {
      return;
    }
    setCycleError(null);
    setGeneratingCycle(true);
    const startedAt = Date.now();
    try {
      // Шлём СВОЮ локальную дату: сервер иначе возьмёт свой UTC-день и после
      // 21:00 МСК стартует неделю со вчера.
      const now = new Date();
      const localDate = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
      const res = await fetch('/api/microcycle/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ localDate }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data?.error || 'Не удалось собрать неделю');
      }
      await fetchCalendar();
      const elapsed = Date.now() - startedAt;
      if (elapsed < MIN_OVERLAY_MS) {
        await new Promise((r) => setTimeout(r, MIN_OVERLAY_MS - elapsed));
      }
    } catch (err: any) {
      setCycleError(err?.message || 'Ошибка');
    } finally {
      setGeneratingCycle(false);
    }
  };

  const fetchCalendar = async () => {
    const myId = ++reqIdRef.current;
    setIsLoading(true);
    setLoadError(null);
    try {
      const month = currentDate.getMonth();
      const year = currentDate.getFullYear();

      const [scheduleRes, assignmentsRes, microcycleRes] = await Promise.all([
        fetch(`/api/schedule?month=${month}&year=${year}`),
        fetch('/api/assignments?role=athlete'),
        fetch('/api/microcycle/current'),
      ]);
      // Быстро перелистали месяцы — ответ устарел, применять его нельзя.
      if (reqIdRef.current !== myId) return;

      if (scheduleRes.ok) {
        setScheduledWorkouts(await scheduleRes.json());
      } else {
        setLoadError('Не удалось загрузить расписание');
      }
      if (assignmentsRes.ok) {
        const data = await assignmentsRes.json();
        setCoachAssignments(data.assignments ?? []);
      }
      if (microcycleRes.ok) {
        const data = await microcycleRes.json();
        setMicrocycle(data.microcycle);
        setCycleLoaded(true);
      } else {
        // Не выставляем cycleLoaded: иначе покажем «Собрать неделю» и юзер
        // случайно перезапишет существующий план.
        setLoadError('Не удалось загрузить недельный план');
      }
    } catch (error) {
      console.error('Error fetching calendar:', error);
      if (reqIdRef.current === myId) setLoadError('Нет связи с сервером');
    } finally {
      if (reqIdRef.current === myId) setIsLoading(false);
    }
  };

  /** При смене месяца двигаем и выбранный день — иначе внизу остаётся «Сегодня,
   *  14 августа», пока пользователь смотрит сентябрь. */
  const goToMonth = (next: Date) => {
    setCurrentDate(next);
    const today = new Date();
    const sameMonth =
      today.getMonth() === next.getMonth() && today.getFullYear() === next.getFullYear();
    setSelectedDate(sameMonth ? today : new Date(next.getFullYear(), next.getMonth(), 1));
  };

  const handlePrevMonth = () => {
    goToMonth(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1));
  };

  const handleNextMonth = () => {
    goToMonth(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1));
  };

  const handleDateClick = (date: Date) => {
    setSelectedDate(date);
  };

  const isSameDay = (a: Date, b: Date) =>
    a.getDate() === b.getDate() &&
    a.getMonth() === b.getMonth() &&
    a.getFullYear() === b.getFullYear();

  const getWorkoutsForDate = (date: Date) =>
    scheduledWorkouts.filter((w) => isSameDay(new Date(w.date), date));

  // Правило приоритета: если в день есть план Марка (ScheduledWorkout),
  // тренерское назначение из календаря скрываем. В /profile/assignments оно остаётся.
  const getAssignmentsForDate = (date: Date) => {
    if (getWorkoutsForDate(date).length > 0) return [];
    return coachAssignments.filter(
      (a) =>
        a.status !== 'COMPLETED' &&
        a.status !== 'CANCELLED' &&
        isSameDay(new Date(a.dueDate), date),
    );
  };

  // Возвращает день микроцикла (если есть), привязанный к конкретной дате.
  // dayOfWeek — ПОРЯДКОВЫЙ день цикла (1..N от weekStartDate), НЕ календарный
  // Пн=1: вводная неделя может стартовать с любого дня. Дата дня = weekStartDate
  // + (dayOfWeek-1).
  const getMicrocycleDayForDate = (date: Date): MicrocycleDay | null => {
    if (!microcycle) return null;
    // weekStartDate приходит как ISO date-only ("YYYY-MM-DD") — парсим в UTC,
    // чтобы избежать сдвига на сутки в локали с положительным offset.
    const weekStart = new Date(microcycle.weekStartDate);
    for (const d of microcycle.days) {
      const dayDate = new Date(weekStart);
      dayDate.setUTCDate(weekStart.getUTCDate() + (d.dayOfWeek - 1));
      // Сравниваем по локальной дате (день/месяц/год), а не по timestamp.
      if (
        dayDate.getUTCFullYear() === date.getFullYear() &&
        dayDate.getUTCMonth() === date.getMonth() &&
        dayDate.getUTCDate() === date.getDate()
      ) {
        return d;
      }
    }
    return null;
  };

  // Диапазон дней цикла «Чт-Сб»/«Пн-Пт» — реальные дни недели от weekStartDate
  // (не хардкодим Пн-Пт: вводная неделя стартует с любого дня).
  const getCycleRangeLabel = (): string => {
    if (!microcycle || microcycle.days.length === 0) return '';
    const WD = ['Вс', 'Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб'];
    const ws = new Date(microcycle.weekStartDate);
    const offsets = microcycle.days.map((d) => d.dayOfWeek);
    const wd = (off: number) =>
      WD[new Date(Date.UTC(ws.getUTCFullYear(), ws.getUTCMonth(), ws.getUTCDate() + (off - 1))).getUTCDay()];
    const first = Math.min(...offsets);
    const last = Math.max(...offsets);
    return first === last ? wd(first) : `${wd(first)}-${wd(last)}`;
  };

  const hasAnyEventOnDay = (year: number, month: number, day: number) => {
    const checkDate = new Date(year, month, day);
    if (scheduledWorkouts.some((w) => isSameDay(new Date(w.date), checkDate))) return true;
    if (getMicrocycleDayForDate(checkDate)) return true;
    return coachAssignments.some(
      (a) =>
        a.status !== 'COMPLETED' &&
        a.status !== 'CANCELLED' &&
        isSameDay(new Date(a.dueDate), checkDate),
    );
  };

  // День, в который атлет реально ВЫПОЛНИЛ тренировку (подсветим лаймом):
  // выполненное расписание, завершённый день микроцикла или закрытое ДЗ тренера.
  const hasCompletedEventOnDay = (year: number, month: number, day: number) => {
    const checkDate = new Date(year, month, day);
    if (scheduledWorkouts.some((w) => w.completed && isSameDay(new Date(w.date), checkDate))) return true;
    const mc = getMicrocycleDayForDate(checkDate);
    if (mc?.workoutSession?.status === 'COMPLETED') return true;
    return coachAssignments.some(
      (a) => a.status === 'COMPLETED' && isSameDay(new Date(a.dueDate), checkDate),
    );
  };

  const renderCalendar = () => {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    
    const daysInMonth = lastDay.getDate();
    // Adjust for Monday start (0 = Sunday, 1 = Monday, ...)
    let startDay = firstDay.getDay(); 
    startDay = startDay === 0 ? 6 : startDay - 1; // Convert to 0=Monday, 6=Sunday

    const days = [];
    
    // Empty cells for previous month
    for (let i = 0; i < startDay; i++) {
      days.push(<div key={`empty-${i}`} className="w-full aspect-square" />);
    }

    const today = new Date();
    const isCurrentMonth = today.getMonth() === month && today.getFullYear() === year;
    // Полночь сегодня (сравнение по дате, без времени) — чтобы определить «прошлые» дни.
    const todayMidnight = new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime();

    for (let i = 1; i <= daysInMonth; i++) {
      const date = new Date(year, month, i);
      const isSelected = 
        selectedDate.getDate() === i && 
        selectedDate.getMonth() === month && 
        selectedDate.getFullYear() === year;
      
      const isToday = isCurrentMonth && today.getDate() === i;
      
      const isDone = hasCompletedEventOnDay(year, month, i);
      const hasWorkouts = hasAnyEventOnDay(year, month, i) || isDone;
      // Пропущенный день: был запланирован, уже прошёл и не выполнен. Сегодня и
      // будущее не «пропущены» — их ещё можно сделать.
      const isMissed = hasWorkouts && !isDone && date.getTime() < todayMidnight;
      // Выполнено — лайм, пропущено — серый, запланировано (сегодня/будущее) — синий.
      const markColor = isDone ? '#A1FF4A' : isMissed ? '#AEABBB' : '#445CFF';

      days.push(
        <button
          key={i}
          onClick={() => handleDateClick(date)}
          aria-current={isToday ? 'date' : undefined}
          aria-pressed={isSelected}
          aria-label={
            `${i} ${monthNamesGenitive[month]}` +
            (isToday ? ', сегодня' : '') +
            (isDone ? ', выполнено' : isMissed ? ', пропущено' : hasWorkouts ? ', запланировано' : '')
          }
          // Ширина тянется по треку сетки: фиксированные 40px не помещались на
          // экранах 320-360px (7×40 + гэпы > доступной ширины) и кружки налезали
          // друг на друга.
          className={`w-full max-w-10 aspect-square mx-auto flex flex-col items-center justify-center rounded-full relative text-sm transition-colors
            focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#A1FF4A]
            ${isSelected ? 'bg-[#445CFF] text-white' : 'text-white hover:bg-white/10'}
            ${hasWorkouts ? 'font-bold' : 'font-medium'}
          `}
          style={isToday && !isSelected ? {
            background: 'linear-gradient(180deg, rgba(68, 92, 255, 0) 0%, rgba(68, 92, 255, 0.5) 100%)'
          } : {}}
        >
          {/* Число рисуем ОДИН раз. Раньше поверх белой цифры клался цветной
              дубль — из-под него торчал белый край, а скринридер читал «14 14».
              Синяя цифра на синей подложке ещё и не проходила по контрасту,
              поэтому статус несёт только точка снизу. */}
          {i}
          {hasWorkouts && !isSelected && (
            <span
              className="absolute bottom-1 w-1.5 h-1.5 rounded-full"
              style={
                isDone
                  ? { background: markColor }                                  // выполнено — залитая
                  : isMissed
                    ? { background: markColor, opacity: 0.5, transform: 'scale(0.75)' } // пропущено — тусклая
                    : { border: `1.5px solid ${markColor}` }                   // запланировано — контур
              }
            />
          )}
        </button>
      );
    }

    return days;
  };

  const monthNames = [
    'ЯНВАРЬ', 'ФЕВРАЛЬ', 'МАРТ', 'АПРЕЛЬ', 'МАЙ', 'ИЮНЬ',
    'ИЮЛЬ', 'АВГУСТ', 'СЕНТЯБРЬ', 'ОКТЯБРЬ', 'НОЯБРЬ', 'ДЕКАБРЬ'
  ];

  const monthNamesGenitive = [
    'января', 'февраля', 'марта', 'апреля', 'мая', 'июня',
    'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря'
  ];

  const formatSelectedDate = (date: Date) => {
    const today = new Date();
    const isToday = 
      date.getDate() === today.getDate() && 
      date.getMonth() === today.getMonth() && 
      date.getFullYear() === today.getFullYear();
    
    const day = date.getDate();
    const month = monthNamesGenitive[date.getMonth()];
    
    if (isToday) {
      return `Сегодня, ${day} ${month}`;
    }
    return `${day} ${month}`;
  };

  const categoryMap: Record<string, string> = {
    STRENGTH: 'Сила',
    ENDURANCE: 'Выносливость',
    SPEED: 'Скорость',
    TECHNIQUE: 'Техника',
    SKATING: 'Катание',
    SHOOTING: 'Броски',
    PASSING: 'Пас',
    CHECKING: 'Силовая борьба',
    GOALKEEPER: 'Вратарь',
    POWER_PLAY: 'Большинство',
    PENALTY_KILL: 'Меньшинство',
    TACTICAL: 'Тактика',
    GENERAL: 'Общее',
  };

  const levelMap: Record<string, string> = {
    BEGINNER: 'Новичок',
    INTERMEDIATE: 'Любитель',
    ADVANCED: 'Продвинутый',
    EXPERT: 'Профи',
  };

  const handleDeleteWorkout = (id: string) => {
    setScheduledWorkouts(prev => prev.filter(w => w.id !== id));
  };

  const selectedWorkouts = getWorkoutsForDate(selectedDate);
  const selectedAssignments = getAssignmentsForDate(selectedDate);
  const selectedMicrocycleDay = getMicrocycleDayForDate(selectedDate);
  const hasAnythingForSelected =
    selectedWorkouts.length > 0 ||
    selectedAssignments.length > 0 ||
    selectedMicrocycleDay !== null;

  const formatDuration = (seconds: number | null) => {
    if (!seconds) return '';
    const min = Math.round(seconds / 60);
    return `${min} мин`;
  };

  return (
    <div
      // .pb-nav — единый клиренс над таб-баром (safe-area + высота бара);
      // раньше здесь был свой calc(+128), разъезжавшийся с остальными экранами.
      className="min-h-screen pb-nav"
      style={{
        background: 'linear-gradient(182.77deg, #101530 69.24%, #060919 97.69%)',
      }}
    >
      {/* Header */}
      <header className="flex items-center px-4 pb-4 safe-top">
        {/* Тач-таргет 44×44: сама иконка 24, но кликать надо было ровно в неё.
            Цветовые классы не работали (SVG-файл не наследует currentColor) —
            отклик даём прозрачностью. */}
        <button
          onClick={() => router.back()}
          aria-label="Назад"
          className="-ml-3 mr-1 w-11 h-11 flex items-center justify-center opacity-60 hover:opacity-100 transition-opacity"
        >
          <Image src="/icons/icon-action-back.svg" alt="" width={24} height={24} aria-hidden />
        </button>
        <h1 
          className="text-white uppercase"
          style={{
            fontWeight: 700,
            fontSize: '12px',
            lineHeight: '120%',
            letterSpacing: '0.5px',
            verticalAlign: 'middle',
            textTransform: 'uppercase'
          }}
        >
          КАЛЕНДАРЬ
        </h1>
      </header>

      <div className="px-4">
        {/* Сбой загрузки. Раньше 401/500/обрыв сети выглядели одинаково —
            пустой календарь и «нет запланированных тренировок». */}
        {loadError && (
          <div
            role="alert"
            className="flex items-center gap-2 mb-4 rounded-2xl px-4 py-3"
            style={{
              background: 'rgba(255,140,74,0.10)',
              border: '1px solid rgba(255,140,74,0.30)',
              color: '#FF8C4A',
              fontSize: 13,
            }}
          >
            <AlertTriangle size={20} className="shrink-0" aria-hidden />
            <span className="flex-1 min-w-0">{loadError}</span>
            <button
              type="button"
              onClick={fetchCalendar}
              className="shrink-0 underline"
              style={{ fontWeight: 700 }}
            >
              Повторить
            </button>
          </div>
        )}

        {/* Большая кнопка сборки недели — ТОЛЬКО когда микроцикла ещё нет
            (пустое состояние + точка входа + якорь онбординг-тура). Когда неделя
            собрана, пересборка живёт компактной ссылкой внутри календаря ниже —
            большую кнопку сверху не показываем, чтобы не провоцировать случайную
            замену всего плана. */}
        {cycleLoaded && !microcycle && (
          <button
            type="button"
            data-tour="microcycle-button"
            onClick={handleGenerateMicrocycle}
            disabled={generatingCycle}
            className="w-full mb-4 rounded-2xl flex items-center gap-3 p-4 transition-transform active:scale-[0.98]"
            style={{
              background:
                'linear-gradient(135deg, rgba(161, 255, 74, 0.18) 0%, rgba(68, 92, 255, 0.22) 100%)',
              border: '1px solid rgba(161, 255, 74, 0.35)',
              cursor: generatingCycle ? 'wait' : 'pointer',
              opacity: generatingCycle ? 0.7 : 1,
            }}
          >
            <div
              style={{
                width: 40,
                height: 40,
                borderRadius: 999,
                background: 'rgba(161, 255, 74, 0.2)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
              }}
            >
              <Zap size={20} color="#A1FF4A" />
            </div>
            <div className="flex-1 min-w-0 text-left">
              <div
                style={{
                  color: '#A1FF4A',
                  fontSize: 11,
                        fontWeight: 800,
                  textTransform: 'uppercase',
                  letterSpacing: 0.5,
                  marginBottom: 2,
                }}
              >
                ИИ-тренер
              </div>
              <div className="text-white text-sm font-semibold leading-tight">
                {generatingCycle ? 'Собираю неделю…' : 'Собрать неделю — 5 тренировок'}
              </div>
            </div>
            <ChevronRight size={20} className="text-[#A1FF4A] shrink-0" />
          </button>
        )}
        {cycleError && (
          <div role="alert" className="text-[#FF8C4A] text-xs text-center mb-4 font-medium">{cycleError}</div>
        )}

        {/* Calendar Widget */}
        <div className="bg-[#101530] rounded-3xl mb-8">
          <div className="bg-[#445CFF]/20 rounded-2xl p-4">
            {/* Компактный блок микроцикла ВНУТРИ календаря. Заменяет прежний
                полноширинный баннер; несёт якорь тура data-tour="microcycle-banner".
                Прячем на время сборки (generatingCycle) — как и старый баннер,
                чтобы спотлайт тура не подсвечивал пустоту под оверлеем. */}
            {microcycle && !generatingCycle && (
              <div
                data-tour="microcycle-banner"
                className="flex items-center gap-2 mb-4 pb-3"
                style={{ borderBottom: '1px solid rgba(255,255,255,0.10)' }}
              >
                <BatteryFull size={16} color="#A1FF4A" className="shrink-0" />
                <div className="flex-1 min-w-0 leading-tight">
                  <span
                    style={{
                      color: '#A1FF4A',
                      fontSize: 10,
                                fontWeight: 800,
                      textTransform: 'uppercase',
                      letterSpacing: 0.5,
                    }}
                  >
                    {microcycle.cycleNumber === 1 ? 'Первый микроцикл' : `Микроцикл №${microcycle.cycleNumber}`}
                  </span>
                  {getCycleRangeLabel() && (
                    <span className="text-[#AEABBB] text-[11px]"> · {getCycleRangeLabel()}</span>
                  )}
                </div>
                <button
                  type="button"
                  onClick={handleGenerateMicrocycle}
                  disabled={generatingCycle}
                  className="flex items-center gap-1 shrink-0 transition-transform active:scale-95"
                  style={{
                    color: '#A1FF4A',
                    fontSize: 11,
                    fontWeight: 700,
                    background: 'rgba(161, 255, 74, 0.12)',
                    border: '1px solid rgba(161, 255, 74, 0.3)',
                    borderRadius: 999,
                    padding: '8px 12px',
                    minHeight: 40,
                    display: 'inline-flex',
                    alignItems: 'center',
                    cursor: generatingCycle ? 'wait' : 'pointer',
                  }}
                >
                  <RefreshCw size={16} />
                  пересобрать
                </button>
              </div>
            )}

            {/* Month Navigation */}
            <div className="flex items-center justify-between mb-6 text-white">
              <button onClick={handlePrevMonth} aria-label="Предыдущий месяц" className="w-11 h-11 flex items-center justify-center hover:bg-white/10 rounded-full">
                <ChevronLeft size={24} />
              </button>
              <h2 aria-live="polite" className="text-sm font-bold uppercase tracking-widest">
                {monthNames[currentDate.getMonth()]}, {currentDate.getFullYear()}
              </h2>
              <button onClick={handleNextMonth} aria-label="Следующий месяц" className="w-11 h-11 flex items-center justify-center hover:bg-white/10 rounded-full">
                <ChevronRight size={24} />
              </button>
            </div>

            {/* Days of Week */}
            <div className="grid grid-cols-7 gap-1 mb-4 text-center">
              {['ПН', 'ВТ', 'СР', 'ЧТ', 'ПТ', 'СБ', 'ВС'].map(day => (
                <div key={day} className="text-[#AEABBB] text-sm font-bold">
                  {day}
                </div>
              ))}
            </div>

            {/* Calendar Grid */}
            <div className="grid grid-cols-7 gap-1">
              {renderCalendar()}
            </div>

            {/* Легенда индикаторов */}
            <div className="flex items-center justify-center gap-3 mt-3 text-[11px] text-[#AEABBB]">
              <span className="flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full" style={{ background: '#A1FF4A' }}></span>выполнено
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full" style={{ border: '1.5px solid #445CFF' }}></span>запланировано
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full" style={{ background: '#AEABBB', opacity: 0.5, transform: 'scale(0.75)' }}></span>пропущено
              </span>
            </div>
          </div>
        </div>

        {/* Selected Date Header */}
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-white text-sm font-medium">
            {formatSelectedDate(selectedDate)}
          </h2>
          <Link 
            href="/video" 
            className="flex items-center gap-2 rounded-full px-4 py-3 transition-colors hover:brightness-125"
            style={{ background: 'var(--color-surface)', border: '1px solid var(--border-hairline)' }}
          >
            <span className="text-[#AEABBB] text-xs font-medium">Добавить видео</span>
            <div className="w-6 h-6 bg-[#445CFF] rounded-full flex items-center justify-center">
              <Plus size={16} className="text-white" />
            </div>
          </Link>
        </div>

        {/* Workouts List */}
        {isLoading ? (
          // Раньше `isLoading` не использовался в разметке вообще: пока летели три
          // запроса, пользователь видел «Нет запланированных тренировок».
          <div className="space-y-4" aria-busy="true">
            {[0, 1].map((i) => (
              <div
                key={i}
                className="animate-pulse rounded-2xl"
                style={{ height: 96, background: 'var(--color-surface)' }}
              />
            ))}
          </div>
        ) : (
        <div className="space-y-4">
          {/* Карточка дня микроцикла — отрисуется первой, если день есть */}
          {selectedMicrocycleDay && (() => {
            const d = selectedMicrocycleDay;
            const ws = d.workoutSession;
            // Если AI не нашёл модулей — день пустой, показываем заглушку.
            if (!ws) {
              return (
                <div
                  className="block rounded-2xl overflow-hidden"
                  style={{
                    background: 'rgba(174, 171, 187, 0.08)',
                    border: '1px dashed rgba(174, 171, 187, 0.3)',
                  }}
                >
                  <div className="p-4">
                    <div
                      style={{
                        color: '#AEABBB',
                        fontSize: 11,
                                    fontWeight: 700,
                        textTransform: 'uppercase',
                        letterSpacing: 0.5,
                        marginBottom: 6,
                        display: 'flex',
                        alignItems: 'center',
                        gap: 6,
                      }}
                    >
                      <EnergyIcon state={d.intent} size={16} color="#AEABBB" />
                      {MICROCYCLE_INTENT_LABEL[d.intent]} · ИИ-тренер
                    </div>
                    <div className="text-[#AEABBB] text-sm">
                      Для этого дня не хватило подходящих модулей в каталоге.
                    </div>
                  </div>
                </div>
              );
            }
            return (
              <>
              <Link
                href={`/training/workout?id=${ws.id}`}
                className="block rounded-2xl overflow-hidden"
                style={{
                  background:
                    'linear-gradient(135deg, rgba(68, 92, 255, 0.20) 0%, rgba(161, 255, 74, 0.12) 100%)',
                  border: '1px solid rgba(68, 92, 255, 0.35)',
                }}
              >
                <div className="p-4 flex gap-3 items-center">
                  <div
                    className="relative w-20 h-20 rounded-lg shrink-0 flex items-center justify-center"
                    style={{ background: 'rgba(68, 92, 255, 0.25)' }}
                  >
                    <EnergyIcon state={d.intent} size={28} color="#A1FF4A" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div
                      style={{
                        color: '#A1FF4A',
                        fontSize: 11,
                                    fontWeight: 700,
                        textTransform: 'uppercase',
                        letterSpacing: 0.5,
                        marginBottom: 6,
                      }}
                    >
                      ИИ-тренер · {MICROCYCLE_INTENT_LABEL[d.intent]}
                    </div>
                    <div className="text-white text-sm font-semibold leading-tight">
                      Тренировка · {ws.totalVideos} модул{ws.totalVideos === 1 ? 'ь' : ws.totalVideos < 5 ? 'я' : 'ей'}
                    </div>
                    {d.goal && (
                      <div className="text-[#A1FF4A] text-xs font-bold mt-1 flex items-center gap-1.5">
                        {/* Своя иконка на каждую цель; Target — фолбэк для
                            старого ответа API без goalKey. */}
                        {d.goalKey ? (
                          <GoalIcon goal={d.goalKey} size={16} className="shrink-0" />
                        ) : (
                          <Target size={16} className="shrink-0" />
                        )}
                        <span className="min-w-0">{d.goal}</span>
                      </div>
                    )}
                    <div className="text-[#AEABBB] text-xs mt-1">
                      ~{ws.targetDuration} мин
                      {ws.status === 'IN_PROGRESS' && ` · в процессе (${ws.currentVideoIndex}/${ws.totalVideos})`}
                      {ws.status === 'COMPLETED' && ' · завершено'}
                    </div>
                  </div>
                </div>
              </Link>
              {d.modules.length > 0 && (
                <div className="mt-2">
                  <div
                    className="font-overpass"
                    style={{ color: '#AEABBB', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8 }}
                  >
                    Что в тренировке
                  </div>
                  <div className="flex flex-col gap-2">
                    {d.modules.map((m, i) => (
                      <Link
                        key={m.id ?? i}
                        // fromWorkout+sessionId → видео открывается ТОЛЬКО в режиме
                        // «Тренировка»: без перемотки, переключатель режима скрыт,
                        // прогресс идёт в зачёт сессии (тот же флоу, что на
                        // /training/workout).
                        href={`/video/${m.id}?fromWorkout=true&sessionId=${ws.id}`}
                        className="flex items-center gap-3 rounded-2xl p-2 transition-transform active:scale-[0.99]"
                        style={{ background: 'rgba(174,171,187,0.06)' }}
                      >
                        <div className="relative w-16 h-16 rounded-lg overflow-hidden bg-[#0d1228] shrink-0">
                          {m.thumbnail ? (
                            <Image src={m.thumbnail} alt={m.title} fill className="object-cover" />
                          ) : (
                            <div className="absolute inset-0 flex items-center justify-center text-[#AEABBB]">
                              <Dumbbell size={20} />
                            </div>
                          )}
                          <span
                            className="absolute top-1 left-1 text-[#A1FF4A] text-[10px] font-bold px-1.5 py-0.5 rounded-md"
                            style={{ background: 'rgba(6,9,25,0.72)' }}
                          >
                            {i + 1}
                          </span>
                        </div>
                        <div className="flex-1 min-w-0 pr-2">
                          <div className="text-white text-sm font-semibold leading-tight line-clamp-2">{m.title}</div>
                          {m.duration > 0 && (
                            <div className="text-[#AEABBB] text-xs mt-1">{formatDuration(m.duration)}</div>
                          )}
                        </div>
                      </Link>
                    ))}
                  </div>
                </div>
              )}
              {d.intent === 'STRETCH' && (
                <div className="mt-2 rounded-2xl p-3" style={{ background: 'rgba(174,171,187,0.08)' }}>
                  <div
                    className="font-overpass"
                    style={{
                      color: '#AEABBB',
                      fontSize: 11,
                      fontWeight: 700,
                      textTransform: 'uppercase',
                      letterSpacing: 0.5,
                      marginBottom: 8,
                      display: 'flex',
                      alignItems: 'center',
                      gap: 6,
                    }}
                  >
                    <PersonStanding size={16} />
                    Куда делать растяжку?
                  </div>
                  <div className="flex gap-2">
                    {([['lower', 'Низ тела'], ['upper', 'Верх тела'], ['full', 'Всё тело']] as const).map(([bp, label]) => (
                      <button
                        key={bp}
                        type="button"
                        disabled={stretchRebuilding}
                        onClick={() => handleStretchBodyPart(ws.id, bp)}
                        className="flex-1 font-overpass transition-transform active:scale-95"
                        style={{
                          background: 'rgba(161,255,74,0.12)',
                          color: '#A1FF4A',
                          border: '1px solid var(--border-lime)',
                          borderRadius: 999,
                          padding: '12px 8px',
                          minHeight: 44,
                          fontSize: 11,
                          fontWeight: 800,
                          textTransform: 'uppercase',
                          letterSpacing: 0.3,
                          cursor: stretchRebuilding ? 'wait' : 'pointer',
                          opacity: stretchRebuilding ? 0.6 : 1,
                        }}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                  {stretchError && (
                    <div role="alert" style={{ color: '#FF8C4A', fontSize: 12, marginTop: 8 }}>{stretchError}</div>
                  )}
                </div>
              )}
              </>
            );
          })()}

          {selectedAssignments.map((a) => {
            const coachName = `${a.coach.firstName ?? ''} ${a.coach.lastName ?? ''}`.trim() || 'Тренер';
            const isFull = !!a.workoutSessionId;
            const href = isFull
              ? `/training/workout?id=${a.workoutSessionId}`
              : `/video/${a.video?.id ?? ''}`;
            const title = isFull
              ? 'Полноценное занятие · 4 модуля'
              : (a.video?.title ?? 'Задание от тренера');
            const durationSec = a.video?.duration ?? null;
            return (
              <Link
                key={a.id}
                href={href}
                className="block rounded-2xl overflow-hidden"
                style={{
                  background:
                    'linear-gradient(135deg, rgba(161, 255, 74, 0.12) 0%, rgba(68, 92, 255, 0.20) 100%)',
                  border: '1px solid rgba(161, 255, 74, 0.25)',
                }}
              >
                <div className="p-4 flex gap-3 items-center">
                  <div className="relative w-20 h-20 rounded-lg overflow-hidden bg-[#0d1228] shrink-0">
                    {a.video?.thumbnail && !isFull && (
                      <Image src={a.video.thumbnail} alt={a.video.title} fill className="object-cover" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div
                      style={{
                        color: '#A1FF4A',
                        fontSize: 11,
                                    fontWeight: 700,
                        textTransform: 'uppercase',
                        letterSpacing: 0.5,
                        marginBottom: 6,
                      }}
                    >
                      от тренера · {coachName}
                    </div>
                    <div className="text-white text-sm font-semibold leading-tight line-clamp-2">
                      {title}
                    </div>
                    {!isFull && durationSec ? (
                      <div className="text-[#AEABBB] text-xs mt-1">{formatDuration(durationSec)}</div>
                    ) : null}
                  </div>
                </div>
              </Link>
            );
          })}

          {selectedWorkouts.map((workout) => (
            <SwipeableWorkoutItem
              key={workout.id}
              workout={workout}
              onDelete={handleDeleteWorkout}
              categoryMap={categoryMap}
              levelMap={levelMap}
            />
          ))}

          {!hasAnythingForSelected && (
            <div className="flex flex-col items-center text-center" style={{ padding: '32px 16px' }}>
              <CalendarDays size={24} style={{ color: 'var(--color-muted)', marginBottom: 12 }} aria-hidden />
              <div className="text-[#AEABBB] text-sm">Нет запланированных тренировок</div>
            </div>
          )}
        </div>
        )}
      </div>

      <BottomNavigation activeTab="calendar" />

      {/* Анимация сборки недели */}
      <MicrocyclePreparingOverlay open={generatingCycle} />
    </div>
  );
}
