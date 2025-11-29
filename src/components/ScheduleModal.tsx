'use client';

import React, { useState, useEffect, useRef } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import Image from 'next/image';
import { getTelegramId } from '@/lib/auth';

interface ScheduleModalProps {
  isOpen: boolean;
  onClose: () => void;
  videoId: string;
}

interface ScheduledDate {
  date: string; // ISO string
  hasEvent: boolean;
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

  // Reset state when modal opens
  useEffect(() => {
    if (isOpen) {
      setIsClosing(false);
      setIsSuccess(false);
      setSelectedDates([]);
      fetchScheduledDates();
    }
  }, [isOpen, currentDate.getMonth(), currentDate.getFullYear()]);

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
    const dateString = date.toDateString();
    const isSelected = selectedDates.some(d => d.toDateString() === dateString);

    if (isSelected) {
      setSelectedDates(selectedDates.filter(d => d.toDateString() !== dateString));
    } else {
      setSelectedDates([...selectedDates, date]);
    }
  };

  const handleSave = async () => {
    if (selectedDates.length === 0) return;

    setIsSaving(true);
    try {
      const telegramId = getTelegramId();
      const response = await fetch('/api/schedule', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-telegram-id': telegramId || '',
        },
        body: JSON.stringify({
          videoId,
          dates: selectedDates.map(d => d.toISOString()),
        }),
      });

      if (response.ok) {
        setIsSuccess(true);
        setTimeout(() => {
          handleClose();
        }, 1000);
      }
    } catch (error) {
      console.error('Error saving schedule:', error);
    } finally {
      setIsSaving(false);
    }
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

      days.push(
        <button
          key={i}
          onClick={() => handleDateClick(date)}
          className={`h-10 w-10 flex flex-col items-center justify-center rounded-full relative text-sm font-medium transition-colors
            ${isSelected 
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
          {hasEvent && !isSelected && !isToday && (
            <span className="absolute bottom-1 w-1 h-1 bg-[#445CFF] rounded-full"></span>
          )}
          {/* Blue text for dates with events if not selected/today? 
              Screenshot shows blue text for 10, 13, 22, 26. 
              Let's apply blue text if hasEvent and not selected/today 
          */}
          {hasEvent && !isSelected && !isToday && (
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
        className={`w-full max-w-md bg-[#101530] rounded-t-3xl sm:rounded-3xl overflow-hidden shadow-2xl transform transition-transform duration-300 ease-out ${isClosing ? 'translate-y-full' : 'animate-slide-up'}`}
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

          {/* Save Button */}
          <button
            onClick={handleSave}
            disabled={selectedDates.length === 0 || isSaving || isSuccess}
            className={`w-full py-4 rounded-full font-bold text-[14px] uppercase tracking-wider transition-all
              ${isSuccess
                ? 'bg-[#445CFF] text-[#060919]'
                : selectedDates.length > 0 
                  ? 'bg-[#A1FF4A] text-[#060919] hover:bg-[#8FE639]' 
                  : 'bg-[#A1FF4A33] text-[#060919] cursor-not-allowed'
              }
            `}
          >
            {isSaving ? 'СОХРАНЕНИЕ...' : isSuccess ? 'СОХРАНЕНО' : 'СОХРАНИТЬ'}
          </button>
        </div>
      </div>
    </div>
  );
}
