'use client';

import { useState, useEffect } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useTelegram } from '@/hooks/useTelegram';

interface Video {
  id: string;
  title: string;
  description: string | null;
  duration: number;
  videoUrl: string;
  thumbnail: string | null;
  category: string;
  difficulty: string;
}

interface Trainer {
  id: string;
  name: string;
  lastName: string;
  speciality: string;
  experience: number;
  rating: number;
  avatar: string | null;
  description: string | null;
  videos: Video[];
}

interface Stats {
  videosCount: number;
  trainingSessions: number;
  experience: number;
}

export default function TrainerPage() {
  const { id } = useParams();
  const [trainer, setTrainer] = useState<Trainer | null>(null);
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Инициализируем Telegram WebApp
  useTelegram();

  useEffect(() => {
    const fetchTrainer = async () => {
      try {
        const response = await fetch(`/api/trainers/${id}`);
        
        if (!response.ok) {
          throw new Error('Не удалось загрузить данные тренера');
        }
        
        const data = await response.json();
        setTrainer(data.trainer);
        setStats(data.stats);
      } catch (err) {
        console.error('Ошибка при загрузке данных тренера:', err);
        setError('Не удалось загрузить данные тренера');
      } finally {
        setLoading(false);
      }
    };

    if (id) {
      fetchTrainer();
    }
  }, [id]);

  if (loading) {
    return (
      <div className="bg-[#101530] min-h-screen text-white flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white mx-auto mb-4"></div>
          <p className="text-sm font-overpass">Загрузка...</p>
        </div>
      </div>
    );
  }

  if (error || !trainer) {
    return (
      <div className="bg-[#101530] min-h-screen text-white p-4 pt-[100px]">
        <Link href="/trainers" className="inline-block mb-4">
          <div className="w-8 h-8 flex items-center justify-center">
            <Image 
              src="/icons/arrow.svg" 
              alt="Назад" 
              width={16} 
              height={16}
              style={{ transform: 'rotate(180deg)' }}
            />
          </div>
        </Link>
        <div className="text-center mt-8">
          <p className="text-[#AEABBB]">Тренер не найден или произошла ошибка при загрузке данных</p>
          <Link href="/trainers" className="mt-4 inline-block text-[#445CFF]">
            Вернуться к списку тренеров
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-[#101530] min-h-screen text-white pb-16">
      {/* Верхняя навигация */}
      <div className="p-4 pt-[100px] flex items-center">
        <Link href="/trainers" className="inline-block">
          <div className="w-8 h-8 flex items-center justify-center">
            <Image 
              src="/icons/arrow.svg" 
              alt="Назад" 
              width={16} 
              height={16}
              style={{ transform: 'rotate(180deg)' }}
            />
          </div>
        </Link>
        <h1 className="text-lg font-bold text-center flex-1 pr-8">Тренер</h1>
      </div>

      {/* Основная информация о тренере */}
      <div className="px-4 py-2">
        <div className="bg-[#060919] rounded-xl overflow-hidden">
          {/* Верхняя часть с аватаром и информацией */}
          <div className="flex p-4">
            {/* Аватар с рейтингом */}
            <div className="relative mr-4">
              <div className="w-24 h-24 rounded-lg overflow-hidden bg-gradient-to-b from-transparent to-blue-600/50">
                <Image 
                  src={trainer.avatar || "/avatars/af9e5de293f8ce1c351f480e9af666a6453ed701.png"}
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
                <span className="relative z-10 text-[#A1FF4A] text-xs font-bold">{trainer.rating}</span>
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
                <div className="py-2 border-t border-[#101530]">
                  <span className="text-[#AEABBB] text-xs font-bold uppercase tracking-wide">
                    {trainer.speciality}
                  </span>
                </div>
              </div>
            </div>
          </div>
          
          {/* Статистика */}
          <div className="px-4 py-3 border-t border-b border-[#101530]">
            <div className="flex items-center justify-between">
              <div className="text-center">
                <div className="text-[#A1FF4A] text-sm font-bold">{stats?.experience || trainer.experience}</div>
                <div className="text-white text-xs font-bold uppercase tracking-wide">ЛЕТ ОПЫТА</div>
              </div>
              <div className="w-px h-8 bg-[#101530]"></div>
              <div className="text-center">
                <div className="text-[#A1FF4A] text-sm font-bold">{stats?.videosCount || 0}</div>
                <div className="text-white text-xs font-bold uppercase tracking-wide">ТРЕНЕК</div>
              </div>
              <div className="w-px h-8 bg-[#101530]"></div>
              <div className="text-center">
                <div className="text-[#A1FF4A] text-sm font-bold">{stats?.trainingSessions || 0}</div>
                <div className="text-white text-xs font-bold uppercase tracking-wide">ТРЕНИРОВОК</div>
              </div>
            </div>
          </div>
          
          {/* Описание тренера */}
          {trainer.description && (
            <div className="p-4">
              <p className="text-[#AEABBB] text-xs leading-relaxed">
                {trainer.description}
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Список видео тренера */}
      <div className="px-4 py-4">
        <h2 className="text-lg font-bold mb-4">Видео тренера</h2>
        {trainer.videos.length > 0 ? (
          <div className="space-y-4">
            {trainer.videos.map((video) => (
              <Link href={`/video/${video.id}`} key={video.id}>
                <div className="bg-[#060919] rounded-lg overflow-hidden flex">
                  <div className="w-24 h-16 relative">
                    <Image 
                      src={video.thumbnail || "/images/video_prew_2.png"} 
                      alt={video.title} 
                      fill
                      className="object-cover"
                    />
                    <div className="absolute inset-0 flex items-center justify-center">
                      <div className="w-8 h-8 rounded-full bg-[#445CFF]/80 flex items-center justify-center">
                        <div className="w-0 h-0 border-t-4 border-t-transparent border-l-8 border-l-white border-b-4 border-b-transparent ml-1"></div>
                      </div>
                    </div>
                    <div className="absolute bottom-1 right-1 text-xs text-white bg-black/60 px-1 rounded">
                      {Math.floor(video.duration / 60)}:{(video.duration % 60).toString().padStart(2, '0')}
                    </div>
                  </div>
                  <div className="p-2 flex-1">
                    <h3 className="text-sm font-medium line-clamp-2">{video.title}</h3>
                    <div className="flex items-center mt-1">
                      <span className="text-xs text-[#AEABBB] uppercase">{video.category}</span>
                      <span className="mx-2 text-[#AEABBB]">•</span>
                      <span className="text-xs text-[#AEABBB] uppercase">{video.difficulty}</span>
                    </div>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        ) : (
          <div className="text-center py-8 text-[#AEABBB]">
            <p>У этого тренера пока нет видео</p>
          </div>
        )}
      </div>

      {/* Кнопка "Связаться с тренером" */}
      <div className="fixed bottom-6 left-0 right-0 px-4">
        <button 
          className="w-full bg-[#445CFF] text-white py-3 rounded-lg font-bold uppercase text-sm tracking-wide"
          onClick={() => alert('Функционал связи с тренером будет доступен в будущих обновлениях')}
        >
          Связаться с тренером
        </button>
      </div>
    </div>
  );
}