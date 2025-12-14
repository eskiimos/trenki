'use client';

import React, { useState, useRef } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { ThumbsUp, Trash2 } from 'lucide-react';
import { getTelegramId } from '@/lib/auth';

interface SwipeableWorkoutItemProps {
  workout: any;
  onDelete: (id: string) => void;
  categoryMap: Record<string, string>;
  levelMap: Record<string, string>;
}

export default function SwipeableWorkoutItem({ 
  workout, 
  onDelete,
  categoryMap,
  levelMap 
}: SwipeableWorkoutItemProps) {
  const [startX, setStartX] = useState<number | null>(null);
  const [currentX, setCurrentX] = useState(0);
  const [isSwiped, setIsSwiped] = useState(false);
  const [isLiked, setIsLiked] = useState(false); // Local state for like, ideally should be from props
  const itemRef = useRef<HTMLDivElement>(null);

  const handleTouchStart = (e: React.TouchEvent) => {
    setStartX(e.touches[0].clientX);
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (startX === null) return;
    
    const diff = e.touches[0].clientX - startX;
    
    // Only allow swiping left (negative diff)
    // Limit swipe to -160px (width of two buttons)
    if (diff < 0 && diff > -200) {
      setCurrentX(diff);
    } else if (diff > 0 && isSwiped) {
      // Allow swiping back right if already swiped
      setCurrentX(-160 + diff);
    }
  };

  const handleTouchEnd = () => {
    if (currentX < -80) {
      // Snap to open
      setCurrentX(-160);
      setIsSwiped(true);
    } else {
      // Snap back to closed
      setCurrentX(0);
      setIsSwiped(false);
    }
    setStartX(null);
  };

  const handleDelete = async () => {
    try {
      const telegramId = getTelegramId();
      const response = await fetch(`/api/schedule?id=${workout.id}`, {
        method: 'DELETE',
        headers: {
          'x-telegram-id': telegramId || '',
        }
      });

      if (response.ok) {
        onDelete(workout.id);
      }
    } catch (error) {
      console.error('Error deleting workout:', error);
    }
  };

  const handleLike = async () => {
    try {
      const telegramId = getTelegramId();
      const response = await fetch(`/api/videos/${workout.video.id}/like`, {
        method: 'POST',
        headers: {
          'X-Telegram-User-ID': telegramId || '',
        }
      });

      if (response.ok) {
        const data = await response.json();
        setIsLiked(data.isLiked);
        // Close swipe after action
        setCurrentX(0);
        setIsSwiped(false);
      }
    } catch (error) {
      console.error('Error liking video:', error);
    }
  };

  return (
    <div className="relative overflow-hidden rounded-2xl mb-4">
      {/* Actions Background */}
      <div className="absolute inset-0 flex justify-end">
        <button 
          onClick={handleLike}
          className="w-20 bg-[#35553B] flex flex-col items-center justify-center gap-1"
        >
          <ThumbsUp size={20} className="text-white" />
          <span className="text-white text-[10px] font-medium leading-tight text-center">
            В<br/>избранное
          </span>
        </button>
        <button 
          onClick={handleDelete}
          className="w-20 bg-[#1A2036] flex flex-col items-center justify-center gap-1"
        >
          <Trash2 size={20} className="text-white" />
          <span className="text-white text-[10px] font-medium leading-tight">
            Удалить
          </span>
        </button>
      </div>

      {/* Swipeable Content */}
      <div
        ref={itemRef}
        className="relative bg-[#101530] transition-transform duration-200 ease-out"
        style={{ transform: `translateX(${currentX}px)` }}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        <Link 
          href={`/video/${workout.video.id}?fromWorkout=true`} 
          className="block"
          onClick={(e) => {
            // Prevent navigation if swiping
            if (Math.abs(currentX) > 5) {
              e.preventDefault();
            }
          }}
        >
          <div className="flex p-3 gap-4">
            {/* Thumbnail */}
            <div className="relative w-32 h-20 rounded-xl overflow-hidden flex-shrink-0">
              {workout.video.thumbnail ? (
                <Image
                  src={workout.video.thumbnail}
                  alt={workout.video.title}
                  fill
                  className="object-cover"
                />
              ) : (
                <div className="w-full h-full bg-gray-800" />
              )}
              <div className="absolute bottom-1 right-1 bg-black/60 rounded px-1.5 py-0.5">
                <span className="text-white text-[10px] font-medium">
                  {Math.floor(workout.video.duration / 60)}:{String(workout.video.duration % 60).padStart(2, '0')}
                </span>
              </div>
            </div>

            {/* Info */}
            <div className="flex-1 flex flex-col justify-between py-1">
              {/* Trainer and Start Time */}
              <div className="flex items-center justify-between gap-2 mb-1">
                <div className="flex items-center gap-2">
                  <div className="w-5 h-5 rounded-full overflow-hidden bg-gray-700 relative">
                    {workout.video.trainer.avatar ? (
                      <Image
                        src={workout.video.trainer.avatar}
                        alt={workout.video.trainer.name}
                        fill
                        className="object-cover"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-[8px] text-white">
                        {workout.video.trainer.name[0]}
                      </div>
                    )}
                  </div>
                  <span className="text-white text-xs font-bold uppercase">
                    {workout.video.trainer.name} {workout.video.trainer.lastName}
                  </span>
                </div>
                {workout.date && (
                  <span className="text-[#A1FF4A] text-xs font-bold">
                    {new Date(workout.date).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })}
                  </span>
                )}
              </div>

              {/* Tags */}
              <div className="flex flex-wrap gap-2">
                {workout.video.category && (
                  <div className="bg-[#2A3045] rounded px-2 py-1">
                    <span className="text-[#AEABBB] text-[10px] font-medium">
                      {categoryMap[workout.video.category] || workout.video.category}
                    </span>
                  </div>
                )}
                {workout.video.equipment && workout.video.equipment.length > 0 && (
                  <div className="bg-[#2A3045] rounded px-2 py-1">
                    <span className="text-[#AEABBB] text-[10px] font-medium">
                      {workout.video.equipment[0]}
                    </span>
                  </div>
                )}
                {workout.video.level && (
                  <div className="bg-[#2A3045] rounded px-2 py-1">
                    <span className="text-[#AEABBB] text-[10px] font-medium">
                      {levelMap[workout.video.level] || workout.video.level}
                    </span>
                  </div>
                )}
              </div>
            </div>
          </div>
        </Link>
      </div>
    </div>
  );
}
