'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useState, useEffect } from 'react';

interface Trainer {
  id: string;
  name: string;
  lastName: string;
  speciality: string;
  experience: number;
  rating: number;
  avatar: string | null;
  description: string | null;
  videos: any[];
  shortVideosCount: number; // Тренеки (< 10 мин)
  longVideosCount: number;  // Тренировки (>= 10 мин)
}

const TrainersPage = () => {
  const [trainers, setTrainers] = useState<Trainer[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearchOpen, setIsSearchOpen] = useState(false);

  useEffect(() => {
    const fetchTrainers = async () => {
      try {
        const response = await fetch('/api/trainers');
        const data = await response.json();
        setTrainers(data.trainers || []);
      } catch (error) {
        console.error('Error loading trainers:', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchTrainers();
  }, []);

  // Фильтрация тренеров по поисковому запросу
  const filteredTrainers = trainers.filter((trainer) => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return (
      trainer.name.toLowerCase().includes(query) ||
      trainer.lastName.toLowerCase().includes(query) ||
      trainer.speciality.toLowerCase().includes(query)
    );
  });

  return (
    <div className="bg-[#101530] min-h-screen text-white">
      {/* Верхняя панель с кнопками */}
      <div
        className="px-4 pb-4"
        style={{ paddingTop: 'calc(env(safe-area-inset-top, 0px) + 16px)' }}
      >
        <div className="flex items-center gap-3 justify-between">
          {/* Кнопка назад */}
          <Link href="/" className="inline-block flex-shrink-0">
            <div className="w-12 h-12 flex items-center justify-center">
              <Image 
                src="/icons/icon-action-back.svg" 
                alt="Назад" 
                width={32} 
                height={32}
              />
            </div>
          </Link>

          {/* Поисковая строка */}
          <div className={`flex-1 transition-all duration-300 ease-in-out overflow-hidden ${
            isSearchOpen ? 'opacity-100 max-w-full' : 'opacity-0 max-w-0'
          }`}>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Поиск тренера..."
              className="w-full bg-[#060919] text-white px-4 py-3 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#445CFF] placeholder:text-[#AEABBB]"
              autoFocus={isSearchOpen}
            />
          </div>

          {/* Кнопка поиска */}
          <button 
            onClick={() => setIsSearchOpen(!isSearchOpen)}
            className="w-12 h-12 flex items-center justify-center hover:opacity-80 transition-opacity flex-shrink-0 ml-auto"
          >
            <Image 
              src="/icons/mingcute_search-line.svg" 
              alt="Поиск" 
              width={32} 
              height={32}
            />
          </button>
        </div>
      </div>

      {/* Контент страницы тренеров */}
      <div className="px-4 pb-4 flex flex-col gap-4">
        {isLoading ? (
          <div className="text-center py-8">
            <div className="text-[#AEABBB]">Загрузка тренеров...</div>
          </div>
        ) : filteredTrainers.length === 0 ? (
          <div className="text-center py-8">
            <div className="text-[#AEABBB]">
              {searchQuery ? 'Тренеры не найдены по запросу' : 'Тренеры не найдены'}
            </div>
          </div>
        ) : (
          filteredTrainers.map((trainer) => (
            <TrainerCard key={trainer.id} trainer={trainer} />
          ))
        )}
      </div>
    </div>
  );
};

const TrainerCard = ({ trainer }: { trainer: Trainer }) => {
  // Разделяем специальности по запятой или переносу строки
  const specialities = trainer.speciality.split(/[,\n]/).map(s => s.trim()).filter(Boolean);
  
  return (
    <Link href={`/trainers/${trainer.id}`}>
      <div className="w-full bg-[#060919] rounded-xl overflow-hidden hover:opacity-90 transition-opacity cursor-pointer">
        {/* Верхняя часть с аватаром и информацией */}
        <div className="flex p-4">
          {/* Аватар с рейтингом */}
          <div className="relative mr-4">
            <div className="w-24 h-24 rounded-lg overflow-hidden bg-gradient-to-b from-transparent to-blue-600/50">
              <Image 
                src={trainer.avatar || "/avatars/Avatar.png"}
                alt={`${trainer.name} ${trainer.lastName}`}
                width={96} 
                height={96} 
                className="w-full h-full object-cover"
              />
            </div>
            {/* Звезда с рейтингом */}
            <div className="absolute top-1 left-1 w-6 h-6 flex items-center justify-center">
              <Image 
                src="/icons/star-6.svg" 
                alt="Рейтинг" 
                width={24} 
                height={24}
                className="absolute"
              />
              <span className="relative z-10 text-[#060919] text-[10px] font-normal uppercase leading-[10px] tracking-[0.5px]">
                {trainer.rating.toFixed(1)}
              </span>
            </div>
          </div>
          
          {/* Информация о тренере */}
          <div className="flex-1">
            <div className="mb-3">
              <h2 className="text-[#445CFF] text-sm font-bold uppercase tracking-wide leading-tight">
                {trainer.name}
              </h2>
              <h2 className="text-[#445CFF] text-sm font-bold uppercase tracking-wide leading-tight">
                {trainer.lastName}
              </h2>
            </div>
            
            <div className="space-y-2">
              {specialities.map((spec, index) => (
                <div key={index} className="py-2 border-t border-[#101530]">
                  <span className="text-[#AEABBB] text-xs font-bold uppercase tracking-wide">
                    {spec}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
        
        {/* Статистика */}
        <div className="px-4 py-3 border-t border-b border-[#101530]">
          <div className="flex items-center justify-between">
            <div className="text-center">
              <div className="text-[#A1FF4A] text-sm font-bold">{trainer.experience}</div>
              <div className="text-white text-xs font-bold uppercase tracking-wide">ЛЕТ ОПЫТА</div>
            </div>
            <div className="w-px h-8 bg-[#101530]"></div>
            <div className="text-center">
              <div className="text-[#A1FF4A] text-sm font-bold">{trainer.shortVideosCount || 0}</div>
              <div className="text-white text-xs font-bold uppercase tracking-wide">ТРЕНЕК</div>
            </div>
            <div className="w-px h-8 bg-[#101530]"></div>
            <div className="text-center">
              <div className="text-[#A1FF4A] text-sm font-bold">{trainer.longVideosCount || 0}</div>
              <div className="text-white text-xs font-bold uppercase tracking-wide">ТРЕНИРОВОК</div>
            </div>
          </div>
        </div>
        
        {/* Дисклеймер */}
        {trainer.description && (
          <div className="p-4">
            <p className="text-[#AEABBB] text-xs leading-relaxed line-clamp-3">
              {trainer.description}
            </p>
          </div>
        )}
      </div>
    </Link>
  );
};

export default TrainersPage;
