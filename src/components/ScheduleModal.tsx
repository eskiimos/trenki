'use client';

import React, { useState, useEffect, useRef } from 'react';
import { ChevronLeft, ChevronRight, CheckCircle2 } from 'lucide-react';
import Image from 'next/image';
import { getTelegramId } from '@/lib/auth';
import { Button } from '@/components/ui';

interface ScheduleModalProps {
  isOpen: boolean;
  onClose: () => void;
  videoId: string;
}

interface ScheduledDate {
  date: string; // ISO string
  hasEvent: boolean;
}

interface VideoData {
  id: string;
  title: string;
  thumbnail: string | null;
  duration: number;
}

export default function ScheduleModal({ isOpen, onClose, videoId }: ScheduleModalProps) {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDates, setSelectedDates] = useState<Date[]>([]);
  const [scheduledDates, setScheduledDates] = useState<string[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [isClosing, setIsClosing] = useState(false);
  const modalRef = useRef<HTMLDivElement>(null);
  const touchStartY = useRef<number | null>(null);
  const [startTime, setStartTime] = useState<{ hours: number; minutes: number }>({ hours: 9, minutes: 0 });
  const [showTimePicker, setShowTimePicker] = useState(false);
  const hoursRef = useRef<HTMLDivElement>(null);
  const minutesRef = useRef<HTMLDivElement>(null);
  const [videoData, setVideoData] = useState<VideoData | null>(null);
  const [timeError, setTimeError] = useState<string | null>(null);
  const [isAddingToDevice, setIsAddingToDevice] = useState(false);

  // Fetch video data when modal opens
  useEffect(() => {
    if (isOpen && videoId) {
      fetchVideoData();
    }
  }, [isOpen, videoId]);

  // Reset state when modal opens
  useEffect(() => {
    if (isOpen) {
      setIsClosing(false);
      setIsSuccess(false);
      setSelectedDates([]);
      setStartTime({ hours: 9, minutes: 0 });
      setShowTimePicker(false);
      setTimeError(null);
      fetchScheduledDates();
    }
  }, [isOpen, currentDate.getMonth(), currentDate.getFullYear()]);

  const fetchVideoData = async () => {
    try {
      const response = await fetch(`/api/videos/${videoId}`);
      if (response.ok) {
        const data = await response.json();
        setVideoData(data);
      }
    } catch (error) {
      console.error('Error fetching video data:', error);
    }
  };

  // Scroll time pickers to selected values
  useEffect(() => {
    if (showTimePicker) {
      if (hoursRef.current) {
        const hourElement = hoursRef.current.children[startTime.hours] as HTMLElement;
        if (hourElement) {
          hourElement.scrollIntoView({ block: 'center', behavior: 'smooth' });
        }
      }
      if (minutesRef.current) {
        const minuteElement = minutesRef.current.children[startTime.minutes] as HTMLElement;
        if (minuteElement) {
          minuteElement.scrollIntoView({ block: 'center', behavior: 'smooth' });
        }
      }
    }
  }, [showTimePicker]);

  const handleClose = () => {
    setIsClosing(true);
    setTimeout(() => {
      onClose();
      setIsClosing(false);
    }, 300); // Match animation duration
  };

  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartY.current = e.touches[0].clientY;
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (touchStartY.current === null) return;
    
    const currentY = e.touches[0].clientY;
    const diff = currentY - touchStartY.current;

    // If swiping down significantly
    if (diff > 50) {
      // Could add visual feedback here (transform translateY)
    }
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (touchStartY.current === null) return;
    
    const currentY = e.changedTouches[0].clientY;
    const diff = currentY - touchStartY.current;

    if (diff > 100) { // Threshold for closing
      handleClose();
    }
    touchStartY.current = null;
  };

  const fetchScheduledDates = async () => {
    try {
      const month = currentDate.getMonth();
      const year = currentDate.getFullYear();
      const telegramId = getTelegramId();
      
      const response = await fetch(`/api/schedule?month=${month}&year=${year}`, {
        headers: {
          'x-telegram-id': telegramId || '',
        }
      });
      
      if (response.ok) {
        const data = await response.json();
        // Extract dates from response
        const dates = data.map((item: any) => new Date(item.date).toDateString());
        setScheduledDates(dates);
      }
    } catch (error) {
      console.error('Error fetching schedule:', error);
    }
  };

  const handlePrevMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1));
  };

  const handleNextMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1));
  };

  const handleDateClick = (date: Date) => {
    // Проверяем, не является ли дата прошедшей
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const selectedDate = new Date(date);
    selectedDate.setHours(0, 0, 0, 0);
    
    if (selectedDate < today) {
      return; // Не даем выбрать прошедшую дату
    }
    
    const dateString = date.toDateString();
    const isSelected = selectedDates.some(d => d.toDateString() === dateString);

    if (isSelected) {
      setSelectedDates(selectedDates.filter(d => d.toDateString() !== dateString));
    } else {
      // Если выбрана сегодняшняя дата, устанавливаем время на час вперед от текущего
      if (selectedDate.getTime() === today.getTime()) {
        const now = new Date();
        const nextHour = now.getHours() + 1;
        const nextMinutes = 0;
        
        if (nextHour < 24) {
          setStartTime({ hours: nextHour, minutes: nextMinutes });
        } else {
          // Если уже поздно, устанавливаем на 23:00
          setStartTime({ hours: 23, minutes: 0 });
        }
      } else {
        // Для будущих дат устанавливаем 9:00
        setStartTime({ hours: 9, minutes: 0 });
      }
      
      setSelectedDates([...selectedDates, date]);
      setTimeError(null);
    }
  };

  const handleSave = async () => {
    if (selectedDates.length === 0) return;

    // Сбрасываем ошибку
    setTimeError(null);

    // Проверяем, не является ли выбранное время прошедшим для сегодняшней даты
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    
    for (const selectedDate of selectedDates) {
      const dateOnly = new Date(selectedDate.getFullYear(), selectedDate.getMonth(), selectedDate.getDate());
      
      // Если выбрана сегодняшняя дата
      if (dateOnly.getTime() === today.getTime()) {
        const selectedDateTime = new Date(selectedDate);
        selectedDateTime.setHours(startTime.hours);
        selectedDateTime.setMinutes(startTime.minutes);
        
        // Если выбранное время уже прошло
        if (selectedDateTime <= now) {
          setTimeError('Нельзя выбрать прошедшее время');
          return;
        }
      }
    }

    setIsSaving(true);
    try {
      const telegramId = getTelegramId();
      
      // Combine dates with selected time (сохраняем в UTC через toISOString)
      const datesWithTime = selectedDates.map((d) => {
        const dateWithTime = new Date(d);
        dateWithTime.setHours(startTime.hours, startTime.minutes, 0, 0);
        return dateWithTime.toISOString();
      });
      
      const response = await fetch('/api/schedule', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-telegram-id': telegramId || '',
        },
        body: JSON.stringify({
          videoId,
          dates: datesWithTime,
        }),
      });

      if (response.ok) {
        setIsSuccess(true);
        // Не закрываем автоматически - даём пользователю возможность добавить в календарь устройства
      }
    } catch (error) {
      console.error('Error saving schedule:', error);
    } finally {
      setIsSaving(false);
    }
  };

  const handleAddToDeviceCalendar = async () => {
    if (!videoData || selectedDates.length === 0) return;

    setIsAddingToDevice(true);

    try {
      // Добавляем каждую выбранную дату в календарь устройства
      for (const selectedDate of selectedDates) {
        const dateWithTime = new Date(selectedDate);
        dateWithTime.setHours(startTime.hours);
        dateWithTime.setMinutes(startTime.minutes);
        dateWithTime.setSeconds(0);

        const response = await fetch('/api/calendar/ics', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            videoId: videoData.id,
            date: dateWithTime.toISOString(),
          }),
        });

        if (response.ok) {
          const blob = await response.blob();
          const url = window.URL.createObjectURL(blob);
          const filename = `trenki-workout-${videoData.id}-${Date.now()}.ics`;

          // Проверяем поддержку Web Share API для мобильных устройств
          if (navigator.share && /iPhone|iPad|iPod|Android/i.test(navigator.userAgent)) {
            try {
              const file = new File([blob], filename, { type: 'text/calendar' });
              await navigator.share({
                files: [file],
                title: 'Тренировка',
                text: `Добавить в календарь: ${videoData.title}`,
              });
            } catch (shareError) {
              // Если share не сработал, переходим к скачиванию
              downloadICSFile(url, filename);
            }
          } else {
            // Для desktop или если Share API не поддерживается - скачиваем файл
            downloadICSFile(url, filename);
          }

          // Небольшая задержка между файлами, если их несколько
          if (selectedDates.length > 1) {
            await new Promise(resolve => setTimeout(resolve, 300));
          }
        }
      }
    } catch (error) {
      console.error('Error adding to device calendar:', error);
    } finally {
      setIsAddingToDevice(false);
    }
  };

  const downloadICSFile = (url: string, filename: string) => {
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
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
      const dateString = date.toDateString();
      const isSelected = selectedDates.some(d => d.toDateString() === dateString);
      const isToday = isCurrentMonth && today.getDate() === i;
      const hasEvent = scheduledDates.includes(dateString);
      
      // Проверка на прошедшую дату
      const isPast = date < new Date(today.getFullYear(), today.getMonth(), today.getDate());

      days.push(
        <button
          key={i}
          onClick={() => handleDateClick(date)}
          disabled={isPast}
          className={`h-10 w-10 flex flex-col items-center justify-center rounded-full relative text-sm font-medium transition-colors
            ${isPast
              ? 'text-white/30 cursor-not-allowed'
              : isSelected 
                ? 'bg-[#A1FF4A] text-[#060919]' 
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
          {hasEvent && !isSelected && !isToday && !isPast && (
            <span className="absolute bottom-1 w-1 h-1 bg-[#445CFF] rounded-full"></span>
          )}
          {hasEvent && !isSelected && !isToday && !isPast && (
             <span className="absolute inset-0 flex items-center justify-center text-[#445CFF] font-bold">{i}</span>
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

  if (!isOpen && !isClosing) return null;

  return (
    <div 
      className={`fixed inset-0 z-[100] flex items-end justify-center sm:items-center bg-black/60 transition-opacity duration-300 ${isClosing ? 'opacity-0' : 'opacity-100'}`}
      onClick={handleClose}
    >
      <div 
        ref={modalRef}
        onClick={(e) => e.stopPropagation()}
        className={`w-full max-w-md bg-[#101530] rounded-t-3xl sm:rounded-3xl overflow-hidden shadow-2xl transform transition-transform duration-300 ease-out ${isClosing ? 'translate-y-full' : 'animate-slideUp'}`}
      >
        
        {/* Header */}
        <div 
          className="relative h-[56px] flex items-center justify-center overflow-hidden cursor-grab active:cursor-grabbing"
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
        >
          <Image 
            src="/icons/video/calendar-header.svg" 
            alt="Header Background" 
            fill 
            className="object-cover"
          />
          
          <h2 className="relative z-10 text-white font-bold text-[14px] tracking-wider uppercase">
            ЗАПЛАНИРУЙ ТРЕНИРОВКУ
          </h2>
        </div>

        <div className="p-6">
          {/* Calendar Container */}
          <div className="bg-[#445CFF]/20 rounded-2xl p-4 mb-8">
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

          {/* Start Time Section */}
          {selectedDates.length > 0 && !isSuccess && (
            <div className="mb-8">
              <div className="flex items-center justify-between mb-4">
                <span className="text-white text-[12px] font-bold uppercase tracking-wider">
                  НАЧАЛО
                </span>
                <button
                  onClick={() => { setShowTimePicker(!showTimePicker); setTimeError(null); }}
                  className={`px-6 py-2 bg-[#1C2344] text-white rounded-full font-bold text-[14px] border-2 hover:bg-[#2A3154] transition-colors ${
                    timeError ? 'border-red-500' : 'border-[#A1FF4A]'
                  }`}
                >
                  {String(startTime.hours).padStart(2, '0')}:{String(startTime.minutes).padStart(2, '0')}
                </button>
              </div>

              {/* Time Error */}
              {timeError && (
                <div className="mb-4 p-3 bg-red-500/20 border border-red-500/50 rounded-xl">
                  <p className="text-red-400 text-xs text-center font-medium">{timeError}</p>
                </div>
              )}

              {/* Time Picker */}
              {showTimePicker && (
                <div className="relative mb-4 py-2">
                  {/* iOS-style highlight bar - полоса выделения */}
                  <div className="absolute left-0 right-0 top-1/2 -translate-y-1/2 h-7 bg-[#1C2344] rounded-xl pointer-events-none z-0"></div>
                  
                  <div className="flex justify-center gap-2 relative z-10">
                    {/* Hours Picker */}
                    <div className="flex-1 max-w-[80px] relative">
                      <div 
                        ref={hoursRef}
                        onScroll={(e) => {
                          const element = e.currentTarget;
                          const scrollTop = element.scrollTop;
                          const itemHeight = 28; // h-7 = 28px
                          const centerIndex = Math.round(scrollTop / itemHeight);
                          setStartTime({ ...startTime, hours: centerIndex });
                        }}
                        className="h-32 overflow-y-scroll snap-y snap-mandatory scrollbar-hide py-[50px]"
                        style={{
                          maskImage: 'linear-gradient(to bottom, transparent 0%, black 25%, black 75%, transparent 100%)',
                          WebkitMaskImage: 'linear-gradient(to bottom, transparent 0%, black 25%, black 75%, transparent 100%)',
                        }}
                      >
                        {Array.from({ length: 24 }, (_, i) => (
                          <div
                            key={i}
                            className={`h-7 flex items-center justify-center snap-center transition-all ${
                              startTime.hours === i
                                ? 'text-white text-[18px] font-bold'
                                : 'text-[#AEABBB] text-[14px] opacity-50'
                            }`}
                          >
                            {String(i).padStart(2, '0')}
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Separator */}
                    <div className="flex items-center justify-center w-3">
                      <span className="text-white text-[18px] font-bold">:</span>
                    </div>

                    {/* Minutes Picker */}
                    <div className="flex-1 max-w-[80px] relative">
                      <div 
                        ref={minutesRef}
                        onScroll={(e) => {
                          const element = e.currentTarget;
                          const scrollTop = element.scrollTop;
                          const itemHeight = 28; // h-7 = 28px
                          const centerIndex = Math.round(scrollTop / itemHeight);
                          setStartTime({ ...startTime, minutes: centerIndex });
                        }}
                        className="h-32 overflow-y-scroll snap-y snap-mandatory scrollbar-hide py-[50px]"
                        style={{
                          maskImage: 'linear-gradient(to bottom, transparent 0%, black 25%, black 75%, transparent 100%)',
                          WebkitMaskImage: 'linear-gradient(to bottom, transparent 0%, black 25%, black 75%, transparent 100%)',
                        }}
                      >
                        {Array.from({ length: 60 }, (_, i) => (
                          <div
                            key={i}
                            className={`h-7 flex items-center justify-center snap-center transition-all ${
                              startTime.minutes === i
                                ? 'text-white text-[18px] font-bold'
                                : 'text-[#AEABBB] text-[14px] opacity-50'
                            }`}
                          >
                            {String(i).padStart(2, '0')}
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Success State with Video Preview */}
          {isSuccess && videoData && selectedDates.length > 0 ? (
            <div className="space-y-4">
              <div className="flex items-center justify-between mb-4">
                <p className="text-white text-sm font-medium">
                  {selectedDates[0].toLocaleDateString('ru-RU', { day: 'numeric', month: 'long' })}
                </p>
                <p className="text-white text-sm font-bold">
                  {String(startTime.hours).padStart(2, '0')}:{String(startTime.minutes).padStart(2, '0')}
                </p>
              </div>
              
              {/* Video Preview */}
              <div className="relative w-full aspect-video rounded-2xl overflow-hidden">
                {videoData.thumbnail ? (
                  <Image
                    src={videoData.thumbnail}
                    alt={videoData.title}
                    fill
                    className="object-cover"
                  />
                ) : (
                  <div className="w-full h-full bg-gray-800" />
                )}
                <div className="absolute bottom-2 right-2 bg-black/60 rounded px-2 py-1">
                  <span className="text-white text-xs font-medium">
                    {Math.floor(videoData.duration / 60)}:{String(videoData.duration % 60).padStart(2, '0')}
                  </span>
                </div>
              </div>

              {/* Success Message */}
              <div className="w-full py-4 rounded-full font-bold text-[14px] uppercase tracking-wider bg-[#445CFF] text-white flex items-center justify-center gap-2">
                <CheckCircle2 size={20} className="shrink-0" />
                УСПЕШНО ДОБАВЛЕНО В ПРИЛОЖЕНИЕ
              </div>

              {/* Add to Device Calendar Button */}
              <Button
                variant="primary"
                fullWidth
                onClick={handleAddToDeviceCalendar}
                disabled={isAddingToDevice}
                className="flex items-center justify-center gap-2"
              >
                <Image
                  src="/icons/video/Type_calendar_No.svg"
                  alt="Календарь"
                  width={20}
                  height={20}
                />
                {isAddingToDevice ? 'ДОБАВЛЕНИЕ...' : 'ДОБАВИТЬ В КАЛЕНДАРЬ УСТРОЙСТВА'}
              </Button>

              {/* Close Button */}
              <Button variant="ghost" size="sm" fullWidth onClick={handleClose}>
                ЗАКРЫТЬ
              </Button>
            </div>
          ) : (
            /* Save Button */
            <Button
              variant="primary"
              fullWidth
              onClick={handleSave}
              disabled={selectedDates.length === 0 || isSaving}
            >
              {isSaving ? 'СОХРАНЕНИЕ...' : 'СОХРАНИТЬ'}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
