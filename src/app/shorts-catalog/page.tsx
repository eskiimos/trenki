'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import BottomNavigation from '@/components/BottomNavigation';

interface ShortData {
  id: string;
  title: string;
  description?: string;
  videoUrl: string;
  thumbnail?: string;
  tags: string[];
  viewsCount: number;
  likesCount: number;
  trainer?: {
    id: string;
    name: string;
    lastName: string;
    avatar: string | null;
  };
}

const ITEMS_PER_PAGE = 12; // 4 ряда по 3 видео

export default function ShortsCatalogPage() {
  const [allShorts, setAllShorts] = useState<ShortData[]>([]);
  const [displayedShorts, setDisplayedShorts] = useState<ShortData[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const observerRef = useRef<IntersectionObserver | null>(null);
  const loadMoreRef = useRef<HTMLDivElement>(null);

  // Загружаем все shorts один раз
  useEffect(() => {
    const loadShorts = async () => {
      try {
        setIsLoading(true);
        const response = await fetch('/api/shorts');
        
        if (!response.ok) {
          throw new Error('Ошибка загрузки треньков');
        }
        
        const data = await response.json();
        const shorts = data.shorts || [];
        setAllShorts(shorts);
        setDisplayedShorts(shorts.slice(0, ITEMS_PER_PAGE));
      } catch (error) {
        console.error('Error loading shorts:', error);
        setError('Не удалось загрузить треньки');
      } finally {
        setIsLoading(false);
      }
    };

    loadShorts();
  }, []);

  // Функция для загрузки следующей порции
  const loadMore = useCallback(() => {
    if (isLoadingMore || displayedShorts.length >= allShorts.length) return;

    setIsLoadingMore(true);
    
    // Без задержки - мгновенная загрузка
    const nextPage = page + 1;
    const newShorts = allShorts.slice(0, nextPage * ITEMS_PER_PAGE);
    setDisplayedShorts(newShorts);
    setPage(nextPage);
    setIsLoadingMore(false);
  }, [isLoadingMore, displayedShorts.length, allShorts, page]);

  // Intersection Observer для автозагрузки
  useEffect(() => {
    if (isLoading || displayedShorts.length >= allShorts.length) return;

    observerRef.current = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && !isLoadingMore) {
          loadMore();
        }
      },
      { threshold: 0.1 }
    );

    if (loadMoreRef.current) {
      observerRef.current.observe(loadMoreRef.current);
    }

    return () => {
      if (observerRef.current) {
        observerRef.current.disconnect();
      }
    };
  }, [isLoading, displayedShorts.length, allShorts.length, isLoadingMore, loadMore]);

  if (error) {
    return (
      <div className="min-h-screen bg-[#060919] flex flex-col items-center justify-center px-4">
        <div className="text-white text-xl mb-4">{error}</div>
        <Link href="/" className="text-[#445CFF] underline">
          Вернуться на главную
        </Link>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#060919] text-white pb-24">
      {/* Шапка */}
      <div
        className="px-4 pb-6 bg-gradient-to-b from-[#101530] to-[#060919]"
        style={{ paddingTop: 'calc(env(safe-area-inset-top, 0px) + 16px)' }}
      >
        <div className="flex items-center gap-2">
          <Link href="/" className="inline-block">
            <div className="w-10 h-10 flex items-center justify-center">
              <Image 
                src="/icons/icon-action-back.svg" 
                alt="Назад" 
                width={24} 
                height={24}
              />
            </div>
          </Link>
          <h1 
            className="text-white font-bold uppercase"
            style={{ 
              fontFamily: 'Overpass', 
              fontSize: '13px', 
              letterSpacing: '0.5px' 
            }}
          >
            Треньки {!isLoading && allShorts.length > 0 && (
              <span className="text-white/60 font-normal ml-1">({allShorts.length})</span>
            )}
          </h1>
        </div>
      </div>

      {/* Сетка шортсов */}
      <div className="px-0">
        {isLoading ? (
          // Skeleton loader
          <div className="grid grid-cols-3 gap-[1px]">
            {[...Array(12)].map((_, i) => (
              <div 
                key={i} 
                className="relative aspect-[9/16] bg-gray-800/50 animate-pulse"
              >
                <div className="absolute inset-0 bg-gradient-to-br from-gray-700/30 to-gray-800/30" />
              </div>
            ))}
          </div>
        ) : displayedShorts.length > 0 ? (
          <>
            <div className="grid grid-cols-3 gap-[1px]">
              {displayedShorts.map((short, index) => (
                <Link 
                  key={short.id} 
                  href={`/shorts?index=${index}`}
                  className="block animate-fadeIn"
                  style={{ 
                    animationDelay: `${Math.min(index * 30, 300)}ms`,
                    animationFillMode: 'both'
                  }}
                >
                  <div className="relative aspect-[9/16] bg-gray-800 overflow-hidden cursor-pointer hover:opacity-90 transition-opacity">
                    {/* Thumbnail */}
                    {short.thumbnail ? (
                      <Image 
                        src={short.thumbnail}
                        alt={short.title}
                        fill
                        className="object-cover"
                        sizes="33vw"
                        loading={index < 12 ? 'eager' : 'lazy'}
                      />
                    ) : (
                      <div className="w-full h-full bg-gradient-to-br from-[#445CFF] to-[#2d3e8f]" />
                    )}
                  </div>
                </Link>
              ))}
            </div>
            
            {/* Триггер для загрузки следующей порции */}
            {displayedShorts.length < allShorts.length && (
              <div ref={loadMoreRef} className="py-8 flex justify-center">
                {isLoadingMore && (
                  <div className="flex items-center gap-2">
                    <div className="w-6 h-6 border-2 border-[#445CFF] border-t-transparent rounded-full animate-spin" />
                    <span className="text-white/60 text-sm">Загрузка...</span>
                  </div>
                )}
              </div>
            )}
          </>
        ) : (
          <div className="text-center py-12">
            <div className="text-white/50 text-lg mb-2">Нет треньков</div>
            <div className="text-white/30 text-sm">Скоро здесь появятся новые видео</div>
          </div>
        )}
      </div>

      {/* Нижнее меню */}
      <BottomNavigation activeTab="shorts" />
    </div>
  );
}
