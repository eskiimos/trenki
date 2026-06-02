'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { ChevronLeft, ChevronRight, Plus } from 'lucide-react';
import BottomNavigation from '@/components/BottomNavigation';
import SwipeableWorkoutItem from '@/components/SwipeableWorkoutItem';

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

export default function CalendarPage() {
  const router = useRouter();
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [scheduledWorkouts, setScheduledWorkouts] = useState<ScheduledWorkout[]>([]);
  const [coachAssignments, setCoachAssignments] = useState<CoachAssignment[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetchCalendar();
  }, [currentDate.getMonth(), currentDate.getFullYear()]);

  const fetchCalendar = async () => {
    setIsLoading(true);
    try {
      const month = currentDate.getMonth();
      const year = currentDate.getFullYear();

      const [scheduleRes, assignmentsRes] = await Promise.all([
        fetch(`/api/schedule?month=${month}&year=${year}`),
        fetch('/api/assignments?role=athlete'),
      ]);

      if (scheduleRes.ok) {
        setScheduledWorkouts(await scheduleRes.json());
      }
      if (assignmentsRes.ok) {
        const data = await assignmentsRes.json();
        setCoachAssignments(data.assignments ?? []);
      }
    } catch (error) {
      console.error('Error fetching calendar:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handlePrevMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1));
  };

  const handleNextMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1));
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

  const hasAnyEventOnDay = (year: number, month: number, day: number) => {
    const checkDate = new Date(year, month, day);
    if (scheduledWorkouts.some((w) => isSameDay(new Date(w.date), checkDate))) return true;
    return coachAssignments.some(
      (a) =>
        a.status !== 'COMPLETED' &&
        a.status !== 'CANCELLED' &&
        isSameDay(new Date(a.dueDate), checkDate),
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
      days.push(<div key={`empty-${i}`} className="h-10 w-10" />);
    }

    const today = new Date();
    const isCurrentMonth = today.getMonth() === month && today.getFullYear() === year;

    for (let i = 1; i <= daysInMonth; i++) {
      const date = new Date(year, month, i);
      const isSelected = 
        selectedDate.getDate() === i && 
        selectedDate.getMonth() === month && 
        selectedDate.getFullYear() === year;
      
      const isToday = isCurrentMonth && today.getDate() === i;
      
      const hasWorkouts = hasAnyEventOnDay(year, month, i);

      days.push(
        <button
          key={i}
          onClick={() => handleDateClick(date)}
          className={`h-10 w-10 flex flex-col items-center justify-center rounded-full relative text-sm font-medium transition-colors
            ${isSelected 
              ? 'bg-[#445CFF] text-white' 
              : isToday 
                ? 'text-white' 
                : 'text-white hover:bg-white/10'
            }
          `}
          style={isToday && !isSelected ? {
            background: 'linear-gradient(180deg, rgba(87, 108, 255, 0) 0%, rgba(87, 108, 255, 0.5) 100%)'
          } : {}}
        >
          {i}
          {hasWorkouts && !isSelected && !isToday && (
             <span className="absolute inset-0 flex items-center justify-center text-[#445CFF] font-bold">{i}</span>
          )}
          {hasWorkouts && !isSelected && !isToday && (
            <span className="absolute bottom-1 w-1 h-1 bg-[#445CFF] rounded-full"></span>
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
  const hasAnythingForSelected = selectedWorkouts.length > 0 || selectedAssignments.length > 0;

  const formatDuration = (seconds: number | null) => {
    if (!seconds) return '';
    const min = Math.round(seconds / 60);
    return `${min} мин`;
  };

  return (
    <div 
      className="min-h-screen pb-24"
      style={{ background: 'linear-gradient(182.77deg, #101530 69.24%, #060919 97.69%)' }}
    >
      {/* Header */}
      <header className="flex items-center p-4" style={{ paddingTop: 'calc(env(safe-area-inset-top, 0px) + 16px)' }}>
        <button onClick={() => router.back()} className="mr-4 text-white/60 hover:text-white">
          <Image src="/icons/icon-action-back.svg" alt="Назад" width={24} height={24} />
        </button>
        <h1 
          className="text-white uppercase"
          style={{
            fontFamily: 'Overpass',
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
        {/* Calendar Widget */}
        <div className="bg-[#101530] rounded-3xl mb-8">
          <div className="bg-[#445CFF]/20 rounded-2xl p-4">
            {/* Month Navigation */}
            <div className="flex items-center justify-between mb-6 text-white">
              <button onClick={handlePrevMonth} className="p-2 hover:bg-white/10 rounded-full">
                <ChevronLeft size={24} />
              </button>
              <span className="text-[14px] font-bold uppercase tracking-widest">
                {monthNames[currentDate.getMonth()]}, {currentDate.getFullYear()}
              </span>
              <button onClick={handleNextMonth} className="p-2 hover:bg-white/10 rounded-full">
                <ChevronRight size={24} />
              </button>
            </div>

            {/* Days of Week */}
            <div className="grid grid-cols-7 gap-1 mb-4 text-center">
              {['ПН', 'ВТ', 'СР', 'ЧТ', 'ПТ', 'СБ', 'ВС'].map(day => (
                <div key={day} className="text-[#AEABBB] text-[14px] font-bold italic">
                  {day}
                </div>
              ))}
            </div>

            {/* Calendar Grid */}
            <div className="grid grid-cols-7 gap-1 place-items-center">
              {renderCalendar()}
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
            className="flex items-center gap-2 bg-[#2A3045] rounded-full px-4 py-2 hover:bg-[#353c57] transition-colors"
          >
            <span className="text-[#AEABBB] text-xs font-medium">Добавить видео</span>
            <div className="w-5 h-5 bg-[#445CFF] rounded-full flex items-center justify-center">
              <Plus size={12} className="text-white" />
            </div>
          </Link>
        </div>

        {/* Workouts List */}
        <div className="space-y-4">
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
                        fontFamily: 'Overpass',
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
            <div className="text-[#AEABBB] text-sm text-center py-8">
              Нет запланированных тренировок
            </div>
          )}
        </div>
      </div>

      <BottomNavigation activeTab="calendar" />
    </div>
  );
}
